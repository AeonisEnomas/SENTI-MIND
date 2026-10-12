import { useState } from "react";
import { submitScreener } from "../services/screenerService";
import { getErrorMessage } from "../lib/errors";

const GAD2_QUESTIONS = [
  "Over the last 2 weeks, how often have you been bothered by feeling nervous, anxious, or on edge?",
  "Over the last 2 weeks, how often have you been bothered by not being able to stop or control worrying?",
];

const PHQ2_QUESTIONS = [
  "Over the last 2 weeks, how often have you been bothered by having little interest or pleasure in doing things?",
  "Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?",
];

const OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

export default function ScreenerPage() {
  const [step, setStep] = useState("start"); // start, gad2, phq2, result
  const [gad2Answers, setGad2Answers] = useState([null, null]);
  const [phq2Answers, setPhq2Answers] = useState([null, null]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleNext = () => setStep(step === "gad2" ? "phq2" : "result");

  // Leaving or retaking the screener must not carry over previous answers/results.
  const resetScreener = () => {
    setGad2Answers([null, null]);
    setPhq2Answers([null, null]);
    setResult(null);
    setSubmitError(null);
    setStep("start");
  };
  const isGad2Complete = gad2Answers[0] !== null && gad2Answers[1] !== null;
  const isPhq2Complete = phq2Answers[0] !== null && phq2Answers[1] !== null;

  const handleSubmit = async () => {
    setLoading(true);
    setSubmitError(null);
    try {
      const res = await submitScreener(gad2Answers, phq2Answers);
      setResult(res);
      setStep("result");
    } catch (err) {
      console.error("Screener submission failed:", err);
      setSubmitError(getErrorMessage(err, "We couldn't submit your answers. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const renderQuestions = (questions, answers, setAnswers, prefix) => (
    <div className="space-y-8 animate-medical-slide-up relative z-10">
      {questions.map((q, idx) => (
        <div key={idx} className="bg-white/70 backdrop-blur-xl border border-sage-200/60 shadow-sm p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-sage-200/20 rounded-full blur-3xl transition-all duration-500 group-hover:bg-sage-300/30"></div>
          
          <p id={`${prefix}-q${idx}`} className="text-warm-800 font-medium mb-6 text-lg tracking-tight relative z-10">{q}</p>
          <div className="flex flex-col sm:flex-row gap-3 relative z-10" role="group" aria-labelledby={`${prefix}-q${idx}`}>
            {OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={answers[idx] === opt.value}
                onClick={() => {
                  const newAnswers = [...answers];
                  newAnswers[idx] = opt.value;
                  setAnswers(newAnswers);
                }}
                className={`flex-1 p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-sm font-semibold flex items-center justify-center text-center
                  ${answers[idx] === opt.value
                    ? "bg-sage-700 text-white border-sage-700 shadow-medical ring-4 ring-sage-600/10"
                    : "bg-white/80 backdrop-blur-sm text-warm-600 border-sage-200/60 hover:border-sage-400 hover:bg-sage-50/80 hover:shadow-sm"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 animate-medical-fade-in relative">
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-sage-200/50 pb-5 relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sage-200/30 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="space-y-1">
           <div className="inline-flex items-center gap-2 px-3 py-1 bg-sage-100/50 border border-sage-200/60 rounded-lg text-sage-700 text-xs font-bold uppercase tracking-widest mb-1">
             <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Standard Assessment
           </div>
           <h1 className="text-2xl sm:text-4xl font-light text-warm-800 tracking-tight">Clinical <span className="font-semibold text-sage-700">Screener</span></h1>
           <p className="text-warm-500 text-sm sm:text-base">Brief diagnostic check-in for anxiety (GAD-2) and depression (PHQ-2).</p>
        </div>
      </div>

      {step === "start" && (
        <div className="bg-white/70 backdrop-blur-xl border border-sage-200/60 shadow-sm p-8 sm:p-12 text-center animate-medical-slide-up rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-sage-200/20 rounded-full blur-3xl pointer-events-none -z-10"></div>
          
          <div className="mx-auto w-16 h-16 sm:w-24 sm:h-24 bg-sage-50/80 rounded-3xl flex items-center justify-center border border-sage-100 shadow-sm mb-6 rotate-3">
             <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sage-600" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-warm-800 mb-3 tracking-tight">Start Assessment</h2>
          <p className="text-warm-600 text-sm sm:text-base mb-8 max-w-md mx-auto leading-relaxed">
            This involves 4 short questions about how you've been feeling over the last 2 weeks. 
            It is not a diagnostic tool, but can help signal if you should talk to a professional.
          </p>
          <button onClick={() => setStep("gad2")} className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-sage-700 hover:bg-sage-800 text-white font-semibold rounded-2xl shadow-md transition-all duration-300 hover:scale-105">
            Begin Assessment <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      )}

      {step === "gad2" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-4">
            <h2 className="text-xl font-bold text-sage-800 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-sage-100 text-sage-600 flex items-center justify-center text-sm">1</span>
              Part 1: Anxiety (GAD-2)
            </h2>
            <span className="text-xs font-bold uppercase tracking-widest bg-sage-100 text-sage-700 px-3 py-1.5 rounded-lg border border-sage-200/50">Progress: 50%</span>
          </div>
          {renderQuestions(GAD2_QUESTIONS, gad2Answers, setGad2Answers, "gad2")}
          <div className="flex justify-end pt-6">
            <button onClick={handleNext} disabled={!isGad2Complete} className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-sage-700 hover:bg-sage-800 text-white font-semibold rounded-2xl shadow-md transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed">
              Continue to Part 2 <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </div>
      )}

      {step === "phq2" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-4">
            <h2 className="text-xl font-bold text-sage-800 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-sage-100 text-sage-600 flex items-center justify-center text-sm">2</span>
              Part 2: Depression (PHQ-2)
            </h2>
            <span className="text-xs font-bold uppercase tracking-widest bg-sage-200 text-sage-800 px-3 py-1.5 rounded-lg border border-sage-300/50">Progress: 100%</span>
          </div>
          {renderQuestions(PHQ2_QUESTIONS, phq2Answers, setPhq2Answers, "phq2")}
          {submitError && (
            <div className="p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-sm" role="alert">
              {submitError}
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-4 pt-6">
            <button onClick={() => setStep("gad2")} className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-warm-600 border border-sage-200 font-semibold rounded-2xl shadow-sm transition-all duration-300 hover:bg-sage-50 hover:text-sage-800 hover:scale-[1.02]">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Back
            </button>
            <button onClick={handleSubmit} disabled={!isPhq2Complete || loading} className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-sage-700 hover:bg-sage-800 text-white font-semibold rounded-2xl shadow-medical transition-all duration-300 hover:scale-[1.02] hover:shadow-medical-lg disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed">
              {loading ? (
                <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Calculating...</>
              ) : (
                <>Submit Assessment <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></>
              )}
            </button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="space-y-6 animate-medical-slide-up">
          <div className="bg-white/70 backdrop-blur-xl border border-sage-200/60 shadow-sm p-6 sm:p-10 rounded-3xl relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-sage-200/30 rounded-full blur-3xl pointer-events-none -z-10"></div>
            
            <div className="flex flex-col items-center mb-8">
               <div className="w-14 h-14 rounded-2xl bg-sage-100 text-sage-600 flex items-center justify-center mb-3 shadow-sm border border-sage-200">
                  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
               </div>
               <h2 className="text-2xl sm:text-3xl font-bold text-sage-800 tracking-tight">Assessment Complete</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-8 relative z-10">
              <div className="bg-white/80 backdrop-blur-md p-5 sm:p-8 rounded-2xl border border-sage-100 shadow-sm relative overflow-hidden group hover:border-sage-300 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-sage-100/50 rounded-full blur-2xl pointer-events-none group-hover:bg-sage-200/50 transition-colors"></div>
                <p className="text-warm-500 font-bold uppercase tracking-widest text-xs mb-2">Anxiety Component</p>
                <div className="text-4xl sm:text-6xl font-black text-sage-700 tracking-tighter mb-3">{result.gad2_score} <span className="text-xl sm:text-2xl text-sage-300 font-normal">/ 6</span></div>
                <p className={`text-sm font-semibold ${result.gad2_score >= 3 ? "text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg inline-block border border-rose-100" : "text-sage-700 bg-sage-50 px-3 py-1.5 rounded-lg inline-block border border-sage-100"}`}>
                  {result.gad2_interpretation}
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-md p-5 sm:p-8 rounded-2xl border border-sage-100 shadow-sm relative overflow-hidden group hover:border-sage-300 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-sage-100/50 rounded-full blur-2xl pointer-events-none group-hover:bg-sage-200/50 transition-colors"></div>
                <p className="text-warm-500 font-bold uppercase tracking-widest text-xs mb-2">Depression Component</p>
                <div className="text-4xl sm:text-6xl font-black text-sage-700 tracking-tighter mb-3">{result.phq2_score} <span className="text-xl sm:text-2xl text-sage-300 font-normal">/ 6</span></div>
                <p className={`text-sm font-semibold ${result.phq2_score >= 3 ? "text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg inline-block border border-rose-100" : "text-sage-700 bg-sage-50 px-3 py-1.5 rounded-lg inline-block border border-sage-100"}`}>
                  {result.phq2_interpretation}
                </p>
              </div>
            </div>

            {(result.gad2_score >= 3 || result.phq2_score >= 3) && (
              <div className="p-6 bg-rose-50/80 backdrop-blur-md border border-rose-200/60 rounded-2xl text-rose-800 text-sm text-left shadow-sm flex items-start gap-4">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5 text-rose-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div className="flex-1">
                   <strong className="block text-base mb-1 text-rose-900">Clinical Attention Recommended</strong>
                   <span className="text-rose-700/90 leading-relaxed font-medium">Since one or both scores are elevated (3 or higher), it is highly recommended to share these results with a healthcare provider for a thorough evaluation and support.</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center pt-4">
             <button type="button" onClick={resetScreener} className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-warm-700 border border-sage-200 font-bold tracking-wide rounded-2xl shadow-sm transition-all duration-300 hover:bg-sage-50 hover:scale-105">
               Exit Screener
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
