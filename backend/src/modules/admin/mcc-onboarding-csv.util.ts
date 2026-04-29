/**
 * Flatten nested JSON for MCC onboarding export (wizard section_payload, etc.).
 * Objects use "_" between keys; arrays of primitives are joined with "; ".
 * Arrays of objects get numeric suffixes: parent_0_key, parent_1_key.
 */
export function cellString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  return String(value);
}

function safeKeyPart(k: string): string {
  return k.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * @param value JSON value to flatten
 * @param prefix non-empty for nested (e.g. "wizard", "gs_response")
 */
export function flattenJsonToRow(value: unknown, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};

  const walk = (val: unknown, p: string) => {
    if (val === null || val === undefined) {
      if (p) out[p] = '';
      return;
    }
    if (val instanceof Date) {
      if (p) out[p] = val.toISOString();
      return;
    }
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      if (p) out[p] = cellString(val);
      return;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        if (p) out[p] = '';
        return;
      }
      const allPrimitive = val.every(
        (x) =>
          x === null ||
          x === undefined ||
          typeof x === 'string' ||
          typeof x === 'number' ||
          typeof x === 'boolean',
      );
      if (allPrimitive) {
        if (p) out[p] = val.map((x) => cellString(x)).filter((s) => s.length > 0).join('; ');
      } else {
        val.forEach((item, i) => {
          const next = p ? `${p}_${i}` : `_${i}`;
          walk(item, next);
        });
      }
      return;
    }
    if (typeof val === 'object') {
      const o = val as Record<string, unknown>;
      const keys = Object.keys(o);
      if (keys.length === 0) {
        if (p) out[p] = '';
        return;
      }
      for (const k of keys) {
        const next = p ? `${p}_${safeKeyPart(k)}` : safeKeyPart(k);
        walk(o[k], next);
      }
    } else {
      if (p) out[p] = cellString(val);
    }
  };

  walk(value, prefix);
  return out;
}

export function escapeCsvField(s: string): string {
  if (s.length === 0) return '';
  if (/[",\n\r]/.test(s) || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const UTF8_BOM = '\uFEFF';

/**
 * Human-readable CSV headers (match admin onboarding detail + wizard sections).
 * Keys are the same internal field names as row data. Unlisted keys use {@link humanizeMccCsvColumnKey}.
 */
const MCC_ONBOARDING_CSV_COLUMN_TITLES: Record<string, string> = {
  // Core / list
  id: 'Submission ID',
  submission_code: 'Submission code',
  business_name: 'Business name',
  common_name: 'Common / local name',
  manager_first_name: 'Manager first name',
  manager_last_name: 'Manager last name',
  manager_phone: 'Manager phone',
  manager_id_number: 'Manager ID number',
  // Location (resolved + raw IDs)
  location_path: 'Location (hierarchy path)',
  location_label_province: 'Province (label)',
  location_label_district: 'District (label)',
  location_label_sector: 'Sector (label)',
  location_label_cell: 'Cell (label)',
  location_label_village: 'Village (label)',
  location_province_id: 'Province (ID or code)',
  location_district_id: 'District (ID or code)',
  location_sector_id: 'Sector (ID or code)',
  location_cell_id: 'Cell (ID or code)',
  location_village_id: 'Village (ID or code)',
  // Wizard summary (duplicates final_decision in DB; kept for comparison)
  final_decision: 'Wizard decision',
  pass_count: 'Wizard pass count (of 8)',
  // Admin review
  review_status: 'Review status',
  review_notes: 'Review notes',
  reviewed_at: 'Reviewed at',
  reviewed_by_user_id: 'Reviewed by (user ID)',
  reviewed_by_name: 'Reviewed by (name)',
  reviewed_by_email: 'Reviewed by (email)',
  linked_user_id: 'Linked user ID',
  linked_user_name: 'Linked user name',
  linked_user_email: 'Linked user email',
  linked_user_phone: 'Linked user phone',
  linked_account_id: 'Linked account ID',
  linked_account_code: 'Linked account code',
  linked_account_name: 'Linked account name',
  linked_account_status: 'Linked account status',
  google_sheet_status: 'Google Sheet status',
  google_sheet_error: 'Google Sheet error',
  created_at: 'Submitted at (UTC)',
  updated_at: 'Last updated (UTC)',

  // —— Wizard root (not under section*) ——
  wizard_operatorDisability: 'Operator has disability',
  wizard_ownershipStructure: 'Ownership structure',
  wizard_ownershipOther: 'Ownership — other',
  wizard_registrationNumber: 'RURA / RAB registration',
  wizard_operationalStatus: 'Operational status',
  wizard_operationalNotes: 'Operational notes',

  // Section 1 — location & geo
  wizard_section1Location_provinceId: 'Section 1: Province (raw)',
  wizard_section1Location_districtId: 'Section 1: District (raw)',
  wizard_section1Location_sectorId: 'Section 1: Sector (raw)',
  wizard_section1Location_cellId: 'Section 1: Cell (raw)',
  wizard_section1Location_villageId: 'Section 1: Village (raw)',
  wizard_section1Location_latitude: 'Section 1: Latitude',
  wizard_section1Location_longitude: 'Section 1: Longitude',

  // Section 2 — infrastructure
  wizard_section2_dailyMilkVolume: 'Section 2: Daily milk volume (avg L/day)',
  wizard_section2_maxMilkInOneDay: 'Section 2: Max milk in one day (L)',
  wizard_section2_tankCapacitySufficiency: 'Section 2: Tank capacity sufficiency',
  wizard_section2_generatorCapacityKva: 'Section 2: Generator capacity (kVA)',
  wizard_section2_mobileConnectivity: 'Section 2: Mobile connectivity',
  wizard_section2_powerSupplySelections: 'Section 2: Power supply sources',
  wizard_section2_insufficientCapacityPlan: 'Section 2: Plan if capacity insufficient',

  // Section 3 — supply network
  wizard_section3_totalFarmersSupplying: 'Section 3: Total farmers supplying',
  wizard_section3_newFarmersLast3Months: 'Section 3: New farmers (last 3 months)',
  wizard_section3_milkTransportersCount: 'Section 3: Milk transporters (Abacunda)',
  wizard_section3_averageDistanceKm: 'Section 3: Average distance (km)',
  wizard_section3_furthestFarmKm: 'Section 3: Furthest farm (km)',
  wizard_section3_eveningMilkPattern: 'Section 3: Evening milk pattern',
  wizard_section3_ownMilkTransportType: 'Section 3: Own milk transport',
  wizard_section3_noEveningMilkReason: 'Section 3: No evening milk — reason',
  wizard_section3_noOwnTransportPlan: 'Section 3: No own transport — plan',

  // Section 4 — quality
  wizard_section4_testingEquipmentSelections: 'Section 4: Testing equipment present',
  wizard_section4_qualityTestsSelections: 'Section 4: Quality tests on every delivery',
  wizard_section4_averageRejectedPerDayLitres: 'Section 4: Avg rejected per day (L)',
  wizard_section4_rejectionRatePercent: 'Section 4: Rejection rate (%)',
  wizard_section4_otherRejectionReason: 'Section 4: Other rejection reason',
  wizard_section4_correctiveActionsPlanned: 'Section 4: Corrective actions',

  // Section 5 — people (prefix Staff / Cooperative to disambiguate)
  wizard_section5_staffTotalIncludingManager: 'Section 5 — Staff: Total (incl. manager)',
  wizard_section5_staffWomenCount: 'Section 5 — Staff: Women',
  wizard_section5_staffAged1835: 'Section 5 — Staff: Aged 18–35',
  wizard_section5_staffWomen1835: 'Section 5 — Staff: Women aged 18–35',
  wizard_section5_staffWithDisability: 'Section 5 — Staff: With disability',
  wizard_section5_coopMembersTotal: 'Section 5 — Coop members: Total',
  wizard_section5_coopMembersWomen: 'Section 5 — Coop members: Women',
  wizard_section5_coopMembersAged1835: 'Section 5 — Coop members: Aged 18–35',
  wizard_section5_coopMembersWomen1835: 'Section 5 — Coop members: Women aged 18–35',

  // Section 6 — operations
  wizard_section6_recordSystem: 'Section 6: Record system',
  wizard_section6_staffTrainingStatus: 'Section 6: Staff training status',
  wizard_section6_employmentContractsStatus: 'Section 6: Employment contracts',
  wizard_section6_digitalLedgerWillingness: 'Section 6: Digital ledger willingness',
  wizard_section6_digitalDeviceAccess: 'Section 6: Digital devices available',
  wizard_section6_farmerPaymentMethods: 'Section 6: Farmer payment methods',
  wizard_section6_avgDaysDeliveryToPayment: 'Section 6: Avg days delivery → payment',
  wizard_section6_averageAnnualRevenueRwf: 'Section 6: Avg annual revenue (RWF)',
  wizard_section6_milkSalesDestinations: 'Section 6: Milk sales destinations',
  wizard_section6_mainBuyerName: 'Section 6: Main buyer',
  wizard_section6_formalSupplyAgreementDetails: 'Section 6: Formal supply agreement',

  // Section 7 — final assessment
  wizard_section7_passCount: 'Section 7: Pass count (wizard duplicate)',
  wizard_section7_decision: 'Section 7: Decision (wizard duplicate)',
  wizard_section7_keyGaps: 'Section 7: Key gaps requiring action',
  wizard_section7_assessment_coolingCapacity: 'Section 7 — Result: Functioning cooling tank with confirmed capacity',
  wizard_section7_assessment_connectivityViable: 'Section 7 — Result: 3G/4G OR offline sync confirmed viable',
  wizard_section7_assessment_powerBackup: 'Section 7 — Result: Power backup (generator or solar) for cooling tank',
  wizard_section7_assessment_ledgerWillingness: 'Section 7 — Result: Management willing to adopt daily digital ledger',
  wizard_section7_assessment_qualityEquipment: 'Section 7 — Result: Milk quality testing equipment present and in use',
  wizard_section7_assessment_amlClear: 'Section 7 — Result: No active AML or blacklist flags',
  wizard_section7_assessment_minFarmers: 'Section 7 — Result: Minimum 10 farmers currently supplying',
  wizard_section7_assessment_rejectionTracking: 'Section 7 — Result: Rejection reason tracking in place',
  wizard_section7_notes_coolingCapacity: 'Section 7 — Agent note: Functioning cooling tank with confirmed capacity',
  wizard_section7_notes_connectivityViable: 'Section 7 — Agent note: 3G/4G OR offline sync',
  wizard_section7_notes_powerBackup: 'Section 7 — Agent note: Power backup for cooling',
  wizard_section7_notes_ledgerWillingness: 'Section 7 — Agent note: Digital ledger',
  wizard_section7_notes_qualityEquipment: 'Section 7 — Agent note: Quality equipment',
  wizard_section7_notes_amlClear: 'Section 7 — Agent note: AML / blacklist',
  wizard_section7_notes_minFarmers: 'Section 7 — Agent note: Minimum farmers',
  wizard_section7_notes_rejectionTracking: 'Section 7 — Agent note: Rejection tracking',
};

const SECTION7_RESULT_LABELS: Record<string, string> = {
  coolingCapacity: 'Functioning cooling tank with confirmed capacity',
  connectivityViable: '3G/4G OR offline sync confirmed viable',
  powerBackup: 'Power backup (generator or solar) for cooling tank',
  ledgerWillingness: 'Management willing to adopt daily digital ledger',
  qualityEquipment: 'Milk quality testing equipment present and in use',
  amlClear: 'No active AML or blacklist flags (auto-screen result)',
  minFarmers: 'Minimum 10 farmers currently supplying',
  rejectionTracking: 'At least basic rejection reason tracking in place',
};

/** Regex: wizard_section2_coolingTanks_{idx}_{subfield} */
const RE_COOLING_TANK = /^wizard_section2_coolingTanks_(\d+)_(tankNumber|capacityLitres|yearOrAge|condition)$/;
const RE_REJECTION_RANK = /^wizard_section4_rejectionRankings_(.+)$/;
const RE_ASSESSMENT_ANY = /^wizard_section7_assessment_(.+)$/;
const RE_NOTES_ANY = /^wizard_section7_notes_(.+)$/;

const COOLING_TANK_SUB: Record<string, string> = {
  tankNumber: 'Tank name / #',
  capacityLitres: 'Capacity (L)',
  yearOrAge: 'Year / age',
  condition: 'Condition',
};

/**
 * Public for tests / reuse. Maps internal row key → CSV header text.
 */
export function resolveMccOnboardingColumnTitle(key: string): string {
  if (MCC_ONBOARDING_CSV_COLUMN_TITLES[key]) {
    return MCC_ONBOARDING_CSV_COLUMN_TITLES[key];
  }

  let m = key.match(RE_COOLING_TANK);
  if (m) {
    const n = String(Number(m[1]) + 1);
    const sub = COOLING_TANK_SUB[m[2]] || m[2];
    return `Section 2 — Cooling tank ${n}: ${sub}`;
  }

  m = key.match(RE_REJECTION_RANK);
  if (m) {
    const readable = m[1].replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return `Section 4 — Rejection reason rank: ${readable}`;
  }

  m = key.match(RE_ASSESSMENT_ANY);
  if (m) {
    const k = m[1];
    const long = SECTION7_RESULT_LABELS[k] || k.replace(/_/g, ' ');
    return `Section 7 — Result: ${long}`;
  }

  m = key.match(RE_NOTES_ANY);
  if (m) {
    const k = m[1];
    const long = SECTION7_RESULT_LABELS[k] || k.replace(/_/g, ' ');
    return `Section 7 — Agent note: ${long}`;
  }

  if (key.startsWith('gs_response_')) {
    return 'Google Sheet: ' + humanizeMccCsvSegment(key.slice('gs_response_'.length));
  }
  if (key.startsWith('wizard_')) {
    return humanizeMccWizardKey(key);
  }

  return humanizeMccCsvSegment(key);
}

function humanizeMccWizardKey(fullKey: string): string {
  const rest = fullKey.slice('wizard_'.length);
  return 'Wizard: ' + humanizeMccCsvSegment(rest);
}

/** Fallback for unknown column keys: snake_case and camelCase fragments → words. */
function humanizeMccCsvSegment(s: string): string {
  const withSpaces = s
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[_\s]+/)
    .filter((p) => p.length > 0);
  if (withSpaces.length === 0) return s;
  return withSpaces
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// —— Value humanization (export cells match admin-friendly wording) ——

const REVIEW_STATUS_VALUE: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_changes: 'Needs changes',
};

const WIZARD_DECISION_VALUE: Record<string, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  CONDITIONAL: 'Conditional',
  pass: 'Pass',
  fail: 'Fail',
  conditional: 'Conditional',
};

const GOOGLE_SHEET_STATUS_VALUE: Record<string, string> = {
  not_configured: 'Not configured',
  sent: 'Sent to Google Sheet',
  failed: 'Failed to send to Google Sheet',
};

const ACCOUNT_STATUS_VALUE: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

const PASS_FAIL_VALUE: Record<string, string> = {
  pass: 'Pass',
  fail: 'Fail',
  'n/a': 'N/A',
  na: 'N/A',
  N_A: 'N/A',
  none: '—',
};

const ISO8601_LOOSE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

/**
 * Formats a cell for CSV: readable statuses, pass/fail, decisions, pass counts, ISO datetimes, and light cleanup for code-like enum strings in wizard data.
 * Column keys are unchanged; only the displayed cell text is transformed.
 */
export function humanizeMccOnboardingValue(columnKey: string, raw: string): string {
  if (raw.length === 0) return raw;

  // Skip humanizing if already multi-line or very long (notes, JSON snippets)
  if (raw.length > 4000 || raw.includes('\n')) {
    return raw;
  }

  if (columnKey === 'review_status' && REVIEW_STATUS_VALUE[raw] !== undefined) {
    return REVIEW_STATUS_VALUE[raw];
  }
  if (columnKey === 'google_sheet_status' && GOOGLE_SHEET_STATUS_VALUE[raw] !== undefined) {
    return GOOGLE_SHEET_STATUS_VALUE[raw];
  }
  if (columnKey === 'linked_account_status' && ACCOUNT_STATUS_VALUE[raw] !== undefined) {
    return ACCOUNT_STATUS_VALUE[raw];
  }
  if ((columnKey === 'final_decision' || columnKey === 'wizard_section7_decision') && WIZARD_DECISION_VALUE[raw] !== undefined) {
    return WIZARD_DECISION_VALUE[raw];
  }
  if (columnKey === 'pass_count' || columnKey === 'wizard_section7_passCount' || columnKey === 'section7_pass_count') {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 20) {
      return `${n} of 8`;
    }
  }
  if (columnKey.startsWith('wizard_section7_assessment_') || columnKey.startsWith('section7_result_')) {
    if (PASS_FAIL_VALUE[raw] !== undefined) {
      return PASS_FAIL_VALUE[raw];
    }
    const low = raw.toLowerCase();
    if (low === 'n/a' || low === 'na') return 'N/A';
  }

  if (
    columnKey === 'created_at' ||
    columnKey === 'updated_at' ||
    columnKey === 'reviewed_at' ||
    columnKey === 'wizard_submittedAt'
  ) {
    const f = tryFormatIsoToReadableUtc(raw);
    if (f) return f;
  }

  if (columnKey.startsWith('gs_response_') || columnKey.startsWith('wizard_')) {
    if (ISO8601_LOOSE.test(raw.trim())) {
      const f = tryFormatIsoToReadableUtc(raw.trim());
      if (f) return f;
    }
  }

  if (ISO8601_LOOSE.test(raw.trim())) {
    const f = tryFormatIsoToReadableUtc(raw.trim());
    if (f) return f;
  }

  if (columnKey.startsWith('wizard_') && isLikelySnakeCodeValue(raw)) {
    return humanizeSnakeCodeToWords(raw);
  }

  if (raw.includes('; ')) {
    return raw
      .split('; ')
      .map((part) => {
        const t = part.trim();
        if (t.length > 0 && t.length < 64 && isLikelySnakeCodeValue(t) && !t.includes('—')) {
          return humanizeSnakeCodeToWords(t);
        }
        return part;
      })
      .join('; ');
  }

  return raw;
}

function tryFormatIsoToReadableUtc(s: string): string | null {
  if (!ISO8601_LOOSE.test(s.trim())) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day} ${h}:${min} UTC`;
}

function isLikelySnakeCodeValue(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (t.length >= 32 && t.includes('-') && /^[0-9a-f-]+$/i.test(t)) {
    return false; // UUID-style id
  }
  if (t.includes(' ')) return false; // free text / option with spaces
  if (/(?:[A-Z].*){2,}/.test(t) && t.length > 3) return false; // "HTTP" or "RWF" or mixed
  if (/^[\d.]+$/.test(t)) return false;
  if (t === '—' || t === '--') return false;
  if (!/^[a-z0-9_/+-]+$/.test(t.replace(/[—-]/g, '-'))) return false; // allow hyphens
  if (t.includes('_')) return true;
  if (/^[a-z]+$/.test(t) && t.length > 2 && t.length < 20) return true; // "pending" as single word code
  return false;
}

function humanizeSnakeCodeToWords(s: string): string {
  return s
    .split(/[_-]+/)
    .filter((p) => p.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Preferred column order (subset); remaining keys are sorted alphabetically. */
export const MCC_ONBOARDING_CSV_PRIMARY_KEYS: string[] = [
  'id',
  'submission_code',
  'business_name',
  'common_name',
  'manager_first_name',
  'manager_last_name',
  'manager_phone',
  'manager_id_number',
  'location_path',
  'location_label_province',
  'location_label_district',
  'location_label_sector',
  'location_label_cell',
  'location_label_village',
  'location_province_id',
  'location_district_id',
  'location_sector_id',
  'location_cell_id',
  'location_village_id',
  'final_decision',
  'pass_count',
  'review_status',
  'review_notes',
  'reviewed_at',
  'reviewed_by_user_id',
  'reviewed_by_name',
  'reviewed_by_email',
  'linked_user_id',
  'linked_user_name',
  'linked_user_email',
  'linked_user_phone',
  'linked_account_id',
  'linked_account_code',
  'linked_account_name',
  'linked_account_status',
  'google_sheet_status',
  'google_sheet_error',
  'section1_latitude',
  'section1_longitude',
  'section2_tank_count',
  'section2_total_cooling_capacity_litres',
  'section2_daily_milk_volume_litres',
  'section2_max_milk_one_day_litres',
  'section2_tank_capacity_sufficiency',
  'section2_generator_capacity_kva',
  'section2_mobile_connectivity',
  'section2_power_supply_sources',
  'section3_total_farmers_supplying',
  'section3_new_farmers_last_3_months',
  'section3_transporters_count',
  'section3_average_distance_km',
  'section3_furthest_farm_km',
  'section3_evening_milk_pattern',
  'section3_own_transport_type',
  'section4_testing_equipment',
  'section4_quality_tests',
  'section4_avg_rejected_per_day_litres',
  'section4_rejection_rate_percent',
  'section4_top_rejection_reasons',
  'section4_other_rejection_reason',
  'section5_staff_total',
  'section5_staff_women',
  'section5_staff_aged_18_35',
  'section5_staff_women_aged_18_35',
  'section5_staff_with_disability',
  'section5_members_total',
  'section5_members_women',
  'section5_members_aged_18_35',
  'section5_members_women_aged_18_35',
  'section6_record_system',
  'section6_staff_training_status',
  'section6_employment_contracts_status',
  'section6_digital_ledger_willingness',
  'section6_digital_devices_available',
  'section6_farmer_payment_methods',
  'section6_avg_days_delivery_to_payment',
  'section6_average_annual_revenue_rwf',
  'section6_milk_sales_destinations',
  'section6_main_buyer_name',
  'section6_formal_supply_agreement',
  'section7_decision',
  'section7_pass_count',
  'section7_key_gaps',
  'section7_result_cooling_capacity',
  'section7_result_connectivity_viable',
  'section7_result_power_backup',
  'section7_result_ledger_willingness',
  'section7_result_quality_equipment',
  'section7_result_aml_clear',
  'section7_result_min_farmers',
  'section7_result_rejection_tracking',
  'created_at',
  'updated_at',
];

export function buildCsvFromRows(allRows: Record<string, string>[]): string {
  if (allRows.length === 0) {
    return (
      escapeCsvField('Message') + '\r\n' + escapeCsvField('No submissions match the filter.')
    );
  }
  const keySet = new Set<string>();
  for (const r of allRows) {
    Object.keys(r).forEach((k) => keySet.add(k));
  }
  const primaryRest = MCC_ONBOARDING_CSV_PRIMARY_KEYS.filter((k) => keySet.has(k));
  for (const k of MCC_ONBOARDING_CSV_PRIMARY_KEYS) {
    keySet.delete(k);
  }
  const rest = [...keySet].sort((a, b) => a.localeCompare(b, 'en'));
  const header = [...primaryRest, ...rest];
  const titleRow = header.map((h) => escapeCsvField(resolveMccOnboardingColumnTitle(h)));
  const lines: string[] = [titleRow.join(',')];
  for (const row of allRows) {
    lines.push(
      header
        .map((h) => escapeCsvField(humanizeMccOnboardingValue(h, row[h] ?? '')))
        .join(','),
    );
  }
  return UTF8_BOM + lines.join('\r\n');
}
