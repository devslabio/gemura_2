import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User, MccSourceResolutionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MccAccessScopeService } from '../mcc-operations/mcc-access-scope.service';

function dayBoundsUtc(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new BadRequestException({ code: 400, status: 'error', message: 'Invalid date. Use YYYY-MM-DD.' });
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function decN(v: { toString(): string } | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class MccManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mccScope: MccAccessScopeService,
  ) {}

  private async resolveAccountId(user: User, accountIdParam?: string): Promise<string> {
    const accountId = accountIdParam || user.default_account_id;
    if (!accountId) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'account_id is required.',
      });
    }
    const access = await this.prisma.userAccount.findFirst({
      where: { user_id: user.id, account_id: accountId, status: 'active' },
      include: { account: true },
    });
    if (!access?.account || access.account.status !== 'active') {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Account not found or access denied.',
      });
    }
    return accountId;
  }

  async getManagerOverview(user: User, accountIdParam: string | undefined, dateStr: string) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    const { start, end } = dayBoundsUtc(dateStr);
    const scope = await this.mccScope.resolveViewScope(user.id, accountId);

    const deliveries = await this.prisma.mccGateDelivery.findMany({
      where: {
        mcc_account_id: accountId,
        arrived_at: { gte: start, lt: end },
        ...(scope.mode === 'scoped' ? { source_account_id: scope.supplierAccountId } : {}),
      },
      include: {
        source_account: { select: { id: true, name: true, code: true } },
        manifest: {
          include: {
            lines: true,
            umucunda_supplier: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { arrived_at: 'desc' },
    });

    let directLitres = 0;
    let umucundaLitres = 0;
    for (const d of deliveries) {
      const vol = decN(d.gate_volume_litres);
      if (d.source_type === 'direct') directLitres += vol;
      else umucundaLitres += vol;
    }

    const manifests = deliveries
      .filter((d) => d.manifest)
      .map((d) => {
        const m = d.manifest!;
        const expected = m.lines.reduce((s, l) => s + decN(l.declared_litres), 0) || decN(d.gate_volume_litres);
        const submitted = m.status === 'submitted' || m.status === 'accepted' || !!m.submitted_at;
        const paymentHold = this.manifestPaymentHold(m.status, d.source_type, m.submitted_at, d.arrived_at);
        const routeMeta = (m.route_metadata as Record<string, unknown> | null)?.label;
        const routeLabel =
          (typeof routeMeta === 'string' && routeMeta) ||
          m.umucunda_supplier?.name ||
          m.umucunda_supplier?.code ||
          m.manifest_ref;
        return {
          id: m.id,
          manifest_ref: m.manifest_ref,
          gate_delivery_id: d.id,
          route_label: routeLabel,
          expected_litres: Math.round(expected * 10) / 10,
          status: m.status,
          submitted,
          submitted_at: m.submitted_at?.toISOString() ?? null,
          payment_hold: paymentHold,
          umucunda_name: m.umucunda_supplier?.name ?? m.umucunda_supplier?.code ?? null,
        };
      });

    // Umucunda gate arrivals today without manifest row (compliance gap)
    const umucundaWithoutManifest = deliveries.filter(
      (d) => d.source_type !== 'direct' && !d.manifest,
    );
    for (const d of umucundaWithoutManifest) {
      manifests.push({
        id: `pending-${d.id}`,
        manifest_ref: '—',
        gate_delivery_id: d.id,
        route_label: d.source_account.name || d.source_account.code || 'Umucunda delivery',
        expected_litres: Math.round(decN(d.gate_volume_litres) * 10) / 10,
        status: 'draft',
        submitted: false,
        submitted_at: null,
        payment_hold: true,
        umucunda_name: d.source_account.name || d.source_account.code || null,
      });
    }

    const gateFilter =
      scope.mode === 'scoped'
        ? { mcc_account_id: accountId, source_account_id: scope.supplierAccountId }
        : { mcc_account_id: accountId };

    const rejections = await this.prisma.mccMilkTestResult.findMany({
      where: {
        outcome: 'rejected',
        tested_at: { gte: start, lt: end },
        gate_delivery: gateFilter,
      },
      include: {
        gate_delivery: {
          include: { source_account: { select: { id: true, name: true, code: true } }, manifest: true },
        },
        manifest_line: {
          include: { farmer_supplier: { select: { name: true, code: true } } },
        },
      },
      orderBy: { tested_at: 'desc' },
    });

    const rejectionRows = rejections.map((r) => {
      const farms =
        r.manifest_line?.farmer_supplier?.name ||
        r.manifest_line?.farmer_supplier?.code ||
        (r.gate_delivery.source_type === 'direct'
          ? r.gate_delivery.source_account.name || r.gate_delivery.source_account.code
          : 'Multiple (manifest batch)');
      const status = r.source_resolution_status ?? 'unresolved';
      return {
        test_result_id: r.id,
        gate_delivery_id: r.mcc_gate_delivery_id,
        source_label:
          r.gate_delivery.source_account.name ||
          r.gate_delivery.source_account.code ||
          r.gate_delivery.source_type,
        source_type: r.gate_delivery.source_type,
        volume_litres: decN(r.gate_delivery.gate_volume_litres),
        rejection_cause: r.rejection_cause ?? '—',
        farms_summary: farms,
        resolution_status: status,
        tested_at: r.tested_at.toISOString(),
      };
    });

    const staffRoles = ['casual_laborer', 'collector', 'agent'];
    const staffAccounts =
      scope.mode === 'scoped'
        ? []
        : await this.prisma.userAccount.findMany({
            where: {
              account_id: accountId,
              status: 'active',
              role: { in: staffRoles },
            },
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          });

    const openShifts =
      scope.mode === 'scoped'
        ? await this.prisma.mccStaffShift.findMany({
            where: { mcc_account_id: accountId, ended_at: null, user_id: user.id },
            select: { user_id: true, started_at: true, role_label_snapshot: true },
          })
        : await this.prisma.mccStaffShift.findMany({
            where: { mcc_account_id: accountId, ended_at: null },
            select: { user_id: true, started_at: true, role_label_snapshot: true },
          });
    const shiftByUserId = new Map(openShifts.map((s) => [s.user_id, s]));

    const staffFromUa = await Promise.all(
      staffAccounts.map(async (ua) => {
        const tasksDone = await this.prisma.milkSale.count({
          where: {
            customer_account_id: accountId,
            recorded_by: ua.user_id,
            sale_at: { gte: start, lt: end },
            status: { notIn: ['deleted', 'cancelled'] },
          },
        });
        const shift = shiftByUserId.get(ua.user_id);
        return {
          user_account_id: ua.id,
          user_id: ua.user_id,
          name: ua.user.name || ua.user.phone || 'Staff',
          role: ua.role,
          on_duty: !!shift,
          shift_started_at: shift?.started_at.toISOString() ?? null,
          tasks_done: tasksDone,
        };
      }),
    );

    const uaUserIds = new Set(staffAccounts.map((u) => u.user_id));
    const extraFromShifts = openShifts
      .filter((s) => !uaUserIds.has(s.user_id))
      .map((s) => s.user_id);
    const extraUsers =
      extraFromShifts.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: extraFromShifts } },
            select: { id: true, name: true, phone: true },
          })
        : [];
    const extraRows = await Promise.all(
      extraUsers.map(async (u) => {
        const shift = shiftByUserId.get(u.id);
        const tasksDone = await this.prisma.milkSale.count({
          where: {
            customer_account_id: accountId,
            recorded_by: u.id,
            sale_at: { gte: start, lt: end },
            status: { notIn: ['deleted', 'cancelled'] },
          },
        });
        return {
          user_account_id: `shift-only-${u.id}`,
          user_id: u.id,
          name: u.name || u.phone || 'Staff',
          role: shift?.role_label_snapshot || 'on_shift',
          on_duty: true,
          shift_started_at: shift?.started_at.toISOString() ?? null,
          tasks_done: tasksDone,
        };
      }),
    );

    const staff = scope.mode === 'scoped' ? [] : [...staffFromUa, ...extraRows];

    return {
      code: 200,
      status: 'success',
      message: 'MCC manager overview',
      data: {
        date: dateStr,
        gate: {
          direct_litres: Math.round(directLitres * 10) / 10,
          umucunda_litres: Math.round(umucundaLitres * 10) / 10,
          total_litres: Math.round((directLitres + umucundaLitres) * 10) / 10,
          delivery_count: deliveries.length,
        },
        manifests,
        rejections: rejectionRows,
        staff,
      },
    };
  }

  private manifestPaymentHold(
    manifestStatus: string,
    sourceType: string,
    submittedAt: Date | null,
    arrivedAt: Date,
  ): boolean {
    if (manifestStatus === 'accepted') return false;
    if (manifestStatus === 'rejected') return true;
    const hoursSince = (Date.now() - arrivedAt.getTime()) / 3600000;
    if (sourceType !== 'direct' && !submittedAt && hoursSince > 2) return true;
    if (manifestStatus === 'draft' || manifestStatus === 'submitted') return true;
    return false;
  }

  async approveTestResolution(
    user: User,
    accountIdParam: string | undefined,
    testResultId: string,
    status: MccSourceResolutionStatus,
  ) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    if (status !== 'resolved' && status !== 'secondary_test' && status !== 'frozen') {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid resolution status.',
      });
    }

    const row = await this.prisma.mccMilkTestResult.findFirst({
      where: { id: testResultId },
      include: { gate_delivery: true },
    });
    if (!row) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Test result not found.' });
    }
    if (row.gate_delivery.mcc_account_id !== accountId) {
      throw new ForbiddenException({ code: 403, status: 'error', message: 'Not allowed for this account.' });
    }
    if (row.outcome !== 'rejected') {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Only rejected tests can carry traceability resolution updates.',
      });
    }

    await this.prisma.mccMilkTestResult.update({
      where: { id: testResultId },
      data: { source_resolution_status: status },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Resolution updated.',
      data: { test_result_id: testResultId, source_resolution_status: status },
    };
  }
}
