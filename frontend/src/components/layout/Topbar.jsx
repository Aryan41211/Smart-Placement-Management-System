import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Settings, UserCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { notificationApi } from '../../api/endpoints.js';
import { initials } from '../../utils/format.js';
import { breadcrumbsFor, titleForPath } from '../../config/navigation.js';

/**
 * Application top bar: page context, notifications and the account menu.
 *
 * @param {object} props component props
 */
export default function Topbar({ onMenuClick }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const title = titleForPath(location.pathname);
  const crumbs = breadcrumbsFor(location.pathname);

  async function refreshUnread() {
    try {
      const result = await notificationApi.unreadCount();
      setUnread(result?.unread ?? 0);
    } catch {
      setUnread(0);
    }
  }

  useEffect(() => {
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 60000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--app-border)] bg-white/85 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="-ml-1 rounded-lg p-2 text-navy-500 transition hover:bg-navy-100 hover:text-navy-800 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            {crumbs.length > 1 && (
              <p className="hidden truncate text-2xs font-medium uppercase tracking-[0.1em] text-navy-400 sm:block">
                {crumbs.slice(0, -1).join(' / ')}
              </p>
            )}
            <h1 className="truncate text-[0.9375rem] font-semibold leading-tight text-navy-900">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/notifications"
            className="relative rounded-lg p-2 text-navy-500 transition hover:bg-navy-100 hover:text-navy-800"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
          >
            <Bell className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[0.625rem] font-semibold text-white ring-2 ring-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>

          <div className="mx-1 hidden h-6 w-px bg-navy-200 sm:block" aria-hidden="true" />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-navy-100"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white">
                {initials(user?.full_name)}
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-[9rem] truncate text-[0.8125rem] font-medium leading-tight text-navy-800">
                  {user?.full_name}
                </span>
                <span className="block text-2xs capitalize leading-tight text-navy-400">{role}</span>
              </span>
              <ChevronDown
                className={`hidden h-3.5 w-3.5 text-navy-400 transition-transform duration-200 sm:block ${
                  menuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 animate-scale-in overflow-hidden rounded-xl border border-[var(--app-border)] bg-white shadow-popover"
              >
                <div className="border-b border-[var(--app-border)] px-4 py-3">
                  <p className="truncate text-sm font-semibold text-navy-900">{user?.full_name}</p>
                  <p className="mt-0.5 truncate text-xs text-navy-500">{user?.email}</p>
                  <span className="mt-2 inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-inset ring-brand-200">
                    {role}
                  </span>
                </div>
                <div className="p-1.5">
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] text-navy-700 transition hover:bg-navy-50"
                  >
                    <UserCircle className="h-4 w-4 text-navy-400" aria-hidden="true" />
                    Profile & security
                  </Link>
                  <Link
                    to="/notifications"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] text-navy-700 transition hover:bg-navy-50"
                  >
                    <Settings className="h-4 w-4 text-navy-400" aria-hidden="true" />
                    Notification settings
                  </Link>
                </div>
                <div className="border-t border-[var(--app-border)] p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
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
