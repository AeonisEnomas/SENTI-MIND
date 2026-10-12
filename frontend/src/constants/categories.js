// Single source of truth for clinical category presentation.
// Tailwind scans src/**/*.js, so the class names below are kept as full literals.
//
//   text   - foreground colour for the category label
//   bg     - light background tint
//   border - border colour
//   swatch - solid colour used for heatmap cells and legends
//   bar    - solid colour used for confidence bars
export const CATEGORY_CONFIG = {
  Normal: {
    label: "Normal",
    icon: "🌿",
    text: "text-sage-700",
    bg: "bg-sage-50",
    border: "border-sage-200",
    swatch: "bg-sage-400",
    bar: "bg-sage-500",
  },
  Stress: {
    label: "Stress",
    icon: "🌅",
    text: "text-medical-mild",
    bg: "bg-amber-50",
    border: "border-amber-200",
    swatch: "bg-amber-400",
    bar: "bg-amber-400",
  },
  Anxiety: {
    label: "Anxiety",
    icon: "🌊",
    text: "text-medical-moderate",
    bg: "bg-orange-50",
    border: "border-orange-200",
    swatch: "bg-orange-400",
    bar: "bg-medical-moderate",
  },
  Bipolar: {
    label: "Bipolar",
    icon: "⚡",
    text: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    swatch: "bg-indigo-400",
    bar: "bg-indigo-500",
  },
  Depression: {
    label: "Depression",
    icon: "☁️",
    text: "text-medical-severe",
    bg: "bg-rose-50",
    border: "border-rose-200",
    swatch: "bg-rose-400",
    bar: "bg-medical-severe",
  },
  Suicidal: {
    label: "Suicidal",
    icon: "🚨",
    text: "text-medical-emergency",
    bg: "bg-rose-100",
    border: "border-rose-300",
    swatch: "bg-rose-600",
    bar: "bg-medical-emergency",
  },
  "Personality Disorder": {
    label: "Personality Disorder",
    icon: "🎭",
    text: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    swatch: "bg-violet-400",
    bar: "bg-violet-500",
  },
};

export const DEFAULT_CATEGORY = {
  label: "Unknown",
  icon: "💭",
  text: "text-warm-600",
  bg: "bg-warm-50",
  border: "border-warm-200",
  swatch: "bg-sage-400",
  bar: "bg-warm-400",
};

export function getCategoryConfig(category) {
  return CATEGORY_CONFIG[category] ?? { ...DEFAULT_CATEGORY, label: category || DEFAULT_CATEGORY.label };
}
