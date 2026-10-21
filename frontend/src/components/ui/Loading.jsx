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
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-navy-400">
      <span className="relative flex h-10 w-10 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand-100/70 animate-ping" />
        <Spinner className="relative h-6 w-6" />
      </span>
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
  return <div className={`animate-pulse rounded-md bg-navy-100 ${className}`} />;
}

/**
 * Skeleton table used while a paginated list is loading.
 *
 * @param {object} props component props
 */
export function TableSkeleton({ rows = 6, columns = 4 }) {
  return (
    <div className="divide-y divide-navy-100">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={`h-3.5 ${columnIndex === 0 ? 'w-40' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
