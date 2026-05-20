# Operator dashboard — production baseline

Before wiring the operator overview to live APIs, capture real platform numbers from production so mock scaling and labels match reality.

## What gets captured

For each period preset (`day`, `week`, `month`, `quarter`, `year`):

| KPI | SQL field | Live API (when dynamic) |
|-----|-----------|-------------------------|
| MCCs | `mccs.total` / `active_with_collections` | `GET /admin/dashboard/stats` + overview |
| Farmers | `farmers.total` / `active` | farms aggregate (SQL) or future API |
| Collectors | `collectors_distinct` | `usage-stats` → `milk.distinct_operators` |
| Suppliers | `suppliers_*` | `stats.suppliers` + distinct suppliers in period |
| Litres | `litres_total`, `litres_daily_avg` | `stats.sales.liters` |
| Rejection rate | `rejection_rate_pct` | `rejections.liters` / `sales.liters` |
| Rejected litres | `rejected_litres` | `stats.rejections.liters` |
| Payments | `payments_recorded_rwf` | `finance-stats` → `milk_payments_recorded` |
| Gate deliveries | `gate_deliveries` | `usage-stats` → `mcc_gate_deliveries` |
| Loans | `loans_outstanding_rwf`, `active_borrowers` | `finance-stats` portfolio |

Output file: `backend/prisma/data/operator-dashboard-prod-baseline.json`

## Option A — SQL on Kwezi (recommended)

Uses `DATABASE_URL` inside the API container (no public API exposure).

```bash
# From repo root (needs SERVER_PASS in server-credentials.sh)
./scripts/gemura/ops/run-fetch-operator-dashboard-prod-baseline.sh
```

UAT:

```bash
GEMURA_API_CONTAINER=gemura-uat-api ./scripts/gemura/ops/run-fetch-operator-dashboard-prod-baseline.sh
```

## Option B — SQL locally

Point at a prod restore or tunneled DB:

```bash
cd backend
DATABASE_URL='postgresql://...' npx tsx prisma/fetch-operator-dashboard-prod-baseline.ts --mode=sql
```

## Option C — Production API

```bash
cd backend
GEMURA_API_URL=https://api.gemura.rw \
GEMURA_ADMIN_PHONE=250780559310 \
GEMURA_ADMIN_PASSWORD='...' \
npx tsx prisma/fetch-operator-dashboard-prod-baseline.ts --mode=api
```

Requires a user with `dashboard.view` (system admin or platform operator on `ACC_MAIN_001`).

## Next step (dynamic UI)

1. Review `operator-dashboard-prod-baseline.json` (especially `periods.week.kpis`).
2. Replace `buildOperatorDashboardForPeriod` mock scaling with API calls to:
   - `adminApi.getDashboardStats`
   - `adminApi.getFinanceDashboardStats`
   - `adminApi.getUsageDashboardStats`
3. Map responses using the table above; keep period toolbar URL in sync (already shared with system admin).

## npm script

```bash
cd backend && npm run fetch:operator-dashboard-prod-baseline
```

Add `--` args: `npm run fetch:operator-dashboard-prod-baseline -- --mode=api`
