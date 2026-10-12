import { useModalA11y } from "../hooks/useModalA11y";

export default function GratitudeModal({ isOpen, onClose, isError }) {
  const modalRef = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gratitude-modal-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-warm-900/40 backdrop-blur-md transition-opacity animate-medical-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-sm overflow-hidden bg-white/90 backdrop-blur-xl border border-sage-200/60 shadow-medical-lg rounded-3xl animate-medical-slide-up p-8 text-center"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-sage-200/40 rounded-full blur-3xl pointer-events-none -z-10"></div>
        
        {isError ? (
          <>
            <div className="mx-auto w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6 border border-rose-100 shadow-sm text-rose-500">
               <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            </div>
            <h2 id="gratitude-modal-title" className="text-2xl font-bold text-warm-800 tracking-tight mb-2">Save Failed</h2>
            <p className="text-warm-500 font-medium mb-8">We couldn't secure this entry into your vault right now. Please try again later.</p>
            <button
              onClick={onClose}
              className="inline-flex w-full items-center justify-center gap-2 px-8 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto w-16 h-16 bg-sage-50 rounded-2xl flex items-center justify-center mb-6 border border-sage-100 shadow-sm text-sage-600">
               <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </div>
            <h2 id="gratitude-modal-title" className="text-2xl font-bold text-warm-800 tracking-tight mb-2">Secured in Vault</h2>
            <p className="text-warm-500 font-medium mb-8 leading-relaxed">Your positive indicator has been safely cataloged in your Gratitude Vault.</p>
            <button
              onClick={onClose}
              className="inline-flex w-full items-center justify-center gap-2 px-8 py-3.5 bg-sage-700 hover:bg-sage-800 text-white font-semibold rounded-2xl shadow-medical transition-all duration-300 hover:scale-[1.02] hover:shadow-medical-lg"
            >
              Return to Journal
            </button>
          </>
        )}
      </div>
    </div>
  );
}
