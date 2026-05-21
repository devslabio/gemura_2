'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import Modal from '@/app/components/Modal';
import Icon, { faArrowLeft, faArrowRight, faFloppyDisk } from '@/app/components/Icon';
import { useToastStore } from '@/store/toast';
import { useAuthStore } from '@/store/auth';
import { supplierOnboardingApi } from '@/lib/api/supplierOnboardingApi';
import { adminApi } from '@/lib/api/admin';
import type { SupplierSegment } from '@/types';
import {
  formatLocationLine,
  normalizeRwandaPhoneDigits,
  validateOnboardingReview,
} from './onboardingCommercialValidation';
import { buildKycOnboardingPayload, deriveAccountFromKyc } from './buildKycOnboardingPayload';
import {
  initialSupplierKycDraft,
  isKycDirty,
  KYC_STEP_KEYS,
  kycFullName,
  type KycStepKey,
  type SupplierKycDraft,
} from './kycModel';
import { kycStepComplete } from './kycOnboardingProgress';
import { validateKycStep } from './kycOnboardingValidation';
import SupplierKycStepper from './SupplierKycStepper';
import SupplierKycSidebar from './SupplierKycSidebar';
import SupplierKycStepPanels from './SupplierKycStepPanels';
import SupplierKycCredentialsBlock, {
  type SupplierKycCredentials,
} from './SupplierKycCredentialsBlock';
import { ProgressBar, WizardStepAlert } from './formPrimitives';

const STORAGE_KEY = 'gemura-supplier-kyc-draft';

type Props = {
  open: boolean;
  onClose: () => void;
  onRegistered?: () => void;
};

export default function SupplierKycOnboardingFlow({ open, onClose, onRegistered }: Props) {
  const toast = useToastStore();
  const { currentAccount } = useAuthStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<SupplierKycDraft>(() => initialSupplierKycDraft());
  const [stepBlockMessages, setStepBlockMessages] = useState<string[]>([]);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [reviewFieldErrors, setReviewFieldErrors] = useState<Record<string, string>>({});
  const regPrefillRef = useRef(false);

  const [credentials, setCredentials] = useState<SupplierKycCredentials>({
    regName: '',
    regPhone: '',
    regEmail: '',
    regPassword: '',
    regPassword2: '',
    regPricePerLiter: '390',
    regNid: '',
    regAddress: '',
    regBankName: '',
    regBankAccount: '',
  });

  const currentStep = KYC_STEP_KEYS[stepIndex];
  const isReview = currentStep === 'review';
  const mccName = currentAccount?.name;

  const stepProgressPercent = ((stepIndex + 1) / KYC_STEP_KEYS.length) * 100;

  const resetAll = useCallback(() => {
    setStepIndex(0);
    setDraft(initialSupplierKycDraft());
    setStepBlockMessages([]);
    setReviewFieldErrors({});
    regPrefillRef.current = false;
    setCredentials({
      regName: '',
      regPhone: '',
      regEmail: '',
      regPassword: '',
      regPassword2: '',
      regPricePerLiter: '390',
      regNid: '',
      regAddress: '',
      regBankName: '',
      regBankAccount: '',
    });
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

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          draft?: SupplierKycDraft;
          stepIndex?: number;
          credentials?: Partial<SupplierKycCredentials>;
        };
        if (parsed.draft) setDraft({ ...initialSupplierKycDraft(), ...parsed.draft });
        if (typeof parsed.stepIndex === 'number') setStepIndex(parsed.stepIndex);
        if (parsed.credentials) setCredentials((c) => ({ ...c, ...parsed.credentials }));
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
          JSON.stringify({ draft, stepIndex, credentials })
        );
      } catch {
        /* quota */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [open, draft, stepIndex, credentials]);

  useEffect(() => {
    if (!isReview || regPrefillRef.current) return;
    regPrefillRef.current = true;
    const i = draft.identity;
    const p = draft.payment;
    setCredentials((c) => ({
      ...c,
      regName: kycFullName(draft) || c.regName,
      regPhone: (() => {
        try {
          return i.primaryPhone ? normalizeRwandaPhoneDigits(i.primaryPhone) : c.regPhone;
        } catch {
          return i.primaryPhone || c.regPhone;
        }
      })(),
      regNid: i.nid.replace(/\D/g, '').slice(0, 16) || c.regNid,
      regAddress:
        formatLocationLine([i.village, i.cell, i.sector, i.district, i.province]) || c.regAddress,
      regBankName: p.bankName || c.regBankName,
      regBankAccount: p.bankAccount || c.regBankAccount,
      regPassword: '',
      regPassword2: '',
    }));
  }, [isReview, draft]);

  const gpsForPayload = useMemo(() => {
    const lat = draft.farm.gpsLat ? Number(draft.farm.gpsLat) : undefined;
    const lng = draft.farm.gpsLng ? Number(draft.farm.gpsLng) : undefined;
    if (lat != null && !Number.isNaN(lat) && lng != null && !Number.isNaN(lng)) {
      return { lat, lng };
    }
    return {};
  }, [draft.farm.gpsLat, draft.farm.gpsLng]);

  const goBack = () => {
    setStepBlockMessages([]);
    if (stepIndex <= 0) {
      handleClose();
      return;
    }
    setStepIndex((i) => i - 1);
  };

  const goNext = () => {
    if (stepIndex >= KYC_STEP_KEYS.length - 1) return;
    const errs = validateKycStep(currentStep, draft);
    if (errs.length) {
      setStepBlockMessages(errs);
      toast.error(errs[0]);
      return;
    }
    setStepBlockMessages([]);
    setStepIndex((i) => i + 1);
  };

  const handleSaveDraft = () => {
    toast.success('KYC draft saved on this device. Continue later or create account on the last step.');
    handleClose();
  };

  const handleCreateAccount = async () => {
    const reviewErrs = validateKycStep('review', draft);
    if (reviewErrs.length) {
      setStepBlockMessages(reviewErrs);
      toast.error(reviewErrs[0]);
      return;
    }

    const { errors, parsed } = validateOnboardingReview({
      name: credentials.regName,
      phoneRaw: credentials.regPhone,
      emailRaw: credentials.regEmail,
      password: credentials.regPassword,
      password2: credentials.regPassword2,
      pricePerLiterRaw: credentials.regPricePerLiter,
      nidDigits: credentials.regNid,
      addressRaw: credentials.regAddress,
      bankNameRaw: credentials.regBankName,
      bankAccountRaw: credentials.regBankAccount,
    });
    setReviewFieldErrors(errors);
    if (!parsed) {
      toast.error('Fix login and commercial fields before submitting.');
      return;
    }

    const mccId = currentAccount?.account_id;
    if (!mccId) {
      toast.error('No MCC account in session.');
      return;
    }

    const derived = deriveAccountFromKyc(draft);
    const onboardingPayload = buildKycOnboardingPayload(draft, gpsForPayload);

    setCreatingAccount(true);
    try {
      const res = await supplierOnboardingApi.register({
        mcc_account_id: mccId,
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        password: parsed.password,
        account_type: derived.account_type,
        supplier_segment:
          derived.account_type === 'supplier'
            ? (derived.supplier_segment as SupplierSegment)
            : undefined,
        onboarding: onboardingPayload as unknown as Record<string, unknown>,
        price_per_liter: parsed.price_per_liter,
        nid: parsed.nid,
        address: parsed.address,
        bank_name: parsed.bank_name,
        bank_account_number: parsed.bank_account_number,
      });
      if (res.code === 200 || res.code === 201) {
        toast.success(
          res.data?.message ||
            'Supplier account created. They can sign in with phone and password.'
        );
        onRegistered?.();
        handleClose();
        return;
      }
      toast.error(res.message || 'Registration failed.');
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
              account_type: derived.account_type,
              role: 'owner',
              ...(derived.account_type === 'supplier' && derived.supplier_segment
                ? { supplier_segment: derived.supplier_segment }
                : {}),
              onboarding_payload: onboardingPayload as unknown as Record<string, unknown>,
            },
            mccId
          );
          if (adminRes?.code === 200 || adminRes?.code === 201) {
            toast.success('User created via admin.');
            onRegistered?.();
            handleClose();
            return;
          }
          toast.error(adminRes?.message || 'Admin user creation failed.');
        } catch {
          toast.error(apiMsg || 'Could not create user.');
        }
        return;
      }
      toast.error(apiMsg || 'Could not create account.');
    } finally {
      setCreatingAccount(false);
    }
  };

  const stepCompleteFn = (key: KycStepKey) => kycStepComplete(key, draft);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Supplier KYC & Onboarding"
      maxWidth="max-w-6xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-sm border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            <Icon icon={faArrowLeft} size="sm" />
            {stepIndex === 0 ? 'Cancel' : 'Back'}
          </button>
          {!isReview ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-sm font-medium text-white border border-[#004AAD] bg-[#004AAD] hover:bg-[#052A54]"
            >
              Save &amp; Continue
              <Icon icon={faArrowRight} size="sm" />
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={creatingAccount || !isKycDirty(draft)}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-sm font-medium border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <Icon icon={faFloppyDisk} size="sm" />
                Save draft
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
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Classify the supplier and configure roles, farm profile, payments, and documents — then
          create their Gemura login.
        </p>

        <ProgressBar
          value={stepProgressPercent}
          stepCurrent={stepIndex + 1}
          stepTotal={KYC_STEP_KEYS.length}
        />

        <SupplierKycStepper currentIndex={stepIndex} stepComplete={stepCompleteFn} />

        <WizardStepAlert messages={stepBlockMessages} />

        <div className="flex gap-5 items-start">
          <div className="flex-1 min-w-0">
            <SupplierKycStepPanels
              step={currentStep}
              draft={draft}
              onChange={setDraft}
              credentials={
                isReview ? (
                  <SupplierKycCredentialsBlock
                    values={credentials}
                    errors={reviewFieldErrors}
                    onChange={(patch) => setCredentials((c) => ({ ...c, ...patch }))}
                    onClearError={(key) =>
                      setReviewFieldErrors((p) => {
                        const n = { ...p };
                        delete n[key];
                        return n;
                      })
                    }
                  />
                ) : undefined
              }
            />
          </div>
          <SupplierKycSidebar draft={draft} stepIndex={stepIndex} mccName={mccName} />
        </div>
      </div>
    </Modal>
  );
}
