# MCC Role Dashboard Specification — Implementation Todo List

Source: Gemura × VIBE **MCC Role Dashboard Specification** (Version 1, April 2026).  
This document translates the gap analysis versus the current Gemura codebase into a structured backlog.

**Current baseline:** MCC operations use `MilkSale`-centric collections (one supplier per record), permission-based navigation, stats overview, finance/inventory/loans, and basic accept/reject with rejection reasons. **Umucunda manifests, delivery/traceability types, structured vet testing, and role-specific dashboards are largely not implemented.**

---

## 1. Data model and traceability core

- [ ] Introduce **delivery** concept with `delivery_id`, `source_type` (`direct` | `umucunda_A` | `umucunda_B`), `source_id`, authoritative **`gate_volume_litres`**, optional `manifest_id`, linkage to `test_result_id` (per spec §12.2).
- [ ] Introduce **manifest** entity: `manifest_id`, `umucunda_id`, `delivery_id`, `constituent_farms[]` (`farmer_id`, `declared_litres`, `container_id`), route/GPS metadata where available (§2.2–2.3).
- [ ] Enforce **declared volumes sum** within **0.5 L** of gate scale reading before manifest acceptance (§2.2, §12.1).
- [ ] Introduce **test_result** entity: accept/reject, `rejection_cause`, `source_resolution_status` (`resolved` | `secondary_test` | `frozen` | `auto_zero`) (§12.2).
- [ ] Introduce **credit_event** (or equivalent) referencing `farmer_id`, `delivery_id`, `manifest_id` (if Umucunda), `volume_credited`, `test_result_id` (§12.2).
- [ ] Define migration/refactor path from current **`milk_sales`** (single `supplier_account_id` per row) to delivery + optional multi-farm allocation for Umucunda batches.
- [ ] **Manifest immutability** after acceptance; amendments only with **MCC Manager** approval + audit log (§12.1).
- [ ] Generate unique **manifest reference number** visible to all constituent farmers (§12.1).

---

## 2. Umucunda workflow and payment rules

- [ ] **Block vet acceptance** for Umucunda deliveries until manifest is **submitted** (§4.4).
- [ ] Implement **payment hold rules**: no manifest → hold Umucunda payment and freeze constituent farmer credit updates; rejected batch → hold fees/payments pending resolution; accepted → release timelines per spec (§2.4).
- [ ] **Mixed batch rejection**: separate-container vs full-batch paths; frozen farms; resolution options (secondary per-farm test, signed declaration, manager proportional allocation); **48h** auto zero-delivery + compliance penalty (§2.3).
- [ ] **Type B pre-payment**: record collector advance, net farmer payment on acceptance, recover advance from collection fee; handle rejected batch collector loss rules (§2.4, §9.2).
- [ ] **Manifest compliance scoring** (30-day on-time %); thresholds **80%** warning / review, **70%** two consecutive months → route suspension pending manager (§8–9, §11).

---

## 3. Offline and sync (§12.1, §12.3)

- [ ] **Offline manifest** creation/submission with local queue; timestamp at submission time, not sync time (§12.1).
- [ ] Sync engine for queued manifests (and GPS route data when offline).
- [ ] **Vet**: offline test entry queue; show pending manifests from offline store (§12.3).
- [ ] **Casual laborer**: offline task log sync (§12.3).
- [ ] **MCC Manager**: offline read of last-synced data; queue alerts and manifest approvals for sync (§12.3).

---

## 4. Roles and permissions

- [ ] Map platform roles to **nine MCC personas**: Manager, Veterinary Officer, Casual Laborer, Leadership, Regulator, Umucunda Type A, Umucunda Type B, Direct farmer (supplier), and clarify coexistence with existing `UserAccountRole` / types (§1.1, §10).
- [ ] Implement **permissions matrix** behaviors (§10): manifests (manager edit vs Umucunda own vs leadership compliance % only); PII restrictions for leadership/regulator; vet vs laborer boundaries.
- [ ] **Regulator**: time-limited or recurring read-only provisioning by Gemura Ops; **audit trail** for all regulator access (§7.2).
- [ ] Fix **Vet vs Agent/collector** conflation in web UI (today vet-like roles may share limited dashboard paths with `agent`) — align with dedicated vet gate experience (§4).

---

## 5. Dashboard — MCC Manager (§3)

- [ ] KPI: total litres today vs **7-day average** (green/amber/red thresholds).
- [ ] KPI: deliveries logged vs **expected** (registered farmers + scheduled Umucunda routes).
- [ ] KPI: **Via Umucunda** (litres, collector count, farm count) + **Direct farmer** litres/count.
- [ ] KPI: **Rejected today** (litres, %, count) with amber/red rules.
- [ ] KPI: **Unresolved rejection sources** (red if &gt; 0; manager SLA **48h**).
- [ ] KPI: **Tank capacity** (% used, L used/total); amber/red thresholds; evening projection alerts (sensor and/or manual path).
- [ ] KPI: **Manifest compliance today** (X of Y submitted; red if pending &gt; **2h** post-delivery).
- [ ] KPI: **Staff on shift** by role; tap for assignments.
- [ ] KPI: **Wallet balance** vs SaaS fee threshold (e.g. **80,000 RWF** red rule per spec).
- [ ] Panel: **delivery source breakdown** + per-Umucunda compliance tracker (expected volume, submitted status, payment hold).
- [ ] Panel: **staff on shift** table + laborer **reassignment** + overtime &gt; **8h** flag.
- [ ] Panel: **rejection events** with traceability status + **manager approve resolution**.
- [ ] Panel: **alerts queue** (tank, manifest delays, generator fuel, credit tier changes, Gemura ops escalations).

---

## 6. Dashboard — Veterinary Officer (§4)

- [ ] KPIs: tests completed, batches accepted/rejected (rates), Umucunda batch count, unresolved sources, **queue depth** (alert if &gt; 5).
- [ ] Panel: **test queue** ordered by arrival; manifest status; **Test now** action.
- [ ] Forms: **direct farmer** test fields (temperature, fat %, alcohol pass/fail, lactometer, antibiotic strip, visual inspection, notes) → derive accept/reject; store fat as credit signal (§4.4).
- [ ] Forms: **Umucunda batch** same tests + read-only manifest breakdown; accept credits all farms; reject triggers **source resolution** workflow (§4.4).
- [ ] Panel: **rejection source resolution** + secondary per-container test logging (§4.4).

---

## 7. Dashboard — Casual Laborer (§5)

- [ ] Role-assigned **task-only** UI (no finance/credit/wallets beyond minimal manifest identifiers per spec).
- [ ] **Gate recorder**: arrival log (who, type direct/A/B, volume, manifest yes/no flag).
- [ ] **Weighing operator**: delivery ID, gross/net weight flow + read-only daily log.
- [ ] **Tank monitor**: scheduled readings (level, temperature, chiller status); auto-alert manager on thresholds (§5.4).
- [ ] **Cleaning**: checklist with timestamps; visible to manager dashboard.

---

## 8. Dashboard — MCC Leadership (§6)

- [ ] **Daily 6pm** summary (volume, rejection rate, manifest compliance, wallet) via SMS + app notification (§6.2).
- [ ] **Weekly Monday** report (volume trend, participation table, top/bottom farmers by volume, Umucunda summary, financial summary, alerts) (§6.2).
- [ ] **Monthly** governance report (reconciliation, SaaS billing, loan **count** only, compliance, committee agenda hints) (§6.2).
- [ ] KPIs/panels: week volume, active members, week revenue, rejection rate, Umucunda compliance %, active loans **count**, SaaS billing status, 8-week trend, participation buckets, Umucunda governance table, governance flags (§6.3–6.4).
- [ ] Enforce **no individual** wallet balances, credit scores, or personal financials — aggregates and participation only (§6.4).

---

## 9. Dashboard — Regulator (§7)

- [ ] KPIs: licence status, certified tank capacity, utilisation, generator/fuel compliance, 30-day rejection rate, testing compliance %, rejection traceability % (§7.3).
- [ ] Panels: **quality compliance record** (monthly table, export **PDF**); **infrastructure** read-only; **6-month rejection trend** vs targets (§7.4).
- [ ] Ensure **no farmer PII/financial/credit** in regulator views (§7).

---

## 10. Dashboard — Umucunda Type A & B (§8–9)

- [ ] **Type A**: split KPIs (own milk vs collected litres), earnings (farmer rate vs collection fee), credit score (own production only), manifest compliance record (§8.3–8.4).
- [ ] Panels: today’s manifest breakdown, earnings breakdown, route farms (manager-approved changes only), farmer verification/disputes flags (§8.4).
- [ ] **Type B**: manifest-first mobile UX; payment held/released; collection fee; pre-payment tracker and net settlement panel; 30-day compliance chart (§9.3–9.4).
- [ ] **Onboarding** for Type A/B distinct from generic farmer onboarding (spec §13).

---

## 11. Notifications and escalation (§11)

- [ ] Manifest not submitted **&gt;2h** after delivery → notify manager + Umucunda; payment hold (§11).
- [ ] Mixed batch rejected → vet + manager + Umucunda; source resolution (§11).
- [ ] Unresolved rejection **&gt;48h** → critical path + zero-delivery automation (§11).
- [ ] Tank **&gt;85%**, generator fuel **&gt;7d** overdue, compliance **&lt;80%** / **&lt;70%** two months, antibiotic positive, adulteration repeated events, regulator access request — per matrix (§11).

---

## 12. Localization and display (§12.4)

- [ ] **Kinyarwanda** default for Farmer, Umucunda, Laborer, Manager (where applicable); **English** available; regulator/leadership defaults per spec.
- [ ] Volumes: **litres, one decimal**; money: **RWF, integer, thousands separators**; timestamps: **DD-MMM-YYYY HH:mm** (24h).

---

## 13. Product validation (spec §13)

- [ ] Validate Umucunda workflow with **3–5 active collectors** (manifest UI speed at gate).
- [ ] Confirm **per-litre collection fee** and pre-payment recovery rules with finance before Type B build.
- [ ] Confirm **regulator access model** with RAB/RURA (time-limited vs persistent read-only).
- [ ] Define **collection route** registration/amendment authority (who adds/removes farms).
- [ ] Decide tank alerts: **sensor** vs **manual** logging per MCC.

---

## Appendix — Related repo pointers

- Collections API/DTOs: `backend/src/modules/collections/`
- Milk transaction model: `MilkSale` in `backend/prisma/schema.prisma`
- Web dashboard: `apps/gemura-web/app/(authenticated)/dashboard/page.tsx`
- Nav/permissions: `apps/gemura-web/lib/config/nav.config.ts`, `apps/gemura-web/lib/services/permission.service.ts`
- Mobile Umucunda label only: `apps/gemura-mobile/.../register_employee_screen.dart`, `manage_account_access_screen.dart`
