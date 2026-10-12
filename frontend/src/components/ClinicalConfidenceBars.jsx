import { getCategoryConfig } from "../constants/categories";

export default function ClinicalConfidenceBars({
  primaryCategory,
  confidence,
  topCategories,
}) {
  const primaryConfig = getCategoryConfig(primaryCategory);
  const primaryIcon = primaryConfig.icon;

  return (
    <div className="medical-card">
      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="medical-label mb-2">Clinical Assessment</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{primaryIcon}</span>
              <div>
                <p className={`text-xl font-bold ${primaryConfig.text}`}>
                  {primaryCategory}
                </p>
                <p className="text-xs text-warm-500 mt-0.5">
                  Primary classification
                </p>
              </div>
            </div>
          </div>
          
          <div 
            className={`w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-medical ${primaryConfig.bar}`}
          >
            {(confidence * 100).toFixed(0)}%
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-warm-600">Confidence Level</span>
            <span className={`text-sm font-bold ${primaryConfig.text}`}>
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-warm-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${primaryConfig.bar}`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        </div>

        {/* Alternative Possibilities */}
        {topCategories && topCategories.length > 1 && (
          <div className="border-t border-sage-100 pt-5">
            <p className="medical-label mb-3">Alternative Possibilities</p>

            <div className="space-y-2.5">
              {topCategories.slice(1, 4).map((category) => {
                const config = getCategoryConfig(category.category);
                const icon = config.icon;
                const percentage = (category.confidence * 100).toFixed(0);

                return (
                  <div key={category.category} className="flex items-center gap-3">
                    <span className="text-sm">{icon}</span>
                    <span className="text-sm w-28 truncate text-warm-600 font-medium"
                    >
                      {category.category}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-warm-100 overflow-hidden"
                    >
                      <div
                        className={`h-full rounded-full ${config.bar} opacity-60`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-warm-500 w-8 text-right font-medium"
                    >
                      {percentage}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Uncertainty Note */}
        {confidence < 0.7 && (
          <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 flex-shrink-0">⚠️</span>
              <p className="text-sm text-amber-700 leading-relaxed">
                Lower confidence detected ({(confidence * 100).toFixed(0)}%). 
                Consider this result as preliminary. Multiple categories show similar patterns.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
