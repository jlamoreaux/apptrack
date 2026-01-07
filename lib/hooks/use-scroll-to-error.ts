"use client";

import { useCallback, useRef, RefObject } from "react";

export interface FieldRefs {
  [key: string]: RefObject<HTMLElement | null>;
}

/**
 * Hook for scrolling to the first form field with an error.
 * Uses requestAnimationFrame for reliable timing instead of arbitrary setTimeout.
 *
 * @param fieldOrder - Array of field names in the order they should be checked
 * @returns Object with refs to attach to fields and a function to scroll to first error
 *
 * @example
 * const { refs, scrollToFirstError } = useScrollToError(['email', 'password']);
 *
 * // Attach refs to your form fields
 * <Input ref={refs.email} ... />
 * <Input ref={refs.password} ... />
 *
 * // In validation
 * if (Object.keys(errors).length > 0) {
 *   scrollToFirstError(errors);
 * }
 */
export function useScrollToError<T extends string>(fieldOrder: T[]) {
  const refs = useRef<Record<T, RefObject<HTMLElement | null>>>(
    {} as Record<T, RefObject<HTMLElement | null>>
  );

  // Initialize refs for each field
  fieldOrder.forEach((field) => {
    if (!refs.current[field]) {
      refs.current[field] = { current: null };
    }
  });

  const scrollToFirstError = useCallback(
    (errors: Partial<Record<T, string>>) => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        for (const field of fieldOrder) {
          if (errors[field] && refs.current[field]?.current) {
            const element = refs.current[field].current;
            element?.scrollIntoView({ behavior: "smooth", block: "center" });

            // Focus the element if it's focusable, or find a focusable child
            if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
              element.focus();
            } else {
              const focusable = element?.querySelector<HTMLElement>(
                'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
              );
              focusable?.focus();
            }
            break;
          }
        }
      });
    },
    [fieldOrder]
  );

  return {
    refs: refs.current,
    scrollToFirstError,
  };
}
