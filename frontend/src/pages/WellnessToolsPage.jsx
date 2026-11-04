import { useState, useEffect } from "react";

export default function WellnessToolsPage() {
  const [activeTab, setActiveTab] = useState("breathing");

  return (
    <div className="space-y-6 animate-medical-fade-in relative">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-sage-200/50 pb-5 relative">
        <div className="absolute top-0 right-10 w-64 h-64 bg-sage-200/30 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="space-y-1">
           <div className="inline-flex items-center gap-2 px-3 py-1 bg-sage-100/50 border border-sage-200/60 rounded-lg text-sage-700 text-xs font-bold uppercase tracking-widest mb-1">
             <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg> Calming Tools
           </div>
           <h1 className="text-2xl sm:text-4xl font-light text-warm-800 tracking-tight">Wellness <span className="font-semibold text-sage-700">Hub</span></h1>
           <p className="text-warm-500 text-sm sm:text-base">Immediate relief techniques for moments of high stress or panic.</p>
        </div>
      </div>

      <div className="flex justify-center relative z-20">
        <div className="flex gap-1.5 p-1.5 bg-white/80 backdrop-blur-xl border border-sage-200/60 rounded-2xl shadow-sm w-full sm:w-max overflow-x-auto">
          <button
            onClick={() => setActiveTab("breathing")}
            className={`flex-1 sm:flex-none px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === "breathing" ? "bg-sage-600 text-white shadow-md" : "text-sage-600 hover:text-sage-800 hover:bg-sage-50"}`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12c0 2 5 2 5 2 0 4 5 8 5 8s5-4 5-8c0 0 5 0 5-2A10 10 0 0 0 12 2z"/></svg>
            Box Breathing 
          </button>
          <button
            onClick={() => setActiveTab("grounding")}
            className={`flex-1 sm:flex-none px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === "grounding" ? "bg-sage-600 text-white shadow-md" : "text-sage-600 hover:text-sage-800 hover:bg-sage-50"}`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            5-4-3-2-1 Grounding
          </button>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl border border-sage-200/60 shadow-sm p-6 sm:p-12 min-h-[420px] sm:min-h-[550px] flex items-center justify-center rounded-3xl relative overflow-hidden group">
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-sage-200/20 rounded-full blur-3xl pointer-events-none group-hover:bg-sage-300/20 transition-colors duration-1000"></div>
        {activeTab === "breathing" && <BoxBreather />}
        {activeTab === "grounding" && <GroundingTool />}
      </div>
    </div>
  );
}

function BoxBreather() {
  const [phase, setPhase] = useState("Rest"); // Inhale, Hold, Exhale, Hold
  const [timer, setTimer] = useState(4);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev > 1) return prev - 1;
        
        // Switch phase
        setPhase((p) => {
          if (p === "Inhale") return "Hold (Full)";
          if (p === "Hold (Full)") return "Exhale";
          if (p === "Exhale") return "Hold (Empty)";
          return "Inhale";
        });
        return 4;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [active]);

  const toggle = () => {
    if (!active) {
      setPhase("Inhale");
      setTimer(4);
    } else {
      setPhase("Rest");
      setTimer(0);
    }
    setActive(!active);
  };

  const getScale = () => {
    if (!active) return "scale-100 opacity-50";
    if (phase === "Inhale") return "scale-[1.8] opacity-100 transition-all duration-[4000ms] ease-linear shadow-[0_0_80px_rgba(16,185,129,0.2)]";
    if (phase === "Hold (Full)") return "scale-[1.8] opacity-100 transition-all duration-100 shadow-[0_0_80px_rgba(16,185,129,0.3)]";
    if (phase === "Exhale") return "scale-100 opacity-60 transition-all duration-[4000ms] ease-linear shadow-[0_0_20px_rgba(16,185,129,0.1)]";
    return "scale-100 opacity-60 transition-all duration-100";
  };

  return (
    <div className="text-center animate-medical-fade-in w-full relative z-10">
      <h2 className="text-2xl font-bold text-sage-800 tracking-tight mb-2">Box Breathing</h2>
      <p className="text-warm-500 font-medium mb-20 max-w-sm mx-auto">Breathe in, hold, breathe out and hold for four seconds each. A simple way to slow down when stress or panic builds.</p>

      <div className="relative w-48 h-48 mx-auto mb-20 flex items-center justify-center">
        {/* The Outer Breathing Aura */}
        <div className={`absolute w-32 h-32 rounded-full border border-sage-300/50 bg-gradient-to-tr from-sage-100/40 to-sage-50/10 flex items-center justify-center ${getScale()}`} />
        
        {/* The Inner Anchor */}
        <div className={`relative z-10 w-28 h-28 rounded-full border border-white/40 shadow-xl flex flex-col items-center justify-center overflow-hidden transition-colors duration-1000 ${
          active ? 'bg-sage-600 text-white' : 'bg-white/80 backdrop-blur-sm text-sage-800'
        }`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
          <span className="relative z-10 text-xs font-bold uppercase tracking-widest opacity-80">{active ? phase.split(" ")[0] : "Ready"}</span>
          {active ? (
            <span className="relative z-10 text-5xl font-black font-mono mt-1 tracking-tighter mix-blend-plus-lighter">{timer}</span>
          ) : (
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-2 opacity-50" viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12c0 2 5 2 5 2 0 4 5 8 5 8s5-4 5-8c0 0 5 0 5-2A10 10 0 0 0 12 2z"/></svg>
          )}
        </div>
      </div>

      <button onClick={toggle} className={`group inline-flex items-center justify-center gap-2 px-10 py-4 font-bold rounded-2xl shadow-medical transition-all duration-300 hover:-translate-y-1 hover:shadow-medical-lg relative overflow-hidden ${
        active ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-sage-800 text-white hover:bg-sage-900'
      }`}>
        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:transition-all group-hover:duration-1000 group-hover:translate-x-full"></div>
        {active ? (
          <><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/></svg> Stop</>
        ) : (
          <><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Routine</>
        )}
      </button>
    </div>
  );
}

const GROUNDING_STEPS = [
  { item: "Things you can SEE", count: 5, icon: <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg> },
  { item: "Things you can FEEL", count: 4, icon: <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M10 5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M6 7a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v10a8 8 0 0 0 16 0v-6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/></svg> },
  { item: "Things you can HEAR", count: 3, icon: <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M18 8C18 3.5 15.3 2 12 2S6 3.5 6 8c0 4.5 2 5.5 2 9.5"/><path d="M8 17.5V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.5"/><path d="M10 10h4"/></svg> },
  { item: "Things you can SMELL", count: 2, icon: <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2c0 0-6 4-6 10s3 8 6 8 6-2 6-8-6-10-6-10z"/><path d="M12 16c1.5 0 3-1.5 3-3s-3-5-3-5-3 3.5-3 5 1.5 3 3 3z"/></svg> },
  { item: "Thing you can TASTE", count: 1, icon: <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
];

function GroundingTool() {
  const [stepIndex, setStepIndex] = useState(0);
  const [items, setItems] = useState(["", "", "", "", ""]);

  const step = GROUNDING_STEPS[stepIndex];
  const isComplete = stepIndex === GROUNDING_STEPS.length;

  const allFilled = items.slice(0, step?.count || 0).every(val => val.trim().length > 0);

  const handleNext = () => {
    setItems(["", "", "", "", ""]); // Reset inputs for next screen
    setStepIndex(s => s + 1);
  };

  if (isComplete) {
    return (
      <div className="text-center animate-medical-fade-in w-full relative z-10 px-4">
        <div className="mx-auto w-24 h-24 bg-sage-100 rounded-3xl flex items-center justify-center border border-sage-200 shadow-sm mb-8 rotate-3">
           <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sage-600" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h2 className="text-3xl font-bold text-sage-800 tracking-tight mb-4">Grounding Complete</h2>
        <p className="text-warm-600 mb-10 max-w-md mx-auto text-lg leading-relaxed">
          Notice how your body feels now compared to when you started. You have safely anchored yourself back to the present moment.
        </p>
        <button onClick={() => setStepIndex(0)} className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-warm-700 border border-sage-200 font-bold tracking-wide rounded-2xl shadow-sm transition-all duration-300 hover:bg-sage-50 hover:scale-[1.02]">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Restart Exercise
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto animate-medical-fade-in relative z-10">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-sage-800 tracking-tight mb-2 flex items-center justify-center gap-3">
          <span className="bg-sage-100 text-sage-600 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black border border-sage-200/50 shadow-sm">5</span> Sensory Grounding
        </h2>
        <p className="text-warm-500 font-medium">Consciously bring your attention back into the physical world.</p>
      </div>

      <div className="mb-6 flex gap-2 justify-center">
        {GROUNDING_STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 w-12 rounded-full transition-all duration-500 ${i <= stepIndex ? "bg-sage-600 scale-y-110" : "bg-sage-100"}`} />
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-sage-200/80 p-8 rounded-3xl text-center mb-8 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-sage-100/50 rounded-full blur-2xl pointer-events-none group-hover:bg-sage-200/50 transition-colors"></div>
        <div className="text-sage-600 flex justify-center mb-6 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
           {step.icon}
        </div>
        <h3 className="text-3xl font-black text-sage-800 tracking-tighter mb-2">Name {step.count}</h3>
        <p className="text-lg font-bold text-warm-500 uppercase tracking-widest">{step.item}</p>
      </div>

      <div className="space-y-4 mb-10">
        {Array.from({ length: step.count }).map((_, i) => (
          <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 group">
             <div className="w-8 h-8 rounded-xl bg-sage-50 border border-sage-200/50 text-sage-700 flex items-center justify-center text-sm font-black shrink-0 shadow-sm group-hover:bg-sage-100 transition-colors">{i + 1}</div>
             <input
               type="text"
               value={items[i]}
               onChange={(e) => {
                 const newItems = [...items];
                 newItems[i] = e.target.value;
                 setItems(newItems);
               }}
               placeholder="Focus entirely on this object..."
               className="w-full bg-white/60 border border-sage-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 shadow-sm transition-all text-warm-800 font-medium placeholder-warm-400"
             />
          </div>
        ))}
      </div>

      <button onClick={handleNext} disabled={!allFilled} className="w-full inline-flex justify-center items-center gap-2 px-8 py-4 bg-sage-700 hover:bg-sage-800 text-white font-bold rounded-2xl shadow-medical transition-all duration-300 hover:scale-[1.01] hover:shadow-medical-lg disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed">
        Continue Forward <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </button>
    </div>
  );
}
