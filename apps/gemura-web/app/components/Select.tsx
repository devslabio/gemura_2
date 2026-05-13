'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon, { faChevronDown, faCheck } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  required?: boolean;
  /** Optional: show a clear/empty option at the top (value '') */
  allowEmpty?: boolean;
  /** Max height of dropdown list in px */
  maxListHeight?: number;
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  id,
  name,
  className = '',
  required = false,
  allowEmpty = false,
  maxListHeight = 240,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const effectiveOptions = allowEmpty
    ? [{ value: '', label: placeholder || '—' }, ...options]
    : options;
  const safeValue = value ?? '';
  const selectedOption = effectiveOptions.find((o) => o.value === safeValue);
  const displayLabel = selectedOption?.label ?? (safeValue || '');

  useLayoutEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      setHighlightIndex(effectiveOptions.findIndex((o) => o.value === safeValue));
    }
  }, [open, safeValue, effectiveOptions.length]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open || highlightIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) =>
        i < effectiveOptions.length - 1 ? i + 1 : i
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : 0));
      return;
    }
    if (e.key === 'Enter' && effectiveOptions[highlightIndex]) {
      e.preventDefault();
      onChange(effectiveOptions[highlightIndex]!.value);
      setOpen(false);
    }
  };

  const handleSelect = (option: SelectOption) => {
    onChange(option.value);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="hidden"
        name={name}
        value={safeValue}
        required={required}
        readOnly
        aria-hidden
      />
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="input w-full flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={displayLabel || placeholder}
        aria-required={required}
      >
        <span
          className={
            !displayLabel || (allowEmpty && safeValue === '')
              ? 'text-gray-500'
              : 'text-gray-900'
          }
        >
          {displayLabel || placeholder}
        </span>
        <Icon
          icon={faChevronDown}
          size="sm"
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed rounded-xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden z-[9999] py-1.5"
            style={{
              top: position.top,
              left: position.left,
              width: Math.max(position.width, 200),
              minWidth: 200,
            }}
            role="listbox"
            aria-label={placeholder}
          >
            <ul
              ref={listRef}
              className="overflow-y-auto"
              style={{ maxHeight: maxListHeight }}
            >
              {effectiveOptions.map((option, i) => {
                const selected = option.value === safeValue;
                const highlighted = i === highlightIndex;
                return (
                  <li
                    key={option.value !== undefined && option.value !== '' ? String(option.value) : `__empty__-${i}`}
                    role="option"
                    aria-selected={selected}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightIndex(i)}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors rounded-md mx-1 ${
                      selected
                        ? 'bg-[var(--primary)]/12 text-[var(--primary)] font-medium'
                        : highlighted
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {selected && (
                      <Icon icon={faCheck} size="sm" className="shrink-0 text-[var(--primary)]" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
