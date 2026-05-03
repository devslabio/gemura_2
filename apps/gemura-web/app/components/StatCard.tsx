'use client';

import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import Icon from './Icon';
import Link from 'next/link';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconDefinition;
  href?: string;
  /** Use `\\n` for a second line; each line truncates with ellipsis. */
  subtitle?: string;
  /** Optional longer description shown as native tooltip on the subtitle block. */
  subtitleTitle?: string;
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
  subtitleTitle,
  iconBgColor = '#eff6ff',
  iconColor = 'var(--primary)',
}: StatCardProps) {
  const content = (
    <div className="bg-white rounded-sm border border-gray-200 p-6 min-h-[120px] hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            {label}
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {value}
          </div>
          {subtitle ? (
            <div
              className="mt-1.5 space-y-0.5"
              title={subtitleTitle ?? subtitle.replace(/\n/g, ' · ')}
            >
              {subtitle
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <div key={i} className="text-[11px] leading-snug text-gray-600 truncate">
                    {line}
                  </div>
                ))}
            </div>
          ) : null}
        </div>
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center self-start"
          style={{ backgroundColor: iconBgColor, color: iconColor }}
        >
          <Icon icon={icon} size="lg" />
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
