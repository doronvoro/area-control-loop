'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiDataOptions {
  /** Skip the initial fetch (useful for conditional fetching) */
  skip?: boolean;
}

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching data from an API endpoint on mount.
 *
 * @param url - The API URL to fetch from. Pass null to skip fetching.
 * @param options - Optional configuration
 * @returns { data, loading, error, refetch }
 */
export function useApiData<T>(
  url: string | null,
  options?: UseApiDataOptions
): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const fetchData = useCallback(async () => {
    const currentUrl = urlRef.current;
    if (!currentUrl) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(currentUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `שגיאה בטעינת הנתונים`);
      }
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options?.skip || !url) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [url, options?.skip, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
