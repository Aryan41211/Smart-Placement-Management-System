import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints.js';
import {
  SESSION_EXPIRED_EVENT,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
} from '../api/client.js';

const AuthContext = createContext(null);

/**
 * Holds the authenticated account and the JWT pair.
 *
 * The backend is the authority on permissions. The role stored here only
 * decides which screens the shell renders; every request is still checked by
 * the server.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setStatus('anonymous');
      return null;
    }
    try {
      const me = await authApi.me();
      setUser(me);
      setStatus('authenticated');
      return me;
    } catch (err) {
      clearTokens();
      setUser(null);
      setStatus('anonymous');
      return null;
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    function onExpired() {
      clearTokens();
      setUser(null);
      setStatus('anonymous');
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (credentials) => {
    setError(null);
    try {
      const payload = await authApi.login(credentials);
      storeTokens({ access: payload.access, refresh: payload.refresh });
      setUser(payload.user);
      setStatus('authenticated');
      return payload.user;
    } catch (err) {
      setError(err.message || 'Sign in failed.');
      throw err;
    }
  }, []);

  const register = useCallback(async (payload) => {
    setError(null);
    try {
      const result = await authApi.register(payload);
      storeTokens({ access: result.access, refresh: result.refresh });
      setUser(result.user);
      setStatus('authenticated');
      return result.user;
    } catch (err) {
      setError(err.message || 'Registration failed.');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    try {
      if (refresh) await authApi.logout(refresh);
    } catch {
      // A failed logout must never trap the user in the application.
    } finally {
      clearTokens();
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const changePassword = useCallback(async (payload) => {
    return authApi.changePassword(payload);
  }, []);

  const refreshProfile = useCallback(async () => {
    const me = await loadUser();
    return me;
  }, [loadUser]);

  const value = useMemo(
    () => ({
      user,
      status,
      error,
      role: user?.role ?? null,
      isAuthenticated: status === 'authenticated',
      isAdmin: user?.role === 'admin',
      isStudent: user?.role === 'student',
      isRecruiter: user?.role === 'recruiter',
      login,
      register,
      logout,
      changePassword,
      refreshProfile,
    }),
    [user, status, error, login, register, logout, changePassword, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the authentication context. */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}
