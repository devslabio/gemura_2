'use client';

import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import Link from 'next/link';
import Icon from './Icon';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconDefinition;
  href?: string;
  subtitle?: string;
  iconBgColor?: string;
  iconColor?: string;
}

/**
 * ResolveIT-style stat card: label, value, optional subtitle, icon in colored box (right).
 */
export default function StatCard({
  label,
  value,
  icon,
  href,
  subtitle,
  iconBgColor = '#eff6ff',
  iconColor = 'var(--primary)',
}: StatCardProps) {
  const content = (
    <div
      className={`rounded-sm border border-gray-200 bg-white transition-colors hover:border-gray-300 ${
        subtitle ? 'min-h-[104px] p-5' : 'p-4'
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
          <div className="min-w-0">
            <div className="truncate whitespace-nowrap font-bold leading-none text-gray-900 text-[clamp(1rem,2.2vw,1.5rem)]">
              {value}
            </div>
          </div>
          {subtitle && <div className="mt-1.5 text-xs text-gray-600">{subtitle}</div>}
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11"
          style={{ backgroundColor: iconBgColor, color: iconColor }}
        >
          <Icon icon={icon} size="sm" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
