import { NavLink } from 'react-router-dom';
import { GraduationCap, X } from 'lucide-react';
import { navigationFor } from '../../config/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { initials } from '../../utils/format.js';

/**
 * Collapsible sidebar that lists the navigation of the current role.
 *
 * @param {object} props component props
 */
export default function Sidebar({ open, onClose }) {
  const { user, role } = useAuth();
  const items = navigationFor(role);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-900 transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-brand-600 p-2 text-white">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight text-white">Smart Placement</p>
              <p className="text-xs text-slate-400">Management System</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {initials(user?.full_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
              <p className="truncate text-xs capitalize text-slate-400">{role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
