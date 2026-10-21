import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const ERROR_FIELD = 'border-rose-300 focus:border-rose-500 focus:ring-rose-100';

/**
 * Labelled text input.
 *
 * @param {object} props component props
 */
export const Input = forwardRef(function Input(
  { label, error, hint, className = '', id, leadingIcon: LeadingIcon, ...rest },
  ref,
) {
  const inputId = id || rest.name;
  return (
    <div className={className}>
      {label && (
        <label className="label-base" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="relative">
        {LeadingIcon && (
          <LeadingIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
            aria-hidden="true"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input-base ${LeadingIcon ? 'pl-9' : ''} ${error ? ERROR_FIELD : ''}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error && inputId ? `${inputId}-error` : undefined}
          {...rest}
        />
      </div>
      {hint && !error && <p className="mt-1 text-xs text-navy-500">{hint}</p>}
      {error && (
        <p id={inputId ? `${inputId}-error` : undefined} className="mt-1 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
});

/**
 * Labelled select element with a consistent chevron affordance.
 *
 * @param {object} props component props
 */
export const Select = forwardRef(function Select(
  { label, error, hint, className = '', id, children, ...rest },
  ref,
) {
  const selectId = id || rest.name;
  return (
    <div className={className}>
      {label && (
        <label className="label-base" htmlFor={selectId}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`input-base appearance-none pr-9 ${error ? ERROR_FIELD : ''}`}
          aria-invalid={error ? 'true' : 'false'}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
          aria-hidden="true"
        />
      </div>
      {hint && !error && <p className="mt-1 text-xs text-navy-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
});

/**
 * Labelled multi-line text area.
 *
 * @param {object} props component props
 */
export const Textarea = forwardRef(function Textarea(
  { label, error, hint, className = '', id, rows = 4, ...rest },
  ref,
) {
  const areaId = id || rest.name;
  return (
    <div className={className}>
      {label && (
        <label className="label-base" htmlFor={areaId}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
        rows={rows}
        className={`input-base resize-y ${error ? ERROR_FIELD : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        {...rest}
      />
      {hint && !error && <p className="mt-1 text-xs text-navy-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
});

/**
 * Checkbox with a label.
 *
 * @param {object} props component props
 */
export function Checkbox({ label, className = '', id, ...rest }) {
  const checkboxId = id || rest.name;
  return (
    <label
      htmlFor={checkboxId}
      className={`inline-flex cursor-pointer select-none items-center gap-2 text-sm text-navy-700 ${className}`}
    >
      <input
        id={checkboxId}
        type="checkbox"
        className="h-4 w-4 rounded border-navy-300 text-brand-600 transition focus:ring-2 focus:ring-brand-400"
        {...rest}
      />
      {label}
    </label>
  );
}
