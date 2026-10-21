import { Search, X } from 'lucide-react';

/**
 * Search box with a debounced callback.
 *
 * @param {object} props component props
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  size = 'md',
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`input-base pl-9 ${value ? 'pr-9' : ''} ${
          size === 'sm' ? 'input-base-sm' : ''
        } [&::-webkit-search-cancel-button]:hidden`}
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-navy-400 transition hover:bg-navy-100 hover:text-navy-700"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
