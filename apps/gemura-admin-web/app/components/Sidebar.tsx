'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import Icon, {
  faChevronRight,
  faBars,
  faUsers,
  faUserShield,
  faLock,
  faWarehouse,
  faBuilding,
  faChartLine,
  faClipboardList,
  faReceipt,
  faHandHoldingDollar,
  faChartBar,
} from './Icon';
import { adminApi } from '@/lib/api/admin';
import { PermissionService } from '@/lib/services/permission.service';
import type { CSSProperties } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

type NavSection = { kind: 'section'; label: string };
type NavLink = { kind: 'link'; href: string; label: string; icon: IconDefinition; badge?: number };
type NavEntry = NavSection | NavLink;

interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
}

export default function Sidebar({ isOpen, collapsed, onClose, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const { user, currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin, canViewDashboard } = usePermission();

  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('User');
  const [onboardingPending, setOnboardingPending] = useState(0);

  useEffect(() => {
    if (!user) return;
    setUserName(`${user.firstName} ${user.lastName}`.trim() || 'User');
    setUserEmail(user.email || '');
    setUserRole(currentAccount?.role || 'User');
  }, [user, currentAccount]);

  useEffect(() => {
    // Read permission via static service to avoid unstable hook function refs
    // re-firing this effect every render (which would spam the API endlessly).
    if (!(PermissionService.canManageUsers() || PermissionService.isAdmin()) || !currentAccount?.account_id) {
      setOnboardingPending(0);
      return;
    }
    let cancelled = false;
    adminApi
      .getOnboardingPendingCount(currentAccount.account_id)
      .then((res) => {
        if (!cancelled && res.code === 200 && res.data) setOnboardingPending(res.data.pendingCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) setOnboardingPending(0);
      });
    return () => {
      cancelled = true;
    };
  }, [currentAccount?.account_id]);

  const navEntries = useMemo((): NavEntry[] => {
    const entries: NavEntry[] = [];

    if (canViewDashboard() || isAdmin()) {
      entries.push({ kind: 'section', label: 'Dashboards' });
      entries.push({
        kind: 'link',
        href: '/admin/dashboard/overview',
        label: 'Overview',
        icon: faChartLine,
      });
      entries.push({
        kind: 'link',
        href: '/admin/dashboard/milk',
        label: 'Milk & collections',
        icon: faReceipt,
      });
      entries.push({
        kind: 'link',
        href: '/admin/dashboard/finance',
        label: 'Finance',
        icon: faHandHoldingDollar,
      });
      entries.push({
        kind: 'link',
        href: '/admin/dashboard/usage',
        label: 'Usage',
        icon: faChartBar,
      });
    }

    if (canManageUsers() || isAdmin()) {
      entries.push({ kind: 'section', label: 'Administration' });
      entries.push({ kind: 'link', href: '/admin/users', label: 'Users', icon: faUsers });
      entries.push({
        kind: 'link',
        href: '/admin/onboarding',
        label: 'MCC onboarding',
        icon: faClipboardList,
        badge: onboardingPending > 0 ? onboardingPending : undefined,
      });
      entries.push({ kind: 'link', href: '/admin/roles', label: 'Roles', icon: faUserShield });
      entries.push({ kind: 'link', href: '/admin/permissions', label: 'Permissions', icon: faLock });
    }

    entries.push({ kind: 'section', label: 'Platform' });
    entries.push({ kind: 'link', href: '/admin/immis', label: 'IMMIS', icon: faUsers });
    entries.push({ kind: 'link', href: '/admin/farms', label: 'Farms', icon: faWarehouse });
    entries.push({ kind: 'link', href: '/admin/accounts', label: 'Accounts', icon: faBuilding });

    return entries;
  }, [canManageUsers, isAdmin, canViewDashboard, onboardingPending]);

  const linkIsActive = (href: string) => {
    if (!href) return false;
    if (href.startsWith('/admin/dashboard/')) {
      const segment = href.replace('/admin/dashboard/', '');
      if (!segment) return false;
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const userInitials = useMemo(() => {
    const f = user?.firstName?.trim()?.charAt(0);
    const l = user?.lastName?.trim()?.charAt(0);
    if (f && l) return `${f}${l}`.toUpperCase();
    if (f) return f.toUpperCase();
    if (userEmail) return userEmail.charAt(0).toUpperCase();
    return '?';
  }, [user?.firstName, user?.lastName, userEmail]);

  const handleCollapseToggle = useCallback(() => {
    onCollapsedChange(!collapsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gemuraSidebarCollapsed', (!collapsed).toString());
    }
  }, [collapsed, onCollapsedChange]);

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) onClose();
  };

  const asideStyle: CSSProperties | undefined = undefined;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden min-h-screen min-h-[100dvh]"
          style={{ minHeight: '100dvh' }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        style={asideStyle}
        className={`
          fixed top-0 left-0 z-50
          flex flex-col overflow-y-auto overflow-x-hidden
          transition-all duration-300 ease-in-out
          h-full min-h-[100dvh]
          w-[280px] max-w-[85vw]
          lg:max-w-none
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'lg:w-20' : 'lg:w-64'}
          bg-[#052a54]
          border-r border-[#031a3a]
          text-white
        `}
      >
        {/* Logo */}
        <div className="p-4 sm:p-5 border-b border-[#031a3a] flex-shrink-0 mb-2 sm:mb-4">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <Link href="/admin/dashboard/overview" className={`flex items-center gap-3 min-h-[44px] ${collapsed ? 'justify-center w-full' : 'w-auto'}`} onClick={handleLinkClick}>
              <div className="relative flex-shrink-0 bg-transparent flex items-center justify-center overflow-hidden rounded-full">
                <Image src="/logo.png" alt="Gemura" width={collapsed ? 32 : 40} height={collapsed ? 32 : 40} className="object-contain" priority />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-lg sm:text-xl font-semibold text-white leading-tight truncate">Gemura</span>
                  <span className="text-xs text-white/80 leading-tight hidden sm:block">Admin portal</span>
                </div>
              )}
            </Link>

            <span className="hidden lg:inline-flex">
              {collapsed ? (
                <button
                  type="button"
                  onClick={handleCollapseToggle}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[#031a3a] rounded-sm transition-colors text-gray-300 hover:text-white"
                  aria-label="Expand sidebar"
                >
                  <Icon icon={faChevronRight} size="sm" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCollapseToggle}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[#031a3a] rounded-sm transition-colors text-gray-300 hover:text-white"
                  aria-label="Collapse sidebar"
                >
                  <Icon icon={faBars} size="sm" />
                </button>
              )}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-0 overflow-y-auto min-h-0">
          <ul className="list-none p-0 m-0 flex flex-col gap-0">
            {navEntries.map((entry, idx) => {
              if (entry.kind === 'section') {
                if (collapsed) return null;
                return (
                  <li key={`section-${entry.label}-${idx}`} className="mt-3 mb-1 first:mt-0 px-5 md:px-7">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{entry.label}</span>
                  </li>
                );
              }

              const active = linkIsActive(entry.href);
              const rowClass = `
                flex items-center gap-3 min-h-[44px] px-4 py-3 sm:px-5 md:px-7 w-full text-left
                transition-all duration-200
                ${collapsed ? 'justify-center px-3' : ''}
                ${
                  active
                    ? 'bg-[#031a3a] text-white border-l-4 border-[var(--primary)]'
                    : 'text-gray-300 hover:bg-[#031a3a] hover:text-white active:bg-[#031a3a]'
                }
              `;

              return (
                <li key={entry.href} className="my-0.5">
                  <Link href={entry.href} onClick={handleLinkClick} className={rowClass} title={collapsed ? entry.label : undefined}>
                    <Icon icon={entry.icon} className={active ? 'text-white' : 'text-gray-300'} size="sm" />
                    {!collapsed && (
                      <span className="text-sm font-medium flex-1 whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-2 min-w-0">
                        {entry.label}
                        {entry.badge != null && entry.badge > 0 && (
                          <span className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-400 text-[#052a54] text-xs font-bold">
                            {entry.badge > 99 ? '99+' : entry.badge}
                          </span>
                        )}
                      </span>
                    )}
                    {!collapsed && <span className="w-3 shrink-0" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={`flex-shrink-0 border-t border-[#031a3a] p-4 ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/25 text-xs font-semibold text-white ring-1 ring-white/20"
              title={userName}
            >
              <span className={collapsed ? 'text-[11px]' : 'text-xs'}>{userInitials}</span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{userName}</div>
                <div className="truncate text-xs text-white/60">{userRole}</div>
                {userEmail && <div className="truncate text-[11px] text-white/45">{userEmail}</div>}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

