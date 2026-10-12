import { useModalA11y } from "../hooks/useModalA11y";
import { X, Sparkles, Heart, Brain, Shield, Info } from "lucide-react";

export default function InsightModal({ insight, modelsUsed, onClose }) {
  const modalRef = useModalA11y(Boolean(insight), onClose);

  if (!insight) return null;

  // Parse the structured insight content
  const parseInsight = (content) => {
    const sections = {
      feeling: "",
      why: "",
      issues: "",
      strategies: [],
    };

    // Extract sections using regex
    const feelingMatch = content.match(/\*\*What You Are Feeling:\*\*\s*([\s\S]*?)(?=\*\*Why You Might Be Feeling This:\**|$)/);
    const whyMatch = content.match(/\*\*Why You Might Be Feeling This:\*\*\s*([\s\S]*?)(?=\*\*Potential Issues\/Risks:\**|$)/);
    const issuesMatch = content.match(/\*\*Potential Issues\/Risks:\*\*\s*([\s\S]*?)(?=\*\*Exercises \u0026 Coping Strategies:\**|$)/);
    const copingMatch = content.match(/\*\*Exercises \u0026 Coping Strategies:\*\*\s*([\s\S]*?)$/);

    if (feelingMatch) sections.feeling = feelingMatch[1].trim().replace(/\*\*(.*?)\*\*/g, "$1");
    if (whyMatch) sections.why = whyMatch[1].trim().replace(/\*\*(.*?)\*\*/g, "$1");
    if (issuesMatch) sections.issues = issuesMatch[1].trim().replace(/\*\*(.*?)\*\*/g, "$1");
    
    if (copingMatch) {
      const copingText = copingMatch[1].trim();
      sections.strategies = copingText
        .split("\n")
        .map(line => line.replace(/^(\d+\.|-|\*)\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1").trim())
        .filter(line => line.length > 0);
    }

    return sections;
  };

  const sections = parseInsight(insight);
  const hasStructuredContent = sections.feeling || sections.why || sections.strategies.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insight-modal-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-warm-900/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden medical-card-elevated animate-medical-slide-up"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-sage-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-400 to-sage-600 flex items-center justify-center text-white shadow-medical"
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 id="insight-modal-title" className="font-bold text-warm-800">
                  AI Insight
                </h2>
                <p className="text-xs text-warm-500">Personalized Support Recommendations</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="w-10 h-10 rounded-full flex items-center justify-center text-warm-500 hover:bg-sage-50 hover:text-sage-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-5">
            {hasStructuredContent ? (
              <>
                {/* What You're Feeling */}
                {sections.feeling && (
                  <section className="medical-card-subtle p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-sage-100 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-sage-600" />
                      </div>
                      <h3 className="font-semibold text-warm-800">What You Are Feeling</h3>
                    </div>
                    <p className="text-sm text-warm-700 leading-relaxed pl-10">
                      {sections.feeling}
                    </p>
                  </section>
                )}

                {/* Why You Might Be Feeling This */}
                {sections.why && (
                  <section className="medical-card-subtle p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center">
                        <Info className="w-4 h-4 text-warm-600" />
                      </div>
                      <h3 className="font-semibold text-warm-800">Why You Might Be Feeling This</h3>
                    </div>
                    <p className="text-sm text-warm-700 leading-relaxed pl-10">
                      {sections.why}
                    </p>
                  </section>
                )}

                {/* Potential Issues */}
                {sections.issues && (
                  <section className="medical-card border-medical-moderate/20 bg-medical-moderate/5 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-medical-moderate/20 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-medical-moderate" />
                      </div>
                      <h3 className="font-semibold text-warm-800">Potential Considerations</h3>
                    </div>
                    <p className="text-sm text-warm-700 leading-relaxed pl-10">
                      {sections.issues}
                    </p>
                  </section>
                )}

                {/* Coping Strategies */}
                {sections.strategies.length > 0 && (
                  <section className="medical-card border-sage-300 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-sage-100 flex items-center justify-center">
                        <Heart className="w-4 h-4 text-sage-600" />
                      </div>
                      <h3 className="font-semibold text-warm-800">Coping Strategies & Exercises</h3>
                    </div>
                    
                    <ul className="space-y-3 pl-10">
                      {sections.strategies.map((strategy, idx) => (
                        <li key={idx} className="flex items-start gap-3 group">
                          <span className="w-6 h-6 rounded-full bg-sage-100 flex items-center justify-center text-xs font-medium text-sage-700 flex-shrink-0 mt-0.5 group-hover:bg-sage-200 transition-colors">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-warm-700 leading-relaxed pt-0.5">
                            {strategy}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              /* Fallback for non-standard generation */
              <section className="medical-card-subtle p-5">
                <p className="text-sm text-warm-700 leading-relaxed whitespace-pre-line">
                  {insight.replace(/\*\*(.*?)\*\*/g, "$1")}
                </p>
              </section>
            )}

            {/* Model Telemetry */}
            {modelsUsed && modelsUsed.length > 0 && (
              <section className="pt-4 border-t border-sage-100">
                <button
                  className="flex items-center gap-2 text-xs text-warm-500 hover:text-sage-600 transition-colors"
                  onClick={(e) => {
                    const details = e.currentTarget.nextElementSibling;
                    details?.classList.toggle("hidden");
                  }}
                >
                  <Info className="w-3 h-3" />
                  <span className="font-medium">Technical Details</span>
                </button>
                
                <div className="hidden mt-4 space-y-3">
                  {modelsUsed.map((model, idx) => (
                    <div key={idx} className="bg-warm-50 p-3 rounded-lg border border-warm-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-warm-700">{model.name}</span>
                        <span className="text-[10px] uppercase font-bold text-warm-400 border border-warm-200 px-1.5 py-0.5 rounded">
                          {model.type}
                        </span>
                      </div>
                      {model.details?.total_tokens && (
                        <div className="text-[10px] text-warm-500 flex gap-3">
                          <span>Tokens: {model.details.total_tokens}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-sage-100 px-6 py-4">
          <button
            onClick={onClose}
            className="medical-btn medical-btn-primary w-full"
          >
            Got it, thank you
          </button>
        </div>
      </div>
    </div>
  );
}
