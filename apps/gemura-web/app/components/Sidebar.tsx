'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import { getRoleLabel } from '@/lib/utils/role';
import Icon, { faBars, faChevronRight, faChevronDown, faUser } from './Icon';
import type { NavItem } from '@/lib/config/nav.config';
import {
  ADMIN_NAV_ITEMS,
  OPERATIONS_NAV_ITEMS,
  EXTERNAL_SUPPLIER_NAV_ITEMS,
  EXTERNAL_CUSTOMER_NAV_ITEMS,
  EXTERNAL_FARMER_NAV_ITEMS,
  isBusinessAccount,
  isAdminRole,
  isOperationsRole,
  isExternalSupplier,
  isExternalCustomer,
} from '@/lib/config/nav.config';

interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
}

const FORCE_OPERATIONS_DASHBOARD =
  (process.env.NEXT_PUBLIC_FORCE_OPERATIONS_DASHBOARD || '').toLowerCase() === 'true';

export default function Sidebar({ isOpen, collapsed, onClose, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const { user, currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin, canViewDashboard, hasPermission } = usePermission();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('User');
  // Collapsible sections: set of parent hrefs that are expanded (only when they have children)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const role = (currentAccount?.role ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  const accountType = currentAccount?.account_type ?? '';
  const isLimitedOpsRole =
    role === 'agent' ||
    role === 'collector' ||
    role === 'veterinary' ||
    role === 'veterinarian' ||
    role === 'veternary' ||
    role === 'milkreceptionist' ||
    role === 'milk_receptionist';
  const limitedOpsAllowedPrefixes = ['/dashboard', '/sales', '/collections', '/inventory', '/suppliers', '/customers'];

  useEffect(() => {
    if (user) {
      setUserName(`${user.firstName} ${user.lastName}`);
      setUserEmail(user.email);
      setUserRole(getRoleLabel(currentAccount?.role, currentAccount?.account_type));
    }
  }, [user, currentAccount]);

  // Build menu.
  // Admin portal is shown based on role/permissions (manage_users + dashboard.view), matching backend.
  const menuItems = useMemo(() => {
    const items: NavItem[] = [];

    // Milk farmer / supplier / customer: never MCC admin UI (UserAccount.role may still be "owner" on their tenant).
    if (isExternalSupplier(accountType) || isExternalCustomer(accountType)) {
      if (isExternalSupplier(accountType)) {
        EXTERNAL_SUPPLIER_NAV_ITEMS.forEach((item) => items.push(item));
      } else if ((accountType || '').toLowerCase() === 'farmer') {
        EXTERNAL_FARMER_NAV_ITEMS.forEach((item) => items.push(item));
      } else {
        EXTERNAL_CUSTOMER_NAV_ITEMS.forEach((item) => items.push(item));
      }
      return items;
    }

    const showAdminDashboard = canViewDashboard() || isAdmin();
    const showAdminUsers = canManageUsers() || isAdmin();
    // Owner/admin on a farm/business account use the operations app; do not trap them in admin-portal-only nav.
    const useOperationsNavForAdminRole =
      isBusinessAccount(accountType) && isAdminRole(role);
    const preferOperationsSidebar = FORCE_OPERATIONS_DASHBOARD && isBusinessAccount(accountType);

    const shouldUseAdminPortal =
      isAdminRole(role) &&
      (showAdminDashboard || showAdminUsers) &&
      !useOperationsNavForAdminRole &&
      !preferOperationsSidebar;
    if (shouldUseAdminPortal) {
      ADMIN_NAV_ITEMS.forEach((item) => {
        if (item.href === '/admin/dashboard') {
          if (!showAdminDashboard) return;
        }

        if (item.href === '/admin/users' || item.href === '/admin/roles' || item.href === '/admin/permissions') {
          if (!showAdminUsers) return;
        }

        items.push(item);
      });

      return items;
    }

    // User accounts: menu by role and permissions (active/default account)
    // Operations: business account types, filter by role/permissions
    if (isOperationsRole(role) && isBusinessAccount(accountType)) {
      if (role === 'manager') {
        OPERATIONS_NAV_ITEMS.forEach((item) => items.push(item));
        return items;
      }

      if (role === 'accountant') {
        OPERATIONS_NAV_ITEMS.forEach((item) => {
          if (item.href === '/accounts' || item.href === '/settings') return;
          items.push(item);
        });
        return items;
      }

      if (isLimitedOpsRole) {
        OPERATIONS_NAV_ITEMS.forEach((item) => {
          const isAllowed = limitedOpsAllowedPrefixes.some(
            (prefix) => item.href === prefix || item.href.startsWith(prefix + '/')
          );
          if (!isAllowed) return;
          items.push(item);
        });
        return items;
      }

      OPERATIONS_NAV_ITEMS.forEach((item) => {
        if (item.requiresPermission && !hasPermission(item.requiresPermission)) return;
        items.push(item);
      });
      return items;
    }

    // Owner/admin role on non-admin account (tenant/branch etc.) → operations menu by permissions
    if (isAdminRole(role) && isBusinessAccount(accountType)) {
      OPERATIONS_NAV_ITEMS.forEach((item) => {
        if (item.requiresPermission && !hasPermission(item.requiresPermission)) return;
        items.push(item);
      });
      return items;
    }

    // Fallback: business account type, unknown role — show operations by permissions
    if (isBusinessAccount(accountType)) {
      OPERATIONS_NAV_ITEMS.forEach((item) => {
        if (item.href === '/settings' && (role === 'collector' || role === 'agent' || role === 'accountant')) return;
        if (item.href === '/accounts' && role === 'accountant') return;
        if (item.requiresPermission && !hasPermission(item.requiresPermission) && !isAdmin()) return;
        items.push(item);
      });
      if (items.length > 0) return items;
    }

    // Last resort: minimal menu
    items.push(
      { icon: ADMIN_NAV_ITEMS[0].icon, label: 'Dashboard', href: '/dashboard', section: 'admin' },
      { icon: ADMIN_NAV_ITEMS[4].icon, label: 'Settings', href: '/settings', section: 'admin' },
    );
    return items;
  }, [role, accountType, canManageUsers, isAdmin, canViewDashboard, hasPermission]);

  // Keep the section that contains the current route expanded (only add, never remove, to avoid loop)
  useEffect(() => {
    if (!pathname || collapsed) return;
    const key = menuItems.find(
      (item) => item.href === pathname || item.children?.some((c) => pathname.startsWith(c.href))
    )?.href;
    if (key) {
      setExpandedKeys((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
  }, [pathname, collapsed, menuItems]);

  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname?.startsWith(href);
  };

  const handleCollapseToggle = useCallback(() => {
    const newCollapsed = !collapsed;
    onCollapsedChange(newCollapsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gemuraSidebarCollapsed', newCollapsed.toString());
    }
  }, [collapsed, onCollapsedChange]);

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      {/* Overlay for mobile - full viewport height to avoid gap at bottom */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden min-h-dvh"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50
          flex flex-col overflow-y-auto overflow-x-hidden
          transition-all duration-300 ease-in-out
          h-full min-h-dvh
          w-70 max-w-[85vw]
          lg:max-w-none
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'lg:w-20' : 'lg:w-64'}
          bg-[#052a54]
          border-r border-[#031a3a]
          text-white
        `}
      >
        {/* Logo Section */}
        <div className="p-4 sm:p-5 border-b border-[#031a3a] shrink-0 mb-2 sm:mb-4">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 min-h-11 ${collapsed ? 'flex-1 justify-center' : 'flex-1'}`}
              onClick={handleLinkClick}
            >
              <div className="relative shrink-0 bg-transparent flex items-center justify-center overflow-hidden rounded-full">
                <Image
                  src="/logo.png"
                  alt="Gemura"
                  width={collapsed ? 32 : 40}
                  height={collapsed ? 32 : 40}
                  className="object-contain"
                  priority
                />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-lg sm:text-xl font-semibold text-white leading-tight truncate">Gemura</span>
                  <span className="text-xs text-white/80 leading-tight hidden sm:block">Milk collection services platform</span>
                </div>
              )}
            </Link>
            {/* Collapse toggle: only on lg+ */}
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
                >
                  <Icon icon={faBars} size="sm" />
                </button>
              )}
            </span>
          </div>
        </div>

        {/* User block */}
        <div className={`shrink-0 flex flex-col items-center gap-3 sm:gap-4 mb-2 sm:mb-4 p-4 sm:p-6 ${collapsed ? 'lg:px-3' : ''}`}>
          <div
            className={`
              rounded-full flex items-center justify-center text-white
              bg-black/20 border-2 border-white/30
              transition-all duration-300 ease-in-out
              hover:bg-black/30 hover:border-white/50 active:scale-105
              w-14 h-14 sm:w-20 sm:h-20
              ${collapsed ? 'lg:w-12 lg:h-12' : 'lg:w-24 lg:h-24'}
            `}
          >
            <Icon icon={faUser} className="text-white" size={collapsed ? 'sm' : '2x'} />
          </div>
          {!collapsed && (
            <div className="text-center w-full min-w-0">
              <div className="text-sm font-semibold text-white mb-0.5 truncate">{userName}</div>
              {userEmail && (
                <div className="text-xs text-gray-300 truncate max-w-50 mx-auto">{userEmail}</div>
              )}
              <div className="text-xs text-white/80 font-medium uppercase tracking-wide mt-0.5">{userRole}</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-0 overflow-y-auto min-h-0">
          <ul className="list-none p-0 m-0 flex flex-col gap-0">
            {menuItems.map((item, index) => {
              const hasChildren = !collapsed && item.children && item.children.length > 0;
              const parentActive = isActive(item.href) || (item.children?.some((c) => isActive(c.href)) ?? false);
              const isExpanded = hasChildren && expandedKeys.has(item.href);
              const rowClass = `
                flex items-center gap-3 min-h-[44px] px-4 sm:px-5 md:px-7 py-3 sm:py-4 w-full text-left
                transition-all duration-200
                ${collapsed ? 'justify-center px-3' : ''}
                ${parentActive && !hasChildren
                  ? 'bg-[#031a3a] text-white border-l-4 border-white/30'
                  : parentActive && hasChildren
                    ? 'text-white border-l-4 border-white/30'
                    : 'text-gray-300 hover:bg-[#031a3a] hover:text-white active:bg-[#031a3a]'
                }
              `;
              return (
                <li key={index} className="my-0.5">
                  {hasChildren ? (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.href)}
                        className={rowClass}
                        title={collapsed ? item.label : undefined}
                        aria-expanded={isExpanded}
                      >
                        <Icon
                          icon={item.icon}
                          className={parentActive ? 'text-white' : 'text-gray-300'}
                          size="sm"
                        />
                        {!collapsed && (
                          <>
                            <span className="text-sm font-medium flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                              {item.label}
                            </span>
                            <Icon
                              icon={faChevronDown}
                              size="sm"
                              className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </>
                        )}
                      </button>
                      {isExpanded && (
                        <ul className="list-none pl-0 mt-0 mb-1">
                          {item.children!.map((child, childIndex) => {
                            const childActive = isActive(child.href);
                            return (
                              <li key={childIndex} className="my-0">
                                <Link
                                  href={child.href}
                                  onClick={handleLinkClick}
                                  className={`
                                    flex items-center gap-2 min-h-11 py-2.5 pl-10 sm:pl-12 pr-3 sm:pr-4 text-sm
                                    transition-all duration-200
                                    ${childActive
                                      ? 'bg-[#031a3a] text-white border-l-4 border-white/30 -ml-0.5 pl-13'
                                      : 'text-gray-400 hover:bg-[#031a3a] hover:text-white active:bg-[#031a3a]'
                                    }
                                  `}
                                >
                                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">{child.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href || '#'}
                      onClick={handleLinkClick}
                      className={rowClass}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        icon={item.icon}
                        className={parentActive ? 'text-white' : 'text-gray-300'}
                        size="sm"
                      />
                      {!collapsed && (
                        <span className="text-sm font-medium flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
