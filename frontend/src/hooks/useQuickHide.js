import { useEffect, useRef } from "react";

export const QUICK_EXIT_URL = "https://www.google.com";
export const DOUBLE_ESCAPE_WINDOW_MS = 800;

export function quickExit() {
  window.location.replace(QUICK_EXIT_URL);
}

/**
 * Calls `onTrigger` when Escape is pressed twice within `windowMs`.
 * Escape presses that something else already handled (event.defaultPrevented,
 * e.g. a modal closing) and auto-repeat events are ignored, so closing a dialog
 * never triggers the quick exit.
 */
export function useDoubleEscape(onTrigger = quickExit, { windowMs = DOUBLE_ESCAPE_WINDOW_MS, enabled = true } = {}) {
  const lastPressRef = useRef(0);
  const callbackRef = useRef(onTrigger);

  useEffect(() => {
    callbackRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    if (!enabled) return undefined;
    const handleKeyDown = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.repeat) return;
      const now = Date.now();
      if (lastPressRef.current && now - lastPressRef.current <= windowMs) {
        lastPressRef.current = 0;
        callbackRef.current?.();
      } else {
        lastPressRef.current = now;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [windowMs, enabled]);
}
