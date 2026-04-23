'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import Icon, { faBars, faChevronRight, faChevronDown, faUser } from './Icon';
import type { NavItem, NavItemChild, NavGroup } from '@/lib/config/nav.config';
import {
  ADMIN_NAV_ITEMS,
  OPERATIONS_NAV_GROUPS,
  EXTERNAL_SUPPLIER_NAV_ITEMS,
  EXTERNAL_CUSTOMER_NAV_ITEMS,
  isAdminAccount,
  isBusinessAccount,
  isAdminRole,
  isOperationsRole,
  isExternalSupplier,
  isExternalCustomer,
} from '@/lib/config/nav.config';
import { useFarmCapabilities } from '@/hooks/useFarmCapabilities';

interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
}

/** Collect all hrefs from an item (for active/expand detection): item + children + nested children */
function allHrefs(item: NavItem): string[] {
  const out: string[] = [item.href];
  item.children?.forEach((c) => {
    out.push(c.href);
    c.children?.forEach((cc) => out.push(cc.href));
  });
  return out;
}

export default function Sidebar({ isOpen, collapsed, onClose, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const { user, currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin, hasPermission } = usePermission();
  const caps = useFarmCapabilities();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('User');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [expandedChildKeys, setExpandedChildKeys] = useState<Set<string>>(() => new Set());

  const role = currentAccount?.role ?? '';
  const accountType = currentAccount?.account_type ?? '';

  useEffect(() => {
    if (user) {
      setUserName(`${user.firstName} ${user.lastName}`);
      setUserEmail(user.email);
      setUserRole(currentAccount?.role || 'User');
    }
  }, [user, currentAccount]);

  const menuGroups = useMemo<NavGroup[] | null>(() => {
    if (isAdminAccount(accountType)) return null;
    if (
      (isOperationsRole(role) || isAdminRole(role) || isBusinessAccount(accountType)) &&
      isBusinessAccount(accountType)
    ) {
      return OPERATIONS_NAV_GROUPS.map((group) => ({
        groupLabel: group.groupLabel,
        items: group.items.filter((item) => {
          if (item.farmGate === 'milk' && !caps.milk) return false;
          if (item.farmGate === 'poultry' && !caps.poultry) return false;
          if (item.farmGate === 'pigs' && !caps.pigs) return false;
          return !item.requiresPermission || hasPermission(item.requiresPermission) || isAdmin();
        }),
      })).filter((g) => g.items.length > 0);
    }
    return null;
  }, [role, accountType, hasPermission, isAdmin, caps.milk, caps.poultry, caps.pigs]);

  const menuItems = useMemo<NavItem[]>(() => {
    if (menuGroups !== null) return [];
    if (isAdminAccount(accountType)) {
      return ADMIN_NAV_ITEMS.filter(
        (item) => item.href !== '/admin/users' || canManageUsers() || isAdmin()
      );
    }
    if (isExternalSupplier(accountType)) return EXTERNAL_SUPPLIER_NAV_ITEMS;
    if (isExternalCustomer(accountType)) return EXTERNAL_CUSTOMER_NAV_ITEMS;
    return [
      { icon: ADMIN_NAV_ITEMS[0].icon, label: 'Dashboard', href: '/dashboard', section: 'admin' },
      { icon: ADMIN_NAV_ITEMS[4].icon, label: 'Settings', href: '/settings', section: 'admin' },
    ];
  }, [accountType, canManageUsers, isAdmin, menuGroups]);

  useEffect(() => {
    if (!pathname || collapsed) return;
    if (menuGroups) {
      for (const group of menuGroups) {
        for (const item of group.items) {
          const hrefs = allHrefs(item);
          if (hrefs.some((h) => pathname.startsWith(h))) {
            setExpandedKeys((prev) => {
              if (prev.has(item.href)) return prev;
              const next = new Set(prev);
              next.add(item.href);
              return next;
            });
            item.children?.forEach((c) => {
              if (pathname.startsWith(c.href) || c.children?.some((cc) => pathname.startsWith(cc.href))) {
                setExpandedChildKeys((prev) => {
                  const key = `${item.href}::${c.href}`;
                  if (prev.has(key)) return prev;
                  const next = new Set(prev);
                  next.add(key);
                  return next;
                });
              }
            });
          }
        }
      }
    } else {
      const key = menuItems.find(
        (item) =>
          item.href === pathname ||
          item.children?.some((c) => pathname.startsWith(c.href))
      )?.href;
      if (key) {
        setExpandedKeys((prev) => {
          if (prev.has(key)) return prev;
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      }
    }
  }, [pathname, collapsed, menuGroups, menuItems]);

  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname?.startsWith(href);
  };

  const handleCollapseToggle = useCallback(() => {
    const newCollapsed = !collapsed;
    onCollapsedChange(newCollapsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ororaSidebarCollapsed', newCollapsed.toString());
    }
  }, [collapsed, onCollapsedChange]);

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) onClose();
  };

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleChildExpanded = (key: string) => {
    setExpandedChildKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const linkClass = (active: boolean, indent: 'base' | 'child' | 'grandchild') => {
    const pl = indent === 'base' ? 'pl-10 sm:pl-12' : indent === 'child' ? 'pl-10 sm:pl-12' : 'pl-12 sm:pl-14';
    return `
      flex items-center gap-2 min-h-[44px] py-2.5 ${pl} pr-3 sm:pr-4 text-sm
      transition-all duration-200
      ${active ? 'bg-[#0f1f0f] text-white border-l-4 border-white/30 -ml-0.5' : 'text-gray-400 hover:bg-[#0f1f0f] hover:text-white active:bg-[#0f1f0f]'}
    `;
  };

  const renderChild = (child: NavItemChild, parentHref: string) => {
    const hasGrandchildren = !collapsed && child.children && child.children.length > 0;
    const childKey = `${parentHref}::${child.href}`;
    const isChildExpanded = hasGrandchildren && expandedChildKeys.has(childKey);
    const active = isActive(child.href) || (child.children?.some((cc) => isActive(cc.href)) ?? false);

    if (hasGrandchildren) {
      return (
        <li key={child.href} className="my-0">
          <button
            type="button"
            onClick={() => toggleChildExpanded(childKey)}
            className={`w-full text-left ${linkClass(active, 'child')}`}
            aria-expanded={isChildExpanded}
          >
            <span className="whitespace-nowrap overflow-hidden text-ellipsis flex-1">{child.label}</span>
            {child.comingSoon && (
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/60 bg-white/10 px-1.5 py-0.5 rounded">
                Soon
              </span>
            )}
            <Icon
              icon={faChevronDown}
              size="xs"
              className={`text-gray-400 transition-transform duration-200 ${isChildExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          {isChildExpanded && (
            <ul className="list-none pl-0 mt-0 mb-1">
              {child.children!.map((grandchild) => {
                const grandActive = isActive(grandchild.href);
                return (
                  <li key={grandchild.href} className="my-0">
                    <Link
                      href={grandchild.href}
                      onClick={handleLinkClick}
                      className={linkClass(grandActive, 'grandchild')}
                    >
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis">{grandchild.label}</span>
                      {grandchild.comingSoon && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/60 bg-white/10 px-1.5 py-0.5 rounded">
                          Soon
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      );
    }

    return (
      <li key={child.href} className="my-0">
        <Link href={child.href} onClick={handleLinkClick} className={linkClass(isActive(child.href), 'child')}>
          <span className="whitespace-nowrap overflow-hidden text-ellipsis">{child.label}</span>
          {child.comingSoon && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/60 bg-white/10 px-1.5 py-0.5 rounded">
              Soon
            </span>
          )}
        </Link>
      </li>
    );
  };

  const renderItem = (item: NavItem, index: number) => {
    const hasChildren = !collapsed && item.children && item.children.length > 0;
    const hrefs = allHrefs(item);
    const parentActive = hrefs.some((h) => pathname?.startsWith(h));
    const isExpanded = hasChildren && expandedKeys.has(item.href);
    const rowClass = `
      flex items-center gap-3 min-h-[44px] px-4 sm:px-5 md:px-7 py-3 sm:py-4 w-full text-left
      transition-all duration-200
      ${collapsed ? 'justify-center px-3' : ''}
      ${parentActive && !hasChildren
        ? 'bg-[#0f1f0f] text-white border-l-4 border-white/30'
        : parentActive && hasChildren
          ? 'text-white border-l-4 border-white/30'
          : 'text-gray-300 hover:bg-[#0f1f0f] hover:text-white active:bg-[#0f1f0f]'}
    `;

    return (
      <li key={`${item.href}-${index}`} className="my-0.5">
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
                  {item.comingSoon && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/60 bg-white/10 px-1.5 py-0.5 rounded">
                      Soon
                    </span>
                  )}
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
                {item.children!.map((child) => renderChild(child, item.href))}
              </ul>
            )}
          </>
        ) : (
          <Link
            href={item.comingSoon ? item.href : item.href || '#'}
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
              <>
                <span className="text-sm font-medium flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  {item.label}
                </span>
                {item.comingSoon && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/60 bg-white/10 px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                )}
              </>
            )}
          </Link>
        )}
      </li>
    );
  };

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
          bg-[#1a2e1a]
          border-r border-[#0f1f0f]
          text-white
        `}
      >
        <div className="p-4 sm:p-5 border-b border-[#0f1f0f] flex-shrink-0 mb-2 sm:mb-4">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 min-h-[44px] ${collapsed ? 'flex-1 justify-center' : 'flex-1'}`}
              onClick={handleLinkClick}
            >
              <div
                className={`relative flex-shrink-0 flex items-center justify-center rounded-lg ${collapsed ? 'w-8 h-8' : 'w-10 h-10'} bg-[#84BD22]`}
              >
                <span className={`font-bold text-white ${collapsed ? 'text-sm' : 'text-lg'}`}>O</span>
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-lg sm:text-xl font-semibold text-white leading-tight truncate">Orora</span>
                  <span className="text-xs text-white/80 leading-tight hidden sm:block">Cattle Farming Platform</span>
                </div>
              )}
            </Link>
            {/* Collapse toggle: only on lg+ when sidebar is visible (not overlay) */}
            <span className="hidden lg:inline-flex">
              {collapsed ? (
                <button
                  type="button"
                  onClick={handleCollapseToggle}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[#0f1f0f] rounded-sm transition-colors text-gray-300 hover:text-white"
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                >
                  <Icon icon={faChevronRight} size="sm" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCollapseToggle}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[#0f1f0f] rounded-sm transition-colors text-gray-300 hover:text-white"
                  aria-label="Collapse sidebar"
                >
                  <Icon icon={faBars} size="sm" />
                </button>
              )}
            </span>
          </div>
        </div>

        <div className={`flex-shrink-0 flex flex-col items-center gap-3 sm:gap-4 mb-2 sm:mb-4 p-4 sm:p-6 ${collapsed ? 'lg:px-3' : ''}`}>
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
                <div className="text-xs text-gray-300 truncate max-w-[200px] mx-auto">{userEmail}</div>
              )}
              <div className="text-xs text-white/80 font-medium uppercase tracking-wide mt-0.5">{userRole}</div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-0 overflow-y-auto min-h-0">
          <ul className="list-none p-0 m-0 flex flex-col gap-0">
            {menuGroups ? (
              menuGroups.map((group) => (
                <li key={group.groupLabel} className="mt-2 first:mt-0">
                  {!collapsed && (
                    <div className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                      {group.groupLabel}
                    </div>
                  )}
                  <ul className="list-none p-0 m-0 flex flex-col gap-0">
                    {group.items.map((item, idx) => renderItem(item, idx))}
                  </ul>
                </li>
              ))
            ) : (
              menuItems.map((item, index) => renderItem(item, index))
            )}
          </ul>
        </nav>
      </aside>
    </>
  );
}
