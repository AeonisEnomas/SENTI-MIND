import { useEffect, useState } from "react";

/**
 * WarmupBanner
 *
 * Shows a non-blocking amber banner when the Render backend is cold-starting.
 * Automatically fades out with a success flash once the server is warm.
 *
 * Props:
 *   isCold       {boolean} — server is still waking up
 *   isWarm       {boolean} — server just came online
 *   elapsedSeconds {number} — seconds since cold start was detected
 */
export default function WarmupBanner({ isCold, isWarm, elapsedSeconds }) {
  const [wasCold, setWasCold] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Appear once the server is detected as cold (state adjusted during render,
  // which React handles without an extra effect pass).
  if (isCold && !wasCold) setWasCold(true);

  const visible = wasCold && !dismissed;
  const justWarm = visible && isWarm;

  // Flash "ready" then disappear
  useEffect(() => {
    if (!justWarm) return undefined;
    const t = setTimeout(() => setDismissed(true), 2500);
    return () => clearTimeout(t);
  }, [justWarm]);

  if (!visible) return null;

  const dots = ".".repeat((elapsedSeconds % 3) + 1).padEnd(3, "\u00a0");

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "relative",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 16px",
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "0.01em",
        transition: "background 0.6s ease, color 0.6s ease",
        background: justWarm
          ? "linear-gradient(90deg, #d1fae5, #a7f3d0)"
          : "linear-gradient(90deg, #fef3c7, #fde68a)",
        color: justWarm ? "#065f46" : "#92400e",
        borderBottom: `1px solid ${justWarm ? "#6ee7b7" : "#fcd34d"}`,
      }}
    >
      {/* Pulse dot */}
      <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10, flexShrink: 0 }}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: justWarm ? "#10b981" : "#f59e0b",
            opacity: 0.4,
            animation: "warmup-ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
          }}
        />
        <span
          style={{
            position: "relative",
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: justWarm ? "#10b981" : "#f59e0b",
          }}
        />
      </span>

      {justWarm ? (
        <span>✓ Server is ready — loading your data{dots}</span>
      ) : (
        <span>
          Server is warming up{dots}
          <span style={{ opacity: 0.75, marginLeft: 6 }}>
            ({elapsedSeconds}s elapsed — usually takes ~30–40 seconds on Render free tier)
          </span>
        </span>
      )}

      <style>{`
        @keyframes warmup-ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
