"use client";

import { useLayoutEffect, useRef, type ChangeEvent } from "react";

type Control = HTMLInputElement | HTMLTextAreaElement;

/**
 * Keeps text typed into a controlled field before React hydrated (issue #24). Hydration leaves
 * the typed text in the DOM but the state still holds the server value, so the next render
 * would wipe it: on mount, the field's `onChange` receives the DOM value instead. Fields
 * mounted after hydration already match their state, so nothing happens.
 */
export function useTypedBeforeHydration<T extends Control>(
  value: unknown,
  onChange: ((event: ChangeEvent<T>) => void) | undefined,
) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || value == null || !onChange || node.value === String(value)) return;
    onChange({ target: node, currentTarget: node } as ChangeEvent<T>);
    // Mount only: later renders are React's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
