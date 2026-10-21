import { NavLink } from 'react-router-dom';
import { GraduationCap, LogOut, ShieldCheck, X } from 'lucide-react';
import { navigationFor } from '../../config/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { initials } from '../../utils/format.js';

/**
 * Premium sidebar that lists the navigation of the current role.
 *
 * @param {object} props component props
 */
export default function Sidebar({ open, onClose }) {
  const { user, role } = useAuth();
  const groups = navigationFor(role);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 animate-fade-in bg-navy-950/60 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col bg-navy-950 transition-transform duration-300 ease-smooth lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="relative flex items-center justify-between gap-2 border-b border-white/[0.07] px-5 py-[1.15rem]">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[0.6rem] bg-brand-500/90 text-white shadow-[0_4px_12px_-2px_rgb(92_96_233/0.6)]">
              <GraduationCap className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="text-[0.8125rem] font-semibold text-white">Smart Placement</p>
              <p className="text-2xs text-navy-400">Management System</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-navy-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.section}>
              <p className="mb-1.5 px-3 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-navy-500">
                {group.section}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition duration-150 ease-smooth ${
                            isActive
                              ? 'bg-brand-500/15 text-white'
                              : 'text-navy-300 hover:bg-white/[0.06] hover:text-white'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-400 transition-opacity duration-200 ${
                                isActive ? 'opacity-100' : 'opacity-0'
                              }`}
                              aria-hidden="true"
                            />
                            <Icon
                              className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
                                isActive ? 'text-brand-300' : 'text-navy-400 group-hover:text-navy-200'
                              }`}
                              aria-hidden="true"
                            />
                            {item.label}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Signed-in user */}
        <div className="border-t border-white/[0.07] p-3">
          <div className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/[0.05]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
              {initials(user?.full_name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-medium text-white">{user?.full_name}</p>
              <p className="truncate text-2xs capitalize text-navy-400">{role}</p>
            </div>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
          </div>
          <p className="mt-2 px-1 text-[0.625rem] leading-relaxed text-navy-600">
            Signed in with a verified account. Permissions are enforced by the API.
          </p>
        </div>
      </aside>
    </>
  );
}
