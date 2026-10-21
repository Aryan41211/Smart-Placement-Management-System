import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { homeRouteFor } from '../../config/navigation.js';
import { LoadingState } from '../ui/Loading.jsx';

/**
 * Blocks a route until the session is known.
 *
 * @param {object} props component props
 */
export function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-100">
        <LoadingState label="Restoring your session..." />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

/**
 * Restricts a route to one or more roles.
 *
 * The check is cosmetic - the backend repeats every authorisation decision.
 *
 * @param {object} props component props
 */
export function RequireRole({ roles, children }) {
  const { role } = useAuth();

  if (!roles.includes(role)) {
    return <Navigate to={homeRouteFor(role)} replace />;
  }

  return children;
}
