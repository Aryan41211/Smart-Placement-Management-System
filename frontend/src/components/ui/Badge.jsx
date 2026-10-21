const VARIANTS = {
  neutral: 'bg-navy-50 text-navy-600 ring-navy-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  slate: 'bg-navy-100 text-navy-700 ring-navy-200',
};

const SIZES = {
  sm: 'px-1.5 py-0.5 text-2xs',
  md: 'px-2 py-0.5 text-xs',
};

/**
 * Small pill used to render a status, a role or a tag.
 *
 * @param {object} props component props
 */
export default function Badge({ variant = 'neutral', size = 'md', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset ${
        SIZES[size] ?? SIZES.md
      } ${VARIANTS[variant] ?? VARIANTS.neutral} ${className}`}
    >
      {children}
    </span>
  );
}
