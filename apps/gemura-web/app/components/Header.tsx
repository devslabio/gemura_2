'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { getRoleLabel } from '@/lib/utils/role';
import { accountsApi } from '@/lib/api/accounts';
import { useToastStore } from '@/store/toast';
import { supervisorApi, type SupervisorScope } from '@/lib/api/supervisor';
import Icon, {
  faBars,
  faSearch,
  faBell,
  faUser,
  faCog,
  faRightFromBracket,
  faChevronDown,
  faSpinner,
  faBuilding,
  faCheck,
} from './Icon';

/** Set true to show the header account dropdown again. */
const SHOW_ACCOUNT_SWITCHER = false;

interface HeaderProps {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
  onSidebarToggle?: () => void;
}

export default function Header({
  sidebarOpen,
  sidebarCollapsed,
  onMenuToggle,
  onSidebarToggle,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout, accounts, currentAccount, setCurrentAccount, setAccounts } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [userName, setUserName] = useState('User');
  const [regionOpen, setRegionOpen] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const accountSwitcherRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const districtRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      setUserName(`${user.firstName} ${user.lastName}`);
    }
  }, [user]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
      if (accountSwitcherRef.current && !accountSwitcherRef.current.contains(event.target as Node)) {
        setAccountSwitcherOpen(false);
      }
      if (regionRef.current && !regionRef.current.contains(event.target as Node)) {
        setRegionOpen(false);
      }
      if (districtRef.current && !districtRef.current.contains(event.target as Node)) {
        setDistrictOpen(false);
      }
    };

    if (userMenuOpen || notificationsOpen || searchOpen || accountSwitcherOpen || regionOpen || districtOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen, notificationsOpen, searchOpen, accountSwitcherOpen, regionOpen, districtOpen]);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const handleSwitchAccount = async (accountId: string) => {
    if (currentAccount?.account_id === accountId) {
      setAccountSwitcherOpen(false);
      return;
    }
    setSwitchingAccountId(accountId);
    try {
      const res = await accountsApi.switchAccount({ account_id: accountId });
      if (res.code === 200 && res.data) {
        const { accounts: nextAccounts } = res.data;
        const nextAccount = nextAccounts.find((a) => a.account_id === accountId) || null;
        setAccounts(nextAccounts);
        setCurrentAccount(nextAccount);
        setAccountSwitcherOpen(false);
        useToastStore.getState().success('Default account updated');
      } else {
        useToastStore.getState().error(res.message || 'Failed to switch account');
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
        (e as Error)?.message ??
        'Failed to switch account';
      useToastStore.getState().error(msg);
    } finally {
      setSwitchingAccountId(null);
    }
  };

  // Mock notifications
  const notifications: any[] = [];
  const unreadCount = 0;

  const regionalSupervisorRole =
    (currentAccount?.role || '').trim().toLowerCase().replace(/\s+/g, '_') === 'regional_supervisor';

  /** Province/district scope for supervisors on oversight routes (matches trimmed regional sidebar). */
  const SUPERVISOR_SCOPED_APP_PREFIXES = [
    '/dashboard',
    '/suppliers',
    '/members',
    '/operations',
    '/sales',
    '/collections',
    '/transfers',
  ] as const;

  const showSupervisorGeoFilters =
    regionalSupervisorRole &&
    !!pathname &&
    SUPERVISOR_SCOPED_APP_PREFIXES.some((p) => pathname.startsWith(p));

  const [scope, setScope] = useState<SupervisorScope | null>(null);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState('');
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>(''); // province location id
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(''); // district location id

  const provinces = scope?.provinces ?? [];
  const allDistricts = scope?.districts ?? [];
  const singleProvince = provinces.length === 1 ? provinces[0] : null;
  const effectiveProvinceId = singleProvince?.id ?? selectedProvinceId;

  const districts = useMemo(() => {
    if (!effectiveProvinceId) return [];
    return allDistricts.filter((d) => d.province_id === effectiveProvinceId);
  }, [allDistricts, effectiveProvinceId]);

  const selectedProvinceLabel = useMemo(() => {
    if (singleProvince) return singleProvince.name;
    if (!selectedProvinceId) return scopeLoading ? '' : 'Province';
    return provinces.find((p) => p.id === selectedProvinceId)?.name ?? 'Province';
  }, [provinces, selectedProvinceId, singleProvince, scopeLoading]);

  const selectedDistrictLabel = useMemo(() => {
    if (!selectedDistrictId) return 'All districts';
    return allDistricts.find((d) => d.id === selectedDistrictId)?.name ?? 'All districts';
  }, [allDistricts, selectedDistrictId]);

  const setGeoQuery = useCallback(
    (next: { region_id?: string; district_id?: string }) => {
      const p = new URLSearchParams(searchParams?.toString() || '');
      if (typeof next.region_id === 'string' && next.region_id.length > 0) p.set('region_id', next.region_id);
      else p.delete('region_id');
      if (typeof next.district_id === 'string' && next.district_id.length > 0) p.set('district_id', next.district_id);
      else p.delete('district_id');
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const closeGeoMenus = () => {
    setRegionOpen(false);
    setDistrictOpen(false);
  };

  useEffect(() => {
    if (!showSupervisorGeoFilters) return;
    let cancelled = false;
    setScopeLoading(true);
    setScopeError('');
    const accountId = currentAccount?.account_id?.trim();
    supervisorApi
      .getScope(accountId ? { account_id: accountId } : undefined)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setScope(res.data);
        else setScope(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
          (e as Error)?.message ??
          'Failed to load scope';
        setScopeError(msg);
        setScope(null);
      })
      .finally(() => {
        if (!cancelled) setScopeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showSupervisorGeoFilters, currentAccount?.account_id]);

  useEffect(() => {
    if (!showSupervisorGeoFilters || !scope) return;
    const plist = scope.provinces;
    const dlist = scope.districts;
    const regionFromUrl = searchParams?.get('region_id')?.trim() ?? '';
    const districtFromUrl = searchParams?.get('district_id')?.trim() ?? '';
    const provinceIdsOk = new Set(plist.map((p) => p.id));
    const districtById = new Map(dlist.map((d) => [d.id, d]));

    if (plist.length === 0) {
      setSelectedProvinceId('');
      setSelectedDistrictId('');
      return;
    }

    if (plist.length === 1) {
      const pid = plist[0].id;
      setSelectedProvinceId(pid);
      const dRow = districtFromUrl ? districtById.get(districtFromUrl) : undefined;
      const districtOk = !!(dRow && dRow.province_id === pid);
      const nextDistrict = districtOk ? districtFromUrl : '';
      setSelectedDistrictId(nextDistrict);

      const urlBroken = regionFromUrl !== pid || (districtFromUrl.length > 0 && !districtOk);
      if (urlBroken)
        setGeoQuery({ region_id: pid, district_id: nextDistrict || undefined });
      return;
    }

    // Multiple provinces in scope (legacy/admin): pick one province — never show "all regions" districts mixed.
    const regionOk = regionFromUrl.length > 0 && provinceIdsOk.has(regionFromUrl);
    const chosenPid = regionOk ? regionFromUrl : plist[0].id;
    setSelectedProvinceId(chosenPid);

    const dRow2 = districtFromUrl ? districtById.get(districtFromUrl) : undefined;
    const districtOk2 = !!(dRow2 && dRow2.province_id === chosenPid);
    const nextDistrict2 = districtOk2 ? districtFromUrl : '';
    setSelectedDistrictId(nextDistrict2);

    const urlBroken2 =
      !regionOk || (districtFromUrl.length > 0 && !districtOk2) || regionFromUrl !== chosenPid;
    if (urlBroken2) setGeoQuery({ region_id: chosenPid, district_id: nextDistrict2 || undefined });
  }, [showSupervisorGeoFilters, scope, searchParams, setGeoQuery]);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 safe-area-inset">
      <div className="flex items-center min-h-[56px] sm:min-h-[64px] md:min-h-[72px] lg:h-20 px-3 sm:px-4 md:px-6 lg:px-8 gap-2 sm:gap-4">
        {/* Sidebar Toggle - touch target 44px */}
        <button
          onClick={onMenuToggle}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 bg-gray-50 border border-gray-200 text-gray-900 cursor-pointer rounded-lg transition-all mr-1 sm:mr-3 flex-shrink-0 hover:bg-gray-100 hover:border-gray-300 hover:text-[var(--primary)] active:bg-gray-200 active:scale-95 lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Icon icon={faBars} size="sm" />
        </button>

        {/* Search Input */}
        <div className="flex-1 relative hidden sm:block max-w-[200px] md:max-w-[260px] lg:max-w-[320px] xl:max-w-[360px]" ref={searchRef}>
          <div className="relative w-full">
            <div className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400 z-10 transition-colors ${searchLoading ? 'animate-spin text-[var(--primary)]' : ''}`}>
              <Icon icon={searchLoading ? faSpinner : faSearch} size="sm" />
            </div>
            <input
              type="text"
              placeholder="Search sales, collections, suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => {
                if (searchTerm.trim()) {
                  setSearchOpen(true);
                }
              }}
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm"
            />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1"></div>

        {showSupervisorGeoFilters && (
          <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
            {singleProvince ? (
              <div
                className="flex items-center min-w-0 max-w-[220px] px-3 py-2 min-h-[44px] rounded-lg bg-gray-50 border border-gray-200"
                title="Your supervision is scoped to this province"
              >
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {scopeLoading ? 'Loading…' : selectedProvinceLabel}
                </span>
              </div>
            ) : (
              <div className="relative" ref={regionRef}>
                <button
                  type="button"
                  onClick={() => {
                    setRegionOpen((v) => !v);
                    setDistrictOpen(false);
                    setUserMenuOpen(false);
                    setNotificationsOpen(false);
                    setAccountSwitcherOpen(false);
                  }}
                  className="flex items-center gap-2 min-w-0 max-w-[220px] px-3 py-2 min-h-[44px] rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-colors"
                  aria-label="Province"
                  aria-expanded={regionOpen}
                >
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {scopeLoading ? 'Loading…' : selectedProvinceLabel || 'Province'}
                  </span>
                  <Icon
                    icon={faChevronDown}
                    className={`text-gray-400 transition-transform ${regionOpen ? 'rotate-180' : ''}`}
                    size="sm"
                  />
                </button>
                {regionOpen && provinces.length > 1 ? (
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-lg shadow-gray-200/50 py-1 z-[1000]">
                    {provinces.map((opt) => {
                      const active = opt.id === selectedProvinceId;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedProvinceId(opt.id);
                            setSelectedDistrictId('');
                            setGeoQuery({ region_id: opt.id, district_id: '' });
                            closeGeoMenus();
                          }}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm rounded-lg mx-1 transition-colors ${
                            active ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="truncate font-medium">{opt.name}</span>
                          {active ? <Icon icon={faCheck} className="text-[var(--primary)] shrink-0" size="sm" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            <div className="relative" ref={districtRef}>
              <button
                type="button"
                onClick={() => {
                  setDistrictOpen((v) => !v);
                  setRegionOpen(false);
                  setUserMenuOpen(false);
                  setNotificationsOpen(false);
                  setAccountSwitcherOpen(false);
                }}
                className="flex items-center gap-2 min-w-0 max-w-[220px] px-3 py-2 min-h-[44px] rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-colors"
                aria-label="District"
                aria-expanded={districtOpen}
              >
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {scopeLoading ? 'Loading…' : selectedDistrictLabel}
                </span>
                <Icon
                  icon={faChevronDown}
                  className={`text-gray-400 transition-transform ${districtOpen ? 'rotate-180' : ''}`}
                  size="sm"
                />
              </button>
              {districtOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-lg shadow-gray-200/50 py-1 z-[1000]">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">District</p>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDistrictId('');
                        setGeoQuery({
                          region_id: effectiveProvinceId || selectedProvinceId,
                          district_id: '',
                        });
                        closeGeoMenus();
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm rounded-lg mx-1 transition-colors ${
                        !selectedDistrictId ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="truncate font-medium">All districts</span>
                      {!selectedDistrictId ? <Icon icon={faCheck} className="text-[var(--primary)] shrink-0" size="sm" /> : null}
                    </button>
                    {districts.map((opt) => {
                      const active = opt.id === selectedDistrictId;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedDistrictId(opt.id);
                            setGeoQuery({
                              region_id: effectiveProvinceId || selectedProvinceId,
                              district_id: opt.id,
                            });
                            closeGeoMenus();
                          }}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm rounded-lg mx-1 transition-colors ${
                            active ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="truncate font-medium">{opt.name}</span>
                          {active ? <Icon icon={faCheck} className="text-[var(--primary)] shrink-0" size="sm" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Account Switcher (hidden until product-ready) */}
        {SHOW_ACCOUNT_SWITCHER && accounts.length > 0 && (
          <div className="relative flex-shrink-0 min-w-0" ref={accountSwitcherRef}>
            <button
              type="button"
              onClick={() => {
                setAccountSwitcherOpen(!accountSwitcherOpen);
                setUserMenuOpen(false);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 min-w-0 max-w-[160px] sm:max-w-[220px] md:max-w-[260px] px-2.5 sm:px-3.5 py-2 min-h-[44px] rounded-lg sm:rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all duration-200 group"
              aria-label="Switch account"
              aria-expanded={accountSwitcherOpen}
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                <Icon icon={faBuilding} size="sm" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {currentAccount?.account_name || 'Select account'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {currentAccount
                    ? `${currentAccount.account_code} · ${(currentAccount.account_type || '').toLowerCase()}`
                    : ''}
                </p>
              </div>
              <Icon
                icon={faChevronDown}
                className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${accountSwitcherOpen ? 'rotate-180' : ''}`}
                size="sm"
              />
            </button>

            {accountSwitcherOpen && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-72 sm:max-w-none sm:w-80 bg-white rounded-xl border border-gray-200 shadow-lg shadow-gray-200/50 py-2 z-[1000]">
                <div className="px-3 pb-2 mb-2 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Switch account</p>
                </div>
                <ul className="max-h-[280px] overflow-y-auto">
                  {accounts.map((account) => {
                    const isActive = currentAccount?.account_id === account.account_id;
                    const isSwitching = switchingAccountId === account.account_id;
                    return (
                      <li key={account.account_id}>
                        <button
                          type="button"
                          onClick={() => handleSwitchAccount(account.account_id)}
                          disabled={!!switchingAccountId}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors rounded-lg mx-2 ${
                            isActive
                              ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                              : 'hover:bg-gray-50 text-gray-700'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          <div
                            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                              isActive ? 'bg-[var(--primary)]/20' : 'bg-gray-100'
                            }`}
                          >
                            {isSwitching ? (
                              <Icon icon={faSpinner} size="sm" className="animate-spin text-[var(--primary)]" />
                            ) : (
                              <Icon icon={faBuilding} size="sm" className={isActive ? 'text-[var(--primary)]' : 'text-gray-500'} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${isActive ? 'text-[var(--primary)]' : 'text-gray-900'}`}>
                              {account.account_name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {account.account_code} · {(account.account_type || '').toLowerCase()}
                            </p>
                          </div>
                          {isActive && !isSwitching && (
                            <Icon icon={faCheck} className="flex-shrink-0 text-[var(--primary)]" size="sm" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setUserMenuOpen(false);
              }}
              className="relative flex items-center justify-center min-w-[44px] min-h-[44px] p-2 bg-transparent border-none text-gray-700 cursor-pointer rounded-lg transition-all hover:bg-gray-100 active:scale-95"
              aria-label="Notifications"
            >
              <Icon icon={faBell} size="sm" />
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white pointer-events-none z-10"></span>
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white rounded-full text-[10px] font-semibold flex items-center justify-center border-2 border-white pointer-events-none z-10">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </>
              )}
            </button>

            {/* Notifications Dropdown */}
            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-80 sm:w-80 bg-white border border-gray-200 rounded-xl sm:rounded z-[1000] max-h-[70vh] sm:max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 m-0">Notifications</h3>
                  <Link
                    href="/dashboard"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-sm text-[var(--primary)] hover:text-[#003d8f] no-underline"
                  >
                    View All
                  </Link>
                </div>
                <div className="py-2 max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-sm text-gray-500 m-0">No notifications</p>
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer transition-colors ${
                          !notification.read ? 'bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center`}>
                          <Icon icon={faBell} className="text-gray-600" size="sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'} m-0 mb-1`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 m-0">{notification.time}</p>
                        </div>
                        {!notification.read && (
                          <div className="w-1 h-1 bg-[var(--primary)] rounded-full flex-shrink-0 mt-2"></div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative flex items-center gap-3" ref={userMenuRef}>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-gray-900 m-0 leading-tight">{userName}</p>
              <p className="text-xs text-gray-500 m-0 leading-tight capitalize">
                {currentAccount ? getRoleLabel(currentAccount.role, currentAccount.account_type) : '—'}
              </p>
            </div>
            <button
              onClick={() => {
                setUserMenuOpen(!userMenuOpen);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 min-w-[44px] min-h-[44px] p-2 bg-transparent border-none cursor-pointer rounded-lg transition-all hover:bg-gray-100 active:scale-95"
              aria-label="User menu"
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

            {/* User Dropdown */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 min-w-[200px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl sm:rounded z-[1000] shadow-lg">
                <div className="py-1">
                  {user && (
                    <>
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-900 m-0 mb-1">{userName}</p>
                        <p className="text-xs text-gray-500 m-0">{user.email || 'No email'}</p>
                      </div>
                      <div className="h-px bg-gray-200 my-1"></div>
                    </>
                  )}
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 w-full px-4 py-3 bg-transparent border-none text-left text-sm text-gray-700 cursor-pointer no-underline transition-colors hover:bg-gray-50"
                  >
                    <Icon icon={faUser} className="text-gray-500" size="sm" />
                    <span>Profile &amp; Settings</span>
                  </Link>
                  <div className="h-px bg-gray-200 my-1"></div>
                  <button
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
