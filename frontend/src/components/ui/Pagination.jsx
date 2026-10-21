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
      <p className={`px-4 py-3 text-xs text-navy-500 ${className}`}>
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
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] px-4 py-3 ${className}`}
    >
      <p className="text-xs text-navy-500">
        Page <span className="font-medium text-navy-700">{page}</span> of {pages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-navy-200 p-1.5 text-navy-600 transition hover:border-navy-300 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {window.map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            aria-current={number === page ? 'page' : undefined}
            className={`min-w-9 rounded-md border px-2.5 py-1.5 text-sm transition ${
              number === page
                ? 'border-brand-600 bg-brand-600 font-medium text-white shadow-sm'
                : 'border-navy-200 text-navy-600 hover:border-navy-300 hover:bg-navy-50'
            }`}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="rounded-md border border-navy-200 p-1.5 text-navy-600 transition hover:border-navy-300 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
