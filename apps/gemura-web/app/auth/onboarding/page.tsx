'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import Icon, { faArrowLeft, faBuilding, faMapPin, faCheckCircle } from '@/app/components/Icon';

type ProvinceDistrictMap = Record<string, string[]>;
type LocationOption = {
  id: string;
  label: string;
};
type LocationNode = {
  id: string;
  code: string;
  name: string;
  location_type: string;
  parent_id: string | null;
};
type LocationsResponse = {
  code: number;
  status: string;
  message?: string;
  data: LocationNode[];
};
type OnboardingField = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'email' | 'tel' | 'select';
  options?: string[];
  placeholder?: string;
};

const RWANDA_PROVINCE_DISTRICTS: ProvinceDistrictMap = {
  Kigali: ['Gasabo', 'Kicukiro', 'Nyarugenge'],
  Northern: ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
  Southern: ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyanza', 'Nyaruguru', 'Ruhango'],
  Eastern: ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana'],
  Western: ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rusizi', 'Rutsiro'],
};

const provinces = Object.keys(RWANDA_PROVINCE_DISTRICTS);

const identityFields: OnboardingField[] = [
  { key: 'commonMccName', label: 'B1. MCC name (common/local)' },
  { key: 'operatorManagerName', label: 'B3. Operator / manager name' },
  { key: 'operatorPhone', label: 'B3. Operator / manager phone', type: 'tel' },
  { key: 'operatorNationalId', label: 'B3. Operator / manager national ID' },
  {
    key: 'ownershipStructure',
    label: 'B4. Ownership structure',
    type: 'select',
    options: [
      'Privately owned — individual',
      'Privately owned — company (Ltd)',
      'Farmer cooperative (registered)',
      'Government-supported / NGO-established',
      'Other',
    ],
  },
  { key: 'ownershipStructureOther', label: 'B4. Ownership structure (Other - specify)' },
  { key: 'ownerPwdStatus', label: 'B5. Does the MCC operator/owner have a disability?', type: 'select', options: ['Yes', 'No', 'Prefer not to say'] },
  {
    key: 'mccOperationalStatus',
    label: 'B6. Is this MCC currently operational?',
    type: 'select',
    options: ['Yes — fully operational', 'Partially operational', 'Not currently operating'],
  },
  { key: 'mccOperationalNotes', label: 'B6. If partial or not operating, explain' },
  { key: 'ruraRabRegistrationNumber', label: 'B7. RURA / RAB registration number (if registered)' },
];

const shareholderFields: OnboardingField[] = [
  { key: 'ownershipStructure', label: 'Ownership Structure', type: 'select', options: ['Privately owned — individual', 'Privately owned — company (Ltd)', 'Farmer cooperative (registered)', 'Government-supported / NGO-established', 'Other'] },
  { key: 'ownershipStructureOther', label: 'Ownership Structure (Other - specify)' },
  { key: 'cooperativeMembersTotal', label: 'B27. Total cooperative members / shareholders', type: 'number' },
  { key: 'cooperativeMembersWomen', label: 'B28. Cooperative members who are women', type: 'number' },
  { key: 'cooperativeMembers1835', label: 'B29. Cooperative members aged 18-35', type: 'number' },
  { key: 'cooperativeMembersWomen1835', label: 'B30. Women cooperative members aged 18-35', type: 'number' },
  { key: 'membersShareholders', label: '# Members/Shareholders', type: 'number' },
  { key: 'femaleMembersShareholders', label: '# Female Members/Shareholders', type: 'number' },
  { key: 'members1835', label: '# Members/Shareholders 18-35 years', type: 'number' },
  { key: 'femaleMembers1835', label: '# Female Members/Shareholders 18-35 years', type: 'number' },
  { key: 'maleMembers1835', label: '# Male Members/Shareholders 18-35 years', type: 'number' },
  { key: 'membersPwd', label: '# Members/Shareholders PWD', type: 'number' },
  { key: 'femaleMembersPwd', label: '# Female Members/Shareholders PWD', type: 'number' },
  { key: 'femaleMembersPwd1835', label: '# Female Members/Shareholders PWD 18-35 years', type: 'number' },
  { key: 'membersRefugees', label: '# Members/Shareholders Refugees', type: 'number' },
  { key: 'femaleMembersRefugees', label: '# Female Members/Shareholders Refugees', type: 'number' },
  { key: 'maleMembersRefugees', label: '# Male Members/Shareholders Refugees', type: 'number' },
  { key: 'membersRefugees1835', label: '# Members/Shareholders Refugees 18-35 years', type: 'number' },
  { key: 'femaleMembersRefugees1835', label: '# Female Members/Shareholders Refugees 18-35 years', type: 'number' },
  { key: 'membersHostCommunity1835', label: '# Members/Shareholders Host Communities 18-35 years', type: 'number' },
  { key: 'femaleMembersHostCommunity1835', label: '# Female Members/Shareholders Host Communities 18-35 years', type: 'number' },
];

const employeeFields: OnboardingField[] = [
  { key: 'staffTotalIncludingManager', label: 'B22. Total people working at MCC (including manager)', type: 'number' },
  { key: 'staffWomenCount', label: 'B23. Staff who are women', type: 'number' },
  { key: 'staff1835Count', label: 'B24. Staff aged 18-35', type: 'number' },
  { key: 'staffWomen1835Count', label: 'B25. Women staff aged 18-35', type: 'number' },
  { key: 'staffWithDisabilityCount', label: 'B26. Staff with disability (number or 0)', type: 'number' },
  { key: 'employeesTotal', label: '# Of Employees', type: 'number' },
  { key: 'employeesFemale', label: '# Of Female Employees', type: 'number' },
  { key: 'employeesMale', label: '# Of Male Employees', type: 'number' },
  { key: 'employees1835', label: '# Of Employees 18-35 years', type: 'number' },
  { key: 'femaleEmployees1835', label: '# Female Employees 18-35 years', type: 'number' },
  { key: 'maleEmployees1835', label: '# Male Employees 18-35 years', type: 'number' },
  { key: 'employeesWithDisability', label: '# Of Employees with Disability', type: 'number' },
  { key: 'femaleEmployeesWithDisability', label: '# Female Employees with Disability', type: 'number' },
  { key: 'femaleEmployees1835WithDisability', label: '# Female Employees 18-35 with Disability', type: 'number' },
  { key: 'maleEmployees1835WithDisability', label: '# Male Employees 18-35 with Disability', type: 'number' },
  { key: 'employeesAbove35', label: '# Employees Above 35 years', type: 'number' },
  { key: 'femaleEmployeesAbove35', label: '# Female Employees Above 35 years', type: 'number' },
  { key: 'maleEmployeesAbove35', label: '# Male Employees Above 35 years', type: 'number' },
  { key: 'employeesRefugees', label: '# Employees who are Refugees', type: 'number' },
  { key: 'employeesRefugees1835', label: '# Employees who are Refugees 18-35 years', type: 'number' },
  { key: 'femaleEmployeesRefugees1835', label: '# Female Employees Refugees 18-35 years', type: 'number' },
  { key: 'maleEmployeesRefugees1835', label: '# Male Employees Refugees 18-35 years', type: 'number' },
  { key: 'employeesRefugeesWithDisability', label: '# Employees Refugees with Disability', type: 'number' },
  { key: 'femaleEmployeesRefugeesWithDisability', label: '# Female Employees Refugees with Disability', type: 'number' },
  { key: 'femaleEmployees1835RefugeesWithDisability', label: '# Female Employees 18-35 Refugees with Disability', type: 'number' },
  { key: 'maleEmployees1835RefugeesWithDisability', label: '# Male Employees 18-35 Refugees with Disability', type: 'number' },
  { key: 'employeesFromHostCommunities', label: '# Employees from Refugee Host Communities', type: 'number' },
  { key: 'femaleEmployees1835FromHostCommunities', label: '# Female Employees 18-35 from Host Communities', type: 'number' },
];

const capabilityFields: OnboardingField[] = [
  { key: 'coolingTankTotalCapacityLiters', label: 'B8. Total cooling tank capacity (litres)', type: 'number' },
  { key: 'coolingTankCondition', label: 'B8. Cooling tank condition', type: 'select', options: ['Good', 'Fair', 'Poor'] },
  { key: 'currentDailyMilkVolumeLiters', label: 'B9. Current daily milk volume (average litres/day)', type: 'number' },
  { key: 'maxMilkVolumeOneDayLiters', label: 'B9. Maximum milk volume ever in one day (litres)', type: 'number' },
  { key: 'tankCapacitySufficiency', label: 'B10. Is current tank capacity sufficient?', type: 'select', options: ['Yes — sufficient', 'No — already over capacity', 'No — will be over within 6 months', 'Unsure'] },
  { key: 'insufficientCapacityPlan', label: 'B10. If insufficient, plan' },
  { key: 'powerSupplyAtMcc', label: 'B11. Power supply at MCC (tick all that apply, comma-separated)' },
  { key: 'generatorCapacityKva', label: 'B11. Generator capacity (kVA)', type: 'number' },
  { key: 'mobileNetworkConnectivity', label: 'B12. Mobile network connectivity at MCC site', type: 'select', options: ['Strong 4G / LTE', 'Moderate 3G', 'Weak — intermittent', 'No signal (offline only)'] },
  { key: 'totalDairyFarmersSupplying', label: 'B13. Total dairy farmers currently supplying', type: 'number' },
  { key: 'newFarmersLast3Months', label: 'B13. New farmers in last 3 months', type: 'number' },
  { key: 'numberOfMilkTransporters', label: 'B14. Number of milk transporters (Abacunda)', type: 'number' },
  { key: 'averageDistanceFromFarmsKm', label: 'B15. Average distance from farms to MCC (km)', type: 'number' },
  { key: 'furthestFarmDistanceKm', label: 'B15. Furthest farm distance (km)', type: 'number' },
  { key: 'eveningMilkPattern', label: 'B16. Does the MCC receive evening milk?', type: 'select', options: ['Yes — morning and evening', 'Morning only', 'Evening only', 'Varies by season'] },
  { key: 'noEveningMilkReason', label: 'B16. If no evening milk, reason' },
  { key: 'ownMilkTransportType', label: 'B17. Does MCC have its own milk transport?', type: 'select', options: ['Yes — insulated tank truck', 'Yes — motorcycles with cans', 'No — farmers bring milk', 'No — third-party contracted'] },
  { key: 'noOwnTransportPlan', label: 'B17. If no own transport, plan' },
  { key: 'testingEquipmentPresent', label: 'B18. Testing equipment present and working (comma-separated)' },
  { key: 'qualityTestsEveryDelivery', label: 'B19. Quality tests on every delivery (comma-separated)' },
  { key: 'averageMilkRejectedPerDayLiters', label: 'B20. Average milk rejected per day (litres)', type: 'number' },
  { key: 'rejectionRatePercent', label: 'B20. Rejection rate (%)', type: 'number' },
  { key: 'topRejectionReason1', label: 'B21. Top rejection reason #1' },
  { key: 'topRejectionReason2', label: 'B21. Top rejection reason #2' },
  { key: 'topRejectionReason3', label: 'B21. Top rejection reason #3' },
  { key: 'otherRejectionReason', label: 'B21. Other rejection reason' },
  { key: 'correctiveActionsPlanned', label: 'B21. Corrective actions planned' },
  { key: 'recordSystem', label: 'B31. Current milk delivery record system', type: 'select', options: ['Paper only', 'Paper + some Excel / phone records', 'Electronic (tablet, computer, or app)', 'No records kept'] },
  { key: 'staffTrainingStatus', label: 'B32. Are MCC staff trained on milk handling and quality?', type: 'select', options: ['Yes — all staff trained', 'Yes — some trained', 'No — no formal training', 'Training planned but not yet done'] },
  { key: 'employmentContractsStatus', label: 'B33. Do MCC staff have written employment contracts?', type: 'select', options: ['Yes — all have contracts', 'Some have contracts', 'No — informal employment'] },
  { key: 'farmerPaymentMethods', label: 'B34. How does MCC pay farmers for milk? (tick all that apply, comma-separated)' },
  { key: 'avgDaysDeliveryToPayment', label: 'B34. Average days from delivery to payment', type: 'number' },
  { key: 'digitalLedgerWillingness', label: 'B35. Willing to transition to daily digital ledger?', type: 'select', options: ['Yes — fully willing', 'Yes — will need training', 'Unsure', 'No — prefer current system'] },
  { key: 'milkSalesDestinations', label: 'B36. Where does MCC sell collected milk? (tick all that apply, comma-separated)' },
  { key: 'mainBuyerName', label: 'B36. Main buyer name' },
  { key: 'formalSupplyAgreementDetails', label: 'B36. Formal supply agreement in place? (Yes/No - details)' },
  { key: 'averageAnnualRevenueRwf', label: 'B37. Average annual revenue from milk sales (RWF)', type: 'number' },
];

const STEP_TITLES = ['Section 1', 'Section 2', 'Section 3', 'Section 4', 'Section 5', 'Section 6', 'Section 7'];
const TOTAL_STEPS = STEP_TITLES.length;
const FIELDS_PER_PAGE = 8;
const SECTION1_TOTAL_PAGES = 3;
const SECTION2_TOTAL_PAGES = 3;
const SECTION3_TOTAL_PAGES = 2;
const SECTION4_TOTAL_PAGES = 2;
const SECTION5_TOTAL_PAGES = 2;
const SECTION6_TOTAL_PAGES = 3;
const SECTION2_POWER_OPTIONS = [
  'Mains electricity (RECO/REG)',
  'Power backup generator - working',
  'Generator absent or broken',
  'Solar power system',
  'Frequent outages (3+ per week)',
  'No reliable power',
];
const SECTION2_CONNECTIVITY_OPTIONS = ['Strong 4G / LTE', 'Moderate 3G', 'Weak - intermittent', 'No signal (offline only)'];
const SECTION3_EVENING_MILK_OPTIONS = ['Yes - morning and evening', 'Morning only', 'Evening only', 'Varies by season'];
const SECTION3_TRANSPORT_OPTIONS = ['Yes - insulated tank truck', 'Yes - motorcycles with cans', 'No - farmers bring milk', 'No - third-party contracted'];
const SECTION4_TESTING_EQUIPMENT_OPTIONS = [
  'Lactometer',
  'Alcohol test',
  'Fat content tester',
  'Antibiotic test strips',
  'Thermometer',
  'Calibrated weighing scale',
];
const SECTION4_QUALITY_TEST_OPTIONS = [
  'Temperature on arrival',
  'Lactometer / density',
  'Alcohol test',
  'Fat content',
  'Antibiotic test',
  'Visual inspection',
];
const SECTION4_REJECTION_REASONS = [
  'Low fat content',
  'Umurara (fermentation)',
  'Amazi (water adulteration)',
  'Umubanji (antibiotic contamination)',
  'High temperature on arrival',
  'Other (specify below)',
];
const SECTION6_RECORD_SYSTEM_OPTIONS = [
  'Paper only',
  'Paper + some Excel / phone records',
  'Electronic (tablet, computer, or app)',
  'No records kept',
];
const SECTION6_STAFF_TRAINING_OPTIONS = [
  'Yes - all staff trained',
  'Yes - some trained',
  'No - no formal training',
  'Training planned but not yet done',
];
const SECTION6_CONTRACT_OPTIONS = ['Yes - all have contracts', 'Some have contracts', 'No - informal employment'];
const SECTION6_PAYMENT_METHOD_OPTIONS = ['Cash on delivery', 'Cash at end of week', 'Cash at end of month', 'Bank transfer', 'MTN MoMo', 'Airtel Money'];
const SECTION6_LEDGER_WILLINGNESS_OPTIONS = ['Yes - fully willing', 'Yes - will need training', 'Unsure', 'No - prefer current system'];
const SECTION6_SALES_DESTINATION_OPTIONS = [
  'Directly to a processor (e.g. Inyange)',
  'Local dairy cooperative',
  'Independent collector',
  'Consumers / local market',
  'Multiple destinations',
  'No consistent buyer yet',
];
const SECTION7_REQUIREMENTS = [
  { key: 'coolingCapacity', label: 'Functioning cooling tank with confirmed capacity' },
  { key: 'connectivityViable', label: '3G/4G OR offline sync confirmed viable' },
  { key: 'powerBackup', label: 'Power backup (generator or solar) for cooling tank' },
  { key: 'ledgerWillingness', label: 'Management willing to adopt daily digital ledger' },
  { key: 'qualityEquipment', label: 'Milk quality testing equipment present and in use' },
  { key: 'amlClear', label: 'No active AML or blacklist flags (auto-screen result)' },
  { key: 'minFarmers', label: 'Minimum 10 farmers currently supplying' },
  { key: 'rejectionTracking', label: 'At least basic rejection reason tracking in place' },
] as const;
type Section7RequirementKey = (typeof SECTION7_REQUIREMENTS)[number]['key'];
type AssessmentStatus = 'pass' | 'fail';
type SubmissionValidationResult = {
  isValid: boolean;
  missing: string[];
};
type CompletionCheck = {
  section: number;
  done: boolean;
};

const ONBOARDING_DRAFT_KEY = 'gemura-web-onboarding-draft-v1';

function buildSectorOptions(district: string): string[] {
  if (!district) return [];
  return [`${district} Central`, `${district} East`, `${district} West`];
}

function buildCellOptions(sector: string): string[] {
  if (!sector) return [];
  return [`${sector} Cell A`, `${sector} Cell B`, `${sector} Cell C`];
}

function buildVillageOptions(cell: string): string[] {
  if (!cell) return [];
  return [`${cell} Village 1`, `${cell} Village 2`, `${cell} Village 3`];
}

export default function BusinessOnboardingPage() {
  const [step, setStep] = useState(1);
  const [identityPage, setIdentityPage] = useState(1);
  const [section2Page, setSection2Page] = useState(1);
  const [section3Page, setSection3Page] = useState(1);
  const [section4Page, setSection4Page] = useState(1);
  const [section5Page, setSection5Page] = useState(1);
  const [section6Page, setSection6Page] = useState(1);
  const [ownershipPage, setOwnershipPage] = useState(1);
  const [membersPage, setMembersPage] = useState(1);
  const [employeesPage, setEmployeesPage] = useState(1);
  const [capacityPage, setCapacityPage] = useState(1);

  const [businessName, setBusinessName] = useState('');
  const [commonName, setCommonName] = useState('');
  const [managerFirstName, setManagerFirstName] = useState('');
  const [managerLastName, setManagerLastName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerIdNumber, setManagerIdNumber] = useState('');
  const [ownershipStructure, setOwnershipStructure] = useState('');
  const [ownershipOther, setOwnershipOther] = useState('');
  const [operatorDisability, setOperatorDisability] = useState('');
  const [operationalStatus, setOperationalStatus] = useState('');
  const [operationalNotes, setOperationalNotes] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationError, setLocationError] = useState('');
  const [coolingTanks, setCoolingTanks] = useState([
    { tankNumber: 'Tank 1', capacityLitres: '', yearOrAge: '', condition: '' },
    { tankNumber: 'Tank 2', capacityLitres: '', yearOrAge: '', condition: '' },
    { tankNumber: 'Tank 3', capacityLitres: '', yearOrAge: '', condition: '' },
  ]);
  const [dailyMilkVolume, setDailyMilkVolume] = useState('');
  const [maxMilkInOneDay, setMaxMilkInOneDay] = useState('');
  const [tankCapacitySufficiency, setTankCapacitySufficiency] = useState('');
  const [insufficientCapacityPlan, setInsufficientCapacityPlan] = useState('');
  const [powerSupplySelections, setPowerSupplySelections] = useState<string[]>([]);
  const [generatorCapacityKva, setGeneratorCapacityKva] = useState('');
  const [mobileConnectivity, setMobileConnectivity] = useState('');
  const [totalFarmersSupplying, setTotalFarmersSupplying] = useState('');
  const [newFarmersLast3Months, setNewFarmersLast3Months] = useState('');
  const [milkTransportersCount, setMilkTransportersCount] = useState('');
  const [averageDistanceKm, setAverageDistanceKm] = useState('');
  const [furthestFarmKm, setFurthestFarmKm] = useState('');
  const [eveningMilkPattern, setEveningMilkPattern] = useState('');
  const [noEveningMilkReason, setNoEveningMilkReason] = useState('');
  const [ownMilkTransportType, setOwnMilkTransportType] = useState('');
  const [noOwnTransportPlan, setNoOwnTransportPlan] = useState('');
  const [testingEquipmentSelections, setTestingEquipmentSelections] = useState<string[]>([]);
  const [qualityTestsSelections, setQualityTestsSelections] = useState<string[]>([]);
  const [averageRejectedPerDayLitres, setAverageRejectedPerDayLitres] = useState('');
  const [rejectionRatePercent, setRejectionRatePercent] = useState('');
  const [rejectionRankings, setRejectionRankings] = useState<Record<string, string>>({});
  const [otherRejectionReason, setOtherRejectionReason] = useState('');
  const [correctiveActionsPlanned, setCorrectiveActionsPlanned] = useState('');
  const [staffTotalIncludingManager, setStaffTotalIncludingManager] = useState('');
  const [staffWomenCount, setStaffWomenCount] = useState('');
  const [staffAged1835, setStaffAged1835] = useState('');
  const [staffWomen1835, setStaffWomen1835] = useState('');
  const [staffWithDisability, setStaffWithDisability] = useState('');
  const [coopMembersTotal, setCoopMembersTotal] = useState('');
  const [coopMembersWomen, setCoopMembersWomen] = useState('');
  const [coopMembersAged1835, setCoopMembersAged1835] = useState('');
  const [coopMembersWomen1835, setCoopMembersWomen1835] = useState('');
  const [recordSystem, setRecordSystem] = useState('');
  const [staffTrainingStatus, setStaffTrainingStatus] = useState('');
  const [employmentContractsStatus, setEmploymentContractsStatus] = useState('');
  const [farmerPaymentMethods, setFarmerPaymentMethods] = useState<string[]>([]);
  const [avgDaysDeliveryToPayment, setAvgDaysDeliveryToPayment] = useState('');
  const [digitalLedgerWillingness, setDigitalLedgerWillingness] = useState('');
  const [milkSalesDestinations, setMilkSalesDestinations] = useState<string[]>([]);
  const [mainBuyerName, setMainBuyerName] = useState('');
  const [formalSupplyAgreementDetails, setFormalSupplyAgreementDetails] = useState('');
  const [averageAnnualRevenueRwf, setAverageAnnualRevenueRwf] = useState('');
  const [section7AgentNotes, setSection7AgentNotes] = useState<Partial<Record<Section7RequirementKey, string>>>({});
  const [section7KeyGaps, setSection7KeyGaps] = useState('');
  const [isSubmittingToSheet, setIsSubmittingToSheet] = useState(false);
  const [sheetSubmitError, setSheetSubmitError] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionCode, setSubmissionCode] = useState('');
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [didRestoreDraft, setDidRestoreDraft] = useState(false);
  const [section1ProvinceOptions, setSection1ProvinceOptions] = useState<LocationOption[]>([]);
  const [section1DistrictOptions, setSection1DistrictOptions] = useState<LocationOption[]>([]);
  const [section1SectorOptions, setSection1SectorOptions] = useState<LocationOption[]>([]);
  const [section1CellOptions, setSection1CellOptions] = useState<LocationOption[]>([]);
  const [section1VillageOptions, setSection1VillageOptions] = useState<LocationOption[]>([]);
  const [section1ProvinceId, setSection1ProvinceId] = useState('');
  const [section1DistrictId, setSection1DistrictId] = useState('');
  const [section1SectorId, setSection1SectorId] = useState('');
  const [section1CellId, setSection1CellId] = useState('');
  const [section1VillageId, setSection1VillageId] = useState('');
  const [section1LocationSource, setSection1LocationSource] = useState<'api' | 'fallback'>('fallback');
  const selectedProvinceRef = useRef('');
  const selectedDistrictRef = useRef('');
  const selectedSectorRef = useRef('');
  const selectedCellRef = useRef('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [sector, setSector] = useState('');
  const [cell, setCell] = useState('');
  const [village, setVillage] = useState('');
  const [extraData, setExtraData] = useState<Record<string, string>>({});

  const districtOptions = useMemo(() => (province ? RWANDA_PROVINCE_DISTRICTS[province] || [] : []), [province]);
  const sectorOptions = useMemo(() => buildSectorOptions(district), [district]);
  const cellOptions = useMemo(() => buildCellOptions(sector), [sector]);
  const villageOptions = useMemo(() => buildVillageOptions(cell), [cell]);

  const canProceedFromStep1 = Boolean(
    businessName.trim().length > 1 &&
      section1ProvinceId &&
      section1DistrictId &&
      section1SectorId &&
      section1CellId &&
      section1VillageId &&
      managerFirstName.trim().length > 0 &&
      managerLastName.trim().length > 0 &&
      managerPhone.trim().length > 0 &&
      managerIdNumber.trim().length > 0,
  );
  const hasLocation = Boolean(province && district && sector && cell && village);
  const identityFieldMap = useMemo(
    () => identityFields.reduce<Record<string, OnboardingField>>((acc, field) => ({ ...acc, [field.key]: field }), {}),
    [],
  );
  const businessProfileKeys = ['commonMccName', 'ruraRabRegistrationNumber', 'mccOperationalStatus', 'mccOperationalNotes'];
  const ownershipKeys = ['operatorManagerName', 'operatorPhone', 'operatorNationalId', 'ownershipStructure', 'ownershipStructureOther', 'ownerPwdStatus'];

  const section1ApiBaseUrl = apiClient.instance.defaults.baseURL || '';

  useEffect(() => {
    let cancelled = false;

    const loadProvinces = async () => {
      try {
        const response = await fetch(`${section1ApiBaseUrl}/public/locations/provinces`);

        if (!response.ok) {
          const token = typeof window !== 'undefined' ? localStorage.getItem('gemura-auth-token') : null;
          const protectedResponse = await fetch(`${section1ApiBaseUrl}/locations/provinces`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!protectedResponse.ok) {
            throw new Error('Unable to load provinces');
          }
          const protectedPayload = (await protectedResponse.json()) as LocationsResponse;
          if (cancelled) return;
          const protectedOptions = (protectedPayload.data || []).map((item) => ({ id: item.id, label: item.name }));
          if (protectedOptions.length > 0) {
            setSection1ProvinceOptions(protectedOptions);
            setSection1LocationSource('api');
            return;
          }
        }

        const payload = (await response.json()) as LocationsResponse;
        if (cancelled) return;

        const options = (payload.data || []).map((item) => ({ id: item.id, label: item.name }));
        if (options.length > 0) {
          setSection1ProvinceOptions(options);
          setSection1LocationSource('api');
          return;
        }
      } catch {
        // Fallback handled below.
      }

      if (!cancelled) {
        setSection1ProvinceOptions(Object.keys(RWANDA_PROVINCE_DISTRICTS).map((provinceName) => ({ id: provinceName, label: provinceName })));
        setSection1LocationSource('fallback');
        setLocationError('Using the local Rwanda location list until the API is available.');
      }
    };

    loadProvinces();
    return () => {
      cancelled = true;
    };
  }, [section1ApiBaseUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const clampPage = (value: unknown, max: number) => {
      if (typeof value !== 'number' || Number.isNaN(value)) return 1;
      return Math.min(max, Math.max(1, Math.floor(value)));
    };

    try {
      const savedRaw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!savedRaw) return;
      const draft = JSON.parse(savedRaw) as Record<string, unknown>;
      if (!draft || typeof draft !== 'object') return;

      if (typeof draft.step === 'number') setStep(Math.min(TOTAL_STEPS, Math.max(1, Math.floor(draft.step))));
      setIdentityPage(clampPage(draft.identityPage, SECTION1_TOTAL_PAGES));
      setSection2Page(clampPage(draft.section2Page, SECTION2_TOTAL_PAGES));
      setSection3Page(clampPage(draft.section3Page, SECTION3_TOTAL_PAGES));
      setSection4Page(clampPage(draft.section4Page, SECTION4_TOTAL_PAGES));
      setSection5Page(clampPage(draft.section5Page, SECTION5_TOTAL_PAGES));
      setSection6Page(clampPage(draft.section6Page, SECTION6_TOTAL_PAGES));
      setOwnershipPage(clampPage(draft.ownershipPage, Math.max(1, Math.ceil(ownershipKeys.length / FIELDS_PER_PAGE))));
      setMembersPage(clampPage(draft.membersPage, Math.max(1, Math.ceil(shareholderFields.length / FIELDS_PER_PAGE))));
      setEmployeesPage(clampPage(draft.employeesPage, Math.max(1, Math.ceil(employeeFields.length / FIELDS_PER_PAGE))));
      setCapacityPage(clampPage(draft.capacityPage, Math.max(1, Math.ceil(capabilityFields.length / FIELDS_PER_PAGE))));

      if (typeof draft.businessName === 'string') setBusinessName(draft.businessName);
      if (typeof draft.commonName === 'string') setCommonName(draft.commonName);
      if (typeof draft.managerFirstName === 'string') setManagerFirstName(draft.managerFirstName);
      if (typeof draft.managerLastName === 'string') setManagerLastName(draft.managerLastName);
      if (typeof draft.managerPhone === 'string') setManagerPhone(draft.managerPhone);
      if (typeof draft.managerIdNumber === 'string') setManagerIdNumber(draft.managerIdNumber);
      if (typeof draft.ownershipStructure === 'string') setOwnershipStructure(draft.ownershipStructure);
      if (typeof draft.ownershipOther === 'string') setOwnershipOther(draft.ownershipOther);
      if (typeof draft.operatorDisability === 'string') setOperatorDisability(draft.operatorDisability);
      if (typeof draft.operationalStatus === 'string') setOperationalStatus(draft.operationalStatus);
      if (typeof draft.operationalNotes === 'string') setOperationalNotes(draft.operationalNotes);
      if (typeof draft.registrationNumber === 'string') setRegistrationNumber(draft.registrationNumber);
      if (typeof draft.latitude === 'string') setLatitude(draft.latitude);
      if (typeof draft.longitude === 'string') setLongitude(draft.longitude);

      if (Array.isArray(draft.coolingTanks)) {
        setCoolingTanks(
          draft.coolingTanks.map((tank) => {
            const typedTank = tank as Record<string, unknown>;
            return {
              tankNumber: typeof typedTank.tankNumber === 'string' ? typedTank.tankNumber : '',
              capacityLitres: typeof typedTank.capacityLitres === 'string' ? typedTank.capacityLitres : '',
              yearOrAge: typeof typedTank.yearOrAge === 'string' ? typedTank.yearOrAge : '',
              condition: typeof typedTank.condition === 'string' ? typedTank.condition : '',
            };
          }),
        );
      }

      if (typeof draft.dailyMilkVolume === 'string') setDailyMilkVolume(draft.dailyMilkVolume);
      if (typeof draft.maxMilkInOneDay === 'string') setMaxMilkInOneDay(draft.maxMilkInOneDay);
      if (typeof draft.tankCapacitySufficiency === 'string') setTankCapacitySufficiency(draft.tankCapacitySufficiency);
      if (typeof draft.insufficientCapacityPlan === 'string') setInsufficientCapacityPlan(draft.insufficientCapacityPlan);
      if (Array.isArray(draft.powerSupplySelections)) setPowerSupplySelections(draft.powerSupplySelections.filter((item): item is string => typeof item === 'string'));
      if (typeof draft.generatorCapacityKva === 'string') setGeneratorCapacityKva(draft.generatorCapacityKva);
      if (typeof draft.mobileConnectivity === 'string') setMobileConnectivity(draft.mobileConnectivity);
      if (typeof draft.totalFarmersSupplying === 'string') setTotalFarmersSupplying(draft.totalFarmersSupplying);
      if (typeof draft.newFarmersLast3Months === 'string') setNewFarmersLast3Months(draft.newFarmersLast3Months);
      if (typeof draft.milkTransportersCount === 'string') setMilkTransportersCount(draft.milkTransportersCount);
      if (typeof draft.averageDistanceKm === 'string') setAverageDistanceKm(draft.averageDistanceKm);
      if (typeof draft.furthestFarmKm === 'string') setFurthestFarmKm(draft.furthestFarmKm);
      if (typeof draft.eveningMilkPattern === 'string') setEveningMilkPattern(draft.eveningMilkPattern);
      if (typeof draft.noEveningMilkReason === 'string') setNoEveningMilkReason(draft.noEveningMilkReason);
      if (typeof draft.ownMilkTransportType === 'string') setOwnMilkTransportType(draft.ownMilkTransportType);
      if (typeof draft.noOwnTransportPlan === 'string') setNoOwnTransportPlan(draft.noOwnTransportPlan);
      if (Array.isArray(draft.testingEquipmentSelections)) setTestingEquipmentSelections(draft.testingEquipmentSelections.filter((item): item is string => typeof item === 'string'));
      if (Array.isArray(draft.qualityTestsSelections)) setQualityTestsSelections(draft.qualityTestsSelections.filter((item): item is string => typeof item === 'string'));
      if (typeof draft.averageRejectedPerDayLitres === 'string') setAverageRejectedPerDayLitres(draft.averageRejectedPerDayLitres);
      if (typeof draft.rejectionRatePercent === 'string') setRejectionRatePercent(draft.rejectionRatePercent);
      if (draft.rejectionRankings && typeof draft.rejectionRankings === 'object') {
        setRejectionRankings(draft.rejectionRankings as Record<string, string>);
      }
      if (typeof draft.otherRejectionReason === 'string') setOtherRejectionReason(draft.otherRejectionReason);
      if (typeof draft.correctiveActionsPlanned === 'string') setCorrectiveActionsPlanned(draft.correctiveActionsPlanned);
      if (typeof draft.staffTotalIncludingManager === 'string') setStaffTotalIncludingManager(draft.staffTotalIncludingManager);
      if (typeof draft.staffWomenCount === 'string') setStaffWomenCount(draft.staffWomenCount);
      if (typeof draft.staffAged1835 === 'string') setStaffAged1835(draft.staffAged1835);
      if (typeof draft.staffWomen1835 === 'string') setStaffWomen1835(draft.staffWomen1835);
      if (typeof draft.staffWithDisability === 'string') setStaffWithDisability(draft.staffWithDisability);
      if (typeof draft.coopMembersTotal === 'string') setCoopMembersTotal(draft.coopMembersTotal);
      if (typeof draft.coopMembersWomen === 'string') setCoopMembersWomen(draft.coopMembersWomen);
      if (typeof draft.coopMembersAged1835 === 'string') setCoopMembersAged1835(draft.coopMembersAged1835);
      if (typeof draft.coopMembersWomen1835 === 'string') setCoopMembersWomen1835(draft.coopMembersWomen1835);
      if (typeof draft.recordSystem === 'string') setRecordSystem(draft.recordSystem);
      if (typeof draft.staffTrainingStatus === 'string') setStaffTrainingStatus(draft.staffTrainingStatus);
      if (typeof draft.employmentContractsStatus === 'string') setEmploymentContractsStatus(draft.employmentContractsStatus);
      if (Array.isArray(draft.farmerPaymentMethods)) setFarmerPaymentMethods(draft.farmerPaymentMethods.filter((item): item is string => typeof item === 'string'));
      if (typeof draft.avgDaysDeliveryToPayment === 'string') setAvgDaysDeliveryToPayment(draft.avgDaysDeliveryToPayment);
      if (typeof draft.digitalLedgerWillingness === 'string') setDigitalLedgerWillingness(draft.digitalLedgerWillingness);
      if (Array.isArray(draft.milkSalesDestinations)) setMilkSalesDestinations(draft.milkSalesDestinations.filter((item): item is string => typeof item === 'string'));
      if (typeof draft.mainBuyerName === 'string') setMainBuyerName(draft.mainBuyerName);
      if (typeof draft.formalSupplyAgreementDetails === 'string') setFormalSupplyAgreementDetails(draft.formalSupplyAgreementDetails);
      if (typeof draft.averageAnnualRevenueRwf === 'string') setAverageAnnualRevenueRwf(draft.averageAnnualRevenueRwf);
      if (draft.section7AgentNotes && typeof draft.section7AgentNotes === 'object') {
        setSection7AgentNotes(draft.section7AgentNotes as Partial<Record<Section7RequirementKey, string>>);
      }
      if (typeof draft.section7KeyGaps === 'string') setSection7KeyGaps(draft.section7KeyGaps);

      if (typeof draft.section1ProvinceId === 'string') setSection1ProvinceId(draft.section1ProvinceId);
      if (typeof draft.section1DistrictId === 'string') setSection1DistrictId(draft.section1DistrictId);
      if (typeof draft.section1SectorId === 'string') setSection1SectorId(draft.section1SectorId);
      if (typeof draft.section1CellId === 'string') setSection1CellId(draft.section1CellId);
      if (typeof draft.section1VillageId === 'string') setSection1VillageId(draft.section1VillageId);
      if (typeof draft.province === 'string') setProvince(draft.province);
      if (typeof draft.district === 'string') setDistrict(draft.district);
      if (typeof draft.sector === 'string') setSector(draft.sector);
      if (typeof draft.cell === 'string') setCell(draft.cell);
      if (typeof draft.village === 'string') setVillage(draft.village);
      if (draft.extraData && typeof draft.extraData === 'object') {
        setExtraData(draft.extraData as Record<string, string>);
      }

      setDidRestoreDraft(true);
    } catch {
      // Ignore malformed local draft content and continue with a blank form.
    } finally {
      setIsDraftHydrated(true);
    }
  }, []);

  const loadSection1Children = async (parentId: string, expectedType?: string): Promise<LocationOption[] | null> => {
    try {
      let url = `${section1ApiBaseUrl}/public/locations?parent_id=${encodeURIComponent(parentId)}`;
      if (expectedType) {
        url += `&location_type=${encodeURIComponent(expectedType)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('gemura-auth-token') : null;
        let protectedUrl = `${section1ApiBaseUrl}/locations?parent_id=${encodeURIComponent(parentId)}`;
        if (expectedType) {
          protectedUrl += `&location_type=${encodeURIComponent(expectedType)}`;
        }
        const protectedResponse = await fetch(protectedUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!protectedResponse.ok) {
          throw new Error('Unable to load child locations');
        }
        const protectedPayload = (await protectedResponse.json()) as LocationsResponse;
        const options = (protectedPayload.data || []).map((item) => ({ id: item.id, label: item.name }));
        setSection1LocationSource('api');
        setLocationError('');
        return options.length > 0 ? options : null;
      }

      const payload = (await response.json()) as LocationsResponse;
      const options = (payload.data || []).map((item) => ({ id: item.id, label: item.name }));
      setSection1LocationSource('api');
      setLocationError('');
      return options.length > 0 ? options : null;
    } catch {
      return null;
    }
  };

  const getOptionLabel = (id: string, options: LocationOption[]) => {
    return options.find((option) => option.id === id)?.label || id;
  };

  const handleSection1ProvinceChange = async (provinceId: string) => {
    selectedProvinceRef.current = provinceId;
    selectedDistrictRef.current = '';
    selectedSectorRef.current = '';
    selectedCellRef.current = '';
    setSection1ProvinceId(provinceId);
    setSection1DistrictId('');
    setSection1SectorId('');
    setSection1CellId('');
    setSection1VillageId('');
    setSection1DistrictOptions([]);
    setSection1SectorOptions([]);
    setSection1CellOptions([]);
    setSection1VillageOptions([]);

    if (section1LocationSource === 'fallback') {
      const provinceName = section1ProvinceOptions.find((option) => option.id === provinceId)?.label || provinceId;
      setSection1DistrictOptions((RWANDA_PROVINCE_DISTRICTS[provinceName] || []).map((districtName) => ({ id: districtName, label: districtName })));
      return;
    }

    const options = await loadSection1Children(provinceId);
    if (selectedProvinceRef.current !== provinceId) return;
    if (options) {
      setSection1DistrictOptions(options);
      setLocationError('');
      return;
    }
    setLocationError('Could not load districts for the selected province.');
  };

  const handleSection1DistrictChange = async (districtId: string) => {
    selectedDistrictRef.current = districtId;
    selectedSectorRef.current = '';
    selectedCellRef.current = '';
    setSection1DistrictId(districtId);
    setSection1SectorId('');
    setSection1CellId('');
    setSection1VillageId('');
    setSection1SectorOptions([]);
    setSection1CellOptions([]);
    setSection1VillageOptions([]);

    // Try API first
    const apiOptions = await loadSection1Children(districtId, 'SECTOR');
    if (selectedDistrictRef.current !== districtId) return;
    
    if (apiOptions && apiOptions.length > 0) {
      setSection1SectorOptions(apiOptions);
      setLocationError('');
      return;
    }

    // Fallback to generic sectors if API fails
    const districtName = getOptionLabel(districtId, section1DistrictOptions);
    setSection1SectorOptions(buildSectorOptions(districtName).map((sectorName) => ({ id: sectorName, label: sectorName })));
    if (!apiOptions) {
      setLocationError('Note: Using fallback sectors. API returned no data for this district.');
    }
  };

  const handleSection1SectorChange = async (sectorId: string) => {
    selectedSectorRef.current = sectorId;
    selectedCellRef.current = '';
    setSection1SectorId(sectorId);
    setSection1CellId('');
    setSection1VillageId('');
    setSection1CellOptions([]);
    setSection1VillageOptions([]);

    // Try API first
    const apiOptions = await loadSection1Children(sectorId, 'CELL');
    if (selectedSectorRef.current !== sectorId) return;
    
    if (apiOptions && apiOptions.length > 0) {
      setSection1CellOptions(apiOptions);
      setLocationError('');
      return;
    }

    // Fallback to generic cells if API fails
    const sectorName = getOptionLabel(sectorId, section1SectorOptions);
    setSection1CellOptions(buildCellOptions(sectorName).map((cellName) => ({ id: cellName, label: cellName })));
    if (!apiOptions) {
      setLocationError('Note: Using fallback cells. API returned no data for this sector.');
    }
  };

  const handleSection1CellChange = async (cellId: string) => {
    selectedCellRef.current = cellId;
    setSection1CellId(cellId);
    setSection1VillageId('');
    setSection1VillageOptions([]);

    // Try API first
    const apiOptions = await loadSection1Children(cellId, 'VILLAGE');
    if (selectedCellRef.current !== cellId) return;
    
    if (apiOptions && apiOptions.length > 0) {
      setSection1VillageOptions(apiOptions);
      setLocationError('');
      return;
    }

    // Fallback to generic villages if API fails
    const cellName = getOptionLabel(cellId, section1CellOptions);
    setSection1VillageOptions(buildVillageOptions(cellName).map((villageName) => ({ id: villageName, label: villageName })));
    if (!apiOptions) {
      setLocationError('Note: Using fallback villages. API returned no data for this cell.');
    }
  };

  const handleSection1VillageChange = (villageId: string) => {
    setSection1VillageId(villageId);
  };

  const captureCurrentCoordinates = () => {
    if (!navigator.geolocation) {
      setLocationError('Your browser does not support location capture.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setLocationError('');
      },
      () => {
        setLocationError('Unable to capture current location. You can enter coordinates manually.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const updateCoolingTank = (index: number, field: 'capacityLitres' | 'yearOrAge' | 'condition', value: string) => {
    setCoolingTanks((prev) => prev.map((tank, i) => (i === index ? { ...tank, [field]: value } : tank)));
  };

  const togglePowerSupplyOption = (option: string) => {
    setPowerSupplySelections((prev) =>
      prev.includes(option) ? prev.filter((value) => value !== option) : [...prev, option],
    );
  };

  const toggleStringOption = (
    option: string,
    setState: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setState((prev) => (prev.includes(option) ? prev.filter((value) => value !== option) : [...prev, option]));
  };

  const totalCoolingCapacity = coolingTanks.reduce((sum, tank) => {
    const parsed = Number(tank.capacityLitres);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  const isCooperativeMcc = ownershipStructure === 'Farmer cooperative (registered)';
  const parsedStaffTotal = Number(staffTotalIncludingManager) || 0;
  const parsedStaffWomen = Number(staffWomenCount) || 0;
  const parsedStaff1835 = Number(staffAged1835) || 0;
  const maleStaffAuto = Math.max(0, parsedStaffTotal - parsedStaffWomen);
  const staffAbove35Auto = Math.max(0, parsedStaffTotal - parsedStaff1835);
  const hasConfirmedCoolingTank = coolingTanks.some((tank) => Number(tank.capacityLitres) > 0 && ['Good', 'Fair'].includes(tank.condition));
  const hasConnectivityOrOfflineViable =
    mobileConnectivity === 'Strong 4G / LTE' ||
    mobileConnectivity === 'Moderate 3G' ||
    (mobileConnectivity === 'No signal (offline only)' && digitalLedgerWillingness !== 'No - prefer current system');
  const hasPowerBackup = powerSupplySelections.some((option) =>
    ['Mains electricity (RECO/REG)', 'Power backup generator - working', 'Solar power system'].includes(option),
  );
  const willingDigitalLedger = ['Yes - fully willing', 'Yes - will need training'].includes(digitalLedgerWillingness);
  const hasQualityEquipment = testingEquipmentSelections.length >= 2;
  const amlClear = false;
  const hasMinFarmers = (Number(totalFarmersSupplying) || 0) >= 10;
  const hasRejectionTracking =
    Object.values(rejectionRankings).some((rank) => rank === '1' || rank === '2' || rank === '3') ||
    otherRejectionReason.trim().length > 0 ||
    correctiveActionsPlanned.trim().length > 0;
  const section7AutoAssessment: Record<Section7RequirementKey, AssessmentStatus> = {
    coolingCapacity: hasConfirmedCoolingTank ? 'pass' : 'fail',
    connectivityViable: hasConnectivityOrOfflineViable ? 'pass' : 'fail',
    powerBackup: hasPowerBackup ? 'pass' : 'fail',
    ledgerWillingness: willingDigitalLedger ? 'pass' : 'fail',
    qualityEquipment: hasQualityEquipment ? 'pass' : 'fail',
    amlClear: amlClear ? 'pass' : 'fail',
    minFarmers: hasMinFarmers ? 'pass' : 'fail',
    rejectionTracking: hasRejectionTracking ? 'pass' : 'fail',
  };
  const section7FinalAssessment = section7AutoAssessment;
  const section7PassCount = SECTION7_REQUIREMENTS.filter((req) => section7FinalAssessment[req.key] === 'pass').length;
  const section7AutoDecision: 'PASS' | 'CONDITIONAL' | 'FAIL' = section7PassCount >= 7 ? 'PASS' : section7PassCount >= 5 ? 'CONDITIONAL' : 'FAIL';
  const section7FinalDecision = section7AutoDecision;
  const section7AutoKeyGaps = SECTION7_REQUIREMENTS.filter((req) => section7FinalAssessment[req.key] === 'fail')
    .map((req) => req.label)
    .join('; ');

  const completionChecks: CompletionCheck[] = [
    { section: 1, done: businessName.trim().length > 0 },
    { section: 1, done: section1ProvinceId.trim().length > 0 },
    { section: 1, done: section1DistrictId.trim().length > 0 },
    { section: 1, done: section1SectorId.trim().length > 0 },
    { section: 1, done: section1CellId.trim().length > 0 },
    { section: 1, done: section1VillageId.trim().length > 0 },
    { section: 1, done: managerFirstName.trim().length > 0 },
    { section: 1, done: managerLastName.trim().length > 0 },
    { section: 1, done: managerPhone.trim().length > 0 },
    { section: 1, done: managerIdNumber.trim().length > 0 },
    { section: 1, done: ownershipStructure.trim().length > 0 },
    { section: 1, done: operationalStatus.trim().length > 0 },
    { section: 2, done: coolingTanks.some((tank) => Number(tank.capacityLitres) > 0 && tank.condition.trim().length > 0) },
    { section: 2, done: dailyMilkVolume.trim().length > 0 },
    { section: 2, done: maxMilkInOneDay.trim().length > 0 },
    { section: 2, done: tankCapacitySufficiency.trim().length > 0 },
    { section: 2, done: powerSupplySelections.length > 0 },
    { section: 2, done: generatorCapacityKva.trim().length > 0 },
    { section: 2, done: mobileConnectivity.trim().length > 0 },
    { section: 3, done: totalFarmersSupplying.trim().length > 0 },
    { section: 3, done: milkTransportersCount.trim().length > 0 },
    { section: 3, done: averageDistanceKm.trim().length > 0 },
    { section: 3, done: furthestFarmKm.trim().length > 0 },
    { section: 3, done: eveningMilkPattern.trim().length > 0 },
    { section: 3, done: ownMilkTransportType.trim().length > 0 },
    { section: 4, done: testingEquipmentSelections.length > 0 },
    { section: 4, done: qualityTestsSelections.length > 0 },
    { section: 4, done: averageRejectedPerDayLitres.trim().length > 0 },
    { section: 4, done: rejectionRatePercent.trim().length > 0 },
    { section: 4, done: Object.keys(rejectionRankings).length >= 3 },
    { section: 4, done: correctiveActionsPlanned.trim().length > 0 },
    { section: 5, done: staffTotalIncludingManager.trim().length > 0 },
    { section: 5, done: staffWomenCount.trim().length > 0 },
    { section: 5, done: staffAged1835.trim().length > 0 },
    { section: 5, done: staffWomen1835.trim().length > 0 },
    { section: 5, done: staffWithDisability.trim().length > 0 },
    { section: 6, done: recordSystem.trim().length > 0 },
    { section: 6, done: staffTrainingStatus.trim().length > 0 },
    { section: 6, done: employmentContractsStatus.trim().length > 0 },
    { section: 6, done: farmerPaymentMethods.length > 0 },
    { section: 6, done: avgDaysDeliveryToPayment.trim().length > 0 },
    { section: 6, done: digitalLedgerWillingness.trim().length > 0 },
    { section: 6, done: milkSalesDestinations.length > 0 },
    { section: 6, done: mainBuyerName.trim().length > 0 },
    { section: 6, done: formalSupplyAgreementDetails.trim().length > 0 },
    { section: 6, done: averageAnnualRevenueRwf.trim().length > 0 },
    { section: 7, done: step >= 7 || section7KeyGaps.trim().length > 0 || Object.values(section7AgentNotes).some((value) => Boolean(value && value.trim().length > 0)) },
  ];

  if (isCooperativeMcc) {
    completionChecks.push(
      { section: 5, done: coopMembersTotal.trim().length > 0 },
      { section: 5, done: coopMembersWomen.trim().length > 0 },
      { section: 5, done: coopMembersAged1835.trim().length > 0 },
      { section: 5, done: coopMembersWomen1835.trim().length > 0 },
    );
  }

  const answeredRequiredQuestions = completionChecks.filter((check) => check.done).length;
  const completionPercent = Math.round((answeredRequiredQuestions / Math.max(1, completionChecks.length)) * 100);
  const sectionCompletion = STEP_TITLES.map((_, index) => {
    const sectionNumber = index + 1;
    const checksForSection = completionChecks.filter((check) => check.section === sectionNumber);
    return checksForSection.length > 0 && checksForSection.every((check) => check.done);
  });

  const clearSavedDraft = () => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    setDidRestoreDraft(false);
  };

  useEffect(() => {
    if (!isDraftHydrated || typeof window === 'undefined') {
      return;
    }

    const draftPayload = {
      savedAt: new Date().toISOString(),
      step,
      identityPage,
      section2Page,
      section3Page,
      section4Page,
      section5Page,
      section6Page,
      ownershipPage,
      membersPage,
      employeesPage,
      capacityPage,
      businessName,
      commonName,
      managerFirstName,
      managerLastName,
      managerPhone,
      managerIdNumber,
      ownershipStructure,
      ownershipOther,
      operatorDisability,
      operationalStatus,
      operationalNotes,
      registrationNumber,
      latitude,
      longitude,
      coolingTanks,
      dailyMilkVolume,
      maxMilkInOneDay,
      tankCapacitySufficiency,
      insufficientCapacityPlan,
      powerSupplySelections,
      generatorCapacityKva,
      mobileConnectivity,
      totalFarmersSupplying,
      newFarmersLast3Months,
      milkTransportersCount,
      averageDistanceKm,
      furthestFarmKm,
      eveningMilkPattern,
      noEveningMilkReason,
      ownMilkTransportType,
      noOwnTransportPlan,
      testingEquipmentSelections,
      qualityTestsSelections,
      averageRejectedPerDayLitres,
      rejectionRatePercent,
      rejectionRankings,
      otherRejectionReason,
      correctiveActionsPlanned,
      staffTotalIncludingManager,
      staffWomenCount,
      staffAged1835,
      staffWomen1835,
      staffWithDisability,
      coopMembersTotal,
      coopMembersWomen,
      coopMembersAged1835,
      coopMembersWomen1835,
      recordSystem,
      staffTrainingStatus,
      employmentContractsStatus,
      farmerPaymentMethods,
      avgDaysDeliveryToPayment,
      digitalLedgerWillingness,
      milkSalesDestinations,
      mainBuyerName,
      formalSupplyAgreementDetails,
      averageAnnualRevenueRwf,
      section7AgentNotes,
      section7KeyGaps,
      section1ProvinceId,
      section1DistrictId,
      section1SectorId,
      section1CellId,
      section1VillageId,
      province,
      district,
      sector,
      cell,
      village,
      extraData,
    };

    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draftPayload));
  });

  const validateSubmission = (): SubmissionValidationResult => {
    const missing: string[] = [];
    const addMissing = (label: string, condition: boolean) => {
      if (!condition) {
        missing.push(label);
      }
    };

    addMissing('MCC name (official)', businessName.trim().length > 0);
    addMissing('Province', section1ProvinceId.trim().length > 0);
    addMissing('District', section1DistrictId.trim().length > 0);
    addMissing('Sector', section1SectorId.trim().length > 0);
    addMissing('Cell', section1CellId.trim().length > 0);
    addMissing('Village', section1VillageId.trim().length > 0);
    addMissing('Manager first name', managerFirstName.trim().length > 0);
    addMissing('Manager last name', managerLastName.trim().length > 0);
    addMissing('Manager phone', managerPhone.trim().length > 0);
    addMissing('Manager national ID', managerIdNumber.trim().length > 0);
    addMissing('Ownership structure', ownershipStructure.trim().length > 0);
    addMissing('MCC operational status', operationalStatus.trim().length > 0);
    addMissing('Current daily milk volume', dailyMilkVolume.trim().length > 0);
    addMissing('Maximum milk in one day', maxMilkInOneDay.trim().length > 0);
    addMissing('Tank capacity sufficiency', tankCapacitySufficiency.trim().length > 0);
    addMissing('Power supply selection', powerSupplySelections.length > 0);
    addMissing('Generator capacity', generatorCapacityKva.trim().length > 0);
    addMissing('Mobile network connectivity', mobileConnectivity.trim().length > 0);
    addMissing('Total farmers supplying', totalFarmersSupplying.trim().length > 0);
    addMissing('Milk transporters count', milkTransportersCount.trim().length > 0);
    addMissing('Average distance from farms', averageDistanceKm.trim().length > 0);
    addMissing('Furthest farm distance', furthestFarmKm.trim().length > 0);
    addMissing('Evening milk pattern', eveningMilkPattern.trim().length > 0);
    addMissing('Own milk transport type', ownMilkTransportType.trim().length > 0);
    addMissing('Testing equipment', testingEquipmentSelections.length > 0);
    addMissing('Quality tests', qualityTestsSelections.length > 0);
    addMissing('Average rejected per day', averageRejectedPerDayLitres.trim().length > 0);
    addMissing('Rejection rate percent', rejectionRatePercent.trim().length > 0);
    addMissing('Rejection rankings', Object.keys(rejectionRankings).length >= 3);
    addMissing('Corrective actions planned', correctiveActionsPlanned.trim().length > 0);
    addMissing('Staff total including manager', staffTotalIncludingManager.trim().length > 0);
    addMissing('Staff women count', staffWomenCount.trim().length > 0);
    addMissing('Staff aged 18-35', staffAged1835.trim().length > 0);
    addMissing('Staff women 18-35', staffWomen1835.trim().length > 0);
    addMissing('Staff with disability', staffWithDisability.trim().length > 0);
    addMissing('Record system', recordSystem.trim().length > 0);
    addMissing('Staff training status', staffTrainingStatus.trim().length > 0);
    addMissing('Employment contracts status', employmentContractsStatus.trim().length > 0);
    addMissing('Farmer payment methods', farmerPaymentMethods.length > 0);
    addMissing('Average days from delivery to payment', avgDaysDeliveryToPayment.trim().length > 0);
    addMissing('Digital ledger willingness', digitalLedgerWillingness.trim().length > 0);
    addMissing('Milk sales destinations', milkSalesDestinations.length > 0);
    addMissing('Main buyer name', mainBuyerName.trim().length > 0);
    addMissing('Formal supply agreement details', formalSupplyAgreementDetails.trim().length > 0);
    addMissing('Average annual revenue from milk sales', averageAnnualRevenueRwf.trim().length > 0);

    if (isCooperativeMcc) {
      addMissing('Cooperative total members / shareholders', coopMembersTotal.trim().length > 0);
      addMissing('Cooperative women members / shareholders', coopMembersWomen.trim().length > 0);
      addMissing('Cooperative members aged 18-35', coopMembersAged1835.trim().length > 0);
      addMissing('Cooperative women members aged 18-35', coopMembersWomen1835.trim().length > 0);
    }

    const hasAtLeastOneCoolingTank = coolingTanks.some((tank) => Number(tank.capacityLitres) > 0 && tank.condition.trim().length > 0);
    addMissing('At least one functioning cooling tank', hasAtLeastOneCoolingTank);

    return {
      isValid: missing.length === 0,
      missing,
    };
  };

  const submissionValidation = validateSubmission();

  const setExtraField = (key: string, value: string) => {
    setExtraData((prev) => ({ ...prev, [key]: value }));
  };

  const getTotalPages = (fields: OnboardingField[]) => Math.max(1, Math.ceil(fields.length / FIELDS_PER_PAGE));
  const getPageFields = (fields: OnboardingField[], page: number) => {
    const start = (page - 1) * FIELDS_PER_PAGE;
    return fields.slice(start, start + FIELDS_PER_PAGE);
  };

  const renderField = (field: OnboardingField) => {
    const value = extraData[field.key] || '';
    const isCountField = field.label.trim().startsWith('#');
    const resolvedType = field.type || (isCountField ? 'number' : 'text');

    return (
      <div key={field.key}>
        <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
        </label>
        {field.type === 'select' ? (
          <select
            id={field.key}
            className="input w-full py-3 text-base"
            value={value}
            onChange={(e) => setExtraField(field.key, e.target.value)}
          >
            <option value="">Select option</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={field.key}
            type={resolvedType}
            className="input w-full py-3 text-base"
            value={value}
            placeholder={field.placeholder}
            inputMode={resolvedType === 'number' ? 'numeric' : undefined}
            min={resolvedType === 'number' ? 0 : undefined}
            step={resolvedType === 'number' ? (isCountField ? 1 : 'any') : undefined}
            onChange={(e) => {
              if (resolvedType === 'number' && isCountField) {
                setExtraField(field.key, e.target.value.replace(/[^0-9]/g, ''));
                return;
              }
              setExtraField(field.key, e.target.value);
            }}
          />
        )}
      </div>
    );
  };

  const goToNextStep = () => {
    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  };

  const goToPreviousStep = () => {
    setStep((current) => Math.max(1, current - 1));
  };

  const csvEscape = (value: string) => {
    const normalized = String(value ?? '');
    return `"${normalized.replace(/"/g, '""')}"`;
  };

  const downloadSubmissionCsv = () => {
    const rows: Array<[string, string]> = [
      ['Generated At', new Date().toISOString()],
      ['MCC Official Name', businessName],
      ['MCC Common Name', commonName],
      ['Manager First Name', managerFirstName],
      ['Manager Last Name', managerLastName],
      ['Manager Phone', managerPhone],
      ['Manager National ID', managerIdNumber],
      ['Ownership Structure', ownershipStructure],
      ['Ownership Other', ownershipOther],
      ['Operator Disability', operatorDisability],
      ['Operational Status', operationalStatus],
      ['Operational Notes', operationalNotes],
      ['Registration Number', registrationNumber],
      ['Province ID', section1ProvinceId],
      ['District ID', section1DistrictId],
      ['Sector ID', section1SectorId],
      ['Cell ID', section1CellId],
      ['Village ID', section1VillageId],
      ['Latitude', latitude],
      ['Longitude', longitude],
      ['Daily Milk Volume', dailyMilkVolume],
      ['Max Milk In One Day', maxMilkInOneDay],
      ['Tank Capacity Sufficiency', tankCapacitySufficiency],
      ['Insufficient Capacity Plan', insufficientCapacityPlan],
      ['Power Supply Selections', powerSupplySelections.join('; ')],
      ['Generator Capacity KVA', generatorCapacityKva],
      ['Mobile Connectivity', mobileConnectivity],
      ['Total Farmers Supplying', totalFarmersSupplying],
      ['New Farmers Last 3 Months', newFarmersLast3Months],
      ['Milk Transporters Count', milkTransportersCount],
      ['Average Distance KM', averageDistanceKm],
      ['Furthest Farm KM', furthestFarmKm],
      ['Evening Milk Pattern', eveningMilkPattern],
      ['No Evening Milk Reason', noEveningMilkReason],
      ['Own Milk Transport Type', ownMilkTransportType],
      ['No Own Transport Plan', noOwnTransportPlan],
      ['Testing Equipment', testingEquipmentSelections.join('; ')],
      ['Quality Tests', qualityTestsSelections.join('; ')],
      ['Average Rejected Per Day Litres', averageRejectedPerDayLitres],
      ['Rejection Rate Percent', rejectionRatePercent],
      ['Other Rejection Reason', otherRejectionReason],
      ['Corrective Actions Planned', correctiveActionsPlanned],
      ['Staff Total Including Manager', staffTotalIncludingManager],
      ['Staff Women Count', staffWomenCount],
      ['Staff Aged 18-35', staffAged1835],
      ['Staff Women 18-35', staffWomen1835],
      ['Staff With Disability', staffWithDisability],
      ['Coop Members Total', coopMembersTotal],
      ['Coop Members Women', coopMembersWomen],
      ['Coop Members Aged 18-35', coopMembersAged1835],
      ['Coop Members Women 18-35', coopMembersWomen1835],
      ['Record System', recordSystem],
      ['Staff Training Status', staffTrainingStatus],
      ['Employment Contracts Status', employmentContractsStatus],
      ['Farmer Payment Methods', farmerPaymentMethods.join('; ')],
      ['Average Days Delivery To Payment', avgDaysDeliveryToPayment],
      ['Digital Ledger Willingness', digitalLedgerWillingness],
      ['Milk Sales Destinations', milkSalesDestinations.join('; ')],
      ['Main Buyer Name', mainBuyerName],
      ['Formal Supply Agreement Details', formalSupplyAgreementDetails],
      ['Average Annual Revenue RWF', averageAnnualRevenueRwf],
      ['Section 7 Pass Count', `${section7PassCount}`],
      ['Section 7 Decision', section7FinalDecision],
      ['Section 7 Key Gaps', section7KeyGaps || section7AutoKeyGaps],
    ];

    SECTION7_REQUIREMENTS.forEach((req) => {
      rows.push([`Assessment - ${req.label}`, section7FinalAssessment[req.key]]);
      rows.push([`Assessment Note - ${req.label}`, section7AgentNotes[req.key] || '']);
    });

    const csv = ['Field,Value', ...rows.map(([field, value]) => `${csvEscape(field)},${csvEscape(value)}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gemura-onboarding-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buildSubmissionPayload = () => ({
    submittedAt: new Date().toISOString(),
    businessName,
    commonName,
    managerFirstName,
    managerLastName,
    managerPhone,
    managerIdNumber,
    ownershipStructure,
    ownershipOther,
    operatorDisability,
    operationalStatus,
    operationalNotes,
    registrationNumber,
    section1Location: {
      provinceId: section1ProvinceId,
      districtId: section1DistrictId,
      sectorId: section1SectorId,
      cellId: section1CellId,
      villageId: section1VillageId,
      latitude,
      longitude,
    },
    section2: {
      coolingTanks,
      dailyMilkVolume,
      maxMilkInOneDay,
      tankCapacitySufficiency,
      insufficientCapacityPlan,
      powerSupplySelections,
      generatorCapacityKva,
      mobileConnectivity,
    },
    section3: {
      totalFarmersSupplying,
      newFarmersLast3Months,
      milkTransportersCount,
      averageDistanceKm,
      furthestFarmKm,
      eveningMilkPattern,
      noEveningMilkReason,
      ownMilkTransportType,
      noOwnTransportPlan,
    },
    section4: {
      testingEquipmentSelections,
      qualityTestsSelections,
      averageRejectedPerDayLitres,
      rejectionRatePercent,
      rejectionRankings,
      otherRejectionReason,
      correctiveActionsPlanned,
    },
    section5: {
      staffTotalIncludingManager,
      staffWomenCount,
      staffAged1835,
      staffWomen1835,
      staffWithDisability,
      coopMembersTotal,
      coopMembersWomen,
      coopMembersAged1835,
      coopMembersWomen1835,
    },
    section6: {
      recordSystem,
      staffTrainingStatus,
      employmentContractsStatus,
      farmerPaymentMethods,
      avgDaysDeliveryToPayment,
      digitalLedgerWillingness,
      milkSalesDestinations,
      mainBuyerName,
      formalSupplyAgreementDetails,
      averageAnnualRevenueRwf,
    },
    section7: {
      assessment: section7FinalAssessment,
      passCount: section7PassCount,
      decision: section7FinalDecision,
      keyGaps: section7KeyGaps || section7AutoKeyGaps,
      notes: section7AgentNotes,
    },
  });

  const submitToBackendOnboarding = async () => {
    const payload = buildSubmissionPayload();
    const webhookUrl = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL;
    const response = await fetch(`${section1ApiBaseUrl}/onboard/mcc-submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        googleSheetsWebhookUrl: webhookUrl || undefined,
      }),
    });

    if (!response.ok) {
      let message = `Onboarding submission failed (${response.status})`;
      try {
        const json = await response.json();
        if (json?.message) {
          message = Array.isArray(json.message) ? json.message.join(', ') : String(json.message);
        }
      } catch {
        // Keep default message when response is not valid JSON.
      }
      throw new Error(message);
    }
  };

  const handleFinishAndSendToSheet = async () => {
    try {
      setIsSubmittingToSheet(true);
      setSheetSubmitError('');
      const response = await fetch(`${section1ApiBaseUrl}/onboard/mcc-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildSubmissionPayload(),
          googleSheetsWebhookUrl: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL || undefined,
        }),
      });

      if (!response.ok) {
        let message = `Submission failed (${response.status})`;
        try {
          const json = await response.json();
          if (json?.message) {
            message = Array.isArray(json.message) ? json.message.join(', ') : String(json.message);
          }
        } catch {
          // Keep default message
        }
        throw new Error(message);
      }

      const result = await response.json();
      setSubmissionCode(result?.data?.submission_code || 'N/A');
      setSubmissionSuccess(true);

      if (typeof window !== 'undefined') {
        localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      }

      // Redirect after 3 seconds
      setTimeout(() => {
        window.location.href = '/auth/login';
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit data.';
      setSheetSubmitError(message);
    } finally {
      setIsSubmittingToSheet(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-3 py-6 sm:px-4 lg:px-5 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-360 w-full flex-col">
        <div className="mb-6">
          <Link href="/auth/login" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors">
            <Icon icon={faArrowLeft} size="sm" />
            Back to Login
          </Link>
        </div>

        <div className="grid flex-1 gap-6 lg:grid-cols-[0.65fr_2.35fr]">
          <div className="rounded-lg border border-blue-700 bg-[#0b3a75] text-white shadow-2xl shadow-blue-900/20 overflow-hidden">
            <div className="flex flex-col gap-6 p-6 sm:p-8 lg:p-9">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md border border-white/40 bg-white/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white">
                  <Icon icon={faBuilding} size="sm" />
                  New Business Setup
                </div>
                <h1 className="mt-5 text-3xl font-bold leading-tight text-white! sm:text-4xl">Business Onboarding Wizard</h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white! sm:text-base">
                  Capture MCC operator survey details covering identity, workforce, operations, and digital readiness.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="rounded-md bg-white/20 p-4 ring-1 ring-white/35">
                    <p className="text-xs uppercase tracking-[0.2em] text-white!">What to prepare</p>
                    <p className="mt-1 text-sm font-semibold text-white!">MCC identity, operator details, and operations baseline.</p>
                  </div>
                  <div className="rounded-md bg-white/20 p-4 ring-1 ring-white/35">
                    <p className="text-xs uppercase tracking-[0.2em] text-white!">Data quality</p>
                    <p className="mt-1 text-sm font-semibold text-white!">Count and capacity fields are numeric. Multi-select prompts accept comma-separated values.</p>
                  </div>
                  <div className="rounded-md bg-white/20 p-4 ring-1 ring-white/35">
                    <p className="text-xs uppercase tracking-[0.2em] text-white!">Completion rule</p>
                    <p className="mt-1 text-sm font-semibold text-white!">Location must be complete before final submission.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-white shadow-xl overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-5 sm:px-8 sm:py-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-blue-600">Wizard</p>
                  <h2 className="mt-1 text-2xl font-semibold text-gray-900">Complete the setup</h2>
                </div>
                <div className="rounded-md bg-blue-50 px-4 py-2 text-right text-sm font-medium text-blue-700">
                  <p>Step {step} of {TOTAL_STEPS}</p>
                  <p>{completionPercent}% completed</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <p>
                    Progress: {answeredRequiredQuestions}/{completionChecks.length} required answers
                  </p>
                  <div className="flex items-center gap-3">
                    <p>Draft is auto-saved in this browser.</p>
                    <button
                      type="button"
                      onClick={clearSavedDraft}
                      className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
                    >
                      Clear saved draft
                    </button>
                  </div>
                </div>
                {didRestoreDraft && (
                  <p className="mt-2 text-xs text-emerald-700">
                    Restored your previous onboarding draft.
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                {STEP_TITLES.map((title, index) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => setStep(index + 1)}
                    className={`px-3 py-1 rounded-md ${
                      sectionCompletion[index]
                        ? 'bg-emerald-600 text-white'
                        : step >= index + 1
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-500'
                    } transition-colors hover:opacity-90`}
                  >
                    {index + 1}. {title}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 sm:p-8 lg:p-10">
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faBuilding} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">MCC identity & ownership</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Page {identityPage} of {SECTION1_TOTAL_PAGES}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIdentityPage((p) => Math.max(1, p - 1))}
                        disabled={identityPage === 1}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Prev Section
                      </button>
                      <button
                        type="button"
                        onClick={() => setIdentityPage((p) => Math.min(SECTION1_TOTAL_PAGES, p + 1))}
                        disabled={identityPage === SECTION1_TOTAL_PAGES}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Next Section
                      </button>
                    </div>
                  </div>

                  <div className="space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-5">
                    {identityPage === 1 && (
                      <>
                        <div>
                          <label htmlFor="business-name" className="block text-sm font-medium text-gray-700 mb-2">
                            B1. MCC name (official) <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="business-name"
                            type="text"
                            className="input w-full py-3 text-base"
                            placeholder="e.g. Kivu Dairy Collection Center"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                          />
                        </div>

                        <div>
                          <label htmlFor="common-name" className="block text-sm font-medium text-gray-700 mb-2">
                            Common / local name
                          </label>
                          <input
                            id="common-name"
                            type="text"
                            className="input w-full py-3 text-base"
                            value={commonName}
                            onChange={(e) => setCommonName(e.target.value)}
                          />
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B2. MCC location</h3>
                          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label htmlFor="section1-province" className="block text-sm font-medium text-gray-700 mb-2">Province</label>
                              <select
                                id="section1-province"
                                className="input w-full py-3 text-base"
                                value={section1ProvinceId}
                                onChange={(e) => handleSection1ProvinceChange(e.target.value)}
                              >
                                <option value="">Select province</option>
                                {section1ProvinceOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label htmlFor="section1-district" className="block text-sm font-medium text-gray-700 mb-2">District</label>
                              <select
                                id="section1-district"
                                className="input w-full py-3 text-base"
                                value={section1DistrictId}
                                disabled={!section1ProvinceId}
                                onChange={(e) => handleSection1DistrictChange(e.target.value)}
                              >
                                <option value="">Select district</option>
                                {section1DistrictOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label htmlFor="section1-sector" className="block text-sm font-medium text-gray-700 mb-2">Sector</label>
                              <select
                                id="section1-sector"
                                className="input w-full py-3 text-base"
                                value={section1SectorId}
                                disabled={!section1DistrictId}
                                onChange={(e) => handleSection1SectorChange(e.target.value)}
                              >
                                <option value="">Select sector</option>
                                {section1SectorOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label htmlFor="section1-cell" className="block text-sm font-medium text-gray-700 mb-2">Cell</label>
                              <select
                                id="section1-cell"
                                className="input w-full py-3 text-base"
                                value={section1CellId}
                                disabled={!section1SectorId}
                                onChange={(e) => handleSection1CellChange(e.target.value)}
                              >
                                <option value="">Select cell</option>
                                {section1CellOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label htmlFor="section1-village" className="block text-sm font-medium text-gray-700 mb-2">Village</label>
                              <select
                                id="section1-village"
                                className="input w-full py-3 text-base"
                                value={section1VillageId}
                                disabled={!section1CellId}
                                onChange={(e) => handleSection1VillageChange(e.target.value)}
                              >
                                <option value="">Select village</option>
                                {section1VillageOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-2 rounded-md border border-dashed border-blue-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">GPS / coordinates</p>
                                  <p className="text-xs text-gray-500">Enter them manually or capture the current location on this device.</p>
                                </div>
                                <button type="button" onClick={captureCurrentCoordinates} className="btn btn-secondary px-4 py-2 text-sm">
                                  Use current location
                                </button>
                              </div>
                              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                  <label htmlFor="latitude" className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
                                  <input
                                    id="latitude"
                                    type="text"
                                    className="input w-full py-3 text-base"
                                    value={latitude}
                                    onChange={(e) => setLatitude(e.target.value)}
                                    placeholder="-1.9441"
                                  />
                                </div>
                                <div>
                                  <label htmlFor="longitude" className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
                                  <input
                                    id="longitude"
                                    type="text"
                                    className="input w-full py-3 text-base"
                                    value={longitude}
                                    onChange={(e) => setLongitude(e.target.value)}
                                    placeholder="30.0619"
                                  />
                                </div>
                              </div>
                              {locationError && <p className="mt-3 text-sm text-amber-700">{locationError}</p>}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {identityPage === 2 && (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B3. Operator / manager contact details</h3>
                          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label htmlFor="manager-first-name" className="block text-sm font-medium text-gray-700 mb-2">First name <span className="text-red-500">*</span></label>
                              <input id="manager-first-name" type="text" className="input w-full py-3 text-base" value={managerFirstName} onChange={(e) => setManagerFirstName(e.target.value)} />
                            </div>
                            <div>
                              <label htmlFor="manager-last-name" className="block text-sm font-medium text-gray-700 mb-2">Last name <span className="text-red-500">*</span></label>
                              <input id="manager-last-name" type="text" className="input w-full py-3 text-base" value={managerLastName} onChange={(e) => setManagerLastName(e.target.value)} />
                            </div>
                            <div>
                              <label htmlFor="manager-phone" className="block text-sm font-medium text-gray-700 mb-2">Phone <span className="text-red-500">*</span></label>
                              <input id="manager-phone" type="tel" className="input w-full py-3 text-base" value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                              <label htmlFor="manager-id" className="block text-sm font-medium text-gray-700 mb-2">National ID number <span className="text-red-500">*</span></label>
                              <input id="manager-id" type="text" className="input w-full py-3 text-base" value={managerIdNumber} onChange={(e) => setManagerIdNumber(e.target.value)} />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B4. Ownership structure of this MCC</h3>
                          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <select
                              className="input w-full py-3 text-base md:col-span-2"
                              value={ownershipStructure}
                              onChange={(e) => setOwnershipStructure(e.target.value)}
                            >
                              <option value="">Select ownership structure</option>
                              <option value="Privately owned — individual">Privately owned — individual</option>
                              <option value="Privately owned — company (Ltd)">Privately owned — company (Ltd)</option>
                              <option value="Farmer cooperative (registered)">Farmer cooperative (registered)</option>
                              <option value="Government-supported / NGO-established">Government-supported / NGO-established</option>
                              <option value="Other">Other</option>
                            </select>
                            {ownershipStructure === 'Other' && (
                              <input
                                className="input w-full py-3 text-base md:col-span-2"
                                placeholder="Specify other ownership structure"
                                value={ownershipOther}
                                onChange={(e) => setOwnershipOther(e.target.value)}
                              />
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B5. Does the MCC operator / owner have a disability?</h3>
                          <div className="mt-3 flex flex-wrap gap-3">
                            {['Yes', 'No', 'Prefer not to say'].map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setOperatorDisability(option)}
                                className={`rounded-md border px-4 py-2 text-sm ${operatorDisability === option ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {identityPage === 3 && (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B6. Is this MCC currently operational?</h3>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            {['Yes — fully operational', 'Partially operational', 'Not currently operating'].map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setOperationalStatus(option)}
                                className={`rounded-md border px-4 py-2 text-sm ${operationalStatus === option ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          {operationalStatus !== 'Yes — fully operational' && (
                            <textarea
                              className="input mt-4 w-full py-3 text-base"
                              rows={3}
                              placeholder="If partial or not operating, explain"
                              value={operationalNotes}
                              onChange={(e) => setOperationalNotes(e.target.value)}
                            />
                          )}
                        </div>

                        <div>
                          <label htmlFor="registration-number" className="block text-sm font-medium text-gray-700 mb-2">
                            B7. RURA / RAB registration number (if registered)
                          </label>
                          <input
                            id="registration-number"
                            type="text"
                            className="input w-full py-3 text-base"
                            value={registrationNumber}
                            onChange={(e) => setRegistrationNumber(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setIdentityPage((p) => Math.max(1, p - 1))}
                      disabled={identityPage === 1}
                      className="btn btn-secondary px-6 py-3 disabled:opacity-50"
                    >
                      Back
                    </button>
                    {identityPage < SECTION1_TOTAL_PAGES ? (
                      <button
                        type="button"
                        onClick={() => setIdentityPage((p) => Math.min(SECTION1_TOTAL_PAGES, p + 1))}
                        className="btn btn-primary px-6 py-3"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSection2Page(1);
                          goToNextStep();
                        }}
                        className="btn btn-primary px-6 py-3 text-sm"
                      >
                        Continue to Section 2
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === 999 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faBuilding} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Operator and Ownership Details</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Page {ownershipPage} of {getTotalPages(identityFields.filter(f => ownershipKeys.includes(f.key)))}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOwnershipPage((p) => Math.max(1, p - 1))}
                        disabled={ownershipPage === 1}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Prev Fields
                      </button>
                      <button
                        type="button"
                        onClick={() => setOwnershipPage((p) => Math.min(getTotalPages(identityFields.filter(f => ownershipKeys.includes(f.key))), p + 1))}
                        disabled={ownershipPage === getTotalPages(identityFields.filter(f => ownershipKeys.includes(f.key)))}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Next Fields
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {getPageFields(
                      identityFields.filter(f => ownershipKeys.includes(f.key)),
                      ownershipPage
                    ).map((field) => renderField(field))}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                      Back
                    </button>
                    <button type="button" onClick={goToNextStep} className="btn btn-primary px-6 py-3">
                      Continue to Members
                    </button>
                  </div>
                </div>
              )}

              {step === 903 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faBuilding} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Members and Shareholders</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Page {membersPage} of {getTotalPages(shareholderFields)}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                        disabled={membersPage === 1}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Prev Fields
                      </button>
                      <button
                        type="button"
                        onClick={() => setMembersPage((p) => Math.min(getTotalPages(shareholderFields), p + 1))}
                        disabled={membersPage === getTotalPages(shareholderFields)}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Next Fields
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {getPageFields(shareholderFields, membersPage).map((field) => renderField(field))}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                      Back
                    </button>
                    <button type="button" onClick={goToNextStep} className="btn btn-primary px-6 py-3">
                      Continue to Employees
                    </button>
                  </div>
                </div>
              )}

              {step === 904 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faBuilding} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Employee Composition</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Page {employeesPage} of {getTotalPages(employeeFields)}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEmployeesPage((p) => Math.max(1, p - 1))}
                        disabled={employeesPage === 1}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Prev Fields
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmployeesPage((p) => Math.min(getTotalPages(employeeFields), p + 1))}
                        disabled={employeesPage === getTotalPages(employeeFields)}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Next Fields
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {getPageFields(employeeFields, employeesPage).map((field) => renderField(field))}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                      Back
                    </button>
                    <button type="button" onClick={goToNextStep} className="btn btn-primary px-6 py-3">
                      Continue to Location
                    </button>
                  </div>
                </div>
              )}

              {step === 905 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faMapPin} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Business Location (Rwanda)</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label htmlFor="province" className="block text-sm font-medium text-gray-700 mb-2">Province</label>
                      <select
                        id="province"
                        className="input w-full py-3 text-base"
                        value={province}
                        onChange={(e) => {
                          setProvince(e.target.value);
                          setDistrict('');
                          setSector('');
                          setCell('');
                          setVillage('');
                        }}
                      >
                        <option value="">Select province</option>
                        {provinces.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="district" className="block text-sm font-medium text-gray-700 mb-2">District</label>
                      <select
                        id="district"
                        className="input w-full py-3 text-base"
                        value={district}
                        disabled={!province}
                        onChange={(e) => {
                          setDistrict(e.target.value);
                          setSector('');
                          setCell('');
                          setVillage('');
                        }}
                      >
                        <option value="">Select district</option>
                        {districtOptions.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="sector" className="block text-sm font-medium text-gray-700 mb-2">Sector</label>
                      <select
                        id="sector"
                        className="input w-full py-3 text-base"
                        value={sector}
                        disabled={!district}
                        onChange={(e) => {
                          setSector(e.target.value);
                          setCell('');
                          setVillage('');
                        }}
                      >
                        <option value="">Select sector</option>
                        {sectorOptions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="cell" className="block text-sm font-medium text-gray-700 mb-2">Cell</label>
                      <select
                        id="cell"
                        className="input w-full py-3 text-base"
                        value={cell}
                        disabled={!sector}
                        onChange={(e) => {
                          setCell(e.target.value);
                          setVillage('');
                        }}
                      >
                        <option value="">Select cell</option>
                        {cellOptions.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="village" className="block text-sm font-medium text-gray-700 mb-2">Village</label>
                      <select
                        id="village"
                        className="input w-full py-3 text-base"
                        value={village}
                        disabled={!cell}
                        onChange={(e) => setVillage(e.target.value)}
                      >
                        <option value="">Select village</option>
                        {villageOptions.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                      Back
                    </button>
                    <button type="button" onClick={goToNextStep} disabled={!hasLocation} className="btn btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed">
                      Continue to Section 2
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faMapPin} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Section 2 - Capacity & infrastructure</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Page {section2Page} of {SECTION2_TOTAL_PAGES}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSection2Page((p) => Math.max(1, p - 1))}
                        disabled={section2Page === 1}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Prev Section
                      </button>
                      <button
                        type="button"
                        onClick={() => setSection2Page((p) => Math.min(SECTION2_TOTAL_PAGES, p + 1))}
                        disabled={section2Page === SECTION2_TOTAL_PAGES}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Next Section
                      </button>
                    </div>
                  </div>

                  <div className="space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-5">
                    {section2Page === 1 && (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B8. Cooling tank details - list all tanks</h3>
                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full border border-gray-300 text-sm">
                              <thead className="bg-emerald-50">
                                <tr>
                                  <th className="border border-gray-300 px-3 py-2 text-left">Tank number</th>
                                  <th className="border border-gray-300 px-3 py-2 text-left">Capacity (litres)</th>
                                  <th className="border border-gray-300 px-3 py-2 text-left">Year / age</th>
                                  <th className="border border-gray-300 px-3 py-2 text-left">Condition (Good/Fair/Poor)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {coolingTanks.map((tank, index) => (
                                  <tr key={tank.tankNumber}>
                                    <td className="border border-gray-300 px-3 py-2">{tank.tankNumber}</td>
                                    <td className="border border-gray-300 px-3 py-2">
                                      <input
                                        type="number"
                                        min={0}
                                        className="input w-full py-2 text-sm"
                                        value={tank.capacityLitres}
                                        onChange={(e) => updateCoolingTank(index, 'capacityLitres', e.target.value)}
                                      />
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2">
                                      <input
                                        type="text"
                                        className="input w-full py-2 text-sm"
                                        value={tank.yearOrAge}
                                        onChange={(e) => updateCoolingTank(index, 'yearOrAge', e.target.value)}
                                      />
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2">
                                      <select
                                        className="input w-full py-2 text-sm"
                                        value={tank.condition}
                                        onChange={(e) => updateCoolingTank(index, 'condition', e.target.value)}
                                      >
                                        <option value="">Select</option>
                                        <option value="Good">Good</option>
                                        <option value="Fair">Fair</option>
                                        <option value="Poor">Poor</option>
                                      </select>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">B9. Current daily milk volume (average litres/day)</label>
                            <input
                              type="number"
                              min={0}
                              className="input w-full py-3 text-base"
                              value={dailyMilkVolume}
                              onChange={(e) => setDailyMilkVolume(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">B9. Maximum ever in one day (litres)</label>
                            <input
                              type="number"
                              min={0}
                              className="input w-full py-3 text-base"
                              value={maxMilkInOneDay}
                              onChange={(e) => setMaxMilkInOneDay(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {section2Page === 2 && (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B10. Is current tank capacity sufficient?</h3>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {['Yes - sufficient', 'No - already over capacity', 'No - will be over within 6 months', 'Unsure'].map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setTankCapacitySufficiency(option)}
                                className={`rounded-md border px-4 py-2 text-left text-sm ${tankCapacitySufficiency === option ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          {tankCapacitySufficiency && tankCapacitySufficiency !== 'Yes - sufficient' && (
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">If insufficient, plan</label>
                              <input
                                type="text"
                                className="input w-full py-3 text-base"
                                value={insufficientCapacityPlan}
                                onChange={(e) => setInsufficientCapacityPlan(e.target.value)}
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B11. Power supply at MCC (tick all that apply)</h3>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION2_POWER_OPTIONS.map((option) => (
                              <label key={option} className="flex items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={powerSupplySelections.includes(option)}
                                  onChange={() => togglePowerSupplyOption(option)}
                                />
                                <span className="text-sm text-gray-700">{option}</span>
                              </label>
                            ))}
                          </div>
                          <div className="mt-4 md:w-1/2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Generator capacity (kVA)</label>
                            <input
                              type="number"
                              min={0}
                              className="input w-full py-3 text-base"
                              value={generatorCapacityKva}
                              onChange={(e) => setGeneratorCapacityKva(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {section2Page === 3 && (
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B12. Mobile network connectivity at MCC site</h3>
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          {SECTION2_CONNECTIVITY_OPTIONS.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setMobileConnectivity(option)}
                              className={`rounded-md border px-4 py-2 text-left text-sm ${mobileConnectivity === option ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    {section2Page === 1 ? (
                      <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                        Back
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSection2Page((p) => Math.max(1, p - 1))}
                        className="btn btn-secondary px-6 py-3"
                      >
                        Back
                      </button>
                    )}

                    {section2Page < SECTION2_TOTAL_PAGES ? (
                      <button
                        type="button"
                        onClick={() => setSection2Page((p) => Math.min(SECTION2_TOTAL_PAGES, p + 1))}
                        className="btn btn-primary px-6 py-3"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSection3Page(1);
                          goToNextStep();
                        }}
                        className="btn btn-primary px-6 py-3"
                      >
                        Continue to Section 3
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faMapPin} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Section 3 - Supply network & farmer base</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Page {section3Page} of {SECTION3_TOTAL_PAGES}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSection3Page((p) => Math.max(1, p - 1))}
                        disabled={section3Page === 1}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Prev Section
                      </button>
                      <button
                        type="button"
                        onClick={() => setSection3Page((p) => Math.min(SECTION3_TOTAL_PAGES, p + 1))}
                        disabled={section3Page === SECTION3_TOTAL_PAGES}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Next Section
                      </button>
                    </div>
                  </div>

                  <div className="space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-5">
                    {section3Page === 1 && (
                      <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">B13. Total dairy farmers currently supplying - Number of farmers</label>
                            <input
                              type="number"
                              min={0}
                              className="input w-full py-3 text-base"
                              value={totalFarmersSupplying}
                              onChange={(e) => setTotalFarmersSupplying(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">B13. New farmers in last 3 months</label>
                            <input
                              type="number"
                              min={0}
                              className="input w-full py-3 text-base"
                              value={newFarmersLast3Months}
                              onChange={(e) => setNewFarmersLast3Months(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">B14. Number of milk transporters (Abacunda)</label>
                          <input
                            type="number"
                            min={0}
                            className="input w-full py-3 text-base md:w-1/2"
                            value={milkTransportersCount}
                            onChange={(e) => setMilkTransportersCount(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">B15. Average distance from farms to this MCC - Average (km)</label>
                            <input
                              type="number"
                              min={0}
                              className="input w-full py-3 text-base"
                              value={averageDistanceKm}
                              onChange={(e) => setAverageDistanceKm(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">B15. Furthest farm (km)</label>
                            <input
                              type="number"
                              min={0}
                              className="input w-full py-3 text-base"
                              value={furthestFarmKm}
                              onChange={(e) => setFurthestFarmKm(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {section3Page === 2 && (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B16. Does the MCC receive evening milk?</h3>
                          <p className="mt-1 text-xs text-gray-500">Tick one</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION3_EVENING_MILK_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setEveningMilkPattern(option)}
                                className={`rounded-md border px-4 py-2 text-left text-sm ${eveningMilkPattern === option ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          {eveningMilkPattern === 'Morning only' && (
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">If no evening milk, reason</label>
                              <input
                                type="text"
                                className="input w-full py-3 text-base"
                                value={noEveningMilkReason}
                                onChange={(e) => setNoEveningMilkReason(e.target.value)}
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B17. Does the MCC have its own milk transport?</h3>
                          <p className="mt-1 text-xs text-gray-500">Tick one</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION3_TRANSPORT_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setOwnMilkTransportType(option)}
                                className={`rounded-md border px-4 py-2 text-left text-sm ${ownMilkTransportType === option ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          {ownMilkTransportType.startsWith('No -') && (
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">If no own transport, plan</label>
                              <input
                                type="text"
                                className="input w-full py-3 text-base"
                                value={noOwnTransportPlan}
                                onChange={(e) => setNoOwnTransportPlan(e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    {section3Page === 1 ? (
                      <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                        Back
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSection3Page((p) => Math.max(1, p - 1))}
                        className="btn btn-secondary px-6 py-3"
                      >
                        Back
                      </button>
                    )}

                    {section3Page < SECTION3_TOTAL_PAGES ? (
                      <button
                        type="button"
                        onClick={() => setSection3Page((p) => Math.min(SECTION3_TOTAL_PAGES, p + 1))}
                        className="btn btn-primary px-6 py-3"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSection4Page(1);
                          goToNextStep();
                        }}
                        className="btn btn-primary px-6 py-3"
                      >
                        Continue to Section 4
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faMapPin} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Section 4 - Milk quality & compliance</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Page {section4Page} of {SECTION4_TOTAL_PAGES}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSection4Page((p) => Math.max(1, p - 1))}
                        disabled={section4Page === 1}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Prev Section
                      </button>
                      <button
                        type="button"
                        onClick={() => setSection4Page((p) => Math.min(SECTION4_TOTAL_PAGES, p + 1))}
                        disabled={section4Page === SECTION4_TOTAL_PAGES}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Next Section
                      </button>
                    </div>
                  </div>

                  <div className="space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-5">
                    {section4Page === 1 && (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B18. Testing equipment present and working</h3>
                          <p className="mt-1 text-xs text-gray-500">Tick all that exist and work</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION4_TESTING_EQUIPMENT_OPTIONS.map((option) => (
                              <label key={option} className="flex items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={testingEquipmentSelections.includes(option)}
                                  onChange={() => toggleStringOption(option, setTestingEquipmentSelections)}
                                />
                                <span className="text-sm text-gray-700">{option}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B19. Quality tests conducted on every delivery</h3>
                          <p className="mt-1 text-xs text-gray-500">Tick all routinely applied</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION4_QUALITY_TEST_OPTIONS.map((option) => (
                              <label key={option} className="flex items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={qualityTestsSelections.includes(option)}
                                  onChange={() => toggleStringOption(option, setQualityTestsSelections)}
                                />
                                <span className="text-sm text-gray-700">{option}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">B20. Average milk rejected per day (litres/day)</label>
                            <input
                              type="number"
                              min={0}
                              className="input w-full py-3 text-base"
                              value={averageRejectedPerDayLitres}
                              onChange={(e) => setAverageRejectedPerDayLitres(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">B20. Rejection rate (%)</label>
                            <input
                              type="number"
                              min={0}
                              className="input w-full py-3 text-base"
                              value={rejectionRatePercent}
                              onChange={(e) => setRejectionRatePercent(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {section4Page === 2 && (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B21. Rank the top 3 rejection reasons</h3>
                          <p className="mt-1 text-xs text-gray-500">Write 1 = most common, 2 = second, 3 = third</p>
                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full border border-gray-300 text-sm">
                              <thead className="bg-emerald-50">
                                <tr>
                                  <th className="border border-gray-300 px-3 py-2 text-left">Rejection reason</th>
                                  <th className="border border-gray-300 px-3 py-2 text-left md:w-40">Rank</th>
                                </tr>
                              </thead>
                              <tbody>
                                {SECTION4_REJECTION_REASONS.map((reason) => (
                                  <tr key={reason}>
                                    <td className="border border-gray-300 px-3 py-2">{reason}</td>
                                    <td className="border border-gray-300 px-3 py-2">
                                      <select
                                        className="input w-full py-2 text-sm"
                                        value={rejectionRankings[reason] || ''}
                                        onChange={(e) => setRejectionRankings((prev) => ({ ...prev, [reason]: e.target.value }))}
                                      >
                                        <option value="">-</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                      </select>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">If other</label>
                          <input
                            type="text"
                            className="input w-full py-3 text-base"
                            value={otherRejectionReason}
                            onChange={(e) => setOtherRejectionReason(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Corrective actions planned</label>
                          <textarea
                            className="input w-full py-3 text-base"
                            rows={3}
                            value={correctiveActionsPlanned}
                            onChange={(e) => setCorrectiveActionsPlanned(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    {section4Page === 1 ? (
                      <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                        Back
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSection4Page((p) => Math.max(1, p - 1))}
                        className="btn btn-secondary px-6 py-3"
                      >
                        Back
                      </button>
                    )}

                    {section4Page < SECTION4_TOTAL_PAGES ? (
                      <button
                        type="button"
                        onClick={() => setSection4Page((p) => Math.min(SECTION4_TOTAL_PAGES, p + 1))}
                        className="btn btn-primary px-6 py-3"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSection5Page(1);
                          goToNextStep();
                        }}
                        className="btn btn-primary px-6 py-3"
                      >
                        Continue to Section 5
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faMapPin} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Section 5 - Workforce & cooperative membership</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Page {section5Page} of {SECTION5_TOTAL_PAGES}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSection5Page((p) => Math.max(1, p - 1))}
                        disabled={section5Page === 1}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Prev Section
                      </button>
                      <button
                        type="button"
                        onClick={() => setSection5Page((p) => Math.min(SECTION5_TOTAL_PAGES, p + 1))}
                        disabled={section5Page === SECTION5_TOTAL_PAGES}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Next Section
                      </button>
                    </div>
                  </div>

                  <div className="space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-5">
                    {section5Page === 1 && (
                      <>
                        <p className="text-sm text-gray-700">Four short questions for all MCCs. Plus cooperative member questions if B4 = cooperative.</p>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">B22. Total people working at this MCC including manager</label>
                          <input
                            type="number"
                            min={0}
                            className="input w-full py-3 text-base md:w-1/2"
                            value={staffTotalIncludingManager}
                            onChange={(e) => setStaffTotalIncludingManager(e.target.value)}
                          />
                          <p className="mt-1 text-xs text-emerald-700">VIBE reporting: total employees. Male auto-calculated below.</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">B23. How many of those are women?</label>
                          <input
                            type="number"
                            min={0}
                            className="input w-full py-3 text-base md:w-1/2"
                            value={staffWomenCount}
                            onChange={(e) => setStaffWomenCount(e.target.value)}
                          />
                          <p className="mt-1 text-xs text-gray-600">Male staff (auto): {maleStaffAuto}</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">B24. How many staff are between 18 and 35?</label>
                          <input
                            type="number"
                            min={0}
                            className="input w-full py-3 text-base md:w-1/2"
                            value={staffAged1835}
                            onChange={(e) => setStaffAged1835(e.target.value)}
                          />
                          <p className="mt-1 text-xs text-gray-600">Staff above 35 (auto): {staffAbove35Auto}</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">B25. Of those 18-35, how many are women?</label>
                          <input
                            type="number"
                            min={0}
                            className="input w-full py-3 text-base md:w-1/2"
                            value={staffWomen1835}
                            onChange={(e) => setStaffWomen1835(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">B26. Any staff with a disability? (number or 0)</label>
                          <input
                            type="number"
                            min={0}
                            className="input w-full py-3 text-base md:w-1/2"
                            value={staffWithDisability}
                            onChange={(e) => setStaffWithDisability(e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    {section5Page === 2 && (
                      <>
                        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3">
                          <p className="text-sm font-semibold text-indigo-800">B27-B30 (complete only if B4 = cooperative)</p>
                        </div>

                        {isCooperativeMcc ? (
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">B27. Total members / shareholders</label>
                              <input
                                type="number"
                                min={0}
                                className="input w-full py-3 text-base"
                                value={coopMembersTotal}
                                onChange={(e) => setCoopMembersTotal(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">B28. How many are women?</label>
                              <input
                                type="number"
                                min={0}
                                className="input w-full py-3 text-base"
                                value={coopMembersWomen}
                                onChange={(e) => setCoopMembersWomen(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">B29. How many are aged 18-35?</label>
                              <input
                                type="number"
                                min={0}
                                className="input w-full py-3 text-base"
                                value={coopMembersAged1835}
                                onChange={(e) => setCoopMembersAged1835(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">B30. Of those young members, how many are women?</label>
                              <input
                                type="number"
                                min={0}
                                className="input w-full py-3 text-base"
                                value={coopMembersWomen1835}
                                onChange={(e) => setCoopMembersWomen1835(e.target.value)}
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700">
                            This MCC is not marked as a cooperative in B4, so B27-B30 are not required.
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    {section5Page === 1 ? (
                      <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                        Back
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSection5Page((p) => Math.max(1, p - 1))}
                        className="btn btn-secondary px-6 py-3"
                      >
                        Back
                      </button>
                    )}

                    {section5Page < SECTION5_TOTAL_PAGES ? (
                      <button
                        type="button"
                        onClick={() => setSection5Page((p) => Math.min(SECTION5_TOTAL_PAGES, p + 1))}
                        className="btn btn-primary px-6 py-3"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSection6Page(1);
                          goToNextStep();
                        }}
                        className="btn btn-primary px-6 py-3"
                      >
                        Continue to Section 6
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faMapPin} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Section 6 - Digital readiness & financial systems</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Page {section6Page} of {SECTION6_TOTAL_PAGES}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSection6Page((p) => Math.max(1, p - 1))}
                        disabled={section6Page === 1}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Prev Section
                      </button>
                      <button
                        type="button"
                        onClick={() => setSection6Page((p) => Math.min(SECTION6_TOTAL_PAGES, p + 1))}
                        disabled={section6Page === SECTION6_TOTAL_PAGES}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Next Section
                      </button>
                    </div>
                  </div>

                  <div className="space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-5">
                    {section6Page === 1 && (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B31. Current milk delivery record system</h3>
                          <p className="mt-1 text-xs text-gray-500">Tick one</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION6_RECORD_SYSTEM_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setRecordSystem(option)}
                                className={`rounded-md border px-4 py-2 text-left text-sm ${recordSystem === option ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B32. Are MCC staff trained on milk handling and quality?</h3>
                          <p className="mt-1 text-xs text-gray-500">Tick one</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION6_STAFF_TRAINING_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setStaffTrainingStatus(option)}
                                className={`rounded-md border px-4 py-2 text-left text-sm ${staffTrainingStatus === option ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B33. Do MCC staff have written employment contracts?</h3>
                          <p className="mt-1 text-xs text-gray-500">Tick one</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION6_CONTRACT_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setEmploymentContractsStatus(option)}
                                className={`rounded-md border px-4 py-2 text-left text-sm ${employmentContractsStatus === option ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {section6Page === 2 && (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B34. How does the MCC pay farmers for milk?</h3>
                          <p className="mt-1 text-xs text-gray-500">Tick all that apply</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION6_PAYMENT_METHOD_OPTIONS.map((option) => (
                              <label key={option} className="flex items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={farmerPaymentMethods.includes(option)}
                                  onChange={() => toggleStringOption(option, setFarmerPaymentMethods)}
                                />
                                <span className="text-sm text-gray-700">{option}</span>
                              </label>
                            ))}
                          </div>
                          <div className="mt-4 md:w-1/2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Average days from delivery to payment</label>
                            <input
                              type="number"
                              min={0}
                              className="input w-full py-3 text-base"
                              value={avgDaysDeliveryToPayment}
                              onChange={(e) => setAvgDaysDeliveryToPayment(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B35. Willing to transition to a daily digital ledger?</h3>
                          <p className="mt-1 text-xs text-gray-500">Tick one</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION6_LEDGER_WILLINGNESS_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setDigitalLedgerWillingness(option)}
                                className={`rounded-md border px-4 py-2 text-left text-sm ${digitalLedgerWillingness === option ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {section6Page === 3 && (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">B36. Where does this MCC sell its collected milk?</h3>
                          <p className="mt-1 text-xs text-gray-500">Tick all that apply</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {SECTION6_SALES_DESTINATION_OPTIONS.map((option) => (
                              <label key={option} className="flex items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={milkSalesDestinations.includes(option)}
                                  onChange={() => toggleStringOption(option, setMilkSalesDestinations)}
                                />
                                <span className="text-sm text-gray-700">{option}</span>
                              </label>
                            ))}
                          </div>
                          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Main buyer name</label>
                              <input
                                type="text"
                                className="input w-full py-3 text-base"
                                value={mainBuyerName}
                                onChange={(e) => setMainBuyerName(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Formal supply agreement in place? Yes / No - details</label>
                              <input
                                type="text"
                                className="input w-full py-3 text-base"
                                value={formalSupplyAgreementDetails}
                                onChange={(e) => setFormalSupplyAgreementDetails(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">B37. Average annual revenue from milk sales before joining Gemura (RWF)</label>
                          <input
                            type="number"
                            min={0}
                            className="input w-full py-3 text-base md:w-1/2"
                            value={averageAnnualRevenueRwf}
                            onChange={(e) => setAverageAnnualRevenueRwf(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    {section6Page === 1 ? (
                      <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                        Back
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSection6Page((p) => Math.max(1, p - 1))}
                        className="btn btn-secondary px-6 py-3"
                      >
                        Back
                      </button>
                    )}

                    {section6Page < SECTION6_TOTAL_PAGES ? (
                      <button
                        type="button"
                        onClick={() => setSection6Page((p) => Math.min(SECTION6_TOTAL_PAGES, p + 1))}
                        className="btn btn-primary px-6 py-3"
                      >
                        Continue
                      </button>
                    ) : (
                      <button type="button" onClick={goToNextStep} className="btn btn-primary px-6 py-3">
                        Continue to Section 7
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === 7 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faCheckCircle} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Section 7 - VIBE Pathway 4 compliance assessment</h2>
                  </div>

                  <p className="text-sm text-gray-700">Final assessment is automatically computed from responses in Sections 1-6. Agent notes can still be added.</p>

                  <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left">VIBE P4 requirement</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Pass</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Fail</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Agent notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SECTION7_REQUIREMENTS.map((req) => {
                          const current = section7FinalAssessment[req.key];
                          return (
                            <tr key={req.key}>
                              <td className="border border-gray-300 px-3 py-2 align-top">{req.label}</td>
                              <td className="border border-gray-300 px-3 py-2 align-top">
                                <span className={`inline-flex rounded px-3 py-1 text-xs font-semibold ${current === 'pass' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                  Pass
                                </span>
                              </td>
                              <td className="border border-gray-300 px-3 py-2 align-top">
                                <span className={`inline-flex rounded px-3 py-1 text-xs font-semibold ${current === 'fail' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                  Fail
                                </span>
                              </td>
                              <td className="border border-gray-300 px-3 py-2 align-top">
                                <input
                                  type="text"
                                  className="input w-full py-2 text-sm"
                                  value={section7AgentNotes[req.key] || ''}
                                  onChange={(e) => setSection7AgentNotes((prev) => ({ ...prev, [req.key]: e.target.value }))}
                                  placeholder="Notes"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900">Overall VIBE P4 decision</p>
                    <div className="mt-3">
                      <span className={`inline-flex rounded-md border px-4 py-2 text-sm font-semibold ${section7FinalDecision === 'PASS' ? 'border-emerald-700 bg-emerald-700 text-white' : section7FinalDecision === 'CONDITIONAL' ? 'border-amber-500 bg-amber-500 text-white' : 'border-rose-700 bg-rose-700 text-white'}`}>
                        {section7FinalDecision}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">Decision is automatically computed from answers in Sections 1-6.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Passes out of 8</label>
                      <input type="text" readOnly className="input w-full py-3 text-base bg-gray-100" value={`${section7PassCount} / 8`} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Key gaps requiring action</label>
                      <textarea
                        rows={3}
                        className="input w-full py-3 text-base"
                        value={section7KeyGaps}
                        onChange={(e) => setSection7KeyGaps(e.target.value)}
                        placeholder={section7AutoKeyGaps || 'No major gaps'}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                      Back
                    </button>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={downloadSubmissionCsv} className="btn btn-secondary px-6 py-3">
                        Export to Excel (CSV)
                      </button>
                      <button
                        type="button"
                        onClick={handleFinishAndSendToSheet}
                        disabled={isSubmittingToSheet || submissionSuccess}
                        className="btn btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmittingToSheet ? 'Submitting...' : 'Finish'}
                      </button>
                    </div>
                  </div>
                  {submissionSuccess && (
                    <div className="rounded-lg border border-green-300 bg-green-50 p-4">
                      <div className="flex items-start gap-3">
                        <Icon icon={faCheckCircle} size="sm" className="text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-green-900">Submission Successful! ✅</p>
                          <p className="text-sm text-green-800 mt-1">
                            Your onboarding form has been saved successfully.
                          </p>
                          <p className="text-sm font-medium text-green-900 mt-2">
                            Submission Code: <span className="font-mono font-bold text-base">{submissionCode}</span>
                          </p>
                          <p className="text-xs text-green-700 mt-2">Redirecting to login in 3 seconds...</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {sheetSubmitError && <p className="text-sm text-rose-700">{sheetSubmitError}</p>}
                </div>
              )}

              {step === 907 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Icon icon={faCheckCircle} size="sm" />
                    <h2 className="text-xl font-semibold">Review Summary</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4 rounded-md border border-gray-200 bg-gray-50 p-5 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">MCC Name (Official)</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{businessName}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">MCC Name (Common/Local)</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{extraData.commonMccName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Operator / Manager</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{[managerFirstName, managerLastName].filter(Boolean).join(' ') || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Contact Number</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{extraData.operatorPhone || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Location</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{[village, cell, sector, district, province].filter(Boolean).join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Current Daily Milk Volume</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{dailyMilkVolume || '-'} L/day</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Cooling Tank Capacity</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{totalCoolingCapacity || '-'} L</p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                      Back
                    </button>
                    <Link href="/auth/login" className={`btn btn-primary px-6 py-3 ${!hasLocation ? 'pointer-events-none opacity-50' : ''}`}>
                      Finish (Return to Login)
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
