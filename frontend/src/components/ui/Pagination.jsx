import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Page-number pagination that matches the backend pagination envelope
 * (`count`, `page`, `pages`, `page_size`).
 *
 * @param {object} props component props
 */
export default function Pagination({ page = 1, pages = 1, count = 0, onChange, className = '' }) {
  if (!pages || pages <= 1) {
    return count ? (
      <p className={`px-4 py-3 text-xs text-slate-500 ${className}`}>
        {count} record{count === 1 ? '' : 's'}
      </p>
    ) : null;
  }

  const window = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, start + 4);
  for (let index = start; index <= end; index += 1) window.push(index);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 ${className}`}
    >
      <p className="text-xs text-slate-500">
        Page {page} of {pages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {window.map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            className={`min-w-9 rounded-md border px-2.5 py-1.5 text-sm transition ${
              number === page
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="rounded-md border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
