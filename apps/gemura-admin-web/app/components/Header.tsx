'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon, { faBars, faRightFromBracket, faUser, faSearch, faSpinner } from './Icon';
import { useAuthStore } from '@/store/auth';

interface HeaderProps {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
}

export default function Header({ sidebarOpen, sidebarCollapsed, onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { user, logout, currentAccount } = useAuthStore();

  const [userName, setUserName] = useState('User');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setUserName(`${user.firstName} ${user.lastName}`.trim() || 'User');
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

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

        {/* Search Input (matches gemura-web header) */}
        <div
          className="flex-1 relative hidden sm:block max-w-[200px] md:max-w-[260px] lg:max-w-[320px] xl:max-w-[360px]"
          ref={searchRef}
        >
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

        {/* Spacer */}
        <div className="flex-1" />

        <div className="flex items-center min-w-0 gap-3">
          {/* Account info */}
          <div className="hidden md:flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center text-[var(--primary)]">
              <Icon icon={faUser} size="sm" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 m-0 leading-tight truncate">{userName}</p>
              <p className="text-xs text-gray-500 m-0 capitalize leading-tight truncate">
                {currentAccount?.role ? String(currentAccount.role).toLowerCase() : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Logout */}

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 bg-transparent border-none cursor-pointer rounded-lg transition-all hover:bg-gray-100 active:scale-95"
            aria-label="Logout"
          >
            <Icon icon={faRightFromBracket} size="sm" />
          </button>
        </div>
      </div>
    </header>
  );
}

