import { forwardRef } from 'react';

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-500 disabled:bg-brand-300',
  secondary:
    'bg-white text-navy-700 border border-navy-200 shadow-xs hover:bg-navy-50 hover:border-navy-300 active:bg-navy-100 focus-visible:ring-navy-400 disabled:text-navy-300',
  ghost:
    'text-navy-600 hover:bg-navy-100 hover:text-navy-900 active:bg-navy-200 focus-visible:ring-navy-400 disabled:text-navy-300',
  subtle:
    'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200 focus-visible:ring-brand-400 disabled:text-brand-300',
  danger:
    'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500 disabled:bg-rose-300',
  success:
    'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500 disabled:bg-emerald-300',
  outlineBrand:
    'bg-transparent text-brand-700 border border-brand-200 hover:bg-brand-50 hover:border-brand-300 focus-visible:ring-brand-400 disabled:text-brand-300',
};

const SIZES = {
  xs: 'h-7 px-2 text-2xs gap-1 rounded-md',
  sm: 'h-8 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-lg',
};

const ICON_SIZES = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-4 w-4',
};

/**
 * The application button.
 *
 * @param {object} props component props
 */
const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    className = '',
    type = 'button',
    loading = false,
    icon: Icon,
    iconOnly = false,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex select-none items-center justify-center whitespace-nowrap font-medium
        transition duration-150 ease-smooth
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:cursor-not-allowed ${VARIANTS[variant] ?? VARIANTS.primary} ${
          iconOnly ? SIZES[size].replace(/px-[\d.]+/, '') : SIZES[size]
        } ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? (
        <span
          className={`${ICON_SIZES[size]} animate-spin rounded-full border-2 border-current border-t-transparent`}
          aria-hidden="true"
        />
      ) : (
        Icon && <Icon className={ICON_SIZES[size]} aria-hidden="true" />
      )}
      {children}
    </button>
  );
});

export default Button;
