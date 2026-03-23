'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import Icon, { faChevronRight, faBars, faUsers, faUserShield, faLock, faWarehouse, faBuilding, faChartLine, faUser } from './Icon';
import type { CSSProperties } from 'react';

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

  useEffect(() => {
    if (!user) return;
    setUserName(`${user.firstName} ${user.lastName}`.trim() || 'User');
    setUserEmail(user.email || '');
    setUserRole(currentAccount?.role || 'User');
  }, [user, currentAccount]);

  const menuItems = useMemo(() => {
    const items: Array<{ href: string; label: string; icon: any; requireManageUsers?: boolean }> = [];

    if (canViewDashboard() || isAdmin()) {
      items.push({ href: '/admin/dashboard', label: 'Dashboard', icon: faChartLine });
    }

    if (canManageUsers() || isAdmin()) {
      items.push({ href: '/admin/users', label: 'Users', icon: faUsers, requireManageUsers: true });
      items.push({ href: '/admin/roles', label: 'Roles', icon: faUserShield, requireManageUsers: true });
      items.push({ href: '/admin/permissions', label: 'Permissions', icon: faLock, requireManageUsers: true });
      items.push({ href: '/admin/immis', label: 'IMMIS', icon: faUsers, requireManageUsers: true });
    }

    // Farms & accounts are token-guarded; keep visible for quick switching.
    items.push({ href: '/admin/farms', label: 'Farms', icon: faWarehouse });
    items.push({ href: '/admin/accounts', label: 'Accounts', icon: faBuilding });

    return items;
  }, [canManageUsers, isAdmin, canViewDashboard]);

  const isActive = (href: string) => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(href + '/');
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
            <Link href="/admin/dashboard" className={`flex items-center gap-3 min-h-[44px] ${collapsed ? 'justify-center w-full' : 'w-auto'}`} onClick={handleLinkClick}>
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

        {/* User block */}
        <div className={`flex-shrink-0 flex flex-col items-center gap-3 p-4 sm:p-6 ${collapsed ? 'lg:px-3' : ''} mb-2 sm:mb-4`}>
          <div className="rounded-full flex items-center justify-center text-white bg-black/20 border-2 border-white/30 hover:bg-black/30 hover:border-white/50 active:scale-105 w-14 h-14 sm:w-20 sm:h-20 transition-all duration-300 ease-in-out">
            <Icon icon={faUser} className="text-white" size={collapsed ? 'sm' : '2x'} />
          </div>
          {!collapsed && (
            <div className="text-center w-full min-w-0">
              <div className="text-sm font-semibold text-white mb-0.5 truncate">{userName}</div>
              {userEmail && <div className="text-xs text-gray-300 truncate max-w-[200px] mx-auto">{userEmail}</div>}
              <div className="text-xs text-white/80 font-medium uppercase tracking-wide mt-0.5">{userRole}</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-0 overflow-y-auto min-h-0">
          <ul className="list-none p-0 m-0 flex flex-col gap-0">
            {menuItems.map((item) => {
              const active = isActive(item.href);
              const rowClass = `
                flex items-center gap-3 min-h-[44px] px-4 py-3 sm:px-5 md:px-7 w-full text-left
                transition-all duration-200
                ${collapsed ? 'justify-center px-3' : ''}
                ${
                  active
                    ? 'bg-[#031a3a] text-white border-l-4 border-white/30'
                    : 'text-gray-300 hover:bg-[#031a3a] hover:text-white active:bg-[#031a3a]'
                }
              `;

              return (
                <li key={item.href} className="my-0.5">
                  <Link href={item.href} onClick={handleLinkClick} className={rowClass} title={collapsed ? item.label : undefined}>
                    <Icon icon={item.icon} className={active ? 'text-white' : 'text-gray-300'} size="sm" />
                    {!collapsed && <span className="text-sm font-medium flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>}
                    {/* spacer to keep alignment */}
                    {!collapsed && <span className="w-3" aria-hidden="true" />}
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

