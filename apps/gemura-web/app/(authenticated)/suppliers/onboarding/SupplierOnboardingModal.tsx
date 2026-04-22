'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '@/app/components/Modal';
import Icon, { faTruck, faWarehouse, faUserPlus, faArrowLeft, faArrowRight, faFloppyDisk } from '@/app/components/Icon';
import { useToastStore } from '@/store/toast';
import {
  initialCollectorState,
  initialFarmerState,
  isCollectorDirty,
  isFarmerDirty,
  type FarmerFormState,
  type CollectorFormState,
} from './model';
import { ProgressBar, WizardStepPanel } from './formPrimitives';
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
import { deriveFarmerVibeCodes } from './vibeReporting';

const STORAGE_KEY = 'gemura-supplier-onboarding-draft';
const PENDING_KEY = 'gemura-supplier-onboarding-pending';

/** Setup + 8 sections + agent + review */
const FARMER_STEP_COUNT = 11;
/** Setup + 6 sections + agent + review */
const COLLECTOR_STEP_COUNT = 9;

export type SupplierOnboardType = 'farmer' | 'collector';

interface Props {
  open: boolean;
  onClose: () => void;
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

function buildPayload(
  type: SupplierOnboardType,
  farmer: FarmerFormState,
  collector: CollectorFormState,
  gps: { lat?: number; lng?: number; manualLat: string; manualLng: string },
  nidPhotoName: string | null
) {
  const gpsOut =
    gps.lat != null && gps.lng != null
      ? { lat: gps.lat, lng: gps.lng }
      : gps.manualLat && gps.manualLng
        ? { lat: Number(gps.manualLat), lng: Number(gps.manualLng) }
        : null;

  if (type === 'farmer') {
    return {
      supplier_type: 'farmer' as const,
      gps: gpsOut,
      nid_photo_meta: nidPhotoName,
      draft: farmer,
      agent: farmer.agentFarmer,
      /** C77, C78, C79 for VIBE / sync (GEMURA guide v3) */
      vibe_reporting: deriveFarmerVibeCodes(farmer),
      assessment: computeFarmerAutoSummary(farmer, { districtForRefugee: farmer.identity.district }),
    };
  }
  return {
    supplier_type: 'collector' as const,
    gps: gpsOut,
    nid_photo_meta: nidPhotoName,
    draft: collector,
    agent: collector.agentCollector,
    assessment: computeCollectorAutoSummary(collector, { districtForRefugee: collector.c1.district }),
  };
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

export default function SupplierOnboardingModal({ open, onClose }: Props) {
  const toast = useToastStore();
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
    if (!open) return;
    tryCaptureGps(
      (lat, lng) => {
        setGpsLat(lat);
        setGpsLng(lng);
      },
      setGpsStatus
    );
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
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
        };
        if (parsed.supplierType) setSupplierType(parsed.supplierType);
        if (parsed.farmer) setFarmer(parsed.farmer);
        if (parsed.collector) setCollector(parsed.collector);
        if (parsed.manualLat) setManualLat(parsed.manualLat);
        if (parsed.manualLng) setManualLng(parsed.manualLng);
        if (typeof parsed.wizardIndex === 'number') setWizardIndex(parsed.wizardIndex);
      }
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
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
          })
        );
      } catch {
        /* quota */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [open, supplierType, farmer, collector, manualLat, manualLng, wizardIndex]);

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
  };

  const startWizard = () => {
    if (!supplierType) return;
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

  const handleSubmit = () => {
    if (!supplierType) return;
    const payload = buildPayload(
      supplierType,
      farmer,
      collector,
      {
        lat: gpsLat,
        lng: gpsLng,
        manualLat,
        manualLng,
      },
      nidFileName
    );
    try {
      const prev = localStorage.getItem(PENDING_KEY);
      const list = prev ? (JSON.parse(prev) as unknown[]) : [];
      list.push({ savedAt: new Date().toISOString(), ...payload });
      localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    } catch {
      toast.error('Could not save pending record locally.');
      return;
    }
    toast.success(
      'Onboarding draft saved locally (UI demo). Sync to server when the API is connected.'
    );
    resetAll();
    onClose();
  };

  const goBack = () => {
    if (wizardIndex <= 0) {
      setStep('pick');
      return;
    }
    setWizardIndex((w) => w - 1);
  };

  const goNext = () => {
    if (wizardIndex >= totalSteps - 1) return;
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

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Onboard new supplier"
      maxWidth="max-w-6xl"
      footer={
        step === 'form' && supplierType ? (
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <Icon icon={faArrowLeft} size="sm" />
              {wizardIndex === 0 ? 'Change type' : 'Back'}
            </button>
            {!isReviewStep ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md"
              >
                Next
                <Icon icon={faArrowRight} size="sm" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl font-medium text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md"
              >
                <Icon icon={faFloppyDisk} size="sm" />
                Save draft locally
              </button>
            )}
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between text-sm">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              online
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
            role="status"
          >
            {online ? 'Online' : 'Offline — draft stored on device'}
          </div>
          <div className="text-slate-600">
            Auto-save: <span className="font-medium text-slate-900">enabled</span> (local)
          </div>
        </div>

        {step === 'pick' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Select supplier type, then continue through the guided steps (Back / Next).
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => selectType('farmer')}
                className={`min-h-[120px] text-left p-5 rounded-2xl border-2 transition-all ${
                  supplierType === 'farmer'
                    ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/25 shadow-md'
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
                className={`min-h-[120px] text-left p-5 rounded-2xl border-2 transition-all ${
                  supplierType === 'collector'
                    ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/25 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                } ${supplierType === 'farmer' ? 'opacity-60' : ''}`}
              >
                <Icon icon={faTruck} className="text-2xl text-slate-800 mb-2" />
                <div className="font-semibold text-[16px] text-slate-900">Milk collector</div>
                <p className="text-[13px] text-slate-600 mt-1">
                  Collects from multiple farms; aggregated volume to MCC. Linked collector profile.
                </p>
              </button>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md disabled:opacity-50"
              disabled={!supplierType}
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

            {isSetupStep && (
              <WizardStepPanel
                id="setup"
                title="Setup — GPS & National ID"
                subtitle="Capture location and ID photo before the questionnaire"
              >
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2">
                  <p className="text-sm font-medium text-slate-900">GPS</p>
                  <p className="text-xs text-slate-600" aria-live="polite">
                    Status: {gpsLabel}
                    {gpsLat != null && gpsLng != null && (
                      <span className="ml-2 font-mono text-slate-800">
                        {gpsLat.toFixed(5)}, {gpsLng.toFixed(5)}
                      </span>
                    )}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="mlat" className="text-[13px] font-semibold text-slate-800 block mb-1">
                        Manual latitude
                      </label>
                      <input
                        id="mlat"
                        className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-base focus:ring-2 focus:ring-emerald-500/25"
                        inputMode="decimal"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        placeholder={P.lat}
                      />
                    </div>
                    <div>
                      <label htmlFor="mlng" className="text-[13px] font-semibold text-slate-800 block mb-1">
                        Manual longitude
                      </label>
                      <input
                        id="mlng"
                        className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-base focus:ring-2 focus:ring-emerald-500/25"
                        inputMode="decimal"
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        placeholder={P.lng}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50"
                    onClick={() =>
                      tryCaptureGps(
                        (lat, lng) => {
                          setGpsLat(lat);
                          setGpsLng(lng);
                        },
                        setGpsStatus
                      )
                    }
                  >
                    Retry GPS capture
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-1">National ID photo</p>
                  <p className="text-xs text-slate-600 mb-2">
                    Opens camera on supported devices; stored locally until sync.
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
                      className="max-h-44 rounded-xl border border-slate-200 mt-3 shadow-sm"
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

            {supplierType === 'farmer' && isReviewStep && (
              <FarmerOnboardingPreview
                f={farmer}
                gpsText={gpsDisplay}
                hasNidPhoto={!!nidFileName}
              />
            )}

            {supplierType === 'collector' && isReviewStep && (
              <CollectorOnboardingPreview
                c={collector}
                gpsText={gpsDisplay}
                hasNidPhoto={!!nidFileName}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
