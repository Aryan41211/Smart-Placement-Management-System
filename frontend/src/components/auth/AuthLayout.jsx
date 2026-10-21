import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Database,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: 'Server-enforced eligibility',
    body: 'CGPA, department and backlog rules are evaluated by SQL on the API - never in the browser.',
  },
  {
    icon: Database,
    title: 'Every metric is an aggregation',
    body: 'Dashboards read live MySQL counts, joins and GROUP BY results, so nothing is hard coded.',
  },
  {
    icon: Activity,
    title: 'Audited pipeline',
    body: 'Every status change is written to an immutable history that the placement cell can review.',
  },
];

/**
 * Shared marketing / authentication layout.
 *
 * @param {object} props component props
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-[var(--app-bg)]">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] max-w-[42rem] flex-col justify-between overflow-hidden bg-navy-950 p-10 text-white lg:flex xl:p-12">
        {/* Ambient light */}
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-600/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-[0_8px_24px_-6px_rgb(92_96_233/0.7)]">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="text-[0.9375rem] font-semibold">Smart Placement</p>
            <p className="text-xs text-navy-400">Management System</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-2xs font-medium uppercase tracking-[0.12em] text-brand-200">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            College placement cell portal
          </span>
          <h2 className="mt-5 text-[2rem] font-semibold leading-[1.15] text-white">
            One portal for the placement cell, students and recruiters.
          </h2>
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-navy-300">
            A normalised MySQL schema, a role-aware REST API and a dashboard that answers the only
            three questions a placement cell really asks: who is eligible, who applied and who got
            placed.
          </p>

          <ul className="mt-9 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-brand-300 ring-1 ring-inset ring-white/10">
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[0.8125rem] font-medium text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-navy-400">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-6 border-t border-white/[0.07] pt-6">
          {[
            ['3', 'User roles'],
            ['15', 'Normalised tables'],
            ['MySQL 8.4', 'Database engine'],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-lg font-semibold text-white">{value}</p>
              <p className="text-2xs uppercase tracking-[0.1em] text-navy-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-[54%]">
        <div className="w-full max-w-[26rem]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="text-[0.9375rem] font-semibold text-navy-900">Smart Placement</p>
              <p className="text-xs text-navy-500">Management System</p>
            </div>
          </div>

          <div className="card px-6 py-7 shadow-card sm:px-7">
            <h1 className="text-xl font-semibold tracking-tight text-navy-900">{title}</h1>
            {subtitle && <p className="mt-1.5 text-[0.8125rem] text-navy-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {footer && <div className="mt-5 text-center text-[0.8125rem] text-navy-500">{footer}</div>}

          <p className="mt-8 text-center text-xs text-navy-400">
            <Link to="/login" className="link-base">
              Return to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
