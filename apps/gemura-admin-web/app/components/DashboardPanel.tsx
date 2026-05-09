'use client';

import type { ReactNode } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import Icon from './Icon';

type DashboardPanelProps = {
  children: ReactNode;
  /** Card heading */
  title?: string;
  /** Muted line under title (keep short) */
  subtitle?: string;
  /** Icon shown before title */
  leadIcon?: IconDefinition;
  className?: string;
};

/**
 * Shared surface for admin dashboard charts and tables — matches legacy StatCard chrome (rounded-sm, flat border).
 */
export default function DashboardPanel({
  children,
  title,
  subtitle,
  leadIcon,
  className = '',
}: DashboardPanelProps) {
  return (
    <section className={`rounded-sm border border-gray-200 bg-white ${className}`}>
      <div className="p-4 sm:p-5">
        {title ? (
          <div className={subtitle ? 'mb-3' : 'mb-2'}>
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              {leadIcon ? <Icon icon={leadIcon} size="sm" className="shrink-0 text-[var(--primary)]" /> : null}
              <span>{title}</span>
            </h3>
            {subtitle ? <p className="mt-1 text-xs text-gray-500">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
