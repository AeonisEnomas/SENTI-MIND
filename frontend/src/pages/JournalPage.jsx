import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useAnalysis } from "../hooks/useAnalysis";
import { saveJournalEntry, saveGratitude } from "../services/journalService";
import { logMood } from "../services/moodService";
import { MAX_ANALYSIS_CHARS } from "../services/analysisService";
import RiskBadge from "../components/RiskBadge";
import InsightModal from "../components/InsightModal";
import CrisisAlertBanner from "../components/CrisisAlertBanner";
import GratitudeModal from "../components/GratitudeModal";
import SentiBotAvatar from "../components/SentiBotAvatar";
import { getCategoryConfig } from "../constants/categories";
import { getCrisisSeverity } from "../lib/risk";
import { getErrorMessage } from "../lib/errors";

// Recharts is heavy; load the chart only once there is a result to show.
const EmotionChart = lazy(() => import("../components/EmotionChart"));

// save.status: idle | saving | saved | entryFailed | moodFailed
const IDLE_SAVE = { status: "idle", message: null };

export default function JournalPage() {
  const [text, setText] = useState("");
  const [showInsight, setShowInsight] = useState(false);
  const [save, setSave] = useState(IDLE_SAVE);
  const [gratitudeStatus, setGratitudeStatus] = useState(null);
  const { result, loading, error, analyze, reset } = useAnalysis();
  const pendingMoodRef = useRef(null);
  const savedTimerRef = useRef(null);
  const analyzedTextRef = useRef("");

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);

  const markSaved = () => {
    pendingMoodRef.current = null;
    setSave({ status: "saved", message: "Saved to vault ✓" });
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSave(IDLE_SAVE), 3000);
  };

  const logPendingMood = async () => {
    try {
      await logMood(pendingMoodRef.current);
      markSaved();
    } catch (err) {
      console.error("Mood log failed:", err);
      setSave({
        status: "moodFailed",
        message: `Entry saved, but the mood log failed (${getErrorMessage(err, "unknown error")}).`,
      });
    }
  };

  const persistAnalysis = async (analysisRes, entryText) => {
    clearTimeout(savedTimerRef.current);
    setSave({ status: "saving", message: "Saving to vault..." });

    let savedEntry;
    try {
      savedEntry = await saveJournalEntry({
        raw_text: entryText,
        analysis: analysisRes,
        category: analysisRes.clinical.category,
        risk_level: analysisRes.risk.level,
      });
    } catch (err) {
      console.error("Journal save failed:", err);
      setSave({
        status: "entryFailed",
        message: `Couldn't save this entry (${getErrorMessage(err, "unknown error")}).`,
      });
      return;
    }

    pendingMoodRef.current = {
      category: analysisRes.clinical.category,
      confidence: analysisRes.clinical.confidence,
      risk_level: analysisRes.risk.level,
      risk_score: analysisRes.risk.score,
      entry_id: savedEntry?.id,
    };
    await logPendingMood();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    // 1. Analyze
    const analysisRes = await analyze(text);
    if (!analysisRes) return;

    // 2. Auto-save to Vault and Mood Log
    analyzedTextRef.current = text;
    await persistAnalysis(analysisRes, text);
  };

  // Retries only the step that failed: a mood-log failure never re-saves the entry.
  const handleRetrySave = async () => {
    if (save.status === "moodFailed" && pendingMoodRef.current) {
      setSave({ status: "saving", message: "Retrying mood log..." });
      await logPendingMood();
    } else if (save.status === "entryFailed" && result) {
      await persistAnalysis(result, analyzedTextRef.current);
    }
  };

  const handleGratitude = async () => {
    if (!text.trim()) return;
    try {
      await saveGratitude(text);
      setGratitudeStatus("success");
    } catch (err) {
      console.error("Gratitude save failed:", err);
      setGratitudeStatus("error");
    }
  };

  const handleReset = () => {
    clearTimeout(savedTimerRef.current);
    pendingMoodRef.current = null;
    setText("");
    setShowInsight(false);
    setSave(IDLE_SAVE);
    reset();
  };

  const catCfg = result ? getCategoryConfig(result.clinical.category) : null;
  const crisisSeverity = getCrisisSeverity(result);
  const isSaving = save.status === "saving";
  const saveFailed = save.status === "entryFailed" || save.status === "moodFailed";

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h1 className="medical-heading-2 text-warm-800 tracking-tight text-2xl sm:text-3xl">Secure Journal</h1>
        <p className="text-warm-500 text-sm mt-1">Reflect. AI will analyze and save your patterns securely.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN: Input & Actionable Insights */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {crisisSeverity && (
            <div className="animate-medical-fade-in">
              <CrisisAlertBanner isVisible={true} severity={crisisSeverity} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/dashboard/wellness" className="medical-btn bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 px-4 py-2 text-sm">
                  <span aria-hidden="true">🌬️</span> Box Breathing
                </Link>
                <Link to="/dashboard/wellness" className="medical-btn bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 px-4 py-2 text-sm">
                  <span aria-hidden="true">🖐️</span> 5-4-3-2-1 Grounding
                </Link>
              </div>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="medical-card p-4 sm:p-6 animate-medical-slide-up">
            <label htmlFor="journal-entry" className="medical-label flex justify-between items-center mb-3">
              <span>How are you feeling?</span>
              <span id="journal-entry-count" className="text-warm-400 font-normal normal-case text-xs">
                ({text.length}/{MAX_ANALYSIS_CHARS} chars)
              </span>
            </label>

            <textarea
              id="journal-entry"
              aria-describedby="journal-entry-count"
              maxLength={MAX_ANALYSIS_CHARS}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Start typing your entry here..."
              rows={6}
              disabled={loading}
              className="medical-input resize-none text-base"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <div
                className={`text-sm font-medium flex flex-wrap items-center gap-2 ${saveFailed ? "text-rose-700" : "text-sage-600"}`}
                role="status"
                aria-live="polite"
              >
                {save.message && <span>{save.message}</span>}
                {saveFailed && (
                  <button
                    type="button"
                    onClick={handleRetrySave}
                    className="underline font-semibold hover:text-rose-900"
                  >
                    {save.status === "moodFailed" ? "Retry mood log" : "Retry save"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 ml-auto">
                {result && result.clinical.category === "Normal" && (
                  <button type="button" onClick={handleGratitude} disabled={isSaving} className="medical-btn medical-btn-secondary py-2 px-3 text-sm shadow-sm disabled:opacity-50">
                    <span aria-hidden="true">🫙</span> Add to Jar
                  </button>
                )}
                {result ? (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isSaving}
                    title={isSaving ? "Please wait until your entry is saved" : undefined}
                    className="medical-btn medical-btn-secondary py-2 px-4 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    New Entry
                  </button>
                ) : (
                  <button type="submit" disabled={loading || !text.trim()} className="medical-btn medical-btn-primary py-2 px-5 text-sm shadow-md flex items-center gap-2">
                    {loading ? (
                      <><SentiBotAvatar emotion="loading" size="xs" /><span>Analyzing...</span></>
                    ) : (
                      "Analyze & Save"
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>

          {error && <div className="p-4 bg-rose-50 text-rose-700 rounded-lg" role="alert">{error}</div>}

          {/* AI Clinical Insight Button - Underneath text */}
          {result?.insight && (
            <button
              type="button"
              onClick={() => setShowInsight(true)}
              aria-haspopup="dialog"
              className="medical-card p-6 flex items-center gap-6 w-full text-left hover:bg-sage-50 transition-colors cursor-pointer group animate-medical-fade-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400"
            >
              <span className="w-16 h-16 rounded-full bg-sage-100 flex-shrink-0 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-inner border border-sage-200" aria-hidden="true">💡</span>
              <span className="block">
                <span className="block font-semibold text-warm-800 text-lg tracking-tight">AI Clinical Insight Generated</span>
                <span className="block text-sm text-warm-500 mt-1">We've identified actionable patterns tailored specifically to this entry.</span>
                <span className="inline-flex items-center mt-3 text-sage-600 font-medium text-sm group-hover:underline">
                  Read Detailed Insight <span className="ml-1 group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span>
                </span>
              </span>
            </button>
          )}
        </div>

        {/* RIGHT COLUMN: Analytics Panel */}
        <div className="lg:col-span-1 flex flex-col gap-6 sticky top-8">
           {result ? (
             <div className="space-y-6 animate-medical-fade-in">
               <div className="flex items-center justify-between pb-2 border-b border-sage-200/60">
                 <h3 className="medical-label">Live Analysis</h3>
                 <span className="flex h-2 w-2" aria-hidden="true">
                   <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-sage-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-sage-500"></span>
                 </span>
               </div>

               {/* SentiBot emotion display */}
               <div className="flex flex-col items-center py-4">
                 <div
                   className="hover:scale-105 transition-transform duration-300 group relative"
                   title="Your SentiBot Companion"
                 >
                   <SentiBotAvatar
                     emotion={result.clinical.category}
                     size="lg"
                     animate={true}
                     showLabel={true}
                   />
                 </div>
               </div>

               <div className={`medical-card p-5 border-l-4 ${catCfg.border}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 flex items-center justify-center rounded-xl text-3xl ${catCfg.bg} ${catCfg.text}`} aria-hidden="true">{catCfg.icon}</div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-warm-400 mb-0.5">Primary State</p>
                      <h3 className={`text-xl font-bold leading-tight tracking-tight ${catCfg.text}`}>{catCfg.label}</h3>
                      <p className="text-xs text-warm-500 mt-1">Confidence: {(result.clinical.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>
               </div>

               <RiskBadge level={result.risk.level} score={result.risk.score} triggers={result.risk.triggers} safety_protocol={result.risk.safety_protocol} components={result.risk.components} />

               <div className="medical-card p-5">
                 <p className="text-[10px] font-bold uppercase tracking-wider text-warm-500 mb-4">Emotional Breakdown</p>
                 <Suspense fallback={<div className="h-72 flex items-center justify-center text-xs text-warm-400">Loading chart...</div>}>
                   <EmotionChart emotions={result.emotions ?? []} />
                 </Suspense>
               </div>
             </div>
           ) : loading ? (
             <div className="h-full min-h-[360px] border-2 border-dashed border-sage-200 rounded-3xl flex flex-col items-center justify-center p-8 text-center bg-sage-50/50" role="status" aria-live="polite">
               <SentiBotAvatar emotion="loading" size="lg" animate={true} />
               <p className="text-sm font-semibold text-warm-600 tracking-tight mt-4">Analyzing Your Entry...</p>
               <p className="text-xs text-warm-400 mt-2 leading-relaxed">SentiBot is reading your thoughts and preparing clinical insights.</p>
             </div>
           ) : (
             <div className="h-full min-h-[360px] border-2 border-dashed border-sage-200 rounded-3xl flex flex-col items-center justify-center text-warm-400 p-8 text-center bg-sage-50/50">
               <div
                 className="hover:scale-105 transition-transform duration-300"
                 title="Your SentiBot Companion"
               >
                 <SentiBotAvatar emotion="idle" size="lg" animate={true} />
               </div>
               <p className="text-sm font-semibold text-warm-600 tracking-tight mt-4">Awaiting Entry</p>
               <p className="text-xs mt-2 leading-relaxed">Write your journal entry and analyze it to view your real-time psychological metrics.</p>
             </div>
           )}
        </div>
      </div>

      {showInsight && <InsightModal insight={result?.insight} modelsUsed={result?.models_used} onClose={() => setShowInsight(false)} />}
      <GratitudeModal isOpen={gratitudeStatus !== null} isError={gratitudeStatus === "error"} onClose={() => setGratitudeStatus(null)} />
    </div>
  );
}
