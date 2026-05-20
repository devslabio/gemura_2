/**
 * Snapshot production (or any) platform metrics for calibrating the operator dashboard.
 *
 * Modes:
 *   --mode=api   Login + GET /admin/dashboard/* (needs network + admin credentials)
 *   --mode=sql   Direct Prisma aggregates (needs DATABASE_URL; run on Kwezi API container for prod)
 *
 * Usage:
 *   cd backend
 *   GEMURA_API_URL=https://api.gemura.rw GEMURA_ADMIN_PHONE=... GEMURA_ADMIN_PASSWORD=... \\
 *     npx tsx prisma/fetch-operator-dashboard-prod-baseline.ts --mode=api
 *
 *   DATABASE_URL=postgresql://... npx tsx prisma/fetch-operator-dashboard-prod-baseline.ts --mode=sql
 *
 * Output: prisma/data/operator-dashboard-prod-baseline.json
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

type PeriodKey = 'day' | 'week' | 'month' | 'quarter' | 'year';

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPeriodRange(period: PeriodKey): { date_from: string; date_to: string } {
  const now = new Date();
  let start: Date;
  let end: Date;
  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = start;
      break;
    case 'week':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'quarter': {
      const q = Math.ceil((now.getMonth() + 1) / 3);
      start = new Date(now.getFullYear(), (q - 1) * 3, 1);
      end = new Date(now.getFullYear(), q * 3, 0);
      break;
    }
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
  }
  return { date_from: toYYYYMMDD(start), date_to: toYYYYMMDD(end) };
}

const PERIODS: PeriodKey[] = ['day', 'week', 'month', 'quarter', 'year'];

const OUT_DIR = path.join(__dirname, 'data');
const OUT_FILE = path.join(OUT_DIR, 'operator-dashboard-prod-baseline.json');

function normalizeApiBase(raw: string): string {
  const s = raw.trim().replace(/\/+$/, '');
  return s.endsWith('/api') ? s : `${s}/api`;
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(url, init);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

async function fetchViaApi(): Promise<Record<string, unknown>> {
  const base = normalizeApiBase(process.env.GEMURA_API_URL || 'https://api.gemura.rw');
  const phone = process.env.GEMURA_ADMIN_PHONE?.trim();
  const email = process.env.GEMURA_ADMIN_EMAIL?.trim();
  const password = process.env.GEMURA_ADMIN_PASSWORD?.trim();
  if (!password || (!phone && !email)) {
    throw new Error('Set GEMURA_ADMIN_PASSWORD and GEMURA_ADMIN_PHONE or GEMURA_ADMIN_EMAIL');
  }

  const loginRes = await fetchJson(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      password,
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed HTTP ${loginRes.status}: ${JSON.stringify(loginRes.json)}`);
  }

  const loginBody = loginRes.json as {
    data?: {
      token?: string;
      accounts?: Array<{ account_id: string; account_code?: string; role?: string }>;
    };
  };
  const token = loginBody.data?.token;
  if (!token) throw new Error('Login response missing token');

  const accounts = loginBody.data?.accounts ?? [];
  const preferredCode = process.env.PLATFORM_ACCOUNT_CODE?.trim() || 'ACC_MAIN_001';
  const account =
    accounts.find((a) => a.account_code === preferredCode) ||
    accounts.find((a) => a.role === 'system_admin') ||
    accounts[0];
  if (!account?.account_id) throw new Error('No platform account on login response');

  const accountId = account.account_id;
  const headers = { Authorization: `Bearer ${token}` };
  const tz = String(-new Date().getTimezoneOffset());

  const periods: Record<string, unknown> = {};

  for (const period of PERIODS) {
    const range = getPeriodRange(period);
    const q = new URLSearchParams({
      account_id: accountId,
      date_from: range.date_from,
      date_to: range.date_to,
      tz_offset_minutes: tz,
    });

    const [stats, finance, usage] = await Promise.all([
      fetchJson(`${base}/admin/dashboard/stats?${q}`, { headers }),
      fetchJson(`${base}/admin/dashboard/finance-stats?${q}`, { headers }),
      fetchJson(`${base}/admin/dashboard/usage-stats?${q}`, { headers }),
    ]);

    periods[period] = {
      range,
      stats: stats.json,
      finance: finance.json,
      usage: usage.json,
      http: {
        stats: stats.status,
        finance: finance.status,
        usage: usage.status,
      },
    };
  }

  return {
    fetched_at: new Date().toISOString(),
    mode: 'api',
    api_base: base,
    platform_account_id: accountId,
    platform_account_code: account.account_code ?? preferredCode,
    periods,
    kpi_mapping_notes: KPI_MAPPING_NOTES,
  };
}

const KPI_MAPPING_NOTES = {
  mccs: 'SQL: active tenant/MCC accounts; API: overview.healthRows length or accounts.total (verify)',
  farmers: 'SQL: farms count (status active)',
  collectors: 'usage.summary.milk.distinct_operators or SQL distinct collectors',
  suppliers: 'stats.suppliers.total; period-active: distinct supplier_account_id in milk_sales',
  litres: 'stats.sales.liters',
  rejection_rate: 'rejections.liters / sales.liters',
  rejected_litres: 'stats.rejections.liters',
  payments: 'finance.summary.milk_payments_recorded.amount',
  gate_deliveries: 'usage.summary.mcc_gate_deliveries',
  loans: 'finance.summary.portfolio (active loans principal outstanding)',
};

async function fetchViaSql(): Promise<Record<string, unknown>> {
  const prisma = new PrismaClient();
  const now = new Date();
  const periods: Record<string, unknown> = {};

  try {
    for (const period of PERIODS) {
      const range = getPeriodRange(period);
      const gte = new Date(`${range.date_from}T00:00:00.000Z`);
      const lte = new Date(`${range.date_to}T23:59:59.999Z`);
      const dateFilter = { gte, lte };

      const [
        totalMccAccounts,
        activeMccAccounts,
        totalFarms,
        activeFarms,
        totalUsersActive,
        supplierLinksTotal,
        suppliersDeliveringInPeriod,
        milkAgg,
        rejectedAgg,
        gateDeliveries,
        milkOperators,
        activeLoansAgg,
        milkPaidAgg,
        pendingOnboarding,
      ] = await Promise.all([
        prisma.account.count({ where: { status: 'active', type: 'tenant' } }),
        prisma.account.count({
          where: {
            status: 'active',
            type: 'tenant',
            milk_sales_customer: { some: { sale_at: dateFilter, status: { not: 'deleted' } } },
          },
        }),
        prisma.farm.count(),
        prisma.farm.count({ where: { status: 'active' } }),
        prisma.user.count({ where: { status: 'active' } }),
        prisma.supplierCustomer.count({ where: { relationship_status: 'active' } }),
        prisma.milkSale.findMany({
          where: { sale_at: dateFilter, status: { not: 'deleted' } },
          distinct: ['supplier_account_id'],
          select: { supplier_account_id: true },
        }),
        prisma.milkSale.aggregate({
          where: { sale_at: dateFilter, status: { not: 'deleted' } },
          _sum: { quantity: true },
          _count: { id: true },
        }),
        prisma.milkSale.aggregate({
          where: { sale_at: dateFilter, status: 'rejected' },
          _sum: { quantity: true },
          _count: { id: true },
        }),
        prisma.mccGateDelivery.count({ where: { arrived_at: dateFilter } }),
        prisma.milkSale.findMany({
          where: { sale_at: dateFilter, status: { not: 'deleted' } },
          distinct: ['recorded_by'],
          select: { recorded_by: true },
        }),
        prisma.loan.aggregate({
          where: { status: 'active' },
          _sum: { principal: true, amount_repaid: true },
          _count: { id: true },
        }),
        prisma.milkSale.aggregate({
          where: { sale_at: dateFilter, status: { not: 'deleted' } },
          _sum: { amount_paid: true },
        }),
        prisma.mccOnboardingSubmission.count({
          where: { review_status: { in: ['pending', 'needs_changes'] } },
        }),
      ]);

      const litres = Number(milkAgg._sum.quantity ?? 0);
      const rejectedLitres = Number(rejectedAgg._sum.quantity ?? 0);
      const days = Math.max(
        1,
        Math.floor((lte.getTime() - gte.getTime()) / 86_400_000) + 1,
      );
      const portfolioOutstanding =
        Number(activeLoansAgg._sum.principal ?? 0) - Number(activeLoansAgg._sum.amount_repaid ?? 0);

      periods[period] = {
        range,
        kpis: {
          mccs: { total: totalMccAccounts, active_with_collections: activeMccAccounts },
          farmers: { total: totalFarms, active: activeFarms },
          platform_users_active: totalUsersActive,
          collectors_distinct: milkOperators.filter((r) => r.recorded_by).length,
          suppliers_registered: supplierLinksTotal,
          suppliers_delivering_in_period: suppliersDeliveringInPeriod.length,
          litres_total: litres,
          litres_daily_avg: Math.round(litres / days),
          milk_transactions: milkAgg._count.id,
          rejection_rate_pct: litres > 0 ? Number(((rejectedLitres / litres) * 100).toFixed(2)) : 0,
          rejected_litres: rejectedLitres,
          rejected_transactions: rejectedAgg._count.id,
          payments_recorded_rwf: Number(milkPaidAgg._sum.amount_paid ?? 0),
          gate_deliveries: gateDeliveries,
          loans_outstanding_rwf: portfolioOutstanding,
          active_borrowers: activeLoansAgg._count.id,
          pending_onboarding: pendingOnboarding,
        },
      };
    }

    return {
      fetched_at: new Date().toISOString(),
      mode: 'sql',
      database: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? '(unset)',
      periods,
      kpi_mapping_notes: KPI_MAPPING_NOTES,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const modeArg = process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1];
  const mode = modeArg || process.env.FETCH_MODE || 'sql';

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const payload = mode === 'api' ? await fetchViaApi() : await fetchViaSql();
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`✅ Operator dashboard baseline written: ${OUT_FILE}`);
  console.log(`   Mode: ${mode}`);
  const week = (payload.periods as Record<string, { kpis?: { litres_total?: number } }>)?.week?.kpis;
  if (week?.litres_total != null) {
    console.log(`   Week litres (SQL): ${week.litres_total.toLocaleString()} L`);
  }
}

main().catch((e) => {
  console.error('❌ fetch-operator-dashboard-prod-baseline failed:', e);
  process.exit(1);
});
