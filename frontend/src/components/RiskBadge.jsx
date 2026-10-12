import { 
  Shield, 
  AlertTriangle, 
  TrendingUp,
  Heart,
  Activity
} from "lucide-react";
import { PRIMARY_CRISIS_RESOURCE, telHref } from "../constants/crisisResources";

// Medical-grade risk levels - AHCI compliant color system
const LEVEL_CONFIG = {
  low: {
    bg: "bg-medical-safe/10",
    border: "border-medical-safe/25",
    text: "text-medical-safe",
    bar: "from-medical-safe to-sage-600",
    icon: Shield,
    label: "Low Risk",
    emoji: "🌿",
    description: "No significant mental health concerns detected. Your emotional wellbeing appears stable.",
    ariaLabel: "Low risk assessment - no immediate concerns",
  },
  medium: {
    bg: "bg-medical-mild/10",
    border: "border-medical-mild/25",
    text: "text-medical-mild",
    bar: "from-medical-mild to-amber-500",
    icon: Activity,
    label: "Mild Concern",
    emoji: "🌅",
    description: "Some stress indicators present. Consider self-care practices and monitoring.",
    ariaLabel: "Medium risk assessment - mild concerns detected",
  },
  high: {
    bg: "bg-medical-moderate/10",
    border: "border-medical-moderate/25",
    text: "text-medical-moderate",
    bar: "from-medical-moderate to-medical-severe",
    icon: TrendingUp,
    label: "High Concern",
    emoji: "⚡",
    description: "Significant mental health indicators detected. Consider professional support.",
    ariaLabel: "High risk assessment - professional support recommended",
  },
  critical: {
    bg: "bg-medical-emergency/10",
    border: "border-medical-emergency/25",
    text: "text-medical-emergency",
    bar: "from-medical-severe to-medical-emergency",
    icon: AlertTriangle,
    label: "Critical Concern",
    emoji: "🚨",
    description: "Immediate support strongly recommended. Crisis resources are available.",
    ariaLabel: "Critical risk assessment - immediate support needed",
  },
};

export default function RiskBadge({
  level = "low",
  score = 0,
  triggers = [],
  safety_protocol = false,
  components = null,
}) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.low;
  const Icon = config.icon;
  const pct = Math.round(score * 100);

  return (
    <div
      className={`medical-card border ${config.border} ${config.bg} animate-medical-fade-in`}
      role="region"
      aria-label={config.ariaLabel}
    >
      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                safety_protocol 
                  ? "bg-medical-emergency text-white animate-medical-pulse" 
                  : "bg-white shadow-medical"
              }`}
              aria-hidden="true"
            >
              {safety_protocol ? "🚨" : config.emoji}
            </div>
            <div>
              <p className="medical-label text-xs mb-0.5">Risk Assessment</p>
              <p className={`text-lg font-bold ${config.text}`}>
                {safety_protocol ? "Extra Support Recommended" : config.label}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className={`text-3xl font-bold ${config.text}`}>
              {pct}%
            </p>
            <Icon className="w-4 h-4 mx-auto mt-1 opacity-50" aria-hidden="true" />
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-warm-600 leading-relaxed mb-5">
          {safety_protocol 
            ? "It sounds like you're having a really hard time. You deserve support, and reaching out can help."
            : config.description}
        </p>

        {/* Risk Score Bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-warm-500">Risk Level</span>
            <span className={`text-xs font-semibold ${config.text}`}>
              {pct}%
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-warm-100 overflow-hidden"
          >
            <div
              className={`h-full rounded-full bg-gradient-to-r ${config.bar} transition-all duration-1000 ease-out`}
              style={{ width: `${pct}%` }}
              aria-valuenow={pct}
              aria-valuemin="0"
              aria-valuemax="100"
              role="progressbar"
            />
          </div>
        </div>

        {/* Risk Component Breakdown */}
        {components && (components.clinical > 0 || components.keywords > 0 || components.emotional > 0) && (
          <div className="mb-5 p-4 rounded-xl bg-white/60 border border-sage-100">
            <p className="medical-label text-xs mb-3">Risk Factors</p>
            <div className="space-y-3">
              {components.clinical > 0 && (
                <div className="flex items-center gap-3">
                  <span className="w-20 text-xs text-warm-600 font-medium">Clinical</span>
                  <div className="flex-1 h-2 rounded-full bg-warm-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sage-400 to-sage-500 rounded-full transition-all duration-700"
                      style={{ width: `${components.clinical * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-warm-500 w-10 text-right">
                    {Math.round(components.clinical * 100)}%
                  </span>
                </div>
              )}
              
              {components.keywords > 0 && (
                <div className="flex items-center gap-3">
                  <span className="w-20 text-xs text-warm-600 font-medium">Keywords</span>
                  <div className="flex-1 h-2 rounded-full bg-warm-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700"
                      style={{ width: `${components.keywords * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-warm-500 w-10 text-right">
                    {Math.round(components.keywords * 100)}%
                  </span>
                </div>
              )}
              
              {components.emotional > 0 && (
                <div className="flex items-center gap-3">
                  <span className="w-20 text-xs text-warm-600 font-medium">Emotional</span>
                  <div className="flex-1 h-2 rounded-full bg-warm-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-400 to-violet-500 rounded-full transition-all duration-700"
                      style={{ width: `${components.emotional * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-warm-500 w-10 text-right">
                    {Math.round(components.emotional * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Safety Alert - Enhanced for Crisis */}
        {safety_protocol && (
          <div 
            className="mb-5 p-4 rounded-xl bg-medical-emergency/10 border border-medical-emergency/20"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-medical-emergency flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-medical-emergency">
                  Support is available right now
                </p>
                <p className="text-sm text-warm-700 mt-1 leading-relaxed">
                  It sounds like you're going through a lot. Talking to someone can help,
                  and free, confidential support is available any time.
                </p>
                <a
                  href={telHref(PRIMARY_CRISIS_RESOURCE.phone)}
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-medical-emergency text-white rounded-lg text-sm font-medium hover:bg-medical-emergency/90 transition-colors"
                >
                  <span aria-hidden="true">📞</span> Call {PRIMARY_CRISIS_RESOURCE.shortName} ({PRIMARY_CRISIS_RESOURCE.phone})
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Trigger Keywords */}
        {triggers.length > 0 && (
          <div>
            <p className="medical-label text-xs mb-2">Detected Indicators</p>
            <div className="flex flex-wrap gap-2">
              {triggers.map((trigger) => (
                <span
                  key={trigger}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${
                    safety_protocol
                      ? "bg-medical-emergency/10 text-medical-emergency border border-medical-emergency/20"
                      : "bg-warm-50 text-warm-700 border border-warm-200"
                  }`}
                >
                  <span className={safety_protocol ? "" : "text-sage-500"}>
                    {safety_protocol ? "⚠️" : "•"}
                  </span>
                  {trigger}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
