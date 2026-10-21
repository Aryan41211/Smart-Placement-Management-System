import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from '../ui/Button.jsx';

/**
 * Renders a failed request using the message returned by the backend.
 *
 * @param {object} props component props
 */
export default function ErrorState({ error, onRetry, title = 'Could not load this data' }) {
  const message =
    error?.message || 'An unexpected error occurred while contacting the server.';
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
      <span className="rounded-full bg-rose-100 p-3 text-rose-600">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-rose-900">{title}</h3>
      <p className="max-w-lg text-sm text-rose-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
