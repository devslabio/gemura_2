'use client';

import SupplierKycOnboardingFlow from './SupplierKycOnboardingFlow';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import Modal from '@/app/components/Modal';
import Icon, { faTruck, faWarehouse, faUserPlus, faArrowLeft, faArrowRight, faFloppyDisk } from '@/app/components/Icon';
import { useToastStore } from '@/store/toast';
import {
  initialCollectorState,
  initialFarmerState,
  isCollectorDirty,
  isFarmerDirty,
  MILK_COLLECTOR_KIND,
  type CollectorFormState,
  type FarmerFormState,
  type MilkCollectorKind,
} from './model';
import { mergeFarmerDraft, mergeCollectorDraft } from './mergeOnboardingDraft';
import {
  FieldLabel,
  ProgressBar,
  WizardStepAlert,
  WizardStepPanel,
  wizardInputWithError,
  wizardTextInputClass,
} from './formPrimitives';
import {
  FarmerOnboardingPath,
  computeFarmerProgress,
  type FarmerWizardStep,
} from './FarmerOnboardingPath';
import {
  CollectorOnboardingPath,
  computeCollectorProgress,
  type CollectorWizardStep,
} from './CollectorOnboardingPath';
import { FarmerOnboardingPreview, CollectorOnboardingPreview } from './OnboardingPreview';
import { P } from './fieldPlaceholders';
import { computeCollectorAutoSummary, computeFarmerAutoSummary } from './onboardingAutoResults';
import { buildOnboardingPayload, type SupplierOnboardType } from './buildOnboardingPayload';
import { useAuthStore } from '@/store/auth';
import { adminApi } from '@/lib/api/admin';
import { supplierOnboardingApi } from '@/lib/api/supplierOnboardingApi';
import type { SupplierSegment } from '@/types';
import {
  formatLocationLine,
  normalizeRwandaPhoneDigits,
  validateOnboardingReview,
} from './onboardingCommercialValidation';
import {
  validateCollectorWizardStep,
  validateFarmerWizardStep,
  validateOnboardingSetupStep,
} from './onboardingWizardStepValidation';

const STORAGE_KEY = 'gemura-supplier-onboarding-draft';
const PENDING_KEY = 'gemura-supplier-onboarding-pending';

/** Setup + 8 sections + agent + review */
const FARMER_STEP_COUNT = 11;
/** Setup + 6 sections + agent + review */
const COLLECTOR_STEP_COUNT = 9;

export type { SupplierOnboardType };

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful onboarding registration (refresh lists, etc.). */
  onRegistered?: () => void;
  /** Supplier/farmer completes their own milk onboarding (saved to supplier_milk_onboardings). */
  selfService?: boolean;
}

function tryCaptureGps(
  onUpdate: (lat: number, lng: number) => void,
  onStatus: (s: 'acquiring' | 'captured' | 'unavailable') => void
) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onStatus('unavailable');
    return;
  }
  onStatus('acquiring');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      onUpdate(pos.coords.latitude, pos.coords.longitude);
      onStatus('captured');
    },
    () => onStatus('unavailable'),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function farmerWizardKey(index: number): FarmerWizardStep {
  const keys: FarmerWizardStep[] = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'agent'];
  return keys[index - 1];
}

function collectorWizardKey(index: number): CollectorWizardStep {
  const keys: CollectorWizardStep[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'agent'];
  return keys[index - 1];
}

function stepTitleFarmer(index: number): string {
  const labels = [
    'Setup — location capture',
    '1 — Identity & location',
    '2 — Herd & production',
    '3 — Lactation & breeding',
    '4 — Farming & infrastructure',
    '5 — Management & support',
    '6 — Workforce',
    '7 — Digital & financial',
    '8 — Goals',
    'Agent — pathway assignment',
    'Review & submit',
  ];
  return labels[index] ?? '';
}

function stepTitleCollector(index: number): string {
  const labels = [
    'Setup — location capture',
    'C1 — Identity',
    'C2 — Collection operations',
    'C3 — Farmer roster',
    'C4 — Workforce',
    'C5 — Digital & financial',
    'C6 — Goals',
    'Agent — pathway assignment',
    'Review & submit',
  ];
  return labels[index] ?? '';
}

export default function SupplierOnboardingModal({
  open,
  onClose,
  onRegistered,
  selfService = false,
}: Props) {
  const toast = useToastStore();
  const { currentAccount } = useAuthStore();
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [supplierType, setSupplierType] = useState<SupplierOnboardType | null>(null);
  const [wizardIndex, setWizardIndex] = useState(0);

  const [farmer, setFarmer] = useState<FarmerFormState>(() => initialFarmerState());
  const [collector, setCollector] = useState<CollectorFormState>(() => initialCollectorState());

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'captured' | 'unavailable'>('idle');
  const [gpsLat, setGpsLat] = useState<number | undefined>();
  const [gpsLng, setGpsLng] = useState<number | undefined>();
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  const [nidPreview, setNidPreview] = useState<string | null>(null);
  const [nidFileName, setNidFileName] = useState<string | null>(null);

  const [online, setOnline] = useState(true);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [regPricePerLiter, setRegPricePerLiter] = useState('390');
  const [regNid, setRegNid] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regBankName, setRegBankName] = useState('');
  const [regBankAccount, setRegBankAccount] = useState('');
  const [reviewFieldErrors, setReviewFieldErrors] = useState<Record<string, string>>({});
  /** Shown below progress when validation blocks “Next”. */
  const [stepBlockMessages, setStepBlockMessages] = useState<string[]>([]);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const regPrefillRef = useRef(false);
  const [selfHydrating, setSelfHydrating] = useState(false);
  const [selfLoadError, setSelfLoadError] = useState<string | null>(null);

  /** When browser GPS succeeds, mirror coordinates into the manual fields (editable, persisted in draft). */
  const applyCapturedGps = useCallback((lat: number, lng: number) => {
    setGpsLat(lat);
    setGpsLng(lng);
    setManualLat(Number(lat).toFixed(5));
    setManualLng(Number(lng).toFixed(5));
    setStepBlockMessages([]);
  }, []);

  const totalSteps = supplierType === 'farmer' ? FARMER_STEP_COUNT : COLLECTOR_STEP_COUNT;
  const isReviewStep =
    supplierType != null && wizardIndex === totalSteps - 1;
  const isSetupStep = wizardIndex === 0;

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    if (!open || selfService) return;
    tryCaptureGps(applyCapturedGps, setGpsStatus);
  }, [open, selfService, applyCapturedGps]);

  useLayoutEffect(() => {
    if (open && selfService) {
      setSelfHydrating(true);
      setSelfLoadError(null);
    } else if (!open) {
      setSelfHydrating(false);
      setSelfLoadError(null);
    }
  }, [open, selfService]);

  useEffect(() => {
    if (!open || !selfService) return;
    let cancelled = false;
    (async () => {
      try {
        const first = await supplierOnboardingApi.getMy();
        let onboarding = first.data?.onboarding as Record<string, unknown> | null | undefined;
        if (onboarding == null && !cancelled) {
          const init = await supplierOnboardingApi.initMyOnboarding();
          onboarding = init.data?.onboarding as Record<string, unknown> | null | undefined;
        }
        if (cancelled || onboarding == null) {
          if (!cancelled) setSelfLoadError('Could not load or start milk onboarding.');
          return;
        }
        const stRaw = onboarding.supplier_type;
        const t: SupplierOnboardType = stRaw === 'collector' ? 'collector' : 'farmer';
        setSupplierType(t);
        const draft = onboarding.draft;
        if (t === 'farmer') {
          setFarmer(mergeFarmerDraft(draft));
        } else {
          const ckRaw = onboarding.collector_kind;
          const ck =
            typeof ckRaw === 'string' && (ckRaw === 'farmer_collector' || ckRaw === 'pure_collector')
              ? (ckRaw as MilkCollectorKind)
              : '';
          const merged = mergeCollectorDraft(draft);
          setCollector({ ...merged, collectorKind: ck || merged.collectorKind });
        }
        const gps = onboarding.gps as { lat?: number; lng?: number } | null | undefined;
        if (gps != null && typeof gps.lat === 'number' && typeof gps.lng === 'number') {
          applyCapturedGps(gps.lat, gps.lng);
        } else {
          setGpsLat(undefined);
          setGpsLng(undefined);
          setManualLat('');
          setManualLng('');
        }
        const nid = onboarding.nid_photo_meta;
        if (typeof nid === 'string' && nid.trim()) {
          setNidFileName(nid.trim());
          setNidPreview(null);
        } else if (nid && typeof nid === 'object') {
          const o = nid as { file_name?: string; thumb_data_url?: string };
          setNidFileName(o.file_name?.trim() ? o.file_name : null);
          setNidPreview(typeof o.thumb_data_url === 'string' ? o.thumb_data_url : null);
        } else {
          setNidFileName(null);
          setNidPreview(null);
        }
        setStep('form');
        setWizardIndex(0);
        setStepBlockMessages([]);
      } catch (e) {
        const ax = e as AxiosError;
        const msg =
          (ax.response?.data as { message?: string } | undefined)?.message ||
          'Could not load milk onboarding. Try again or contact support.';
        if (!cancelled) setSelfLoadError(msg);
      } finally {
        if (!cancelled) setSelfHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, selfService, applyCapturedGps]);

  useEffect(() => {
    if (!open || selfService || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          supplierType?: SupplierOnboardType;
          farmer?: FarmerFormState;
          collector?: CollectorFormState;
          manualLat?: string;
          manualLng?: string;
          wizardIndex?: number;
          regPricePerLiter?: string;
          regNid?: string;
          regAddress?: string;
          regBankName?: string;
          regBankAccount?: string;
        };
        if (parsed.supplierType) setSupplierType(parsed.supplierType);
        if (parsed.farmer) setFarmer(parsed.farmer);
        if (parsed.collector) {
          setCollector({
            ...initialCollectorState(),
            ...parsed.collector,
            collectorKind: (parsed.collector as CollectorFormState).collectorKind ?? '',
          });
        }
        if (parsed.manualLat) setManualLat(parsed.manualLat);
        if (parsed.manualLng) setManualLng(parsed.manualLng);
        if (typeof parsed.wizardIndex === 'number') setWizardIndex(parsed.wizardIndex);
        if (typeof parsed.regPricePerLiter === 'string') setRegPricePerLiter(parsed.regPricePerLiter);
        if (typeof parsed.regNid === 'string') setRegNid(parsed.regNid);
        if (typeof parsed.regAddress === 'string') setRegAddress(parsed.regAddress);
        if (typeof parsed.regBankName === 'string') setRegBankName(parsed.regBankName);
        if (typeof parsed.regBankAccount === 'string') setRegBankAccount(parsed.regBankAccount);
      }
    } catch {
      /* ignore */
    }
  }, [open, selfService]);

  useEffect(() => {
    if (!open || selfService || typeof window === 'undefined') return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            supplierType,
            farmer,
            collector,
            manualLat,
            manualLng,
            wizardIndex,
            regPricePerLiter,
            regNid,
            regAddress,
            regBankName,
            regBankAccount,
          })
        );
      } catch {
        /* quota */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [
    open,
    supplierType,
    farmer,
    collector,
    manualLat,
    manualLng,
    wizardIndex,
    regPricePerLiter,
    regNid,
    regAddress,
    regBankName,
    regBankAccount,
    selfService,
  ]);

  const districtHint =
    supplierType === 'farmer'
      ? farmer.identity.district
      : supplierType === 'collector'
        ? collector.c1.district
        : '';

  const fieldProgress = useMemo(() => {
    if (!supplierType) return 0;
    return supplierType === 'farmer'
      ? computeFarmerProgress(farmer)
      : computeCollectorProgress(collector);
  }, [supplierType, farmer, collector]);

  const stepProgressPercent = useMemo(() => {
    if (!supplierType) return 0;
    return ((wizardIndex + 1) / totalSteps) * 100;
  }, [supplierType, wizardIndex, totalSteps]);

  const gpsDisplay = useMemo(() => {
    if (gpsLat != null && gpsLng != null) {
      return `${gpsLat.toFixed(5)}, ${gpsLng.toFixed(5)}`;
    }
    if (manualLat.trim() && manualLng.trim()) {
      return `Manual: ${manualLat.trim()}, ${manualLng.trim()}`;
    }
    return '—';
  }, [gpsLat, gpsLng, manualLat, manualLng]);

  const getOnboardingPayload = useCallback(() => {
    if (!supplierType) return null;
    return buildOnboardingPayload(
      supplierType,
      farmer,
      collector,
      { lat: gpsLat, lng: gpsLng, manualLat, manualLng },
      nidFileName
    );
  }, [supplierType, farmer, collector, gpsLat, gpsLng, manualLat, manualLng, nidFileName]);

  useEffect(() => {
    if (!isReviewStep || selfService) {
      regPrefillRef.current = false;
      return;
    }
    if (regPrefillRef.current) return;
    regPrefillRef.current = true;
    if (supplierType === 'farmer') {
      setRegName(
        `${farmer.identity.firstName} ${farmer.identity.surname}`.trim() || farmer.identity.surname
      );
      setRegPhone(normalizeRwandaPhoneDigits(farmer.identity.primaryPhone));
      setRegNid(farmer.identity.nid.replace(/\D/g, '').slice(0, 16));
      setRegAddress(
        formatLocationLine([
          farmer.identity.village,
          farmer.identity.cell,
          farmer.identity.sector,
          farmer.identity.district,
          farmer.identity.province,
        ])
      );
    } else if (supplierType === 'collector') {
      setRegName(`${collector.c1.firstName} ${collector.c1.surname}`.trim());
      setRegPhone(normalizeRwandaPhoneDigits(collector.c1.primaryPhone));
      setRegNid(collector.c1.nid.replace(/\D/g, '').slice(0, 16));
      setRegAddress(
        formatLocationLine([
          collector.c1.village,
          collector.c1.cell,
          collector.c1.sector,
          collector.c1.district,
          collector.c1.province,
        ])
      );
    }
    setRegPassword('');
    setRegPassword2('');
    setReviewFieldErrors({});
  }, [isReviewStep, selfService, supplierType, farmer, collector]);

  const resetAll = useCallback(() => {
    setStep('pick');
    setSupplierType(null);
    setWizardIndex(0);
    setFarmer(initialFarmerState());
    setCollector(initialCollectorState());
    setGpsStatus('idle');
    setGpsLat(undefined);
    setGpsLng(undefined);
    setManualLat('');
    setManualLng('');
    setNidPreview(null);
    setNidFileName(null);
    setRegName('');
    setRegPhone('');
    setRegEmail('');
    setRegPassword('');
    setRegPassword2('');
    setRegPricePerLiter('390');
    setRegNid('');
    setRegAddress('');
    setRegBankName('');
    setRegBankAccount('');
    setReviewFieldErrors({});
    setStepBlockMessages([]);
    regPrefillRef.current = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const selectType = (t: SupplierOnboardType) => {
    if (supplierType && supplierType !== t) {
      const dirty =
        supplierType === 'farmer' ? isFarmerDirty(farmer) : isCollectorDirty(collector);
      if (dirty) {
        const ok = window.confirm(
          'Switching supplier type will clear the current form. Continue?'
        );
        if (!ok) return;
        setFarmer(initialFarmerState());
        setCollector(initialCollectorState());
        setWizardIndex(0);
      }
    }
    setSupplierType(t);
    if (t === 'farmer') {
      setCollector(initialCollectorState());
    }
  };

  const startWizard = () => {
    if (!supplierType) return;
    setStepBlockMessages([]);
    setWizardIndex(0);
    setStep('form');
  };

  const handleNidFile = (file: File | null) => {
    if (!file) {
      setNidPreview(null);
      setNidFileName(null);
      return;
    }
    setNidFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setNidPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const handleSaveDraft = () => {
    const payload = getOnboardingPayload();
    if (!payload) return;
    try {
      const prev = localStorage.getItem(PENDING_KEY);
      const list = prev ? (JSON.parse(prev) as unknown[]) : [];
      list.push({ savedAt: new Date().toISOString(), ...payload });
      localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    } catch {
      toast.error('Could not save pending record locally.');
      return;
    }
    toast.success('Onboarding draft saved on this device. Use “Create account” to grant login access when ready.');
    resetAll();
    onClose();
  };

  const handleCreateAccount = async () => {
    if (!supplierType) return;
    if (supplierType === 'collector' && !collector.collectorKind) {
      toast.error('Select farmer–collector or pure collector before creating an account.');
      return;
    }
    const onboardingPayload = getOnboardingPayload();
    if (!onboardingPayload) return;

    const { errors, parsed } = validateOnboardingReview({
      name: regName,
      phoneRaw: regPhone,
      emailRaw: regEmail,
      password: regPassword,
      password2: regPassword2,
      pricePerLiterRaw: regPricePerLiter,
      nidDigits: regNid,
      addressRaw: regAddress,
      bankNameRaw: regBankName,
      bankAccountRaw: regBankAccount,
    });

    setReviewFieldErrors(errors);
    if (!parsed) {
      const first =
        errors.regName ||
        errors.regPhone ||
        errors.regEmail ||
        errors.regPricePerLiter ||
        errors.regNid ||
        errors.regAddress ||
        errors.regBankName ||
        errors.regBankAccount ||
        errors.regPassword ||
        errors.regPassword2;
      toast.error(first || 'Fix the highlighted fields before submitting.');
      return;
    }

    const mccId = currentAccount?.account_id;
    if (!mccId) {
      toast.error('No MCC account in session. Log in as an MCC user and try again.');
      return;
    }

    const accountType = supplierType === 'farmer' ? 'farmer' : 'supplier';
    let supplierSegment: SupplierSegment | undefined;
    if (supplierType === 'collector' && collector.collectorKind) {
      supplierSegment = collector.collectorKind as SupplierSegment;
    }

    setCreatingAccount(true);
    try {
      const res = await supplierOnboardingApi.register({
        mcc_account_id: mccId,
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        password: parsed.password,
        account_type: accountType,
        supplier_segment: accountType === 'supplier' ? supplierSegment : undefined,
        onboarding: onboardingPayload as unknown as Record<string, unknown>,
        price_per_liter: parsed.price_per_liter,
        nid: parsed.nid,
        address: parsed.address,
        bank_name: parsed.bank_name,
        bank_account_number: parsed.bank_account_number,
      });
      if (res.code === 200 || res.code === 201) {
        try {
          const prev = localStorage.getItem(PENDING_KEY);
          const list = prev ? (JSON.parse(prev) as unknown[]) : [];
          list.push({ savedAt: new Date().toISOString(), source: 'registered', ...onboardingPayload });
          localStorage.setItem(PENDING_KEY, JSON.stringify(list));
        } catch {
          /* optional */
        }
        toast.success(
          res.data?.message ||
            'Account created. They can sign in at gemura on /auth/login with this phone and password.'
        );
        onRegistered?.();
        resetAll();
        onClose();
        return;
      }
      toast.error(res.message || 'Registration was not successful.');
    } catch (err) {
      const ax = err as AxiosError;
      const status = ax.response?.status;
      const apiMsg = (ax.response?.data as { message?: string } | undefined)?.message;
      if (status === 404 || status === 405 || status === 501) {
        try {
          const fullName = (parsed.name || '').trim();
          const si = fullName.indexOf(' ');
          const first_name = (si === -1 ? fullName || 'User' : fullName.slice(0, si)).trim();
          const last_name = (si === -1 ? '-' : fullName.slice(si + 1)).trim() || '-';
          const adminRes = await adminApi.createUser(
            {
              first_name,
              last_name,
              phone: parsed.phone,
              email: parsed.email,
              password: parsed.password,
              account_type: accountType,
              role: 'owner',
              ...(accountType === 'supplier' && supplierSegment
                ? { supplier_segment: supplierSegment }
                : {}),
              onboarding_payload: onboardingPayload as unknown as Record<string, unknown>,
            },
            mccId
          );
          if (adminRes?.code === 200 || adminRes?.code === 201) {
            toast.success('User created via admin. They can sign in with phone and password.');
            onRegistered?.();
            resetAll();
            onClose();
            return;
          }
          toast.error(adminRes?.message || 'Admin user creation failed.');
        } catch (e) {
          const m = (e as AxiosError)?.response?.data as { message?: string } | undefined;
          toast.error(
            m?.message ||
              'Could not create the user. Check permissions (manage users) or add POST /suppliers/onboarding/register on the server.'
          );
        }
        return;
      }
      if (status && status < 500) {
        toast.error(apiMsg || 'Could not create account.');
        return;
      }
      if (status && status >= 500) {
        toast.error(apiMsg || 'Server error while creating the account.');
        return;
      }
      toast.error('Network error. Check your connection and try again.');
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleSaveSelfOnboarding = async () => {
    if (!supplierType) return;
    if (supplierType === 'collector' && !collector.collectorKind) {
      toast.error('Collector pathway is not set. Contact support if this persists.');
      return;
    }
    const setupErrs = validateOnboardingSetupStep({
      gpsLat,
      gpsLng,
      manualLat,
      manualLng,
    });
    const errs = [...setupErrs];
    if (supplierType === 'farmer') {
      for (let i = 1; i <= 9; i++) {
        errs.push(...validateFarmerWizardStep(farmerWizardKey(i), farmer));
      }
    } else {
      for (let i = 1; i <= 8; i++) {
        errs.push(...validateCollectorWizardStep(collectorWizardKey(i), collector));
      }
    }
    if (errs.length > 0) {
      setStepBlockMessages(errs);
      toast.error(errs[0] ?? 'Fix the checklist above before saving.');
      return;
    }
    const onboardingPayload = getOnboardingPayload();
    if (!onboardingPayload) return;
    setCreatingAccount(true);
    try {
      const res = await supplierOnboardingApi.putMy({
        onboarding: onboardingPayload as unknown as Record<string, unknown>,
      });
      if (res.code === 200) {
        toast.success(res.message || 'Milk onboarding saved.');
        onRegistered?.();
        resetAll();
        onClose();
        return;
      }
      toast.error(res.message || 'Save was not successful.');
    } catch (err) {
      const ax = err as AxiosError;
      const apiMsg = (ax.response?.data as { message?: string } | undefined)?.message;
      toast.error(apiMsg || 'Could not save onboarding.');
    } finally {
      setCreatingAccount(false);
    }
  };

  const goBack = () => {
    setStepBlockMessages([]);
    if (wizardIndex <= 0) {
      if (selfService) {
        onClose();
        return;
      }
      setStep('pick');
      return;
    }
    setWizardIndex((w) => w - 1);
  };

  const goNext = () => {
    if (wizardIndex >= totalSteps - 1) return;
    let errs: string[] = [];
    if (!supplierType) return;
    if (wizardIndex === 0) {
      errs = validateOnboardingSetupStep({
        gpsLat,
        gpsLng,
        manualLat,
        manualLng,
      });
    } else if (supplierType === 'farmer') {
      errs = validateFarmerWizardStep(farmerWizardKey(wizardIndex), farmer);
    } else {
      errs = validateCollectorWizardStep(collectorWizardKey(wizardIndex), collector);
    }

    if (errs.length > 0) {
      setStepBlockMessages(errs);
      toast.error(errs[0] ?? 'Check the checklist above.');
      return;
    }

    setStepBlockMessages([]);
    setWizardIndex((w) => w + 1);
  };

  const gpsLabel =
    gpsStatus === 'acquiring'
      ? 'Acquiring GPS…'
      : gpsStatus === 'captured'
        ? 'GPS captured'
        : gpsStatus === 'unavailable'
          ? 'GPS unavailable — use manual coordinates'
          : 'GPS idle';

  if (!selfService) {
    return (
      <SupplierKycOnboardingFlow open={open} onClose={onClose} onRegistered={onRegistered} />
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Complete milk onboarding"
      maxWidth="max-w-6xl"
      footer={
        step === 'form' && supplierType ? (
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-sm border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <Icon icon={faArrowLeft} size="sm" />
              {wizardIndex === 0 ? (selfService ? 'Close' : 'Change type') : 'Back'}
            </button>
            {!isReviewStep ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-sm font-medium text-white border border-[#004AAD] bg-[#004AAD] hover:bg-[#052A54]"
              >
                Next
                <Icon icon={faArrowRight} size="sm" />
              </button>
            ) : selfService ? (
              <button
                type="button"
                onClick={handleSaveSelfOnboarding}
                disabled={creatingAccount}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-sm font-medium text-white border border-[#004AAD] bg-[#004AAD] hover:bg-[#052A54] disabled:opacity-50"
              >
                {creatingAccount ? 'Saving…' : 'Save to profile'}
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={creatingAccount}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-sm font-medium border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Icon icon={faFloppyDisk} size="sm" />
                  Save draft only
                </button>
                <button
                  type="button"
                  onClick={handleCreateAccount}
                  disabled={creatingAccount}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-sm font-medium text-white border border-[#004AAD] bg-[#004AAD] hover:bg-[#052A54] disabled:opacity-50"
                >
                  {creatingAccount ? 'Creating…' : 'Create account & finish'}
                </button>
              </div>
            )}
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between text-sm">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border ${
              online
                ? 'bg-[#004AAD]/10 border-[#004AAD]/25 text-[#031A3A]'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
            role="status"
          >
            {online ? 'Online' : 'Offline — draft stored on device'}
          </div>
          <div className="text-slate-600">
            {selfService ? (
              <>
                Auto-save: <span className="font-medium text-slate-900">server</span> (on Save at the last step)
              </>
            ) : (
              <>
                Auto-save: <span className="font-medium text-slate-900">enabled</span> (local)
              </>
            )}
          </div>
        </div>

        {selfService && selfHydrating && (
          <div className="py-16 text-center text-slate-600 text-sm">Loading your milk onboarding…</div>
        )}
        {selfService && !selfHydrating && selfLoadError && (
          <div className="rounded-sm border border-red-200 bg-red-50 text-red-900 text-sm px-4 py-3" role="alert">
            {selfLoadError}
          </div>
        )}

        {!selfService && step === 'pick' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Select supplier type, then continue through the guided steps (Back / Next).
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => selectType('farmer')}
                className={`min-h-[120px] text-left p-5 rounded-sm border-2 transition-all ${
                  supplierType === 'farmer'
                    ? 'border-[#004AAD] bg-[#004AAD]/10'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                } ${supplierType === 'collector' ? 'opacity-60' : ''}`}
              >
                <Icon icon={faWarehouse} className="text-2xl text-slate-800 mb-2" />
                <div className="font-semibold text-[16px] text-slate-900">Direct farmer</div>
                <p className="text-[13px] text-slate-600 mt-1">
                  Brings own milk directly to the MCC. Full farm and herd profile required.
                </p>
              </button>
              <button
                type="button"
                onClick={() => selectType('collector')}
                className={`min-h-[120px] text-left p-5 rounded-sm border-2 transition-all ${
                  supplierType === 'collector'
                    ? 'border-[#004AAD] bg-[#004AAD]/10'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                } ${supplierType === 'farmer' ? 'opacity-60' : ''}`}
              >
                <Icon icon={faTruck} className="text-2xl text-slate-800 mb-2" />
                <div className="font-semibold text-[16px] text-slate-900">Milk collector</div>
                <p className="text-[13px] text-slate-600 mt-1">
                  Collects from farms for delivery to the MCC. Then choose farmer–collector vs pure collector.
                </p>
              </button>
            </div>
            {supplierType === 'collector' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-800">Collector profile (required)</p>
                <p className="text-[13px] text-slate-600">
                  Aligns with MCC collection rules: two revenue types for farmer–collectors, manifest-led compliance for
                  pure collectors.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(['farmer_collector', 'pure_collector'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCollector((p) => ({ ...p, collectorKind: k }))}
                      className={`min-h-[100px] text-left p-4 rounded-sm border-2 transition-all ${
                        collector.collectorKind === k
                          ? 'border-[#004AAD] bg-[#004AAD]/10'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-[15px] text-slate-900">{MILK_COLLECTOR_KIND[k].label}</div>
                      <p className="text-[12px] text-slate-600 mt-1 leading-snug">{MILK_COLLECTOR_KIND[k].description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-sm font-medium text-white border border-[#004AAD] bg-[#004AAD] hover:bg-[#052A54] disabled:opacity-50"
              disabled={!supplierType || (supplierType === 'collector' && !collector.collectorKind)}
              onClick={startWizard}
            >
              <Icon icon={faUserPlus} size="sm" />
              Continue to wizard
            </button>
          </div>
        )}

        {step === 'form' && supplierType && (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">
                {supplierType === 'farmer'
                  ? stepTitleFarmer(wizardIndex)
                  : stepTitleCollector(wizardIndex)}
              </p>
              <ProgressBar
                value={stepProgressPercent}
                stepCurrent={wizardIndex + 1}
                stepTotal={totalSteps}
                fieldPercent={fieldProgress}
              />
            </div>

            {stepBlockMessages.length > 0 && (
              <WizardStepAlert messages={stepBlockMessages} />
            )}

            {isSetupStep && (
              <WizardStepPanel
                id="setup"
                title="Setup — GPS & National ID"
                subtitle="Capture location and ID photo before the questionnaire"
              >
                <div className="rounded-lg border border-gray-200 bg-gray-50/90 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-900">GPS</p>
                  <p className="text-xs text-gray-600" aria-live="polite">
                    Status: {gpsLabel}
                    {gpsLat != null && gpsLng != null && (
                      <span className="ml-2 font-mono text-gray-800">
                        {gpsLat.toFixed(5)}, {gpsLng.toFixed(5)}
                      </span>
                    )}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <FieldLabel htmlFor="mlat">Manual latitude</FieldLabel>
                      <input
                        id="mlat"
                        className={wizardTextInputClass}
                        inputMode="decimal"
                        value={manualLat}
                        onChange={(e) => {
                          setManualLat(e.target.value);
                          setStepBlockMessages([]);
                        }}
                        placeholder={P.lat}
                      />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel htmlFor="mlng">Manual longitude</FieldLabel>
                      <input
                        id="mlng"
                        className={wizardTextInputClass}
                        inputMode="decimal"
                        value={manualLng}
                        onChange={(e) => {
                          setManualLng(e.target.value);
                          setStepBlockMessages([]);
                        }}
                        placeholder={P.lng}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-sm border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
                    onClick={() => tryCaptureGps(applyCapturedGps, setGpsStatus)}
                  >
                    Retry GPS capture
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">National ID photo</p>
                  <p className="text-xs text-gray-600 mb-2">
                    {selfService
                      ? 'Opens camera on supported devices; filename is saved with your milk onboarding when you finish.'
                      : 'Opens camera on supported devices; stored locally until sync.'}
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="block w-full text-sm min-h-[44px]"
                    onChange={(e) => handleNidFile(e.target.files?.[0] ?? null)}
                  />
                  {nidPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={nidPreview}
                      alt="NID preview"
                      className="max-h-44 rounded-sm border border-gray-200 mt-3"
                    />
                  )}
                </div>
              </WizardStepPanel>
            )}

            {supplierType === 'farmer' && !isSetupStep && !isReviewStep && (
              <FarmerOnboardingPath
                f={farmer}
                setF={setFarmer}
                onlyStep={farmerWizardKey(wizardIndex)}
                districtForRefugeeHint={districtHint}
              />
            )}

            {supplierType === 'collector' && !isSetupStep && !isReviewStep && (
              <CollectorOnboardingPath
                c={collector}
                setC={setCollector}
                onlyStep={collectorWizardKey(wizardIndex)}
                districtForRefugeeHint={districtHint}
              />
            )}

            {isReviewStep && supplierType && (
              <>
                <WizardStepPanel
                  id="review-registration"
                  title={selfService ? 'Save milk onboarding' : 'Finalize Gemura registration'}
                  subtitle={
                    selfService
                      ? 'Confirm the summary below, then save. You can reopen this wizard from Settings later.'
                      : supplierType === 'collector' && collector.collectorKind
                        ? `${MILK_COLLECTOR_KIND[collector.collectorKind].label} — sign-in, price, and payout for this MCC.`
                        : supplierType === 'collector'
                          ? 'Complete login and commercial fields. Collector type is set on the first screen.'
                          : 'Sign-in credentials plus MCC milk price and payout details.'
                  }
                >
                  {selfService ? (
                    <p className="text-sm text-gray-600 leading-relaxed m-0">
                      Check the summary below. When you save, your answers are stored on your Gemura milk onboarding
                      record. MCC staff normally register new suppliers; here you are only updating your own profile data.
                    </p>
                  ) : (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5 space-y-4 shadow-sm">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-800 border-b border-gray-200 pb-2">
                          Gemura login
                        </h4>
                        <p className="text-sm text-gray-600 mt-2 leading-snug">
                          Phone and password are used on the public login page. Email is optional.
                        </p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">
                        <div className="sm:col-span-2 space-y-1">
                          <FieldLabel htmlFor="oreg-name">Full name</FieldLabel>
                          <input
                            id="oreg-name"
                            className={wizardInputWithError(!!reviewFieldErrors.regName)}
                            value={regName}
                            onChange={(e) => {
                              setRegName(e.target.value);
                              setReviewFieldErrors((p) => {
                                const n = { ...p };
                                delete n.regName;
                                return n;
                              });
                            }}
                            autoComplete="name"
                          />
                          {reviewFieldErrors.regName && (
                            <p className="text-xs text-red-600 font-medium">{reviewFieldErrors.regName}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel htmlFor="oreg-phone">Phone (login)</FieldLabel>
                          <input
                            id="oreg-phone"
                            className={wizardInputWithError(!!reviewFieldErrors.regPhone)}
                            value={regPhone}
                            onChange={(e) => {
                              setRegPhone(e.target.value);
                              setReviewFieldErrors((p) => {
                                const n = { ...p };
                                delete n.regPhone;
                                return n;
                              });
                            }}
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="250788123456"
                          />
                          {reviewFieldErrors.regPhone && (
                            <p className="text-xs text-red-600 font-medium">{reviewFieldErrors.regPhone}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel htmlFor="oreg-email" optional>
                            Email
                          </FieldLabel>
                          <input
                            id="oreg-email"
                            className={wizardInputWithError(!!reviewFieldErrors.regEmail)}
                            type="email"
                            value={regEmail}
                            onChange={(e) => {
                              setRegEmail(e.target.value);
                              setReviewFieldErrors((p) => {
                                const n = { ...p };
                                delete n.regEmail;
                                return n;
                              });
                            }}
                            autoComplete="email"
                          />
                          {reviewFieldErrors.regEmail && (
                            <p className="text-xs text-red-600 font-medium">{reviewFieldErrors.regEmail}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel htmlFor="oreg-pw">Password (min 6)</FieldLabel>
                          <input
                            id="oreg-pw"
                            className={wizardInputWithError(!!reviewFieldErrors.regPassword)}
                            type="password"
                            value={regPassword}
                            onChange={(e) => {
                              setRegPassword(e.target.value);
                              setReviewFieldErrors((p) => {
                                const n = { ...p };
                                delete n.regPassword;
                                return n;
                              });
                            }}
                            autoComplete="new-password"
                          />
                          {reviewFieldErrors.regPassword && (
                            <p className="text-xs text-red-600 font-medium">{reviewFieldErrors.regPassword}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel htmlFor="oreg-pw2">Confirm password</FieldLabel>
                          <input
                            id="oreg-pw2"
                            className={wizardInputWithError(!!reviewFieldErrors.regPassword2)}
                            type="password"
                            value={regPassword2}
                            onChange={(e) => {
                              setRegPassword2(e.target.value);
                              setReviewFieldErrors((p) => {
                                const n = { ...p };
                                delete n.regPassword2;
                                return n;
                              });
                            }}
                            autoComplete="new-password"
                          />
                          {reviewFieldErrors.regPassword2 && (
                            <p className="text-xs text-red-600 font-medium">{reviewFieldErrors.regPassword2}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-sm border border-[#004AAD]/30 bg-[#004AAD]/10 p-4 sm:p-5 space-y-4 shadow-sm shadow-[#052A54]/05">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#031A3A] border-b border-[#004AAD]/20 pb-2">
                          MCC — commercial &amp; payout
                        </h4>
                        <p className="text-sm text-gray-600 mt-2 leading-snug">
                          Same rules as standalone supplier registration. Numbers only where indicated; prefilled fields can
                          be corrected.
                        </p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">
                        <div className="space-y-1">
                          <FieldLabel htmlFor="oreg-price">Price per liter (RWF)</FieldLabel>
                          <input
                            id="oreg-price"
                            className={wizardInputWithError(!!reviewFieldErrors.regPricePerLiter)}
                            inputMode="decimal"
                            value={regPricePerLiter}
                            onChange={(e) => {
                              let v = e.target.value.replace(',', '.');
                              v = v.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*)\..*$/, '$1');
                              const firstDot = v.indexOf('.');
                              if (firstDot !== -1) {
                                v =
                                  v.slice(0, firstDot + 1) +
                                  v.slice(firstDot + 1).replace(/\./g, '');
                              }
                              setRegPricePerLiter(v);
                              setReviewFieldErrors((p) => {
                                const n = { ...p };
                                delete n.regPricePerLiter;
                                return n;
                              });
                            }}
                            placeholder="390"
                          />
                          {reviewFieldErrors.regPricePerLiter && (
                            <p className="text-xs text-red-600 font-medium">{reviewFieldErrors.regPricePerLiter}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel htmlFor="oreg-nid">National ID</FieldLabel>
                          <input
                            id="oreg-nid"
                            className={wizardInputWithError(!!reviewFieldErrors.regNid)}
                            inputMode="numeric"
                            maxLength={16}
                            value={regNid}
                            onChange={(e) => {
                              const d = e.target.value.replace(/\D/g, '').slice(0, 16);
                              setRegNid(d);
                              setReviewFieldErrors((p) => {
                                const n = { ...p };
                                delete n.regNid;
                                return n;
                              });
                            }}
                            placeholder="16 digits · starts with 1"
                            autoComplete="off"
                          />
                          {reviewFieldErrors.regNid && (
                            <p className="text-xs text-red-600 font-medium">{reviewFieldErrors.regNid}</p>
                          )}
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <FieldLabel htmlFor="oreg-addr" optional>
                            Address
                          </FieldLabel>
                          <input
                            id="oreg-addr"
                            className={wizardInputWithError(!!reviewFieldErrors.regAddress)}
                            value={regAddress}
                            onChange={(e) => {
                              setRegAddress(e.target.value);
                              setReviewFieldErrors((p) => {
                                const n = { ...p };
                                delete n.regAddress;
                                return n;
                              });
                            }}
                            maxLength={500}
                            autoComplete="street-address"
                          />
                          {reviewFieldErrors.regAddress && (
                            <p className="text-xs text-red-600 font-medium">{reviewFieldErrors.regAddress}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel htmlFor="oreg-bank" optional>
                            Bank name
                          </FieldLabel>
                          <input
                            id="oreg-bank"
                            className={wizardInputWithError(!!reviewFieldErrors.regBankName)}
                            value={regBankName}
                            onChange={(e) => {
                              setRegBankName(e.target.value);
                              setReviewFieldErrors((p) => {
                                const n = { ...p };
                                delete n.regBankName;
                                return n;
                              });
                            }}
                            maxLength={120}
                            autoComplete="organization"
                          />
                          {reviewFieldErrors.regBankName && (
                            <p className="text-xs text-red-600 font-medium">{reviewFieldErrors.regBankName}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel htmlFor="oreg-bankacct" optional>
                            Bank account number
                          </FieldLabel>
                          <input
                            id="oreg-bankacct"
                            className={wizardInputWithError(!!reviewFieldErrors.regBankAccount)}
                            value={regBankAccount}
                            onChange={(e) => {
                              setRegBankAccount(e.target.value);
                              setReviewFieldErrors((p) => {
                                const n = { ...p };
                                delete n.regBankAccount;
                                return n;
                              });
                            }}
                            maxLength={64}
                            autoComplete="off"
                          />
                          {reviewFieldErrors.regBankAccount && (
                            <p className="text-xs text-red-600 font-medium">{reviewFieldErrors.regBankAccount}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </WizardStepPanel>

                {supplierType === 'farmer' ? (
                  <FarmerOnboardingPreview f={farmer} gpsText={gpsDisplay} hasNidPhoto={!!nidFileName} />
                ) : (
                  <CollectorOnboardingPreview c={collector} gpsText={gpsDisplay} hasNidPhoto={!!nidFileName} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
