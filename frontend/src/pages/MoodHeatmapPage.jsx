import { useEffect, useState } from "react";
import { getMoodHeatmap } from "../services/moodService";
import { CATEGORY_CONFIG, getCategoryConfig } from "../constants/categories";
import { lastNDates, parseLocalDate } from "../lib/dates";
import { getErrorMessage } from "../lib/errors";

const LEGEND = Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => [cat, cfg.swatch]);

export default function MoodHeatmapPage() {
  const [data, setData] = useState({ days: [], feedback: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let cancelled = false;
    getMoodHeatmap()
      .then((res) => {
        if (!cancelled) setData({ days: res?.days ?? [], feedback: res?.feedback ?? "" });
      })
      .catch((err) => {
        console.error("Failed to load mood heatmap:", err);
        if (!cancelled) setError(getErrorMessage(err, "We couldn't load your mood heatmap."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (loading) return <div className="text-center py-10" role="status">Loading heatmap...</div>;

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-10 space-y-4" role="alert">
        <p className="text-rose-700 font-medium">{error}</p>
        <button type="button" onClick={handleRetry} className="medical-btn medical-btn-secondary px-5 py-2 text-sm">
          Try again
        </button>
      </div>
    );
  }

  // 30-day grid keyed by the user's LOCAL calendar date (not UTC).
  const byDate = new Map(data.days.map((x) => [x.logged_date, x]));
  const grid = lastNDates(30).map((date) => ({ date, log: byDate.get(date) }));

  return (
    <div className="space-y-6 animate-medical-fade-in relative">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-sage-100/50 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-sage-200/50 shadow-sm mb-3">
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sage-600" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
        </div>
        <h1 className="text-2xl sm:text-4xl font-light text-warm-800 tracking-tight">Clinical <span className="font-semibold text-sage-700">Heatmap</span></h1>
        <p className="text-warm-500 text-sm sm:text-base max-w-xl mx-auto">
          Pattern recognition of your longitudinal emotional states across the past 30 days.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Main Grid Block */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl border border-sage-200/60 p-4 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sage-200/20 rounded-full blur-3xl pointer-events-none"></div>
          
          <h3 className="text-lg sm:text-xl font-bold text-warm-800 mb-4 sm:mb-6 flex items-center gap-2">
            30-Day Grid <span className="text-xs font-semibold bg-sage-100 text-sage-600 px-2 py-1 rounded-md">Live</span>
          </h3>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-3 mb-6 sm:mb-10 relative z-10">
            {grid.map((cell) => (
              <div
                key={cell.date}
                className={`aspect-square rounded-2xl flex items-center justify-center relative group transition-all duration-300 hover:scale-110 hover:-translate-y-1 hover:shadow-lg hover:z-20 border cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-500
                  ${cell.log ? `${getCategoryConfig(cell.log.category).swatch} border-white/20` : "bg-white/40 border-sage-200/40 backdrop-blur-sm"}
                `}
                style={cell.log ? { boxShadow: "inset 0 2px 4px rgba(255,255,255,0.2)" } : {}}
                tabIndex={0}
                aria-label={`${parseLocalDate(cell.date).toLocaleDateString(undefined, { month: "long", day: "numeric" })}: ${cell.log ? cell.log.category : "no data logged"}`}
              >
                {cell.log && <div className="hidden md:block w-2.5 h-2.5 rounded-full bg-white opacity-40 shadow-sm" />}
                
                {/* Modern Tooltip */}
                <div aria-hidden="true" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max px-4 py-2 bg-warm-800/90 backdrop-blur-sm text-white text-xs font-medium rounded-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-focus:opacity-100 group-focus:translate-y-0 pointer-events-none transition-all duration-200 z-30 shadow-medical-lg border border-warm-700/50 flex flex-col items-center">
                  <span className="text-warm-300 mb-1">{parseLocalDate(cell.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
                  <span className="font-bold flex items-center gap-1.5">
                    {cell.log ? (
                      <>
                        <span className={`w-2 h-2 rounded-full ${getCategoryConfig(cell.log.category).swatch}`}></span>
                        {cell.log.category}
                      </>
                    ) : "No Data Logged"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 pt-6 border-t border-sage-100/50">
            {LEGEND.map(([cat, bg]) => (
              <div key={cat} className="flex items-center gap-2 text-sm font-medium text-warm-600 transition-colors hover:text-warm-800 cursor-default">
                <span className={`w-3.5 h-3.5 rounded-md ${bg} shadow-sm border border-white/40`} /> 
                {cat}
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: AI Clinical Insight */}
        <div className="bg-sage-50/80 backdrop-blur-xl border border-sage-200/60 p-8 rounded-3xl shadow-sm flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sage-200/40 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center text-sage-600 shadow-sm">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
            </div>
            <h3 className="text-xl font-bold text-sage-800">Insight Engine</h3>
          </div>

          <div className="flex-1 relative z-10">
            {data.feedback ? (
              <p className="text-sage-700 leading-relaxed font-medium">"{data.feedback}"</p>
            ) : (
              <p className="text-sage-500 italic">No significant patterns detected yet. Continue logging your entries.</p>
            )}
          </div>
          
          <div className="mt-8 pt-6 border-t border-sage-200/50 flex justify-between items-center relative z-10">
            <span className="text-xs font-bold text-sage-500 uppercase tracking-widest">Model: BioMegatron</span>
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Active
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
