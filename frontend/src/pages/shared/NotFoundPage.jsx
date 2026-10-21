import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { homeRouteFor } from '../../config/navigation.js';

/**
 * Fallback screen for an unknown route.
 */
export default function NotFoundPage() {
  const { isAuthenticated, role } = useAuth();
  const target = isAuthenticated ? homeRouteFor(role) : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="card w-full max-w-md px-6 py-10 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Compass className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          The screen you asked for does not exist or your role cannot open it.
        </p>
        <Link
          to={target}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
