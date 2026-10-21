/**
 * Dashboard metric tile.
 *
 * The accent rail on the left edge keeps a row of tiles from turning into a
 * flat, repetitive grid while still reading as one component family.
 *
 * @param {object} props component props
 */
export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  trend,
  onClick,
}) {
  const tones = {
    brand: {
      rail: 'bg-brand-500',
      icon: 'bg-brand-50 text-brand-600 ring-brand-100',
    },
    emerald: {
      rail: 'bg-emerald-500',
      icon: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    },
    amber: {
      rail: 'bg-amber-500',
      icon: 'bg-amber-50 text-amber-600 ring-amber-100',
    },
    rose: {
      rail: 'bg-rose-500',
      icon: 'bg-rose-50 text-rose-600 ring-rose-100',
    },
    sky: {
      rail: 'bg-sky-500',
      icon: 'bg-sky-50 text-sky-600 ring-sky-100',
    },
    violet: {
      rail: 'bg-violet-500',
      icon: 'bg-violet-50 text-violet-600 ring-violet-100',
    },
    slate: {
      rail: 'bg-navy-400',
      icon: 'bg-navy-50 text-navy-600 ring-navy-100',
    },
  };

  const palette = tones[tone] ?? tones.brand;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card group relative flex items-start gap-4 overflow-hidden px-5 py-4 text-left ${
        onClick ? 'cursor-pointer transition duration-200 ease-smooth hover:shadow-card-hover' : ''
      }`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${palette.rail} opacity-70 transition-opacity duration-200 group-hover:opacity-100`}
        aria-hidden="true"
      />
      {Icon && (
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${palette.icon}`}
        >
          <Icon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-2xs font-semibold uppercase tracking-[0.1em] text-navy-400">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="truncate text-[1.6rem] font-semibold leading-tight text-navy-900">{value}</p>
          {trend && (
            <span
              className={`text-xs font-medium ${
                trend.direction === 'up'
                  ? 'text-emerald-600'
                  : trend.direction === 'down'
                    ? 'text-rose-600'
                    : 'text-navy-400'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
        {hint && <p className="mt-1 truncate text-xs text-navy-500">{hint}</p>}
      </div>
    </Wrapper>
  );
}
