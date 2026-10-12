import { useState, useEffect, useRef, useCallback } from "react";

const HEALTH_URL = (() => {
  const base = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
  // Strip /api/v1 suffix to hit the root-level /wake endpoint
  return base.replace(/\/api\/v1\/?$/, "") + "/wake";
})();

const COLD_THRESHOLD_MS = 4_000; // if no response in 4s → server is cold
const RETRY_INTERVAL_MS = 5_000; // retry every 5s while cold

/**
 * useServerWarmup
 *
 * Probes the backend /wake endpoint on mount.
 * - If it responds quickly → server is already warm, nothing shown.
 * - If it times out     → server is cold; retries until warm.
 *
 * Returns: { isChecking, isCold, isWarm, elapsedSeconds }
 */
export function useServerWarmup() {
  const [status, setStatus] = useState("checking"); // "checking" | "cold" | "warm"
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const startTimeRef = useRef(null);
  const retryTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const probeRef = useRef(null); // lets the retry timer call the latest probe

  const clearTimers = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    clearInterval(elapsedTimerRef.current);
  }, []);

  const startElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) return; // already running
    startTimeRef.current = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const probe = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COLD_THRESHOLD_MS);

    try {
      const res = await fetch(HEALTH_URL, { signal: controller.signal });
      clearTimeout(timeout);
      if (!mountedRef.current) return;

      if (res.ok) {
        clearTimers();
        setStatus("warm");
        return;
      }
    } catch {
      clearTimeout(timeout);
    }

    // Server is cold or unreachable — mark cold, start elapsed timer, schedule retry
    if (!mountedRef.current) return;
    setStatus("cold");
    startElapsedTimer();
    retryTimerRef.current = setTimeout(() => probeRef.current?.(), RETRY_INTERVAL_MS);
  }, [clearTimers, startElapsedTimer]);

  useEffect(() => {
    probeRef.current = probe;
  }, [probe]);

  useEffect(() => {
    mountedRef.current = true;
    // probe() is async: every setState in it runs after `await fetch(...)`, i.e.
    // in a later task, so this does not cause a synchronous cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    probe();

    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [probe, clearTimers]);

  return {
    isChecking: status === "checking",
    isCold: status === "cold",
    isWarm: status === "warm",
    elapsedSeconds,
  };
}
