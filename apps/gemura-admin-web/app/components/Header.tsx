'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Icon, {
  faBars,
  faBuilding,
  faChevronDown,
  faCog,
  faRightFromBracket,
  faSearch,
  faSpinner,
  faUser,
} from './Icon';
import { useAuthStore } from '@/store/auth';
import { PermissionService } from '@/lib/services/permission.service';
import { getRoleLabel } from '@/lib/utils/role';

interface HeaderProps {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
}

export default function Header({ sidebarOpen: _sidebarOpen, sidebarCollapsed: _sidebarCollapsed, onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, currentAccount } = useAuthStore();

  const [userName, setUserName] = useState('User');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setUserName(`${user.firstName} ${user.lastName}`.trim() || 'User');
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    router.push('/auth/login');
  };

  const isOperator = PermissionService.isPlatformOperator();
  const profileHref = isOperator ? '/admin/operator' : user?.id ? `/admin/users/${user.id}` : '/admin/users';
  const settingsHref = isOperator ? '/admin/operator' : user?.id ? `/admin/users/${user.id}/edit` : '/admin/users';
  /** Platform operators see platform-wide data; hide single-MCC membership badge. */
  const hideAccountDisplay = isOperator || pathname?.startsWith('/admin/dashboard');
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 safe-area-inset">
      <div className="flex items-center min-h-[56px] sm:min-h-[64px] md:min-h-[72px] lg:h-20 px-3 sm:px-4 md:px-6 lg:px-8 gap-2 sm:gap-4">
        <button
          onClick={onMenuToggle}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 bg-gray-50 border border-gray-200 text-gray-900 cursor-pointer rounded-lg transition-all hover:bg-gray-100 hover:border-gray-300 hover:text-[var(--primary)] active:bg-gray-200 active:scale-95 lg:hidden"
          aria-label="Toggle sidebar"
          type="button"
        >
          <Icon icon={faBars} size="sm" />
        </button>

        <div className="flex-1 relative hidden sm:block max-w-[200px] md:max-w-[260px] lg:max-w-[320px] xl:max-w-[360px]">
          <div className="relative w-full">
            <div
              className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400 z-10 transition-colors ${
                searchLoading ? 'animate-spin text-[var(--primary)]' : ''
              }`}
            >
              <Icon icon={searchLoading ? faSpinner : faSearch} size="sm" />
            </div>
            <input
              type="text"
              placeholder="Search users, roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm"
            />
          </div>
        </div>

        <div className="flex-1" />

        {currentAccount && !hideAccountDisplay ? (
          <div className="flex items-center gap-2 min-w-0 max-w-[160px] sm:max-w-[220px] md:max-w-[260px] px-2.5 sm:px-3.5 py-2 min-h-[44px] rounded-lg sm:rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
              <Icon icon={faBuilding} size="sm" />
            </div>
            <div className="flex-1 min-w-0 text-left hidden sm:block">
              <p className="text-sm font-semibold text-gray-900 truncate">{currentAccount.account_name}</p>
              <p className="text-xs text-gray-500 truncate">
                {currentAccount.account_code} · {(currentAccount.account_type || '').toLowerCase()}
              </p>
            </div>
          </div>
        ) : null}

        {/* Right: user menu — pattern from gemura-web Header */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative flex items-center gap-3" ref={userMenuRef}>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-gray-900 m-0 leading-tight truncate max-w-[160px] md:max-w-[220px]">
                {userName}
              </p>
              <p className="text-xs text-gray-500 m-0 leading-tight capitalize">
                {currentAccount ? getRoleLabel(currentAccount.role) : '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(!userMenuOpen);
              }}
              className="flex items-center gap-2 min-w-[44px] min-h-[44px] p-2 bg-transparent border-none cursor-pointer rounded-lg transition-all hover:bg-gray-100 active:scale-95"
              aria-label="User menu"
              aria-expanded={userMenuOpen}
            >
              <div className="w-9 h-9 bg-[var(--primary)]/10 rounded-full flex items-center justify-center text-[var(--primary)] flex-shrink-0">
                <Icon icon={faUser} size="sm" />
              </div>
              <Icon
                icon={faChevronDown}
                className={`text-gray-600 transition-transform flex-shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`}
                size="sm"
              />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 min-w-[208px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl z-[1000] shadow-lg shadow-gray-200/50">
                <div className="py-1">
                  {user && (
                    <>
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-900 m-0 mb-1 truncate">{userName}</p>
                        <p className="text-xs text-gray-500 m-0 truncate">{user.email || 'No email'}</p>
                      </div>
                      <div className="h-px bg-gray-200 my-1" />
                    </>
                  )}
                  <Link
                    href={profileHref}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 w-full px-4 py-3 bg-transparent border-none text-left text-sm text-gray-700 cursor-pointer no-underline transition-colors hover:bg-gray-50"
                  >
                    <Icon icon={faUser} className="text-gray-500" size="sm" />
                    <span>Profile</span>
                  </Link>
                  <Link
                    href={settingsHref}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 w-full px-4 py-3 bg-transparent border-none text-left text-sm text-gray-700 cursor-pointer no-underline transition-colors hover:bg-gray-50"
                  >
                    <Icon icon={faCog} className="text-gray-500" size="sm" />
                    <span>Settings</span>
                  </Link>
                  <div className="h-px bg-gray-200 my-1" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 bg-transparent border-none text-left text-sm text-red-600 cursor-pointer transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Icon icon={faRightFromBracket} className="text-gray-500" size="sm" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
