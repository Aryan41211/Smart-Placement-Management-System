import { forwardRef } from 'react';

/**
 * Labelled text input.
 *
 * @param {object} props component props
 */
export const Input = forwardRef(function Input(
  { label, error, hint, className = '', id, ...rest },
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
      <input
        ref={ref}
        id={inputId}
        className={`input-base ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error && inputId ? `${inputId}-error` : undefined}
        {...rest}
      />
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={inputId ? `${inputId}-error` : undefined} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
});

/**
 * Labelled select element.
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
      <select
        ref={ref}
        id={selectId}
        className={`input-base ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        {...rest}
      >
        {children}
      </select>
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
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
        className={`input-base ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        {...rest}
      />
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
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
      className={`inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 ${className}`}
    >
      <input
        id={checkboxId}
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        {...rest}
      />
      {label}
    </label>
  );
}
