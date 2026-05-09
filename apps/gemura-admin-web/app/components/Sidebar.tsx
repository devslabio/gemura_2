'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import { faDroplet } from '@fortawesome/free-solid-svg-icons';
import Icon, {
  faChevronRight,
  faBars,
  faUsers,
  faUser,
  faUserShield,
  faLock,
  faWarehouse,
  faBuilding,
  faChartLine,
  faClipboardList,
  faChartBar,
  faBell,
  faWallet,
  faHandHoldingDollar,
  faBriefcase,
  faShoppingCart,
  faFileAlt,
  faTriangleExclamation,
  faReceipt,
  faList,
  faUserFriends,
  faTruck,
} from './Icon';
import { getRoleLabel } from '@/lib/utils/role';
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
    setUserRole(getRoleLabel(currentAccount?.role));
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
      entries.push({
        kind: 'link',
        href: '/admin/dashboard',
        label: 'Dashboard',
        icon: faChartLine,
      });
      entries.push({ kind: 'section', label: 'Analytics' });
      entries.push({
        kind: 'link',
        href: '/admin/dashboard/overview',
        label: 'Overview',
        icon: faChartBar,
      });
      entries.push({
        kind: 'link',
        href: '/admin/dashboard/milk',
        label: 'Milk & collections',
        icon: faDroplet,
      });
      entries.push({
        kind: 'link',
        href: '/admin/dashboard/finance',
        label: 'Finance metrics',
        icon: faWallet,
      });
      entries.push({
        kind: 'link',
        href: '/admin/dashboard/usage',
        label: 'Usage & adoption',
        icon: faBell,
      });
      entries.push({ kind: 'section', label: 'Reports & lists' });
      entries.push({
        kind: 'link',
        href: '/admin/milk/collections',
        label: 'Milk collections',
        icon: faClipboardList,
      });
      entries.push({
        kind: 'link',
        href: '/admin/milk/rejections',
        label: 'Milk rejections',
        icon: faTriangleExclamation,
      });
      entries.push({
        kind: 'link',
        href: '/admin/finance/active-loans',
        label: 'Active loans',
        icon: faWallet,
      });
      entries.push({
        kind: 'link',
        href: '/admin/finance/loan-disbursements',
        label: 'Loan disbursements',
        icon: faHandHoldingDollar,
      });
      entries.push({
        kind: 'link',
        href: '/admin/finance/loan-repayments',
        label: 'Loan repayments',
        icon: faHandHoldingDollar,
      });
      entries.push({
        kind: 'link',
        href: '/admin/finance/payroll-runs',
        label: 'Payroll runs',
        icon: faBriefcase,
      });
      entries.push({
        kind: 'link',
        href: '/admin/finance/inventory-sales',
        label: 'Inventory sales',
        icon: faShoppingCart,
      });
      entries.push({
        kind: 'link',
        href: '/admin/finance/charges',
        label: 'Supplier charges',
        icon: faReceipt,
      });
      entries.push({
        kind: 'link',
        href: '/admin/finance/accounting-transactions',
        label: 'Accounting journals',
        icon: faList,
      });
      entries.push({
        kind: 'link',
        href: '/admin/directory/supplier-links',
        label: 'Supplier–customer links',
        icon: faUserFriends,
      });
      entries.push({
        kind: 'link',
        href: '/admin/audit-log',
        label: 'Audit log',
        icon: faFileAlt,
      });
      entries.push({ kind: 'section', label: 'Operations' });
      entries.push({
        kind: 'link',
        href: '/admin/operations/gate-deliveries',
        label: 'Gate deliveries',
        icon: faTruck,
      });
      entries.push({
        kind: 'link',
        href: '/admin/operations/milk-manifests',
        label: 'Milk manifests',
        icon: faClipboardList,
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
    if (href === '/admin/dashboard') {
      return pathname === '/admin/dashboard';
    }
    if (href === '/admin/dashboard/overview') {
      return pathname === '/admin/dashboard/overview' || pathname === '/admin/dashboard';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

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
            <Link
              href="/admin/dashboard"
              className={`flex items-center gap-3 min-h-11 ${collapsed ? 'flex-1 justify-center' : 'flex-1'}`}
              onClick={handleLinkClick}
            >
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
                  className="p-2 min-w-11 min-h-11 flex items-center justify-center hover:bg-[#031a3a] rounded-sm transition-colors text-gray-300 hover:text-white"
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                >
                  <Icon icon={faChevronRight} size="sm" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCollapseToggle}
                  className="p-2 min-w-11 min-h-11 flex items-center justify-center hover:bg-[#031a3a] rounded-sm transition-colors text-gray-300 hover:text-white"
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <Icon icon={faBars} size="sm" />
                </button>
              )}
            </span>
          </div>
        </div>

        {/* User block — aligned with main Gemura app sidebar */}
        <div
          className={`shrink-0 flex flex-col items-center gap-3 sm:gap-4 mb-2 sm:mb-4 p-4 sm:p-6 ${collapsed ? 'lg:px-3' : ''}`}
        >
          <div
            className={`
              rounded-full flex items-center justify-center text-white
              bg-black/20 border-2 border-white/30
              transition-all duration-300 ease-in-out
              hover:bg-black/30 hover:border-white/50 active:scale-105
              w-14 h-14 sm:w-20 sm:h-20
              ${collapsed ? 'lg:w-12 lg:h-12' : 'lg:w-24 lg:h-24'}
            `}
            aria-hidden
          >
            <Icon icon={faUser} className="text-white" size={collapsed ? 'sm' : '2x'} />
          </div>
          {!collapsed && (
            <div className="text-center w-full min-w-0">
              <div className="text-sm font-semibold text-white mb-0.5 truncate">{userName}</div>
              {userEmail ? (
                <div className="text-xs text-gray-300 truncate max-w-[12.5rem] mx-auto">{userEmail}</div>
              ) : null}
              <div className="text-xs text-white/80 font-medium uppercase tracking-wide mt-0.5">{userRole}</div>
            </div>
          )}
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
      </aside>
    </>
  );
}

