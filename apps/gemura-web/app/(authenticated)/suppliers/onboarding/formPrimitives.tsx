'use client';

import { ReactNode, useId } from 'react';

export function ProgressBar({
  value,
  stepCurrent,
  stepTotal,
  fieldPercent,
}: {
  /** Step completion 0–100 (wizard position) */
  value: number;
  stepCurrent?: number;
  stepTotal?: number;
  /** Required-field completeness 0–100 (shown as secondary metric) */
  fieldPercent?: number;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const fp = fieldPercent != null ? Math.min(100, Math.max(0, Math.round(fieldPercent))) : null;
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-gray-600">
        <span className="font-medium uppercase tracking-wide text-gray-500">Wizard progress</span>
        <span className="font-semibold tabular-nums text-gray-900">{pct}%</span>
      </div>
      {stepCurrent != null && stepTotal != null && (
        <p className="text-sm font-medium text-gray-800 mt-0.5">
          Step {stepCurrent} of {stepTotal}
          {fp != null && (
            <span className="text-gray-500 font-normal">
              {' '}
              · Required fields: {fp}%
            </span>
          )}
        </p>
      )}
      <div
        className="mt-2 h-2.5 rounded-sm bg-gray-200 overflow-hidden border border-gray-300 box-border"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Wizard step ${stepCurrent ?? 0} of ${stepTotal ?? 0}`}
      >
        <div
          className="h-full rounded-sm bg-gradient-to-r from-[#052A54] to-[#004AAD] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** One wizard screen — card shell for a single step */
export function WizardStepPanel({
  id,
  title,
  subtitle,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-600 mt-1 leading-snug">{subtitle}</p>
        )}
      </header>
      <div className="p-5 sm:p-6 space-y-6 bg-white">{children}</div>
    </section>
  )
}

export function FieldLabel({
  children,
  htmlFor,
  optional,
}: {
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {optional && <span className="text-gray-500 font-normal"> (optional)</span>}
    </label>
  );
}

/** Same visual language as Settings, members, and other authenticated forms (`globals.css` `.input`). */
export const wizardTextInputClass = 'input w-full min-h-[44px]';

export function wizardInputWithError(hasError: boolean) {
  return `${wizardTextInputClass}${hasError ? ' input-error' : ''}`;
}

/** Native `<select>` — matches `globals.css` `.select`. */
export function wizardNativeSelectClass() {
  return 'select w-full min-h-[44px]';
}

export function WizardStepAlert({ messages }: { messages: string[] | null | undefined }) {
  if (!messages?.length) return null;
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-sm"
      role="alert"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-red-900">Complete the following before continuing</p>
      <ul className="mt-2 text-sm text-red-800 list-disc pl-5 space-y-1">
        {messages.map((m, i) => (
          <li key={`${i}-${m.slice(0, 24)}`}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${wizardTextInputClass} ${props.className || ''}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`textarea w-full min-h-[100px] ${props.className || ''}`.trim()}
    />
  );
}

type RadioOpt = { value: string; label: string };

export function RadioRow({
  name,
  value,
  onChange,
  options,
  legend,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: RadioOpt[];
  legend: string;
}) {
  const gid = useId();
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700 mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-sm border min-h-[44px] cursor-pointer text-sm transition-colors ${
              value === o.value
                ? 'border-[#004AAD] bg-[#004AAD]/10 text-[#031A3A]'
                : 'border-gray-200 bg-white hover:border-gray-300 text-gray-800'
            }`}
          >
            <input
              type="radio"
              name={gid + name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CheckboxRow({
  selected,
  onToggle,
  options,
  legend,
  maxSelections,
}: {
  selected: string[];
  onToggle: (key: string, checked: boolean) => void;
  options: { key: string; label: string }[];
  legend: string;
  maxSelections?: number;
}) {
  const atMax = maxSelections != null && selected.length >= maxSelections;
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700 mb-2">
        {legend}
        {maxSelections != null && (
          <span className="text-gray-500 font-normal"> (max {maxSelections})</span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const isOn = selected.includes(o.key);
          const disabled = !isOn && !!atMax;
          return (
            <label
              key={o.key}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-sm border min-h-[44px] text-sm ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${
                isOn
                  ? 'border-[#004AAD] bg-[#004AAD]/10 text-[#031A3A]'
                  : 'border-gray-200 bg-white hover:border-gray-300 text-gray-800'
              }`}
            >
              <input
                type="checkbox"
                checked={isOn}
                disabled={disabled}
                onChange={(e) => onToggle(o.key, e.target.checked)}
                className="rounded-sm border-gray-300"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-gray-600 mt-1 border border-gray-200 rounded-sm bg-gray-50 px-3 py-2 leading-relaxed">
      {children}
    </p>
  );
}

export function RiskBanner({ children }: { children: ReactNode }) {
  return (
    <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2" role="status">
      {children}
    </div>
  );
}

export function AgentPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-sm border-2 border-amber-400/80 bg-gradient-to-br from-amber-50 to-orange-50/90 p-5 space-y-4">
      <h3 className="text-base font-semibold text-amber-950">{title}</h3>
      <p className="text-xs text-amber-900/90">
        Agent-only assessment — visually distinct from farmer/collector fields.
      </p>
      {children}
    </div>
  );
}

/** Key-value row for review step */
export function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2.5 border-b border-gray-100 last:border-0 text-sm">
      <dt className="shrink-0 sm:w-[40%] font-medium text-gray-500">{label}</dt>
      <dd className="text-gray-900 break-words flex-1">{value === '' || value == null ? '—' : value}</dd>
    </div>
  );
}

export function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
      <h4 className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-900">{title}</h4>
      <dl className="px-4 py-3">{children}</dl>
    </section>
  );
}
