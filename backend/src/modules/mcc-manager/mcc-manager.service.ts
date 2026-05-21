import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User, MccSourceResolutionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminService } from '../admin/admin.service';
import { MccAccessScopeService } from '../mcc-operations/mcc-access-scope.service';
import { computeOnboardingProfileCompletion } from './mcc-onboarding-profile.util';

function dayBoundsUtc(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new BadRequestException({ code: 400, status: 'error', message: 'Invalid date. Use YYYY-MM-DD.' });
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function monthBoundsUtc(dateStr: string): { start: Date; end: Date } {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ code: 400, status: 'error', message: 'Invalid date. Use YYYY-MM-DD.' });
  }
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end };
}

function isoDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTrendLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

function followUpStatus(resolution: string): string {
  const s = (resolution || '').toLowerCase();
  if (s === 'resolved') return 'Resolved';
  if (s === 'secondary_test') return 'Pending test';
  if (s === 'frozen') return 'Investigating';
  return 'Open';
}

function decN(v: { toString(): string } | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function decNOrNull(v: { toString(): string } | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

@Injectable()
export class MccManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mccScope: MccAccessScopeService,
    private readonly adminService: AdminService,
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
    await this.adminService.tryBootstrapOperationalProfileFromLinkedOnboarding(accountId);
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
    const gateLitresToday = directLitres + umucundaLitres;

    const intakeSalesAgg = await this.prisma.milkSale.aggregate({
      where: {
        customer_account_id: accountId,
        sale_at: { gte: start, lt: end },
        status: { notIn: ['deleted', 'cancelled', 'rejected'] },
        ...(scope.mode === 'scoped' ? { supplier_account_id: scope.supplierAccountId } : {}),
      },
      _sum: { quantity: true },
    });
    const intakeFromSales = decN(intakeSalesAgg._sum.quantity);
    /** Best estimate of milk in tank for this day (gate + collections/sales). */
    const intakeLitresToday = Math.round(Math.max(gateLitresToday, intakeFromSales) * 10) / 10;

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

    const [wallet, profile, tankProfiles, facilitySnapshot, activeSupplierCount] = await Promise.all([
      this.prisma.wallet.findFirst({
        where: { account_id: accountId, status: 'active' },
        select: { id: true, code: true, balance: true, currency: true, is_default: true },
        orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
      }),
      this.prisma.mccOperationalProfile.findUnique({
        where: { account_id: accountId },
        select: {
          expected_daily_deliveries: true,
          daily_milk_volume_litres: true,
          max_milk_one_day_litres: true,
          tank_capacity_sufficiency: true,
          power_supply_sources: true,
          generator_capacity_kva: true,
          mobile_connectivity: true,
          total_farmers_supplying: true,
          new_farmers_last_3_months: true,
          milk_transporters_count: true,
          average_distance_km: true,
          evening_milk_pattern: true,
          own_milk_transport_type: true,
          record_system: true,
          avg_days_delivery_to_payment: true,
          main_buyer_name: true,
          source_submission_code: true,
          captured_at: true,
        },
      }),
      this.prisma.mccCoolingTankProfile.findMany({
        where: { account_id: accountId },
        orderBy: [{ tank_number: 'asc' }, { created_at: 'asc' }],
        select: {
          tank_number: true,
          capacity_litres: true,
          year_or_age: true,
          condition: true,
        },
      }),
      this.prisma.mccFacilitySnapshot.findUnique({
        where: { account_id: accountId },
        select: {
          tank_used_litres: true,
          tank_used_pct: true,
          cooling_temperature_c: true,
          power_status: true,
          generator_status: true,
          generator_fuel_pct: true,
          observed_at: true,
        },
      }),
      this.prisma.supplierCustomer.count({
        where: {
          customer_account_id: accountId,
          relationship_status: 'active',
          ...(scope.mode === 'scoped' ? { supplier_account_id: scope.supplierAccountId } : {}),
        },
      }),
    ]);

    const tankCapacityTotal = tankProfiles.reduce((sum, tank) => sum + decN(tank.capacity_litres), 0);
    const onboardingCompletion = computeOnboardingProfileCompletion(profile, tankProfiles);
    const powerSources = Array.isArray(profile?.power_supply_sources)
      ? profile.power_supply_sources.filter((v): v is string => typeof v === 'string')
      : [];
    const expectedDailyDeliveries = profile?.expected_daily_deliveries ?? (activeSupplierCount > 0 ? activeSupplierCount : null);
    const pendingManifests = manifests.filter((m) => !m.submitted).length;
    const alerts: Array<{
      id: string;
      priority: number;
      title: string;
      detail: string;
      tone: 'critical' | 'warn' | 'info';
    }> = [];

    if (rejectionRows.length > 0) {
      alerts.push({
        id: 'reject_followup',
        priority: 0,
        title: 'Rejection follow-up',
        detail: `${rejectionRows.length} rejected gate test(s) need traceability action.`,
        tone: 'critical',
      });
    }

    if (pendingManifests > 0) {
      alerts.push({
        id: 'manifest_pending',
        priority: 1,
        title: 'Manifest window',
        detail: `${pendingManifests} manifest(s) pending submission/acceptance.`,
        tone: 'warn',
      });
    } else {
      alerts.push({
        id: 'manifest_clear',
        priority: 5,
        title: 'Manifest window',
        detail: 'No pending manifests for this day.',
        tone: 'info',
      });
    }

    if (expectedDailyDeliveries && deliveries.length < expectedDailyDeliveries) {
      alerts.push({
        id: 'delivery_target',
        priority: 2,
        title: 'Delivery target',
        detail: `Logged ${deliveries.length}/${expectedDailyDeliveries} expected deliveries.`,
        tone: deliveries.length === 0 ? 'warn' : 'info',
      });
    }

    const manualTankLitres = decNOrNull(facilitySnapshot?.tank_used_litres);
    const effectiveTankLitres =
      manualTankLitres != null && manualTankLitres > 0 ? manualTankLitres : intakeLitresToday;
    const effectiveTankPct =
      tankCapacityTotal > 0
        ? Math.round((effectiveTankLitres / tankCapacityTotal) * 1000) / 10
        : decNOrNull(facilitySnapshot?.tank_used_pct);

    const tankUsedPct = effectiveTankPct;
    if (tankUsedPct != null) {
      if (tankUsedPct >= 85) {
        alerts.push({
          id: 'tank_high',
          priority: 1,
          title: 'Tank capacity high',
          detail: `Tank usage at ${Math.round(tankUsedPct)}% exceeds safe threshold.`,
          tone: 'critical',
        });
      } else if (tankUsedPct >= 70) {
        alerts.push({
          id: 'tank_watch',
          priority: 3,
          title: 'Tank capacity watch',
          detail: `Tank usage at ${Math.round(tankUsedPct)}%; monitor intake closely.`,
          tone: 'warn',
        });
      }
    }

    const generatorStatus = (facilitySnapshot?.generator_status ?? '').toLowerCase();
    if (generatorStatus === 'fault' || generatorStatus === 'offline') {
      alerts.push({
        id: 'generator_status',
        priority: 1,
        title: 'Generator status',
        detail: `Generator reported as ${generatorStatus}.`,
        tone: 'critical',
      });
    }

    if (wallet && decN(wallet.balance) <= 0) {
      alerts.push({
        id: 'wallet_low',
        priority: 3,
        title: 'Wallet balance',
        detail: 'Available wallet balance is low or zero.',
        tone: 'warn',
      });
    }

    if (staff.length > 0) {
      const onDuty = staff.filter((s) => s.on_duty).length;
      if (onDuty === 0) {
        alerts.push({
          id: 'staff_shift',
          priority: 4,
          title: 'Staff on shift',
          detail: 'No active shift detected for gate-facing staff.',
          tone: 'warn',
        });
      }
    }

    if (alerts.length === 0) {
      alerts.push({
        id: 'ops_nominal',
        priority: 9,
        title: 'Operations status',
        detail: 'No active alerts for this day.',
        tone: 'info',
      });
    }

    alerts.sort((a, b) => a.priority - b.priority);

    const accountRow = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: {
        name: true,
        code: true,
        operational_district: { select: { name: true } },
      },
    });

    const yesterdayStart = new Date(start);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    const yesterdayEnd = start;
    const trendStart = new Date(start);
    trendStart.setUTCDate(trendStart.getUTCDate() - 6);
    const { start: monthStart, end: monthEnd } = monthBoundsUtc(dateStr);
    const weekStart = new Date(start);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);

    const [
      yesterdayDeliveries,
      trendDeliveries,
      testOutcomesDay,
      topFarmersAgg,
      monthUmucundaDeliveries,
      paymentsWeekAgg,
      paymentsYesterdayAgg,
      paymentsPendingRows,
    ] = await Promise.all([
      this.prisma.mccGateDelivery.findMany({
        where: {
          mcc_account_id: accountId,
          arrived_at: { gte: yesterdayStart, lt: yesterdayEnd },
          ...(scope.mode === 'scoped' ? { source_account_id: scope.supplierAccountId } : {}),
        },
        select: { gate_volume_litres: true },
      }),
      this.prisma.mccGateDelivery.findMany({
        where: {
          mcc_account_id: accountId,
          arrived_at: { gte: trendStart, lt: end },
          ...(scope.mode === 'scoped' ? { source_account_id: scope.supplierAccountId } : {}),
        },
        select: { arrived_at: true, gate_volume_litres: true },
      }),
      this.prisma.mccMilkTestResult.groupBy({
        by: ['outcome'],
        where: {
          tested_at: { gte: start, lt: end },
          outcome: { in: ['accepted', 'rejected'] },
          gate_delivery: gateFilter,
        },
        _count: true,
      }),
      scope.mode === 'scoped'
        ? Promise.resolve([])
        : this.prisma.milkSale.groupBy({
            by: ['supplier_account_id'],
            where: {
              customer_account_id: accountId,
              sale_at: { gte: monthStart, lt: monthEnd },
              status: { notIn: ['deleted', 'cancelled'] },
            },
            _sum: { quantity: true },
            _count: { _all: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 8,
          }),
      scope.mode === 'scoped'
        ? Promise.resolve([])
        : this.prisma.mccGateDelivery.findMany({
            where: {
              mcc_account_id: accountId,
              arrived_at: { gte: monthStart, lt: monthEnd },
              source_type: { not: 'direct' },
            },
            include: {
              source_account: { select: { id: true, name: true, code: true } },
              manifest: { include: { lines: true } },
            },
          }),
      this.prisma.milkSale.aggregate({
        where: {
          customer_account_id: accountId,
          sale_at: { gte: weekStart, lt: end },
          payment_status: 'paid',
          status: { notIn: ['deleted', 'cancelled'] },
        },
        _sum: { amount_paid: true },
        _count: true,
      }),
      this.prisma.milkSale.aggregate({
        where: {
          customer_account_id: accountId,
          sale_at: { gte: yesterdayStart, lt: yesterdayEnd },
          payment_status: 'paid',
          status: { notIn: ['deleted', 'cancelled'] },
        },
        _sum: { amount_paid: true },
        _count: true,
      }),
      this.prisma.milkSale.findMany({
        where: {
          customer_account_id: accountId,
          payment_status: { in: ['unpaid', 'partial'] },
          status: { notIn: ['deleted', 'cancelled'] },
        },
        select: { quantity: true, unit_price: true, amount_paid: true },
      }),
    ]);

    const litresYesterday = yesterdayDeliveries.reduce((s, d) => s + decN(d.gate_volume_litres), 0);
    const totalLitresToday = intakeLitresToday;
    const litresChangePct =
      litresYesterday > 0.01
        ? Math.round(((totalLitresToday - litresYesterday) / litresYesterday) * 1000) / 10
        : null;

    const trendBuckets = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(trendStart);
      d.setUTCDate(trendStart.getUTCDate() + i);
      trendBuckets.set(isoDateKey(d), 0);
    }
    for (const d of trendDeliveries) {
      const key = isoDateKey(d.arrived_at);
      if (trendBuckets.has(key)) {
        trendBuckets.set(key, (trendBuckets.get(key) ?? 0) + decN(d.gate_volume_litres));
      }
    }
    const trend_7d = [...trendBuckets.entries()].map(([date, litres]) => ({
      date,
      label: formatTrendLabel(date),
      litres: Math.round(litres * 10) / 10,
    }));

    const testAccepted = testOutcomesDay.find((r) => r.outcome === 'accepted')?._count ?? 0;
    const testRejected = testOutcomesDay.find((r) => r.outcome === 'rejected')?._count ?? 0;
    const testDenom = testAccepted + testRejected;
    const quality_summary = {
      accepted_count: testAccepted,
      rejected_count: testRejected,
      accepted_pct: testDenom > 0 ? Math.round((testAccepted / testDenom) * 1000) / 10 : null,
      rejected_pct: testDenom > 0 ? Math.round((testRejected / testDenom) * 1000) / 10 : null,
    };

    const causeMap = new Map<string, number>();
    for (const r of rejectionRows) {
      const cause = (r.rejection_cause || 'Other').trim() || 'Other';
      causeMap.set(cause, (causeMap.get(cause) ?? 0) + 1);
    }
    const rejection_causes_top = [...causeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cause, count]) => ({ cause, count }));

    const recent_deliveries = deliveries.slice(0, 5).map((d) => ({
      id: d.id,
      source_name: d.source_account.name || d.source_account.code || '—',
      source_type: d.source_type,
      source_type_label: d.source_type === 'direct' ? 'Direct farmer' : 'Collector / agent',
      litres: Math.round(decN(d.gate_volume_litres) * 10) / 10,
      arrived_at: d.arrived_at.toISOString(),
    }));

    const deliveryById = new Map(deliveries.map((d) => [d.id, d]));
    const routeMap = new Map<
      string,
      { route_label: string; collector_name: string; farms: number; litres: number; submitted: number; total: number }
    >();
    for (const m of manifests) {
      const key = m.route_label || m.umucunda_name || m.manifest_ref;
      const del = deliveryById.get(m.gate_delivery_id);
      const lineCount = del?.manifest?.lines?.length ?? 0;
      const prev = routeMap.get(key) ?? {
        route_label: key,
        collector_name: m.umucunda_name ?? key,
        farms: 0,
        litres: 0,
        submitted: 0,
        total: 0,
      };
      prev.litres += m.expected_litres;
      prev.farms += lineCount;
      prev.total += 1;
      if (m.submitted) prev.submitted += 1;
      routeMap.set(key, prev);
    }
    const collection_by_route = [...routeMap.values()]
      .map((r) => ({
        route_label: r.route_label,
        collector_name: r.collector_name,
        farms_count: r.farms,
        litres: Math.round(r.litres * 10) / 10,
        compliance_pct: r.total > 0 ? Math.round((r.submitted / r.total) * 100) : 100,
      }))
      .sort((a, b) => b.litres - a.litres);

    const farmerIds = topFarmersAgg.map((r) => r.supplier_account_id);
    const farmerAccounts =
      farmerIds.length > 0
        ? await this.prisma.account.findMany({
            where: { id: { in: farmerIds } },
            select: { id: true, name: true, code: true },
          })
        : [];
    const farmerById = new Map(farmerAccounts.map((a) => [a.id, a]));
    const top_farmers_month = topFarmersAgg.slice(0, 5).map((row) => {
      const acc = farmerById.get(row.supplier_account_id);
      const litres = decN(row._sum.quantity);
      const deliveriesN = row._count._all ?? 0;
      const grade =
        deliveriesN >= 20 ? 'A' : deliveriesN >= 10 ? 'B' : deliveriesN >= 3 ? 'C' : '—';
      const quality_score =
        grade === '—' ? null : Math.min(99, 88 + Math.min(8, Math.floor(deliveriesN / 3)));
      return {
        supplier_account_id: row.supplier_account_id,
        name: acc?.name ?? acc?.code ?? 'Farmer',
        code: acc?.code ?? null,
        litres: Math.round(litres * 10) / 10,
        deliveries: deliveriesN,
        quality_grade: grade,
        quality_score_pct: quality_score,
      };
    });

    const collectorMap = new Map<
      string,
      { name: string; code: string | null; litres: number; farms: number; manifests: number; submitted: number }
    >();
    for (const d of monthUmucundaDeliveries) {
      const id = d.source_account_id;
      const prev = collectorMap.get(id) ?? {
        name: d.source_account.name || d.source_account.code || 'Collector',
        code: d.source_account.code,
        litres: 0,
        farms: 0,
        manifests: 0,
        submitted: 0,
      };
      prev.litres += decN(d.gate_volume_litres);
      if (d.manifest) {
        prev.manifests += 1;
        prev.farms += d.manifest.lines.length;
        if (d.manifest.status === 'submitted' || d.manifest.status === 'accepted' || d.manifest.submitted_at) {
          prev.submitted += 1;
        }
      }
      collectorMap.set(id, prev);
    }
    const top_collectors_month = [...collectorMap.values()]
      .map((c) => ({
        name: c.name,
        code: c.code,
        litres: Math.round(c.litres * 10) / 10,
        farms_served: c.farms,
        compliance_pct: c.manifests > 0 ? Math.round((c.submitted / c.manifests) * 100) : 100,
      }))
      .sort((a, b) => b.litres - a.litres)
      .slice(0, 5);

    const holdsQuality = manifests.filter((m) => m.payment_hold).length;
    const holdsOther = rejectionRows.filter((r) => r.resolution_status !== 'resolved').length;

    const pendingPaymentsAmount = paymentsPendingRows.reduce(
      (sum, row) =>
        sum + Math.max(0, decN(row.quantity) * decN(row.unit_price) - decN(row.amount_paid)),
      0,
    );

    const payments_overview = {
      payments_week_amount: decN(paymentsWeekAgg._sum.amount_paid),
      payments_week_count: paymentsWeekAgg._count ?? 0,
      payments_yesterday_amount: decN(paymentsYesterdayAgg._sum.amount_paid),
      payments_yesterday_count: paymentsYesterdayAgg._count ?? 0,
      pending_payments_amount: Math.round(pendingPaymentsAmount * 100) / 100,
      pending_payments_count: paymentsPendingRows.length,
      holds_quality_count: holdsQuality,
      holds_other_count: holdsOther,
    };

    const rejections_follow_up = rejectionRows.map((r) => ({
      ...r,
      hours_elapsed: Math.round(hoursSince(r.tested_at) * 10) / 10,
      follow_up_status: followUpStatus(r.resolution_status),
    }));

    return {
      code: 200,
      status: 'success',
      message: 'MCC manager overview',
      data: {
        date: dateStr,
        updated_at: new Date().toISOString(),
        account_context: {
          name: accountRow?.name ?? accountRow?.code ?? 'MCC',
          code: accountRow?.code ?? null,
          district_label: accountRow?.operational_district?.name ?? null,
        },
        litres_yesterday: Math.round(litresYesterday * 10) / 10,
        litres_change_pct: litresChangePct,
        trend_7d,
        quality_summary,
        rejection_causes_top,
        recent_deliveries,
        collection_by_route,
        top_farmers_month,
        top_collectors_month,
        payments_overview,
        rejections_follow_up,
        gate: {
          direct_litres: Math.round(directLitres * 10) / 10,
          umucunda_litres: Math.round(umucundaLitres * 10) / 10,
          total_litres: Math.round(gateLitresToday * 10) / 10,
          intake_litres: intakeLitresToday,
          delivery_count: deliveries.length,
        },
        manifests,
        rejections: rejections_follow_up,
        staff,
        wallet: wallet
          ? {
              id: wallet.id,
              code: wallet.code,
              balance: decN(wallet.balance),
              currency: wallet.currency,
              is_default: wallet.is_default,
            }
          : null,
        cooling_tanks: tankProfiles.map((t) => ({
          tank_number: t.tank_number,
          capacity_litres: decNOrNull(t.capacity_litres),
          year_or_age: t.year_or_age,
          condition: t.condition,
        })),
        onboarding_completion: onboardingCompletion,
        profile: profile
          ? {
              expected_daily_deliveries: expectedDailyDeliveries,
              cooling_tank_total_capacity_litres: Math.round(tankCapacityTotal * 10) / 10,
              daily_milk_volume_litres: decNOrNull(profile.daily_milk_volume_litres),
              max_milk_one_day_litres: decNOrNull(profile.max_milk_one_day_litres),
              tank_capacity_sufficiency: profile.tank_capacity_sufficiency,
              power_supply_sources: powerSources,
              generator_capacity_kva: decNOrNull(profile.generator_capacity_kva),
              mobile_connectivity: profile.mobile_connectivity,
              total_farmers_supplying: profile.total_farmers_supplying,
              new_farmers_last_3_months: profile.new_farmers_last_3_months,
              milk_transporters_count: profile.milk_transporters_count,
              average_distance_km: decNOrNull(profile.average_distance_km),
              evening_milk_pattern: profile.evening_milk_pattern,
              own_milk_transport_type: profile.own_milk_transport_type,
              record_system: profile.record_system,
              avg_days_delivery_to_payment: profile.avg_days_delivery_to_payment,
              main_buyer_name: profile.main_buyer_name,
              source_submission_code: profile.source_submission_code,
              captured_at: profile.captured_at?.toISOString() ?? null,
            }
          : {
              expected_daily_deliveries: expectedDailyDeliveries,
              cooling_tank_total_capacity_litres:
                tankCapacityTotal > 0 ? Math.round(tankCapacityTotal * 10) / 10 : null,
              daily_milk_volume_litres: null,
              max_milk_one_day_litres: null,
              tank_capacity_sufficiency: null,
              power_supply_sources: powerSources,
              generator_capacity_kva: null,
              mobile_connectivity: null,
              total_farmers_supplying: null,
              new_farmers_last_3_months: null,
              milk_transporters_count: null,
              average_distance_km: null,
              evening_milk_pattern: null,
              own_milk_transport_type: null,
              record_system: null,
              avg_days_delivery_to_payment: null,
              main_buyer_name: null,
              source_submission_code: null,
              captured_at: null,
            },
        facility_snapshot: facilitySnapshot
          ? {
              tank_used_litres: effectiveTankLitres,
              tank_used_pct: effectiveTankPct,
              tank_used_litres_manual: manualTankLitres,
              cooling_temperature_c: decNOrNull(facilitySnapshot.cooling_temperature_c),
              power_status: facilitySnapshot.power_status,
              generator_status: facilitySnapshot.generator_status,
              generator_fuel_pct: decNOrNull(facilitySnapshot.generator_fuel_pct),
              observed_at: facilitySnapshot.observed_at?.toISOString() ?? null,
            }
          : {
              tank_used_litres: intakeLitresToday > 0 ? intakeLitresToday : null,
              tank_used_pct: effectiveTankPct,
              tank_used_litres_manual: null,
              cooling_temperature_c: null,
              power_status: null,
              generator_status: null,
              generator_fuel_pct: null,
              observed_at: null,
            },
        alerts,
      },
    };
  }

  async getOperationalProfile(user: User, accountIdParam: string | undefined) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    await this.adminService.tryBootstrapOperationalProfileFromLinkedOnboarding(accountId);

    const [accountRow, profile, tankProfiles] = await Promise.all([
      this.prisma.account.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          code: true,
          name: true,
          operational_district: { select: { name: true } },
        },
      }),
      this.prisma.mccOperationalProfile.findUnique({
        where: { account_id: accountId },
      }),
      this.prisma.mccCoolingTankProfile.findMany({
        where: { account_id: accountId },
        orderBy: [{ tank_number: 'asc' }, { created_at: 'asc' }],
      }),
    ]);

    const tankCapacityTotal = tankProfiles.reduce((sum, tank) => sum + decN(tank.capacity_litres), 0);
    const powerSources = Array.isArray(profile?.power_supply_sources)
      ? profile.power_supply_sources.filter((v): v is string => typeof v === 'string')
      : [];
    const completion = computeOnboardingProfileCompletion(profile, tankProfiles);

    return {
      code: 200,
      status: 'success',
      message: 'MCC operational profile',
      data: {
        account: {
          id: accountRow?.id ?? accountId,
          code: accountRow?.code ?? null,
          name: accountRow?.name ?? 'MCC',
          district_label: accountRow?.operational_district?.name ?? null,
        },
        cooling_tanks: tankProfiles.map((t) => ({
          tank_number: t.tank_number,
          capacity_litres: decNOrNull(t.capacity_litres),
          year_or_age: t.year_or_age,
          condition: t.condition,
        })),
        profile: profile
          ? {
              expected_daily_deliveries: profile.expected_daily_deliveries,
              cooling_tank_total_capacity_litres:
                tankCapacityTotal > 0 ? Math.round(tankCapacityTotal * 10) / 10 : null,
              daily_milk_volume_litres: decNOrNull(profile.daily_milk_volume_litres),
              max_milk_one_day_litres: decNOrNull(profile.max_milk_one_day_litres),
              tank_capacity_sufficiency: profile.tank_capacity_sufficiency,
              power_supply_sources: powerSources,
              generator_capacity_kva: decNOrNull(profile.generator_capacity_kva),
              mobile_connectivity: profile.mobile_connectivity,
              total_farmers_supplying: profile.total_farmers_supplying,
              new_farmers_last_3_months: profile.new_farmers_last_3_months,
              milk_transporters_count: profile.milk_transporters_count,
              average_distance_km: decNOrNull(profile.average_distance_km),
              evening_milk_pattern: profile.evening_milk_pattern,
              own_milk_transport_type: profile.own_milk_transport_type,
              record_system: profile.record_system,
              avg_days_delivery_to_payment: profile.avg_days_delivery_to_payment,
              main_buyer_name: profile.main_buyer_name,
              source_submission_code: profile.source_submission_code,
              captured_at: profile.captured_at?.toISOString() ?? null,
            }
          : null,
        completion,
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
