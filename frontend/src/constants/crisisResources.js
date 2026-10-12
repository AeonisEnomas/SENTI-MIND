// Single source of truth for crisis / emergency contacts shown in the UI.
// Keep in sync with the crisis rules in the backend chat agent prompt.

export const CRISIS_RESOURCES = [
  {
    id: "umang",
    name: "Umang Mental Health Helpline",
    shortName: "Umang",
    phone: "042 3576 5951",
    description: "Free, confidential mental health support, 24/7",
    action: "Call Now",
    emphasis: "primary",
  },
  {
    id: "rescue1122",
    name: "Emergency Ambulance (Rescue 1122)",
    shortName: "Rescue 1122",
    phone: "1122",
    description: "For immediate medical emergencies",
    action: "Call 1122",
    emphasis: "secondary",
  },
];

export const EMERGENCY_NUMBER = "1122";
export const MORE_RESOURCES_URL = "https://umang.com.pk";

export const PRIMARY_CRISIS_RESOURCE = CRISIS_RESOURCES[0];

/** Converts a display number ("042 3576 5951") into a tel: href. */
export function telHref(phone) {
  return `tel:${String(phone).replace(/[^\d+]/g, "")}`;
}
