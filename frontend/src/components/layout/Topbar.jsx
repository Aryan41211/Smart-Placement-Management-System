import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { notificationApi } from '../../api/endpoints.js';
import { initials } from '../../utils/format.js';

/**
 * Application top bar with the notification badge and the sign-out action.
 *
 * @param {object} props component props
 */
export default function Topbar({ onMenuClick }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

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

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="hidden text-sm text-slate-500 sm:block">
          Signed in as <span className="font-medium capitalize text-slate-700">{role}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/notifications"
          className="relative rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>

        <div className="hidden items-center gap-2 rounded-lg bg-slate-100 px-2 py-1.5 sm:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials(user?.full_name)}
          </span>
          <span className="max-w-[12rem] truncate text-sm text-slate-700">{user?.full_name}</span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
