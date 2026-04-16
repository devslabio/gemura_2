'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Icon, { faArrowLeft, faBuilding, faMapPin, faCheckCircle } from '@/app/components/Icon';

type ProvinceDistrictMap = Record<string, string[]>;
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
  { key: 'commencementDate', label: 'Commencement Date', type: 'date' },
  { key: 'businessOwnerName', label: 'Name of the Business Owner' },
  { key: 'businessContactNumber', label: 'Business Contact Number', type: 'tel' },
  { key: 'ownerNationality', label: 'Nationality' },
  { key: 'ownerNationalId', label: 'National ID' },
  { key: 'ownerEmail', label: 'Email', type: 'email' },
  { key: 'ownerDob', label: 'Owner DoB', type: 'date' },
  { key: 'sex', label: 'Sex', type: 'select', options: ['Male', 'Female'] },
  { key: 'ownerPwdStatus', label: 'Owner PWD Status', type: 'select', options: ['Yes', 'No'] },
  { key: 'businessType', label: 'Business Type' },
  { key: 'businessId', label: 'Business ID' },
  { key: 'supportFromIp', label: 'Support from IP', type: 'select', options: ['Yes', 'No'] },
  { key: 'businessSize', label: 'Business Size' },
  { key: 'averageAnnualRevenue', label: 'Average Annual Revenue (RWF)', type: 'number' },
  { key: 'sexBm', label: 'Sex: BM', type: 'select', options: ['Male', 'Female'] },
  { key: 'ageBm', label: 'Age: BM', type: 'number' },
];

const shareholderFields: OnboardingField[] = [
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
  { key: 'dailyCollectionCapacityLiters', label: 'Daily Collection Capacity (Liters)', type: 'number' },
  { key: 'peakCollectionCapacityLiters', label: 'Peak Collection Capacity (Liters)', type: 'number' },
  { key: 'coolingCapacityLiters', label: 'Cooling Capacity (Liters)', type: 'number' },
  { key: 'storageCapacityLiters', label: 'Storage Capacity (Liters)', type: 'number' },
  { key: 'numberOfCollectionPoints', label: '# Collection Points / Routes', type: 'number' },
  { key: 'hasMilkAnalyzer', label: 'Has Milk Analyzer Equipment', type: 'select', options: ['Yes', 'No'] },
  { key: 'hasAntibioticTestKits', label: 'Has Antibiotic / Adulteration Test Kits', type: 'select', options: ['Yes', 'No'] },
  { key: 'hasGeneratorBackup', label: 'Has Generator or Backup Power', type: 'select', options: ['Yes', 'No'] },
  { key: 'hasColdChainTransport', label: 'Has Cold Chain Transport', type: 'select', options: ['Yes', 'No'] },
  { key: 'digitalRecords', label: 'Uses Digital Records for Collections', type: 'select', options: ['Yes', 'No'] },
  { key: 'qualityTestingFrequency', label: 'Quality Testing Frequency' },
  { key: 'expansionPlan12Months', label: 'Has 12-Month Expansion Plan', type: 'select', options: ['Yes', 'No'] },
];

const STEP_TITLES = ['Business', 'Ownership', 'Members', 'Employees', 'Location', 'Capacity', 'Review'];
const TOTAL_STEPS = STEP_TITLES.length;
const FIELDS_PER_PAGE = 8;

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
  const [ownershipPage, setOwnershipPage] = useState(1);
  const [membersPage, setMembersPage] = useState(1);
  const [employeesPage, setEmployeesPage] = useState(1);
  const [capacityPage, setCapacityPage] = useState(1);

  const [businessName, setBusinessName] = useState('');
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

  const canProceedFromStep1 = businessName.trim().length > 1;
  const hasLocation = Boolean(province && district && sector && cell && village);
  const identityFieldMap = useMemo(
    () => identityFields.reduce<Record<string, OnboardingField>>((acc, field) => ({ ...acc, [field.key]: field }), {}),
    [],
  );
  const businessProfileKeys = ['commencementDate', 'businessType', 'businessId', 'supportFromIp', 'businessSize', 'averageAnnualRevenue'];
  const ownershipKeys = ['businessOwnerName', 'businessContactNumber', 'ownerNationality', 'ownerNationalId', 'ownerEmail', 'ownerDob', 'sex', 'ownerPwdStatus', 'sexBm', 'ageBm'];

  const ownerAge = useMemo(() => {
    const dob = extraData.ownerDob;
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age >= 0 ? String(age) : '';
  }, [extraData.ownerDob]);

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
                  Capture complete business, ownership, workforce, and capacity details in one guided flow.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="rounded-md bg-white/20 p-4 ring-1 ring-white/35">
                    <p className="text-xs uppercase tracking-[0.2em] text-white!">What to prepare</p>
                    <p className="mt-1 text-sm font-semibold text-white!">Business profile, owner identity, and compliance details.</p>
                  </div>
                  <div className="rounded-md bg-white/20 p-4 ring-1 ring-white/35">
                    <p className="text-xs uppercase tracking-[0.2em] text-white!">Data quality</p>
                    <p className="mt-1 text-sm font-semibold text-white!">All fields starting with # accept numbers only.</p>
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
                <div className="rounded-md bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                  Step {step} of {TOTAL_STEPS}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                {STEP_TITLES.map((title, index) => (
                  <span key={title} className={`px-3 py-1 rounded-md ${step >= index + 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {index + 1}. {title}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 sm:p-8 lg:p-10">
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faBuilding} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Business Profile</h2>
                  </div>

                  <div>
                    <label htmlFor="business-name" className="block text-sm font-medium text-gray-700 mb-2">
                      Name of the Business <span className="text-red-500">*</span>
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
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">Business Details</h3>
                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {businessProfileKeys.map((key) => renderField(identityFieldMap[key]))}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={goToNextStep}
                      disabled={!canProceedFromStep1}
                      className="btn btn-primary px-6 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue to Ownership
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faBuilding} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Ownership and Identity</h2>
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

              {step === 3 && (
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

              {step === 4 && (
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

              {step === 5 && (
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
                      Continue to Capacity
                    </button>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Icon icon={faMapPin} size="sm" className="text-primary" />
                    <h2 className="text-xl font-semibold">Milk Collection Capability and Capacity</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Page {capacityPage} of {getTotalPages(capabilityFields)}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCapacityPage((p) => Math.max(1, p - 1))}
                        disabled={capacityPage === 1}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Prev Fields
                      </button>
                      <button
                        type="button"
                        onClick={() => setCapacityPage((p) => Math.min(getTotalPages(capabilityFields), p + 1))}
                        disabled={capacityPage === getTotalPages(capabilityFields)}
                        className="btn btn-secondary px-3 py-2 disabled:opacity-50"
                      >
                        Next Fields
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {getPageFields(capabilityFields, capacityPage).map((field) => renderField(field))}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button type="button" onClick={goToPreviousStep} className="btn btn-secondary px-6 py-3">
                      Back
                    </button>
                    <button type="button" onClick={goToNextStep} className="btn btn-primary px-6 py-3">
                      Continue to Review
                    </button>
                  </div>
                </div>
              )}

              {step === 7 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Icon icon={faCheckCircle} size="sm" />
                    <h2 className="text-xl font-semibold">Review Summary</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4 rounded-md border border-gray-200 bg-gray-50 p-5 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Business Name</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{businessName}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Owner Name</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{extraData.businessOwnerName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Contact Number</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{extraData.businessContactNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Business Type</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{extraData.businessType || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Location</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{[village, cell, sector, district, province].filter(Boolean).join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Daily Capacity</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{extraData.dailyCollectionCapacityLiters || '-'} L</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Cooling Capacity</p>
                      <p className="mt-1 text-base font-medium text-gray-900">{extraData.coolingCapacityLiters || '-'} L</p>
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
