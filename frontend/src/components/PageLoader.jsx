import SentiBotAvatar from "./SentiBotAvatar";

// Shared loading state: SentiBot "thinking" animation with a short label.
// `fullScreen` centers it in the viewport (auth check); otherwise it sits in the page flow.
export default function PageLoader({ label = "Loading...", size = "md", fullScreen = false, className = "" }) {
  const layout = fullScreen ? "h-screen bg-sage-50" : "py-16";
  return (
    <div className={`flex items-center justify-center ${layout} ${className}`} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <SentiBotAvatar emotion="loading" size={size} animate={true} />
        <p className="text-sm text-warm-500 font-medium">{label}</p>
      </div>
    </div>
  );
}
