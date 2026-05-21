'use client';

import Icon, { faCheckCircle } from '@/app/components/Icon';
import { KYC_STEP_KEYS, KYC_STEP_LABELS, type KycStepKey } from './kycModel';

type Props = {
  currentIndex: number;
  stepComplete: (key: KycStepKey) => boolean;
};

export default function SupplierKycStepper({ currentIndex, stepComplete }: Props) {
  return (
    <nav
      className="rounded-lg border border-gray-200 bg-white px-3 py-4 shadow-sm overflow-x-auto"
      aria-label="Supplier onboarding progress"
    >
      <ol className="flex min-w-[640px] items-start justify-between gap-1">
        {KYC_STEP_KEYS.map((key, index) => {
          const done = stepComplete(key);
          const active = index === currentIndex;
          const past = index < currentIndex;
          const meta = KYC_STEP_LABELS[key];
          return (
            <li key={key} className="flex flex-1 flex-col items-center text-center px-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  done || past
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : active
                      ? 'border-[#004AAD] bg-[#004AAD] text-white'
                      : 'border-gray-300 bg-white text-gray-500'
                }`}
              >
                {done || past ? (
                  <Icon icon={faCheckCircle} size="sm" className="text-emerald-600" />
                ) : (
                  index + 1
                )}
              </div>
              <p
                className={`mt-2 text-xs font-semibold leading-tight ${
                  active ? 'text-[#004AAD]' : 'text-gray-800'
                }`}
              >
                {meta.title}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500 leading-snug hidden sm:block">{meta.subtitle}</p>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
