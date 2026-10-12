import { useEffect, useState } from "react";
import { listGratitude, deleteGratitude } from "../services/journalService";
import { getErrorMessage } from "../lib/errors";

export default function GratitudeJarPage() {
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listGratitude()
      .then((data) => {
        if (!cancelled) setSnippets(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load gratitude jar:", err);
        if (!cancelled) setLoadError(getErrorMessage(err, "We couldn't open your gratitude jar."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleRetry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  };

  const handleDelete = async (id) => {
    setActionError(null);
    setDeletingId(id);
    try {
      await deleteGratitude(id);
      setSnippets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Failed to delete gratitude snippet:", err);
      setActionError(getErrorMessage(err, "We couldn't remove that note. Please try again."));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="text-center py-10" role="status">Loading jar...</div>;

  if (loadError) {
    return (
      <div className="max-w-md mx-auto text-center py-10 space-y-4" role="alert">
        <p className="text-rose-700 font-medium">{loadError}</p>
        <button type="button" onClick={handleRetry} className="medical-btn medical-btn-secondary px-5 py-2 text-sm">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-medical-fade-in">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-sage-100/50 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-sage-200/50 shadow-sm mb-3">
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sage-600" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </div>
        <h1 className="text-2xl sm:text-4xl font-light text-warm-800 tracking-tight">The Gratitude <span className="font-semibold text-sage-700">Vault</span></h1>
        <p className="text-warm-500 text-sm sm:text-base max-w-xl mx-auto">
          A collection of your highest energy positive moments. Reflect and recharge.
        </p>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-sm" role="alert">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {snippets.length === 0 ? (
          <div className="col-span-full text-center py-24 bg-white/40 backdrop-blur-xl rounded-3xl border border-sage-200/50 shadow-sm">
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" className="text-sage-300 mx-auto mb-4" viewBox="0 0 24 24"><path d="M20 12v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/><path d="M10 9H8m2 4H8m2 4H8"/><path d="M22 6.5A3.5 3.5 0 0 0 18.5 3c-1.76 0-3 .5-4.5 2 1.5 1.5 2.74 2 4.5 2A3.5 3.5 0 0 0 22 6.5Z"/></svg>
            <p className="text-warm-500 font-medium">No positive indicators recorded yet.</p>
            <p className="text-xs text-warm-400 mt-2">When positive sentiment is manually marked in your journal, it will be securely catalogued here.</p>
          </div>
        ) : (
          snippets.map((snip) => (
          <div key={snip.id} className="relative group overflow-hidden bg-white/70 backdrop-blur-xl border border-sage-200/60 p-6 sm:p-8 rounded-3xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-h-[180px] sm:min-h-[220px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sage-200/30 rounded-full blur-3xl -z-10 group-hover:bg-sage-300/40 transition-colors"></div>
              
              <div className="absolute top-6 right-6 opacity-10 group-hover:opacity-30 transition-opacity">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sage-700" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              </div>

              <p className="text-warm-800 font-medium leading-relaxed z-10 text-lg relative">
                <span className="text-3xl text-sage-300 absolute -top-4 -left-3 font-serif opacity-50">"</span>
                {snip.text}
                <span className="text-3xl text-sage-300 absolute -bottom-5 font-serif opacity-50 ml-1">"</span>
              </p>

              <div className="flex justify-between items-end mt-10 z-10">
                <span className="text-[10px] font-bold text-sage-600/70 uppercase tracking-widest bg-sage-50 px-3 py-1.5 rounded-lg border border-sage-100">
                   {new Date(snip.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                
                <button
                  type="button"
                  onClick={() => handleDelete(snip.id)}
                  disabled={deletingId === snip.id}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50 transition-all hover:bg-rose-100 border border-rose-100 shadow-sm"
                  title="Remove from jar"
                  aria-label="Remove this note from the gratitude jar"
                >
                  <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
