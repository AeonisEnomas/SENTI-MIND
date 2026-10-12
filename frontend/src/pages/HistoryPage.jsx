import { useEffect, useState } from "react";
import { getMoodTrends } from "../services/moodService";
import { exportElementToPDF } from "../services/pdfService";
import { getErrorMessage } from "../lib/errors";
import { parseLocalDate } from "../lib/dates";

export default function HistoryPage() {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleRetry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let cancelled = false;
    getMoodTrends(30)
      .then((data) => {
        if (!cancelled) setTrends(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load mood history:", err);
        if (!cancelled) setLoadError(getErrorMessage(err, "We couldn't load your history."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportElementToPDF("report-content", "sentimind-monthly-report");
    } catch (err) {
      console.error("PDF export failed:", err);
      setExportError("We couldn't create the PDF report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="text-center py-10" role="status">Loading history...</div>;

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-sage-200/50 pb-5 relative">
        <div className="absolute top-0 left-0 w-64 h-64 bg-sage-200/30 rounded-full blur-3xl pointer-events-none -z-10"></div>
        
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-sage-100/50 border border-sage-200/60 rounded-lg text-sage-700 text-xs font-bold uppercase tracking-widest mb-2">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Data Vault
          </div>
          <h1 className="text-2xl sm:text-4xl font-light text-warm-800 tracking-tight">Clinical <span className="font-semibold text-sage-700">History</span></h1>
          <p className="text-warm-500 text-sm sm:text-base">Secure repository of your emotional tracking. Ready for counselor export.</p>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || trends.length === 0}
          className="group relative inline-flex items-center justify-center gap-2 px-5 py-2.5 w-full sm:w-auto bg-sage-800 hover:bg-sage-900 text-white text-sm rounded-xl shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 overflow-hidden"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:transition-all group-hover:duration-1000 group-hover:translate-x-full"></div>
          {exporting ? (
            <>
               <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Compiling...
            </>
          ) : (
            <>
               <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
               Export PDF Report
            </>
          )}
        </button>
      </div>

      {exportError && (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-sm" role="alert">
          {exportError}
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-xl border border-sage-200/60 rounded-2xl shadow-sm p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-sage-200/20 rounded-full blur-3xl pointer-events-none"></div>

        <div id="report-content" className="bg-white rounded-2xl p-6 shadow-sm border border-sage-100 relative z-10 transition-colors">
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-warm-100">
            <div className="w-12 h-12 rounded-xl bg-sage-50 flex items-center justify-center text-sage-600 shadow-sm border border-sage-200/50">
               <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-warm-800 tracking-tight">Longitudinal Data</h3>
              <p className="text-sm text-warm-500 font-medium">Record of inferred categories over 30 days</p>
            </div>
            {/* Minimalist Watermark for PDF */}
            <div className="ml-auto text-right opacity-30">
               <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
          </div>

          {trends.length === 0 ? (
            <div className="text-center py-20 bg-warm-50/50 rounded-2xl border border-dashed border-warm-200">
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1" className="text-warm-400 mx-auto mb-3" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              <p className="text-warm-600 font-medium">No log data available to compile.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trends.map(t => (
                 <div key={t.logged_date} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-warm-100 hover:border-sage-300 hover:bg-sage-50/30 hover:shadow-sm transition-all rounded-xl group">
                   <div className="flex items-center gap-4 mb-2 sm:mb-0">
                     <span className="font-semibold text-warm-800 w-32 bg-warm-100/50 px-2 py-1 rounded-md text-sm text-center border border-warm-200/50 flex items-center justify-center gap-2">
                       <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                       {parseLocalDate(t.logged_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}
                     </span>
                     <span className="px-3 py-1 rounded-md text-xs font-bold bg-sage-100 text-sage-800 shadow-sm border border-sage-200/60 uppercase tracking-widest relative overflow-hidden inline-flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-sage-500 shadow-sm"></span>
                       {t.category}
                     </span>
                   </div>
                   <div className="text-xs font-bold font-mono text-sage-600/60 bg-sage-50 px-3 py-1.5 rounded border border-sage-100/80 group-hover:text-sage-700 transition-colors">
                     {t.confidence != null ? `CONF: ${(t.confidence * 100).toFixed(1)}%` : ""}
                   </div>
                 </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

