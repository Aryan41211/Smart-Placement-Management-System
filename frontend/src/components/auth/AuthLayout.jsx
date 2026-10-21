import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

/**
 * Shared marketing / authentication layout.
 *
 * @param {object} props component props
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <div className="hidden w-1/2 flex-col justify-between bg-slate-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-brand-600 p-2.5">
            <GraduationCap className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-semibold">Smart Placement</p>
            <p className="text-sm text-slate-400">Management System</p>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            One portal for the placement cell, students and recruiters.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Eligibility is computed on the server from live academic records, every status change
            is written to an immutable audit trail and every metric is an SQL aggregation - never a
            hard coded number.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Roles</dt>
              <dd className="mt-1 text-lg font-semibold">3</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Tables</dt>
              <dd className="mt-1 text-lg font-semibold">15</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Engine</dt>
              <dd className="mt-1 text-lg font-semibold">MySQL 8</dd>
            </div>
          </dl>
        </div>

        <p className="text-xs text-slate-500">
          Django 5.2 &middot; Django REST Framework &middot; JWT &middot; React 19 &middot; Tailwind CSS
        </p>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="rounded-xl bg-brand-600 p-2.5 text-white">
              <GraduationCap className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-semibold text-slate-900">Smart Placement</p>
              <p className="text-sm text-slate-500">Management System</p>
            </div>
          </div>

          <div className="card px-6 py-7">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {footer && <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>}

          <p className="mt-8 text-center text-xs text-slate-400">
            <Link to="/login" className="link-base">
              Return to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
