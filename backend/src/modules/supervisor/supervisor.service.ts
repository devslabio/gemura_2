import { Injectable } from '@nestjs/common';
import { AccountType, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { AdminService } from '../admin/admin.service';
import {
  SupervisorDashboardData,
  SupervisorHealthStatus,
} from './supervisor-dashboard.types';

type ScopeLocation = { id: string; code: string; name: string };

@Injectable()
export class SupervisorService {
  constructor(
    private prisma: PrismaService,
    private locations: LocationsService,
    private admin: AdminService,
  ) {}

  private async scopedDistrictIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.regionalSupervisorDistrict.findMany({
      where: { user_id: userId },
      select: { district_location_id: true },
    });
    return [...new Set(rows.map((r) => r.district_location_id).filter(Boolean))] as string[];
  }

  private async effectiveDistrictIds(userId: string, opts: { district_location_id?: string; region_id?: string }) {
    const scoped = await this.scopedDistrictIds(userId);
    if (scoped.length === 0) return [];

    if (opts.district_location_id) {
      return scoped.includes(opts.district_location_id) ? [opts.district_location_id] : [];
    }

    if (opts.region_id) {
      const districts = await this.prisma.location.findMany({
        where: { id: { in: scoped }, parent_id: opts.region_id, location_type: 'DISTRICT' },
        select: { id: true },
      });
      return districts.map((d) => d.id);
    }

    return scoped;
  }

  async getScope(user: User, platformAccountId: string) {
    // Permission enforcement happens via @RequirePermission guard.
    // Scope itself is always derived from regional_supervisor_districts.
    const districtIds = await this.scopedDistrictIds(user.id);
    if (districtIds.length === 0) {
      return {
        code: 200,
        status: 'success',
        message: 'Scope retrieved.',
        data: { provinces: [] as ScopeLocation[], districts: [] as (ScopeLocation & { province_id: string })[] },
      };
    }

    const districtsRaw = await this.prisma.location.findMany({
      where: { id: { in: districtIds }, location_type: 'DISTRICT' },
      select: { id: true, code: true, name: true, parent_id: true },
      orderBy: { name: 'asc' },
    });
    const districts = districtsRaw.filter((d): d is typeof d & { parent_id: string } => !!d.parent_id);
    const provinceIds = [...new Set(districts.map((d) => d.parent_id))];
    const provinces = await this.prisma.location.findMany({
      where: { id: { in: provinceIds }, location_type: 'PROVINCE' },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Scope retrieved.',
      data: {
        provinces,
        districts: districts.map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          province_id: d.parent_id,
        })),
      },
    };
  }

  async listAccounts(
    user: User,
    platformAccountId: string,
    opts: {
      page: number;
      limit: number;
      search?: string;
      account_type?: 'tenant' | 'branch' | 'admin' | 'all';
      district_location_id?: string;
      region_id?: string;
    },
  ) {
    // Reuse the existing admin listing logic (it already applies supervisor scope via view_regional_accounts).
    // For region filtering (province), we request the scoped list and then filter by district ids in that province.
    const base = await this.admin.listTenantAccountsForAdmin(user, platformAccountId, {
      page: opts.page,
      limit: opts.limit,
      search: opts.search,
      account_type: opts.account_type ?? 'all',
      district_location_id: opts.region_id ? undefined : opts.district_location_id,
    });

    if (opts.region_id && base.code === 200 && base.data?.rows) {
      const eff = await this.effectiveDistrictIds(user.id, { region_id: opts.region_id });
      const rows = base.data.rows.filter((r: { operational_district_id?: string | null }) =>
        r.operational_district_id ? eff.includes(r.operational_district_id) : false,
      );
      return {
        ...base,
        data: {
          ...base.data,
          rows,
          pagination: {
            ...base.data.pagination,
            total: rows.length,
            totalPages: 1,
            page: 1,
          },
        },
      };
    }

    return base;
  }

  async getSummary(
    user: User,
    platformAccountId: string,
    opts: { district_location_id?: string; region_id?: string },
  ) {
    const districtIds = await this.effectiveDistrictIds(user.id, opts);
    const emptySummaryData = () => ({
      mcc_count: 0,
      members: 0,
      suppliers: 0,
      customers: 0,
      farms: 0,
      sales: 0,
      collections: 0,
      manifest_acceptance_pct: null as number | null,
      quality_test_rejection_pct: null as number | null,
      avg_tank_utilization_pct: null as number | null,
      open_staff_shifts: 0,
    });

    if (districtIds.length === 0) {
      return {
        code: 200,
        status: 'success',
        message: 'Summary retrieved.',
        data: emptySummaryData(),
      };
    }

    const accounts = await this.prisma.account.findMany({
      where: {
        type: { in: [AccountType.tenant, AccountType.branch] },
        operational_district_id: { in: districtIds },
      },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return {
        code: 200,
        status: 'success',
        message: 'Summary retrieved.',
        data: emptySummaryData(),
      };
    }

    const [
      membersByAccount,
      suppliersByCustomerAccount,
      customersBySupplierAccount,
      salesBySupplierAccount,
      collectionsByCustomerAccount,
      farmsByAccount,
      manifestByStatus,
      testByOutcome,
      tankAvg,
      openStaffShifts,
    ] = await Promise.all([
      this.prisma.userAccount.groupBy({
        by: ['account_id'],
        where: { account_id: { in: accountIds }, status: 'active' },
        _count: true,
      }),
      this.prisma.supplierCustomer.groupBy({
        by: ['customer_account_id'],
        where: { customer_account_id: { in: accountIds }, relationship_status: 'active' },
        _count: true,
      }),
      this.prisma.supplierCustomer.groupBy({
        by: ['supplier_account_id'],
        where: { supplier_account_id: { in: accountIds }, relationship_status: 'active' },
        _count: true,
      }),
      this.prisma.milkSale.groupBy({
        by: ['supplier_account_id'],
        where: { supplier_account_id: { in: accountIds }, status: { not: 'deleted' } },
        _count: true,
      }),
      this.prisma.milkSale.groupBy({
        by: ['customer_account_id'],
        where: { customer_account_id: { in: accountIds }, status: { not: 'deleted' } },
        _count: true,
      }),
      this.prisma.farm.groupBy({
        by: ['account_id'],
        where: { account_id: { in: accountIds } },
        _count: true,
      }),
      this.prisma.mccMilkManifest.groupBy({
        by: ['status'],
        where: {
          mcc_account_id: { in: accountIds },
          status: { in: ['accepted', 'rejected'] },
        },
        _count: true,
      }),
      this.prisma.mccMilkTestResult.groupBy({
        by: ['outcome'],
        where: {
          outcome: { in: ['accepted', 'rejected'] },
          gate_delivery: { mcc_account_id: { in: accountIds } },
        },
        _count: true,
      }),
      this.prisma.mccFacilitySnapshot.aggregate({
        where: { account_id: { in: accountIds }, tank_used_pct: { not: null } },
        _avg: { tank_used_pct: true },
      }),
      this.prisma.mccStaffShift.count({
        where: { mcc_account_id: { in: accountIds }, ended_at: null },
      }),
    ]);

    const normalize = (row: { _count?: number | { _all?: number } }) =>
      typeof row._count === 'number' ? row._count : row._count?._all ?? 0;

    const sum = (rows: Array<{ _count?: number | { _all?: number } }>) => rows.reduce((acc, r) => acc + normalize(r), 0);

    const mAccepted = normalize(manifestByStatus.find((r) => r.status === 'accepted') ?? {});
    const mRejected = normalize(manifestByStatus.find((r) => r.status === 'rejected') ?? {});
    const manifestDenom = mAccepted + mRejected;
    const manifest_acceptance_pct =
      manifestDenom > 0 ? Math.round((mAccepted / manifestDenom) * 1000) / 10 : null;

    const testAcceptedRow = testByOutcome.find((r) => r.outcome === 'accepted');
    const testRejectedRow = testByOutcome.find((r) => r.outcome === 'rejected');
    const testAcceptedN = normalize(testAcceptedRow ?? {});
    const testRejectedN = normalize(testRejectedRow ?? {});
    const testDenom = testAcceptedN + testRejectedN;
    const quality_test_rejection_pct =
      testDenom > 0 ? Math.round((testRejectedN / testDenom) * 1000) / 10 : null;

    const rawTankAvg = tankAvg._avg.tank_used_pct;
    const avg_tank_utilization_pct =
      rawTankAvg != null ? Math.round(Number(rawTankAvg.toString()) * 10) / 10 : null;

    return {
      code: 200,
      status: 'success',
      message: 'Summary retrieved.',
      data: {
        mcc_count: accountIds.length,
        members: sum(membersByAccount),
        suppliers: sum(suppliersByCustomerAccount),
        customers: sum(customersBySupplierAccount),
        farms: sum(farmsByAccount),
        sales: sum(salesBySupplierAccount),
        collections: sum(collectionsByCustomerAccount),
        manifest_acceptance_pct,
        quality_test_rejection_pct,
        avg_tank_utilization_pct,
        open_staff_shifts: openStaffShifts,
      },
    };
  }

  private deriveHealthStatus(input: {
    manifestRejectPct: number | null;
    testRejectPct: number | null;
    tankPct: number | null;
    openShifts: number;
    staleDraftManifests: number;
  }): SupervisorHealthStatus {
    if (
      (input.tankPct ?? 0) >= 90 ||
      (input.testRejectPct ?? 0) > 15 ||
      (input.manifestRejectPct ?? 0) > 25
    ) {
      return 'at_risk';
    }
    if (
      (input.tankPct ?? 0) >= 75 ||
      (input.testRejectPct ?? 0) > 8 ||
      (input.manifestRejectPct ?? 0) > 15 ||
      input.openShifts > 0 ||
      input.staleDraftManifests > 0
    ) {
      return 'fair';
    }
    return 'good';
  }

  private buildDayBuckets(days: number): { labels: string[]; keys: string[] } {
    const labels: string[] = [];
    const keys: string[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      keys.push(key);
      labels.push(
        d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      );
    }
    return { labels, keys };
  }

  private layoutMapPins(
    rows: Array<{
      account_id: string;
      label: string;
      district_id: string | null;
      district_name: string | null;
      status: SupervisorHealthStatus;
    }>,
  ): SupervisorDashboardData['map_pins'] {
    const byDistrict = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.district_id ?? '__none__';
      const list = byDistrict.get(key) ?? [];
      list.push(row);
      byDistrict.set(key, list);
    }
    const districtKeys = [...byDistrict.keys()];
    const n = districtKeys.length || 1;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const pins: SupervisorDashboardData['map_pins'] = [];
    districtKeys.forEach((distKey, di) => {
      const accounts = byDistrict.get(distKey) ?? [];
      const col = di % cols;
      const rowIdx = Math.floor(di / cols);
      const rowsInGrid = Math.ceil(n / cols);
      const baseTop = 10 + (rowIdx / Math.max(1, rowsInGrid - 1 || 1)) * 70;
      const baseLeft = 10 + (col / Math.max(1, cols - 1 || 1)) * 70;
      accounts.forEach((acc, ai) => {
        const offsetTop = (ai % 2) * 6;
        const offsetLeft = Math.floor(ai / 2) * 10;
        pins.push({
          account_id: acc.account_id,
          label: acc.label,
          district_id: acc.district_id,
          district_name: acc.district_name,
          status: acc.status,
          top_pct: Math.min(92, baseTop + offsetTop),
          left_pct: Math.min(92, baseLeft + offsetLeft),
        });
      });
    });
    return pins;
  }

  private formatRelativeTime(d: Date): string {
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `${hours}h ago`;
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  }

  async getDashboard(
    user: User,
    platformAccountId: string,
    opts: { district_location_id?: string; region_id?: string; days?: number },
  ) {
    const days = Math.min(90, Math.max(7, opts.days ?? 14));
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [scopeRes, summaryRes, accountsRes] = await Promise.all([
      this.getScope(user, platformAccountId),
      this.getSummary(user, platformAccountId, opts),
      this.listAccounts(user, platformAccountId, {
        page: 1,
        limit: 100,
        account_type: 'tenant',
        district_location_id: opts.district_location_id,
        region_id: opts.region_id,
      }),
    ]);

    const scope =
      scopeRes.code === 200
        ? scopeRes.data
        : { provinces: [] as ScopeLocation[], districts: [] as SupervisorDashboardData['scope']['districts'] };
    const summary = summaryRes.code === 200 ? summaryRes.data : {
      mcc_count: 0,
      members: 0,
      suppliers: 0,
      customers: 0,
      farms: 0,
      sales: 0,
      collections: 0,
      manifest_acceptance_pct: null,
      quality_test_rejection_pct: null,
      avg_tank_utilization_pct: null,
      open_staff_shifts: 0,
    };
    const accountRows =
      accountsRes.code === 200 && accountsRes.data?.rows
        ? (accountsRes.data.rows as SupervisorDashboardData['portfolio'])
        : [];
    const accountIds = accountRows.map((r) => r.id);
    const nameById = new Map(accountRows.map((r) => [r.id, r.name]));

    const emptyDashboard: SupervisorDashboardData = {
      scope,
      summary,
      trend: { date_labels: this.buildDayBuckets(days).labels, series: [] },
      map_pins: [],
      interventions: [],
      scoreboard: [],
      activities: [],
      escalations: [],
      portfolio: [],
    };

    if (accountIds.length === 0) {
      return { code: 200, status: 'success', message: 'Dashboard retrieved.', data: emptyDashboard };
    }

    const staleDraftCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const escalationSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { labels: dateLabels, keys: dateKeys } = this.buildDayBuckets(days);

    const [
      gateDeliveries,
      manifests,
      testResults,
      snapshots,
      profiles,
      openShifts,
      membersByAccount,
    ] = await Promise.all([
      this.prisma.mccGateDelivery.findMany({
        where: { mcc_account_id: { in: accountIds }, arrived_at: { gte: since } },
        select: {
          id: true,
          mcc_account_id: true,
          gate_volume_litres: true,
          arrived_at: true,
          notes: true,
          recorded_by: { select: { name: true } },
        },
        orderBy: { arrived_at: 'desc' },
      }),
      this.prisma.mccMilkManifest.findMany({
        where: { mcc_account_id: { in: accountIds } },
        select: {
          id: true,
          mcc_account_id: true,
          status: true,
          rejection_reason: true,
          rejected_at: true,
          submitted_at: true,
          created_at: true,
          manifest_ref: true,
        },
        orderBy: { updated_at: 'desc' },
        take: 200,
      }),
      this.prisma.mccMilkTestResult.findMany({
        where: {
          gate_delivery: { mcc_account_id: { in: accountIds } },
          tested_at: { gte: since },
        },
        select: {
          id: true,
          outcome: true,
          tested_at: true,
          gate_delivery: { select: { mcc_account_id: true, id: true } },
        },
        orderBy: { tested_at: 'desc' },
      }),
      this.prisma.mccFacilitySnapshot.findMany({
        where: { account_id: { in: accountIds } },
      }),
      this.prisma.mccOperationalProfile.findMany({
        where: { account_id: { in: accountIds } },
        select: { account_id: true, main_buyer_name: true, total_farmers_supplying: true },
      }),
      this.prisma.mccStaffShift.findMany({
        where: { mcc_account_id: { in: accountIds }, ended_at: null },
        include: { user: { select: { name: true } } },
        orderBy: { started_at: 'desc' },
      }),
      this.prisma.userAccount.groupBy({
        by: ['account_id'],
        where: { account_id: { in: accountIds }, status: 'active' },
        _count: true,
      }),
    ]);

    const memberCount = (id: string) => {
      const row = membersByAccount.find((r) => r.account_id === id);
      if (!row || row._count == null) return 0;
      return typeof row._count === 'number' ? row._count : (row._count as { _all?: number })._all ?? 0;
    };

    type AccountMetrics = {
      gateByDay: Map<string, number>;
      gateTotal: number;
      manifestAccepted: number;
      manifestRejected: number;
      testAccepted: number;
      testRejected: number;
      staleDrafts: number;
      openShifts: number;
      tankPct: number | null;
      power: string | null;
      gen: string | null;
      mainBuyer: string | null;
      farmersExpected: number | null;
    };

    const metrics = new Map<string, AccountMetrics>();
    const ensure = (id: string): AccountMetrics => {
      let m = metrics.get(id);
      if (!m) {
        m = {
          gateByDay: new Map(dateKeys.map((k) => [k, 0])),
          gateTotal: 0,
          manifestAccepted: 0,
          manifestRejected: 0,
          testAccepted: 0,
          testRejected: 0,
          staleDrafts: 0,
          openShifts: 0,
          tankPct: null,
          power: null,
          gen: null,
          mainBuyer: null,
          farmersExpected: null,
        };
        metrics.set(id, m);
      }
      return m;
    };
    for (const id of accountIds) ensure(id);

    for (const d of gateDeliveries) {
      const m = ensure(d.mcc_account_id);
      const litres = Number(d.gate_volume_litres);
      const dayKey = d.arrived_at.toISOString().slice(0, 10);
      if (m.gateByDay.has(dayKey)) {
        m.gateByDay.set(dayKey, (m.gateByDay.get(dayKey) ?? 0) + litres);
      }
      m.gateTotal += litres;
    }

    for (const mf of manifests) {
      const m = ensure(mf.mcc_account_id);
      if (mf.status === 'accepted') m.manifestAccepted += 1;
      if (mf.status === 'rejected') m.manifestRejected += 1;
      if (mf.status === 'draft' && mf.created_at < staleDraftCutoff) m.staleDrafts += 1;
    }

    for (const t of testResults) {
      const mccId = t.gate_delivery.mcc_account_id;
      const m = ensure(mccId);
      if (t.outcome === 'accepted') m.testAccepted += 1;
      if (t.outcome === 'rejected') m.testRejected += 1;
    }

    for (const s of snapshots) {
      const m = ensure(s.account_id);
      m.tankPct = s.tank_used_pct != null ? Number(s.tank_used_pct) : null;
      m.power = s.power_status;
      m.gen = s.generator_status;
    }

    for (const p of profiles) {
      const m = ensure(p.account_id);
      m.mainBuyer = p.main_buyer_name;
      m.farmersExpected = p.total_farmers_supplying;
    }

    for (const sh of openShifts) {
      ensure(sh.mcc_account_id).openShifts += 1;
    }

    const portfolio: SupervisorDashboardData['portfolio'] = accountRows.map((row) => {
      const m = ensure(row.id);
      const manifestDenom = m.manifestAccepted + m.manifestRejected;
      const manifest_acceptance_pct =
        manifestDenom > 0 ? Math.round((m.manifestAccepted / manifestDenom) * 1000) / 10 : null;
      const testDenom = m.testAccepted + m.testRejected;
      const quality_test_rejection_pct =
        testDenom > 0 ? Math.round((m.testRejected / testDenom) * 1000) / 10 : null;
      const manifestRejectPct =
        manifestDenom > 0 ? Math.round((m.manifestRejected / manifestDenom) * 1000) / 10 : null;
      const sparkline_14d = dateKeys.map((k) => Math.round(m.gateByDay.get(k) ?? 0));
      const health_status = this.deriveHealthStatus({
        manifestRejectPct,
        testRejectPct: quality_test_rejection_pct,
        tankPct: m.tankPct,
        openShifts: m.openShifts,
        staleDraftManifests: m.staleDrafts,
      });
      return {
        ...row,
        health_status,
        gate_litres_14d: Math.round(m.gateTotal),
        sparkline_14d,
        manifest_acceptance_pct,
        quality_test_rejection_pct,
        tank_used_pct: m.tankPct,
      };
    });

    const trendSeries = portfolio
      .filter((p) => p.gate_litres_14d > 0)
      .sort((a, b) => b.gate_litres_14d - a.gate_litres_14d)
      .slice(0, 8)
      .map((p) => ({
        account_id: p.id,
        name: p.name,
        data: p.sparkline_14d,
      }));

    const map_pins = this.layoutMapPins(
      portfolio.map((p) => ({
        account_id: p.id,
        label: p.name.length > 18 ? `${p.name.slice(0, 16)}…` : p.name,
        district_id: p.operational_district_id,
        district_name: p.operational_district_label,
        status: p.health_status,
      })),
    );

    const interventions: SupervisorDashboardData['interventions'] = [];
    const escalations: SupervisorDashboardData['escalations'] = [];
    const scoreboard: SupervisorDashboardData['scoreboard'] = [];

    for (const p of portfolio) {
      const m = ensure(p.id);
      const mccName = p.name;
      const supervisorName = p.regional_supervisor?.name ?? null;
      const manifestDenom = m.manifestAccepted + m.manifestRejected;
      const manifestRejectPct =
        manifestDenom > 0 ? (m.manifestRejected / manifestDenom) * 100 : null;
      const testDenom = m.testAccepted + m.testRejected;
      const testRejectPct = testDenom > 0 ? (m.testRejected / testDenom) * 100 : null;
      const testAcceptPct = testRejectPct != null ? Math.round((100 - testRejectPct) * 10) / 10 : null;
      const members = memberCount(p.id);
      const staff_pct =
        m.farmersExpected && m.farmersExpected > 0
          ? Math.min(100, Math.round((members / m.farmersExpected) * 100))
          : members > 0
            ? Math.min(100, members * 5)
            : null;
      let buyer_status: 'ok' | 'watch' | 'hold' = m.mainBuyer ? 'ok' : 'watch';
      if ((manifestRejectPct ?? 0) > 20 || (testRejectPct ?? 0) > 15) buyer_status = 'hold';

      let escCount = 0;
      if ((m.tankPct ?? 0) >= 85) {
        interventions.push({
          id: `tank-${p.id}`,
          account_id: p.id,
          mcc_name: mccName,
          issue: `Tank capacity at ${Math.round(m.tankPct!)}% — monitor evening intake`,
          severity: m.tankPct! >= 90 ? 'high' : 'medium',
          owner: supervisorName,
          due_label: 'Today',
          href: `/operations/gate?account_id=${p.id}`,
        });
        escCount += 1;
      }
      if (m.openShifts > 0) {
        interventions.push({
          id: `shift-${p.id}`,
          account_id: p.id,
          mcc_name: mccName,
          issue: `${m.openShifts} open gate shift(s) without end time`,
          severity: 'low',
          owner: supervisorName,
          due_label: null,
          href: '/operations/shifts',
        });
      }
      if ((testRejectPct ?? 0) > 10 && testDenom >= 3) {
        interventions.push({
          id: `test-${p.id}`,
          account_id: p.id,
          mcc_name: mccName,
          issue: `Gate test rejection ${Math.round(testRejectPct!)}% (${m.testRejected}/${testDenom})`,
          severity: testRejectPct! > 15 ? 'high' : 'medium',
          owner: supervisorName,
          due_label: 'This week',
          href: `/operations/traceability?outcome=rejected&account_id=${p.id}`,
        });
        escCount += 1;
      }
      if ((manifestRejectPct ?? 0) > 15 && manifestDenom >= 2) {
        interventions.push({
          id: `manifest-${p.id}`,
          account_id: p.id,
          mcc_name: mccName,
          issue: `Manifest rejection rate ${Math.round(manifestRejectPct!)}%`,
          severity: manifestRejectPct! > 25 ? 'high' : 'medium',
          owner: supervisorName,
          due_label: null,
          href: '/operations/manifests',
        });
        escCount += 1;
      }
      if (m.staleDrafts > 0) {
        interventions.push({
          id: `draft-${p.id}`,
          account_id: p.id,
          mcc_name: mccName,
          issue: `${m.staleDrafts} manifest draft(s) older than 48h`,
          severity: 'medium',
          owner: supervisorName,
          due_label: null,
          href: '/operations/manifests',
        });
      }

      scoreboard.push({
        account_id: p.id,
        mcc_name: mccName,
        tank_pct: m.tankPct != null ? Math.round(m.tankPct) : null,
        power: m.power,
        generator: m.gen,
        test_pct: testAcceptPct,
        staff_pct,
        buyer_status,
        escalation_count: escCount,
      });
    }

    interventions.sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.severity] - rank[b.severity];
    });

    for (const mf of manifests) {
      if (mf.status !== 'rejected') continue;
      const raised = mf.rejected_at ?? mf.created_at;
      escalations.push({
        id: mf.id,
        account_id: mf.mcc_account_id,
        mcc_name: nameById.get(mf.mcc_account_id) ?? 'MCC',
        issue: mf.rejection_reason?.trim() || `Manifest ${mf.manifest_ref} rejected`,
        severity: 'high',
        raised_label: this.formatRelativeTime(raised),
        status: 'open',
        href: '/operations/manifests',
      });
    }

    for (const t of testResults) {
      if (t.outcome !== 'rejected' || t.tested_at < escalationSince) continue;
      const mccId = t.gate_delivery.mcc_account_id;
      escalations.push({
        id: t.id,
        account_id: mccId,
        mcc_name: nameById.get(mccId) ?? 'MCC',
        issue: 'Gate milk test rejected',
        severity: 'medium',
        raised_label: this.formatRelativeTime(t.tested_at),
        status: 'open',
        href: `/operations/traceability?outcome=rejected`,
      });
    }

    const activities: SupervisorDashboardData['activities'] = [];

    for (const sh of openShifts.slice(0, 12)) {
      activities.push({
        id: `shift-${sh.id}`,
        kind: 'shift',
        mcc_name: nameById.get(sh.mcc_account_id) ?? 'MCC',
        title: 'Open gate shift',
        when_label: this.formatRelativeTime(sh.started_at),
        owner: sh.user.name,
        detail: sh.notes,
        tone: 'info',
        href: '/operations/shifts',
      });
    }

    for (const d of gateDeliveries.slice(0, 15)) {
      activities.push({
        id: `delivery-${d.id}`,
        kind: 'delivery',
        mcc_name: nameById.get(d.mcc_account_id) ?? 'MCC',
        title: `Gate delivery · ${Number(d.gate_volume_litres).toLocaleString()} L`,
        when_label: this.formatRelativeTime(d.arrived_at),
        owner: d.recorded_by.name,
        detail: d.notes,
        tone: d.notes ? 'ok' : 'info',
        href: `/operations/gate`,
      });
    }

    for (const mf of manifests.filter((m) => m.status === 'draft' && m.created_at < staleDraftCutoff).slice(0, 8)) {
      activities.push({
        id: `manifest-draft-${mf.id}`,
        kind: 'manifest',
        mcc_name: nameById.get(mf.mcc_account_id) ?? 'MCC',
        title: `Stale manifest draft · ${mf.manifest_ref}`,
        when_label: this.formatRelativeTime(mf.created_at),
        owner: null,
        detail: null,
        tone: 'warn',
        href: '/operations/manifests',
      });
    }

    for (const t of testResults.filter((x) => x.outcome === 'rejected').slice(0, 8)) {
      const mccId = t.gate_delivery.mcc_account_id;
      activities.push({
        id: `test-${t.id}`,
        kind: 'test',
        mcc_name: nameById.get(mccId) ?? 'MCC',
        title: 'Rejected gate milk test',
        when_label: this.formatRelativeTime(t.tested_at),
        owner: null,
        detail: null,
        tone: 'warn',
        href: '/operations/traceability?outcome=rejected',
      });
    }

    activities.sort((a, b) => {
      const toneRank = { warn: 0, info: 1, ok: 2 };
      return toneRank[a.tone] - toneRank[b.tone];
    });

    const data: SupervisorDashboardData = {
      scope,
      summary,
      trend: { date_labels: dateLabels, series: trendSeries },
      map_pins,
      interventions: interventions.slice(0, 20),
      scoreboard,
      activities: activities.slice(0, 24),
      escalations: escalations.slice(0, 20),
      portfolio,
    };

    return { code: 200, status: 'success', message: 'Dashboard retrieved.', data };
  }
}

