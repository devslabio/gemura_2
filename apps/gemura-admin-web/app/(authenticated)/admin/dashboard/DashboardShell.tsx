'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import AdminPagePeriodBar from '@/app/components/AdminPagePeriodBar';
import { PermissionService } from '@/lib/services/permission.service';

const TABS: Array<{ href: string; label: string; segment: string }> = [
  { href: '/admin/dashboard/overview', label: 'Overview', segment: 'overview' },
  { href: '/admin/dashboard/milk', label: 'Milk & collections', segment: 'milk' },
  { href: '/admin/dashboard/finance', label: 'Finance', segment: 'finance' },
  { href: '/admin/dashboard/usage', label: 'Usage', segment: 'usage' },
];

function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const suffix = qs ? `?${qs}` : '';

  return (
    <div className="-mt-1 space-y-3">
      <div className="mb-2 border-b-2 border-gray-200 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.segment}
                  href={`${tab.href}${suffix}`}
                  className={`
                  flex items-center gap-1.5 rounded-t border-b-2 border-transparent px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all duration-200
                  ${
                    active
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5 font-semibold text-[var(--primary)]'
                      : 'border-transparent bg-transparent text-gray-500 hover:bg-[var(--primary)]/5 hover:text-[var(--primary)]'
                  }
                `}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <AdminPagePeriodBar />
        </div>
      </div>

      {children}
    </div>
  );
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (PermissionService.canViewOperatorDashboard()) {
      router.replace('/admin/operator');
      return;
    }
    if (!PermissionService.canViewSystemAdminDashboard() && !PermissionService.isAdmin()) {
      router.replace('/dashboard');
    }
  }, [router]);

  if (PermissionService.canViewOperatorDashboard()) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500 text-sm">Redirecting…</p>
      </div>
    );
  }

  if (!PermissionService.canViewSystemAdminDashboard() && !PermissionService.isAdmin()) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500 text-sm">Redirecting…</p>
      </div>
    );
  }

  return <DashboardChrome>{children}</DashboardChrome>;
}
