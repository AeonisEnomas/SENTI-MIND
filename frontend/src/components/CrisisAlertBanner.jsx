import { Phone, ExternalLink, Heart } from "lucide-react";
import {
  CRISIS_RESOURCES,
  EMERGENCY_NUMBER,
  MORE_RESOURCES_URL,
  telHref,
} from "../constants/crisisResources";

const VARIANTS = {
  critical: {
    container: "bg-gradient-to-r from-medical-emergency to-rose-600 text-white",
    subtle: "text-rose-100",
    card: "bg-white/10 hover:bg-white/20 border-white/10",
    divider: "border-white/20",
    link: "text-white bg-white/10 hover:bg-white/20",
    heading: "We're here with you",
    body:
      "What you've written sounds really heavy, and you don't have to carry it alone. " +
      "Talking to someone right now can help. These services are free, confidential and available 24/7:",
  },
  high: {
    container: "bg-rose-50 text-rose-900 border border-rose-200",
    subtle: "text-rose-800/80",
    card: "bg-white hover:bg-rose-100/60 border-rose-200",
    divider: "border-rose-200",
    link: "text-rose-800 bg-white hover:bg-rose-100 border border-rose-200",
    heading: "It sounds like things are hard right now",
    body:
      "Thank you for writing this down. If it would help to talk to someone, " +
      "these free and confidential services are available any time:",
  },
};

export default function CrisisAlertBanner({ isVisible = false, severity = "critical" }) {
  if (!isVisible) return null;
  const v = VARIANTS[severity] ?? VARIANTS.critical;
  const isCritical = severity !== "high";

  return (
    <div
      className="w-full animate-medical-fade-in"
      role={isCritical ? "alert" : "status"}
      aria-live={isCritical ? "assertive" : "polite"}
    >
      <div className={`${v.container} p-6 rounded-2xl shadow-medical-lg`}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm" aria-hidden="true">
            <Heart className={`w-7 h-7 ${isCritical ? "animate-pulse" : "text-rose-500"}`} />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold mb-2">{v.heading}</h2>
            <p className={`${v.subtle} text-sm leading-relaxed mb-5`}>{v.body}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              {CRISIS_RESOURCES.map((resource) => (
                <a
                  key={resource.id}
                  href={telHref(resource.phone)}
                  aria-label={`${resource.action}: ${resource.name}, ${resource.phone}`}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-all group border ${v.card}`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl ${resource.emphasis === "primary" ? "bg-medical-emergency" : "bg-sage-600"} flex items-center justify-center flex-shrink-0 shadow-lg`}
                    aria-hidden="true"
                  >
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{resource.name}</p>
                    <p className={`${v.subtle} text-xs opacity-90`}>{resource.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg sm:text-2xl font-bold block whitespace-nowrap">{resource.phone}</span>
                    <span className="text-xs opacity-75">{resource.action}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className={`mt-5 pt-5 border-t ${v.divider} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
          <p className={`text-sm ${v.subtle} flex items-center gap-2`}>
            <span className="text-lg" aria-hidden="true">💚</span>
            You are not alone. Reaching out is a sign of strength.
          </p>
          <a
            href={MORE_RESOURCES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm font-medium flex items-center gap-1.5 hover:underline whitespace-nowrap px-3 py-1.5 rounded-lg transition-colors ${v.link}`}
          >
            More Resources
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      {isCritical && (
        <div className="mt-3 p-3 bg-rose-50 rounded-xl border border-rose-200">
          <p className="text-xs text-rose-700 text-center">
            If you're in immediate danger, please call <strong className="font-semibold">{EMERGENCY_NUMBER}</strong> or go to your nearest emergency room.
          </p>
        </div>
      )}
    </div>
  );
}
