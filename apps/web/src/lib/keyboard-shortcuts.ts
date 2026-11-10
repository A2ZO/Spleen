import { useSyncExternalStore } from "react";

/*
 * Single-key shortcuts ("/", 1..5, 0, L, "?") and the setting that turns them off (WCAG 2.1.4).
 * The setting lives only in this browser; storage may be missing or throw (private window,
 * blocked site data): shortcuts are then on.
 */

const KEY = "spleen-shortcuts";
const listeners = new Set<() => void>();
/** Used when storage throws on write, so the switch still takes effect in this page. */
let fallback: boolean | null = null;

export function shortcutsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setShortcutsEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
    fallback = null;
  } catch {
    // Not saved: the setting then lasts only until the page reloads.
    fallback = enabled;
  }
  for (const listener of listeners) listener();
}

function current() {
  return fallback ?? shortcutsEnabled();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The setting, live (another tab or the settings page changes it at once); on before hydration. */
export function useShortcutsEnabled(): boolean {
  return useSyncExternalStore(subscribe, current, () => true);
}

export const editable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** What the guard reads from a key press (a DOM `KeyboardEvent` fits). */
export interface ShortcutKeyEvent {
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  target: EventTarget | null;
}

/**
 * Whether a single-key shortcut may run: not with Ctrl, Alt (AltGr included) or Cmd, not for a
 * key held down or while composing a character, not while typing in a field, not while a
 * window (`dialog`) is open, and not when the member turned shortcuts off.
 */
export function shortcutAllowed(
  event: ShortcutKeyEvent,
  env: { dialogOpen: boolean; enabled: boolean } = {
    dialogOpen: document.querySelector("dialog[open]") !== null,
    enabled: current(),
  },
): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey) return false;
  if (event.repeat || event.isComposing || event.defaultPrevented) return false;
  if (editable(event.target)) return false;
  return !env.dialogOpen && env.enabled;
}

/** Digits 0..5 by key position (`event.code`): AZERTY's top row gives "&é\"'(" without Shift. */
export function digitOf(code: string): number | null {
  const match = /^(?:Digit|Numpad)([0-5])$/.exec(code);
  return match ? Number(match[1]) : null;
}

/** Opens the shortcut help from anywhere (footer button), even with shortcuts off. */
export const OPEN_HELP_EVENT = "spleen:keyboard-help";
export function openKeyboardHelp() {
  window.dispatchEvent(new Event(OPEN_HELP_EVENT));
}
