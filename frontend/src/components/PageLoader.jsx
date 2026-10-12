export default function PageLoader({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-sage-300 border-t-sage-600 rounded-full animate-spin" aria-hidden="true" />
        <p className="text-sm text-warm-500 font-medium">{label}</p>
      </div>
    </div>
  );
}
