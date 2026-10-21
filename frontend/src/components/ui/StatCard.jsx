/**
 * Dashboard metric tile.
 *
 * @param {object} props component props
 */
export default function StatCard({ label, value, hint, icon: Icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="card flex items-start gap-4 px-5 py-4">
      {Icon && (
        <span className={`rounded-lg p-2.5 ${tones[tone] ?? tones.brand}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
