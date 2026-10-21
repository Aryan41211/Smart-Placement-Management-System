/**
 * Axios client for the Smart Placement Management System API.
 *
 * Responsibilities
 * ----------------
 * * Attach the stored JWT access token to every request.
 * * On a 401 caused by an expired access token, refresh once and replay the
 *   original request. Concurrent requests share a single refresh promise so
 *   the browser never fires a burst of refresh calls.
 * * Surface backend failures as a normalised `ApiError` that carries the
 *   machine readable code, the human readable message and the field errors.
 */

import axios from 'axios';

export const ACCESS_TOKEN_KEY = 'spms.access_token';
export const REFRESH_TOKEN_KEY = 'spms.refresh_token';

/** Base URL of the API. Empty string means "same origin" (Vite dev proxy). */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

/** Normalised error thrown for every failed request. */
export class ApiError extends Error {
  /**
   * @param {string} message human readable message
   * @param {object} options error details
   */
  constructor(message, { code = 'error', details = null, status = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || '';
}

export function storeTokens({ access, refresh } = {}) {
  if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Notifies the application shell that the session is gone. */
export const SESSION_EXPIRED_EVENT = 'spms:session-expired';

function announceSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error('no refresh token');
  const response = await axios.post(
    `${API_BASE_URL}/api/v1/auth/refresh/`,
    { refresh },
    { headers: { 'Content-Type': 'application/json' } },
  );
  const access = response.data?.access;
  if (!access) throw new Error('refresh response did not contain an access token');
  storeTokens({ access });
  return access;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    if (!response) {
      return Promise.reject(
        new ApiError('The server could not be reached. Check that the API is running.', {
          code: 'network_error',
        }),
      );
    }

    const isAuthRoute = config?.url?.includes('/auth/refresh/');
    const shouldRefresh =
      response.status === 401 && !isAuthRoute && !config?._retried && getRefreshToken();

    if (shouldRefresh) {
      config._retried = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const access = await refreshPromise;
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${access}`;
        return api.request(config);
      } catch (refreshError) {
        clearTokens();
        announceSessionExpired();
        return Promise.reject(
          new ApiError('Your session has expired. Please sign in again.', {
            code: 'session_expired',
            status: 401,
          }),
        );
      }
    }

    const payload = response.data;
    if (payload && typeof payload === 'object' && payload.error) {
      const { code, message, details } = payload.error;
      return Promise.reject(
        new ApiError(message || 'The request failed.', {
          code: code || 'error',
          details: details ?? null,
          status: response.status,
        }),
      );
    }

    if (payload && typeof payload === 'object') {
      // DRF field level validation errors arrive as a plain object.
      const first = Object.entries(payload)[0];
      const message =
        first && typeof first[1] === 'string'
          ? first[1]
          : typeof first?.[1] === 'object'
            ? Array.isArray(first[1])
              ? first[1][0]
              : JSON.stringify(first[1])
            : 'The request failed.';
      return Promise.reject(
        new ApiError(message, {
          code: 'validation_error',
          details: payload,
          status: response.status,
        }),
      );
    }

    return Promise.reject(
      new ApiError('The request failed.', {
        code: 'error',
        status: response.status,
      }),
    );
  },
);

/** Download a CSV export through the authenticated API client. */
export async function downloadCsv(path, filename, params) {
  const response = await api.get(path, { responseType: 'blob', params });
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default api;
