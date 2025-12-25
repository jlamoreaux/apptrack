"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_PREFIX = "apptrack_form_";

/**
 * Hook to persist form data in localStorage
 * Automatically saves on change and restores on mount
 */
export function useFormPersistence<T extends object>(
  key: string,
  initialData: T
): {
  formData: T;
  setFormData: (data: T | ((prev: T) => T)) => void;
  clearSavedData: () => void;
  hasRestoredData: boolean;
} {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const [hasRestoredData, setHasRestoredData] = useState(false);
  const isInitialized = useRef(false);

  // Initialize with data from localStorage or initial data
  const [formData, setFormDataInternal] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialData;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as T;
        // Merge with initial data to handle schema changes
        return { ...initialData, ...parsed };
      }
    } catch (e) {
      // Invalid JSON or other error, use initial data
      console.warn("Failed to restore form data:", e);
    }

    return initialData;
  });

  // Check if we restored data (only on client)
  useEffect(() => {
    if (typeof window === "undefined" || isInitialized.current) return;
    isInitialized.current = true;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as T;
        // Check if any field has meaningful content
        const hasContent = Object.values(parsed).some(
          (v) => typeof v === "string" && v.trim().length > 0
        );
        setHasRestoredData(hasContent);
      }
    } catch {
      // Ignore errors
    }
  }, [storageKey]);

  // Save to localStorage whenever form data changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if form has any content worth saving
    const hasContent = Object.values(formData).some(
      (v) => typeof v === "string" && v.trim().length > 0
    );

    if (hasContent) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(formData));
      } catch (e) {
        console.warn("Failed to save form data:", e);
      }
    }
  }, [formData, storageKey]);

  // Wrapper to match useState signature
  const setFormData = useCallback((data: T | ((prev: T) => T)) => {
    setFormDataInternal(data);
  }, []);

  // Clear saved data (call on successful submit)
  const clearSavedData = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(storageKey);
      setHasRestoredData(false);
    } catch (e) {
      console.warn("Failed to clear form data:", e);
    }
  }, [storageKey]);

  return { formData, setFormData, clearSavedData, hasRestoredData };
}
