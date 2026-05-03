import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MccMilkManifestStatus, User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGateDeliveryDto } from './dto/create-gate-delivery.dto';
import { CreateManifestDto } from './dto/create-manifest.dto';
import { CreateTestResultDto } from './dto/create-test-result.dto';
import { RejectManifestDto } from './dto/reject-manifest.dto';
import { StartShiftDto } from './dto/start-shift.dto';
import { UpdateManifestDraftDto } from './dto/update-manifest-draft.dto';
import { UpdateTestResultDto } from './dto/update-test-result.dto';

function dayBoundsUtc(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new BadRequestException({ code: 400, status: 'error', message: 'Invalid date. Use YYYY-MM-DD.' });
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function defaultRangeDays(days: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

@Injectable()
export class MccOperationsService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async assertSupplierDeliversToMcc(mccAccountId: string, supplierAccountId: string): Promise<void> {
    const link = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccountId,
        customer_account_id: mccAccountId,
        relationship_status: 'active',
      },
    });
    if (!link) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Source account is not an active supplier for this MCC.',
      });
    }
  }

  private async getCallerRoleOnAccount(userId: string, accountId: string): Promise<string | null> {
    const ua = await this.prisma.userAccount.findFirst({
      where: { user_id: userId, account_id: accountId, status: 'active' },
      select: { role: true },
    });
    return ua?.role ? String(ua.role).toLowerCase() : null;
  }

  private async assertCanStartShiftForOther(actor: User, mccAccountId: string, targetUserId: string): Promise<void> {
    if (actor.id === targetUserId) return;
    const role = await this.getCallerRoleOnAccount(actor.id, mccAccountId);
    const allowed = role && ['manager', 'system_admin', 'admin', 'owner'].includes(role);
    if (!allowed) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'Only a manager (or admin role) can start a shift for another user.',
      });
    }
  }

  private async assertCanEndShiftForOther(actor: User, mccAccountId: string, shiftUserId: string): Promise<void> {
    if (actor.id === shiftUserId) return;
    const role = await this.getCallerRoleOnAccount(actor.id, mccAccountId);
    const allowed = role && ['manager', 'system_admin', 'admin', 'owner'].includes(role);
    if (!allowed) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: "Only a manager (or admin role) can end another user's shift.",
      });
    }
  }

  async listGateDeliveries(user: User, accountIdParam: string | undefined, from?: string, to?: string) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    let start: Date;
    let end: Date;
    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      start = dayBoundsUtc(from).start;
      end = dayBoundsUtc(to).end;
      if (end <= start) {
        throw new BadRequestException({ code: 400, status: 'error', message: '`to` must be after `from`.' });
      }
    } else {
      const r = defaultRangeDays(14);
      start = r.start;
      end = r.end;
    }

    const rows = await this.prisma.mccGateDelivery.findMany({
      where: { mcc_account_id: accountId, arrived_at: { gte: start, lt: end } },
      include: {
        source_account: { select: { id: true, name: true, code: true } },
        recorded_by: { select: { id: true, name: true } },
        manifest: { select: { id: true, manifest_ref: true, status: true } },
        linked_milk_sale: { select: { id: true } },
      },
      orderBy: { arrived_at: 'desc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Gate deliveries',
      data: rows.map((d) => ({
        id: d.id,
        source_type: d.source_type,
        gate_volume_litres: d.gate_volume_litres.toString(),
        arrived_at: d.arrived_at.toISOString(),
        notes: d.notes,
        source_account: d.source_account,
        recorded_by: d.recorded_by,
        manifest: d.manifest,
        linked_collection_id: d.linked_milk_sale?.id ?? null,
      })),
    };
  }

  async createGateDelivery(user: User, dto: CreateGateDeliveryDto) {
    const accountId = await this.resolveAccountId(user, dto.account_id);
    await this.assertSupplierDeliversToMcc(accountId, dto.source_account_id);

    const arrivedAt = dto.arrived_at ? new Date(dto.arrived_at) : new Date();
    if (Number.isNaN(arrivedAt.getTime())) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'Invalid arrived_at.' });
    }

    const row = await this.prisma.mccGateDelivery.create({
      data: {
        mcc_account_id: accountId,
        source_type: dto.source_type,
        source_account_id: dto.source_account_id,
        gate_volume_litres: dto.gate_volume_litres,
        arrived_at: arrivedAt,
        recorded_by_user_id: user.id,
        notes: dto.notes ?? null,
      },
      include: {
        source_account: { select: { id: true, name: true, code: true } },
        manifest: { select: { id: true, manifest_ref: true, status: true } },
      },
    });

    return {
      code: 201,
      status: 'success',
      message: 'Gate delivery recorded.',
      data: {
        id: row.id,
        source_type: row.source_type,
        gate_volume_litres: row.gate_volume_litres.toString(),
        arrived_at: row.arrived_at.toISOString(),
        source_account: row.source_account,
        manifest: row.manifest,
      },
    };
  }

  async listManifests(user: User, accountIdParam: string | undefined, from?: string, to?: string) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    let start: Date;
    let end: Date;
    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      start = dayBoundsUtc(from).start;
      end = dayBoundsUtc(to).end;
    } else {
      const r = defaultRangeDays(14);
      start = r.start;
      end = r.end;
    }

    const rows = await this.prisma.mccMilkManifest.findMany({
      where: {
        mcc_account_id: accountId,
        gate_delivery: { arrived_at: { gte: start, lt: end } },
      },
      include: {
        gate_delivery: {
          select: { id: true, arrived_at: true, gate_volume_litres: true, source_type: true },
        },
        umucunda_supplier: { select: { id: true, name: true, code: true } },
        lines: {
          include: {
            farmer_supplier: { select: { id: true, name: true, code: true } },
            linked_collection: { select: { id: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Manifests',
      data: rows.map((m) => ({
        id: m.id,
        manifest_ref: m.manifest_ref,
        status: m.status,
        submitted_at: m.submitted_at?.toISOString() ?? null,
        accepted_at: m.accepted_at?.toISOString() ?? null,
        rejected_at: m.rejected_at?.toISOString() ?? null,
        rejection_reason: m.rejection_reason,
        gate_delivery: m.gate_delivery,
        umucunda_supplier: m.umucunda_supplier,
        lines: m.lines.map((l) => ({
          id: l.id,
          declared_litres: l.declared_litres.toString(),
          container_id: l.container_id,
          farmer_supplier: l.farmer_supplier,
          linked_collection_id: l.linked_collection?.id ?? null,
        })),
      })),
    };
  }

  async createManifest(user: User, dto: CreateManifestDto) {
    const accountId = await this.resolveAccountId(user, dto.account_id);
    if (!dto.lines?.length) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'At least one manifest line is required.' });
    }

    const gate = await this.prisma.mccGateDelivery.findFirst({
      where: { id: dto.gate_delivery_id, mcc_account_id: accountId },
    });
    if (!gate) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Gate delivery not found.' });
    }
    if (gate.source_type === 'direct') {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Manifests apply to Umucunda gate deliveries only.',
      });
    }
    if (dto.umucunda_supplier_account_id !== gate.source_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Umucunda supplier must match the gate delivery source account.',
      });
    }

    const existing = await this.prisma.mccMilkManifest.findUnique({
      where: { gate_delivery_id: gate.id },
    });
    if (existing) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'This gate delivery already has a manifest.',
      });
    }

    await this.assertSupplierDeliversToMcc(accountId, dto.umucunda_supplier_account_id);
    for (const line of dto.lines) {
      await this.assertSupplierDeliversToMcc(accountId, line.farmer_supplier_account_id);
    }

    const manifestRef = `MAN-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    const created = await this.prisma.$transaction(async (tx) => {
      const m = await tx.mccMilkManifest.create({
        data: {
          gate_delivery_id: gate.id,
          mcc_account_id: accountId,
          umucunda_supplier_account_id: dto.umucunda_supplier_account_id,
          manifest_ref: manifestRef,
          status: MccMilkManifestStatus.draft,
        },
      });
      await tx.mccManifestLine.createMany({
        data: dto.lines.map((l) => ({
          manifest_id: m.id,
          farmer_supplier_account_id: l.farmer_supplier_account_id,
          declared_litres: l.declared_litres,
          container_id: l.container_id ?? null,
        })),
      });
      return m.id;
    });

    return this.getManifestById(user, accountId, created);
  }

  async getManifestById(user: User, accountIdResolved: string, manifestId: string) {
    await this.resolveAccountId(user, accountIdResolved);
    const m = await this.prisma.mccMilkManifest.findFirst({
      where: { id: manifestId, mcc_account_id: accountIdResolved },
      include: {
        gate_delivery: { select: { id: true, arrived_at: true, gate_volume_litres: true, source_type: true } },
        umucunda_supplier: { select: { id: true, name: true, code: true } },
        lines: {
          include: {
            farmer_supplier: { select: { id: true, name: true, code: true } },
            linked_collection: { select: { id: true } },
          },
        },
      },
    });
    if (!m) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Manifest not found.' });
    }
    return {
      code: 200,
      status: 'success',
      message: 'Manifest',
      data: {
        id: m.id,
        manifest_ref: m.manifest_ref,
        status: m.status,
        submitted_at: m.submitted_at?.toISOString() ?? null,
        accepted_at: m.accepted_at?.toISOString() ?? null,
        rejected_at: m.rejected_at?.toISOString() ?? null,
        rejection_reason: m.rejection_reason,
        gate_delivery: m.gate_delivery,
        umucunda_supplier: m.umucunda_supplier,
        lines: m.lines.map((l) => ({
          id: l.id,
          declared_litres: l.declared_litres.toString(),
          container_id: l.container_id,
          farmer_supplier: l.farmer_supplier,
          linked_collection_id: l.linked_collection?.id ?? null,
        })),
      },
    };
  }

  async updateManifestDraft(user: User, manifestId: string, dto: UpdateManifestDraftDto) {
    const accountId = await this.resolveAccountId(user, dto.account_id);
    const m = await this.prisma.mccMilkManifest.findFirst({
      where: { id: manifestId, mcc_account_id: accountId },
    });
    if (!m) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Manifest not found.' });
    }
    if (m.status !== MccMilkManifestStatus.draft) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Only draft manifests can be edited.',
      });
    }
    if (dto.lines) {
      if (!dto.lines.length) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'lines cannot be empty.' });
      }
      for (const line of dto.lines) {
        await this.assertSupplierDeliversToMcc(accountId, line.farmer_supplier_account_id);
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.mccManifestLine.deleteMany({ where: { manifest_id: manifestId } });
        await tx.mccManifestLine.createMany({
          data: dto.lines!.map((l) => ({
            manifest_id: manifestId,
            farmer_supplier_account_id: l.farmer_supplier_account_id,
            declared_litres: l.declared_litres,
            container_id: l.container_id ?? null,
          })),
        });
      });
    }
    return this.getManifestById(user, accountId, manifestId);
  }

  async submitManifest(user: User, manifestId: string, accountIdParam?: string) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    const m = await this.prisma.mccMilkManifest.findFirst({
      where: { id: manifestId, mcc_account_id: accountId },
      include: { lines: true },
    });
    if (!m) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Manifest not found.' });
    }
    if (m.status !== MccMilkManifestStatus.draft) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'Only draft manifests can be submitted.' });
    }
    if (!m.lines.length) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'Add lines before submitting.' });
    }
    await this.prisma.mccMilkManifest.update({
      where: { id: manifestId },
      data: { status: MccMilkManifestStatus.submitted, submitted_at: new Date() },
    });
    return this.getManifestById(user, accountId, manifestId);
  }

  async acceptManifest(user: User, manifestId: string, accountIdParam?: string) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    const m = await this.prisma.mccMilkManifest.findFirst({
      where: { id: manifestId, mcc_account_id: accountId },
    });
    if (!m) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Manifest not found.' });
    }
    if (m.status !== MccMilkManifestStatus.submitted) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Only submitted manifests can be accepted.',
      });
    }
    await this.prisma.mccMilkManifest.update({
      where: { id: manifestId },
      data: { status: MccMilkManifestStatus.accepted, accepted_at: new Date() },
    });
    return this.getManifestById(user, accountId, manifestId);
  }

  async rejectManifest(user: User, manifestId: string, dto: RejectManifestDto) {
    const accountId = await this.resolveAccountId(user, dto.account_id);
    const m = await this.prisma.mccMilkManifest.findFirst({
      where: { id: manifestId, mcc_account_id: accountId },
    });
    if (!m) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Manifest not found.' });
    }
    if (m.status !== MccMilkManifestStatus.draft && m.status !== MccMilkManifestStatus.submitted) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Only draft or submitted manifests can be rejected.',
      });
    }
    await this.prisma.mccMilkManifest.update({
      where: { id: manifestId },
      data: {
        status: MccMilkManifestStatus.rejected,
        rejected_at: new Date(),
        rejection_reason: dto.rejection_reason,
      },
    });
    return this.getManifestById(user, accountId, manifestId);
  }

  async listTestResults(
    user: User,
    accountIdParam: string | undefined,
    outcome?: string,
    from?: string,
    to?: string,
  ) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    let start: Date;
    let end: Date;
    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      start = dayBoundsUtc(from).start;
      end = dayBoundsUtc(to).end;
    } else {
      const r = defaultRangeDays(30);
      start = r.start;
      end = r.end;
    }

    const where: {
      tested_at: { gte: Date; lt: Date };
      gate_delivery: { mcc_account_id: string };
      outcome?: 'pending' | 'accepted' | 'rejected';
    } = {
      tested_at: { gte: start, lt: end },
      gate_delivery: { mcc_account_id: accountId },
    };
    if (outcome === 'pending' || outcome === 'accepted' || outcome === 'rejected') {
      where.outcome = outcome;
    }

    const rows = await this.prisma.mccMilkTestResult.findMany({
      where,
      include: {
        gate_delivery: {
          include: { source_account: { select: { id: true, name: true, code: true } } },
        },
        manifest_line: {
          include: { farmer_supplier: { select: { id: true, name: true, code: true } } },
        },
        tester: { select: { id: true, name: true } },
      },
      orderBy: { tested_at: 'desc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Milk test results',
      data: rows.map((r) => ({
        id: r.id,
        mcc_gate_delivery_id: r.mcc_gate_delivery_id,
        manifest_line_id: r.manifest_line_id,
        outcome: r.outcome,
        rejection_cause: r.rejection_cause,
        source_resolution_status: r.source_resolution_status,
        tested_at: r.tested_at.toISOString(),
        gate_delivery: r.gate_delivery,
        manifest_line: r.manifest_line,
        tester: r.tester,
      })),
    };
  }

  async createTestResult(user: User, dto: CreateTestResultDto) {
    const accountId = await this.resolveAccountId(user, dto.account_id);
    const gate = await this.prisma.mccGateDelivery.findFirst({
      where: { id: dto.mcc_gate_delivery_id, mcc_account_id: accountId },
    });
    if (!gate) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Gate delivery not found.' });
    }
    if (dto.manifest_line_id) {
      const line = await this.prisma.mccManifestLine.findFirst({
        where: { id: dto.manifest_line_id },
        include: { manifest: true },
      });
      if (!line || line.manifest.gate_delivery_id !== gate.id) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Manifest line does not belong to this gate delivery.',
        });
      }
    }

    const row = await this.prisma.mccMilkTestResult.create({
      data: {
        mcc_gate_delivery_id: gate.id,
        manifest_line_id: dto.manifest_line_id ?? null,
        outcome: dto.outcome,
        rejection_cause: dto.rejection_cause ?? null,
        tested_by_user_id: user.id,
      },
    });

    return {
      code: 201,
      status: 'success',
      message: 'Test result recorded.',
      data: { id: row.id },
    };
  }

  async updateTestResult(user: User, testResultId: string, dto: UpdateTestResultDto) {
    const accountId = await this.resolveAccountId(user, dto.account_id);
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

    await this.prisma.mccMilkTestResult.update({
      where: { id: testResultId },
      data: {
        outcome: dto.outcome,
        rejection_cause: dto.rejection_cause ?? null,
      },
    });

    return { code: 200, status: 'success', message: 'Test result updated.', data: { id: testResultId } };
  }

  async listShifts(user: User, accountIdParam: string | undefined, from?: string, to?: string) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    let start: Date;
    let end: Date;
    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      start = dayBoundsUtc(from).start;
      end = dayBoundsUtc(to).end;
    } else {
      const r = defaultRangeDays(14);
      start = r.start;
      end = r.end;
    }

    const rows = await this.prisma.mccStaffShift.findMany({
      where: {
        mcc_account_id: accountId,
        started_at: { lt: end },
        OR: [{ ended_at: null }, { ended_at: { gt: start } }],
      },
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: { started_at: 'desc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Staff shifts',
      data: rows.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        user: s.user,
        started_at: s.started_at.toISOString(),
        ended_at: s.ended_at?.toISOString() ?? null,
        role_label_snapshot: s.role_label_snapshot,
        notes: s.notes,
        open: s.ended_at === null,
      })),
    };
  }

  async staffOptions(user: User, accountIdParam?: string) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    const uas = await this.prisma.userAccount.findMany({
      where: { account_id: accountId, status: 'active' },
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: { role: 'asc' },
    });
    return {
      code: 200,
      status: 'success',
      message: 'Staff on this account',
      data: uas.map((ua) => ({
        user_account_id: ua.id,
        user_id: ua.user_id,
        name: ua.user.name || ua.user.phone || 'User',
        phone: ua.user.phone,
        role: ua.role,
        status: ua.status,
      })),
    };
  }

  async startShift(user: User, dto: StartShiftDto) {
    const accountId = await this.resolveAccountId(user, dto.account_id);
    const targetUserId = dto.user_id ?? user.id;
    await this.assertCanStartShiftForOther(user, accountId, targetUserId);

    const targetUa = await this.prisma.userAccount.findFirst({
      where: { user_id: targetUserId, account_id: accountId, status: 'active' },
    });
    if (!targetUa) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Target user is not assigned to this MCC.',
      });
    }

    const open = await this.prisma.mccStaffShift.findFirst({
      where: { mcc_account_id: accountId, user_id: targetUserId, ended_at: null },
    });
    if (open) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'User already has an open shift for this MCC.',
      });
    }

    const roleSnap = dto.role_label_snapshot ?? targetUa.role ?? undefined;
    const row = await this.prisma.mccStaffShift.create({
      data: {
        mcc_account_id: accountId,
        user_id: targetUserId,
        role_label_snapshot: roleSnap ?? null,
        notes: dto.notes ?? null,
      },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });

    return {
      code: 201,
      status: 'success',
      message: 'Shift started.',
      data: {
        id: row.id,
        user_id: row.user_id,
        user: row.user,
        started_at: row.started_at.toISOString(),
        ended_at: null,
        role_label_snapshot: row.role_label_snapshot,
        notes: row.notes,
        open: true,
      },
    };
  }

  async endShift(user: User, shiftId: string, accountIdParam?: string) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    const shift = await this.prisma.mccStaffShift.findFirst({
      where: { id: shiftId, mcc_account_id: accountId },
    });
    if (!shift) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Shift not found.' });
    }
    if (shift.ended_at) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'Shift is already closed.' });
    }
    await this.assertCanEndShiftForOther(user, accountId, shift.user_id);

    await this.prisma.mccStaffShift.update({
      where: { id: shiftId },
      data: { ended_at: new Date() },
    });

    return { code: 200, status: 'success', message: 'Shift ended.', data: { id: shiftId } };
  }
}
