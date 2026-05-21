'use client';

import { FieldLabel, wizardInputWithError } from './formPrimitives';

export type SupplierKycCredentials = {
  regName: string;
  regPhone: string;
  regEmail: string;
  regPassword: string;
  regPassword2: string;
  regPricePerLiter: string;
  regNid: string;
  regAddress: string;
  regBankName: string;
  regBankAccount: string;
};

type Props = {
  values: SupplierKycCredentials;
  errors: Record<string, string>;
  onChange: (patch: Partial<SupplierKycCredentials>) => void;
  onClearError: (key: string) => void;
};

export default function SupplierKycCredentialsBlock({
  values,
  errors,
  onChange,
  onClearError,
}: Props) {
  const field = (key: keyof SupplierKycCredentials, label: string, opts?: { optional?: boolean; type?: string; placeholder?: string; maxLength?: number; inputMode?: string }) => (
    <div className="space-y-1">
      <FieldLabel htmlFor={`cred-${key}`} optional={opts?.optional}>
        {label}
      </FieldLabel>
      <input
        id={`cred-${key}`}
        type={opts?.type ?? 'text'}
        className={wizardInputWithError(!!errors[key])}
        value={values[key]}
        placeholder={opts?.placeholder}
        maxLength={opts?.maxLength}
        inputMode={opts?.inputMode as React.HTMLAttributes<HTMLInputElement>['inputMode']}
        onChange={(e) => {
          onChange({ [key]: e.target.value } as Partial<SupplierKycCredentials>);
          onClearError(key);
        }}
        autoComplete={key.includes('Password') ? 'new-password' : undefined}
      />
      {errors[key] && <p className="text-xs text-red-600 font-medium">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5 space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-800 border-b border-gray-200 pb-2">
            Gemura login
          </h4>
          <p className="text-sm text-gray-600 mt-2">
            Phone and password are used on the login page. Email is optional.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">{field('regName', 'Full name')}</div>
          {field('regPhone', 'Phone (login)', { placeholder: '250788123456', inputMode: 'tel' })}
          {field('regEmail', 'Email', { optional: true, type: 'email' })}
          {field('regPassword', 'Password (min 6)', { type: 'password' })}
          {field('regPassword2', 'Confirm password', { type: 'password' })}
        </div>
      </div>

      <div className="rounded-sm border border-[#004AAD]/30 bg-[#004AAD]/10 p-4 sm:p-5 space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#031A3A] border-b border-[#004AAD]/20 pb-2">
            MCC — commercial &amp; payout
          </h4>
          <p className="text-sm text-gray-600 mt-2">
            Price per liter and payout details for this MCC relationship.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {field('regPricePerLiter', 'Price per liter (RWF)', { inputMode: 'decimal', placeholder: '390' })}
          {field('regNid', 'National ID', { inputMode: 'numeric', maxLength: 16, placeholder: '16 digits' })}
          <div className="sm:col-span-2">{field('regAddress', 'Address', { optional: true })}</div>
          {field('regBankName', 'Bank name', { optional: true })}
          {field('regBankAccount', 'Bank account number', { optional: true })}
        </div>
      </div>
    </div>
  );
}
