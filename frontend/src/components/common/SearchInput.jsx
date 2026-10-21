import { Search } from 'lucide-react';

/**
 * Search box with a debounced callback.
 *
 * @param {object} props component props
 */
export default function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input-base pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}
