import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal data-fetching hook used by every page.
 *
 * The hook never fabricates data: while a request is in flight the component
 * receives `loading === true`, and a failure surfaces the real backend message.
 *
 * @param {Function} fetcher async function returning the payload
 * @param {Array} deps dependency list that triggers a reload
 */
export function useApi(fetcher, deps = [], { enabled = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (requestId.current === current) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (requestId.current === current) {
        setError(err);
      }
      return null;
    } finally {
      if (requestId.current === current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    load();
    return undefined;
  }, [enabled, load]);

  return { data, loading, error, reload: load, setData };
}

/**
 * Debounce a rapidly changing value (search boxes).
 *
 * @param {*} value the value to debounce
 * @param {number} delay delay in milliseconds
 */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
