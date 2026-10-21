import { Loader2 } from 'lucide-react';

/**
 * Inline spinner.
 *
 * @param {object} props component props
 */
export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-hidden="true" />;
}

/**
 * Full page loading state.
 *
 * @param {object} props component props
 */
export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/**
 * Skeleton placeholder block.
 *
 * @param {object} props component props
 */
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}
