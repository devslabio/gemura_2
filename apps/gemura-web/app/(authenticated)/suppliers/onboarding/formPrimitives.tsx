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
    <div className="rounded-xl border border-slate-200/90 bg-gradient-to-r from-slate-50 to-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-600">
        <span className="font-medium uppercase tracking-wide text-slate-500">Wizard progress</span>
        <span className="font-semibold tabular-nums text-slate-900">{pct}%</span>
      </div>
      {stepCurrent != null && stepTotal != null && (
        <p className="text-sm font-medium text-slate-800 mt-0.5">
          Step {stepCurrent} of {stepTotal}
          {fp != null && (
            <span className="text-slate-500 font-normal">
              {' '}
              · Required fields: {fp}%
            </span>
          )}
        </p>
      )}
      <div
        className="mt-2 h-2.5 rounded-full bg-slate-200/90 overflow-hidden ring-1 ring-slate-300/60"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Wizard step ${stepCurrent ?? 0} of ${stepTotal ?? 0}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-[width] duration-500 ease-out"
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
      className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5 overflow-hidden"
    >
      <header className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
        <h3 className="text-lg font-semibold tracking-tight text-white drop-shadow-sm">{title}</h3>
        {subtitle && (
          <p className="text-sm mt-1.5 text-slate-100 leading-snug">{subtitle}</p>
        )}
      </header>
      <div className="p-5 sm:p-6 space-y-5 bg-gradient-to-b from-white to-slate-50/40">{children}</div>
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
    <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-slate-800 mb-1.5">
      {children}
      {optional && <span className="text-slate-500 font-normal"> (optional)</span>}
    </label>
  );
}

const fieldBase =
  'w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 transition-shadow';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${fieldBase} ${props.className || ''}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${fieldBase} min-h-[100px] resize-y py-3 ${props.className || ''}`}
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
      <legend className="text-[13px] font-semibold text-slate-800 mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border min-h-[44px] cursor-pointer text-sm transition-colors ${
              value === o.value
                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600/20'
                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
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
      <legend className="text-[13px] font-semibold text-slate-800 mb-2">
        {legend}
        {maxSelections != null && (
          <span className="text-slate-500 font-normal"> (max {maxSelections})</span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const isOn = selected.includes(o.key);
          const disabled = !isOn && !!atMax;
          return (
            <label
              key={o.key}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border min-h-[44px] text-sm ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${
                isOn
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
              }`}
            >
              <input
                type="checkbox"
                checked={isOn}
                disabled={disabled}
                onChange={(e) => onToggle(o.key, e.target.checked)}
                className="rounded border-gray-300"
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
  return <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded px-2 py-1.5">{children}</p>;
}

export function RiskBanner({ children }: { children: ReactNode }) {
  return (
    <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="status">
      {children}
    </div>
  );
}

export function AgentPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-amber-400/80 bg-gradient-to-br from-amber-50 to-orange-50/90 p-5 space-y-4 shadow-md ring-1 ring-amber-900/10">
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
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2.5 border-b border-slate-100 last:border-0 text-sm">
      <dt className="shrink-0 sm:w-[40%] font-medium text-slate-500">{label}</dt>
      <dd className="text-slate-900 break-words flex-1">{value === '' || value == null ? '—' : value}</dd>
    </div>
  );
}

export function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <h4 className="bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">{title}</h4>
      <dl className="px-4 py-2">{children}</dl>
    </section>
  );
}
