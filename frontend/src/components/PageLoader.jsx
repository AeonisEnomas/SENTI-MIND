import { useEffect, useState } from "react";
import SentiBotAvatar from "./SentiBotAvatar";

// Free-tier backend cold starts can take ~30-60 s, so say so instead of looking frozen.
const SLOW_AFTER_MS = 5000;

const STAGE_PX = { sm: 96, md: 132, lg: 176 };

// Shared loading state: SentiBot floats over its shadow inside an orbiting ring of sparks.
// `fullScreen` centers it in the viewport (auth check); otherwise it sits in the page flow.
// `slowHint` adds the cold-start note; pass it only where the wait is on our backend API.
export default function PageLoader({ label = "Loading", size = "md", fullScreen = false, slowHint = false, className = "" }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!slowHint) return undefined;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [slowHint]);

  const stage = STAGE_PX[size] ?? STAGE_PX.md;
  const layout = fullScreen ? "h-screen bg-sage-50" : "py-16";
  const text = label.replace(/(\.\.\.|…)$/, "");

  return (
    <div className={`flex items-center justify-center ${layout} ${className}`} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="sentibot-loader" style={{ width: stage, height: stage }} aria-hidden="true">
          <div className="sentibot-loader-ring" />
          <div className="sentibot-loader-orbit">
            <span className="sentibot-loader-spark" />
          </div>
          <div className="sentibot-loader-orbit sentibot-loader-orbit--reverse">
            <span className="sentibot-loader-spark sentibot-loader-spark--small" />
          </div>
          <div className="sentibot-loader-float">
            <SentiBotAvatar emotion="loading" size={size} animate={true} />
          </div>
          <div className="sentibot-loader-shadow" />
        </div>

        <p className="text-sm text-warm-600 font-medium flex items-baseline">
          {text}
          <span className="sentibot-loader-dots" aria-hidden="true">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </p>
        {slow && (
          <p className="text-xs text-warm-500 max-w-xs text-center animate-medical-fade-in">
            Taking a little longer than usual. The server may be waking up, which can take up to a minute.
          </p>
        )}
      </div>
    </div>
  );
}
