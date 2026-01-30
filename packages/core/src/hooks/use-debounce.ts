import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook that debounces a value
 * Useful for search inputs, form validation, etc.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Track previous value
 * Useful for comparing current and previous values in effects
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

/**
 * Stable callback reference
 * Returns a callback that maintains the same reference across renders
 * but always calls the latest version of the provided callback
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(callback: T): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  
  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
}
