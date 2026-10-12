import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SentiBotAvatar from "./SentiBotAvatar";

const AMBIENT_DIALOGUES = [
  "I'm here if you need to talk.",
  "How are you feeling today?",
  "Remember to take a deep breath.",
  "You're doing great.",
  "Want to reflect on your day?",
];

const ROUTE_DIALOGUES = {
  "/dashboard": "Welcome to your Journal. This is a safe space to write down your thoughts. I'll analyze your entries to help you understand your emotional state.",
  "/dashboard/heatmap": "This is the Mood Heatmap. Here we can visualize your emotional journey over time through color patterns.",
  "/dashboard/history": "This is your History. You can review all your past entries and clinical analyses here.",
  "/dashboard/gratitude": "Welcome to the Gratitude Jar! Taking a moment to appreciate the little things does wonders for mental health.",
  "/dashboard/screener": "Here is the Clinical Screener. You can take standardized mental health assessments to keep track of your clinical symptoms.",
  "/dashboard/wellness": "These are your Wellness Tools. Explore breathing exercises and grounding techniques to center yourself.",
};

const BUBBLE_MS = 5000;
const AMBIENT_INTERVAL_MS = 20000;

function routeDialogue(pathname) {
  if (pathname.includes("/chat")) return null;
  // Remove trailing slash for consistent matching
  const normalized = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return ROUTE_DIALOGUES[normalized] ?? null;
}

let bubbleSeq = 0;
const makeBubble = (text, autoHide) => ({ id: ++bubbleSeq, text, autoHide });

export default function SentiBotFAB({ emotion = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  // bubble: { id, text, autoHide } | null
  const [bubble, setBubble] = useState(() => {
    const text = routeDialogue(location.pathname);
    return text ? makeBubble(text, true) : null;
  });
  const [lastPath, setLastPath] = useState(location.pathname);
  const bubbleRef = useRef(bubble);

  // Route change dialogues (state adjusted during render, no effect needed).
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    const text = routeDialogue(location.pathname);
    if (text) setBubble(makeBubble(text, true));
  }

  useEffect(() => {
    bubbleRef.current = bubble;
  }, [bubble]);

  // Auto-hide: one timer per bubble, always cleared when the bubble changes or on unmount.
  useEffect(() => {
    if (!bubble?.autoHide) return undefined;
    const id = bubble.id;
    const timer = setTimeout(() => {
      setBubble((current) => (current?.id === id ? null : current));
    }, BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [bubble]);

  // Ambient dialogue popups: one stable interval for the component's lifetime.
  useEffect(() => {
    const interval = setInterval(() => {
      // 30% chance to show a bubble every 20 seconds if not already showing
      if (bubbleRef.current || Math.random() <= 0.7) return;
      const text = AMBIENT_DIALOGUES[Math.floor(Math.random() * AMBIENT_DIALOGUES.length)];
      const next = makeBubble(text, true);
      setBubble((current) => current ?? next);
    }, AMBIENT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Hide on the chat page itself
  if (location.pathname.includes("/chat")) return null;

  const showHoverBubble = () => setBubble(makeBubble("Chat with me!", false));
  const hideBubble = () => setBubble(null);

  return (
    <div className="sentibot-fab animate-medical-fade-in" style={{ zIndex: 9999 }}>
      {bubble && (
        <div
          className="sentibot-speech-bubble"
          onClick={() => navigate("/dashboard/chat")}
          role="status"
          aria-live="polite"
        >
          {bubble.text}
        </div>
      )}

      <div className="sentibot-fab-pulse" />

      <button
        type="button"
        className="sentibot-fab-inner"
        onClick={() => navigate("/dashboard/chat")}
        onMouseEnter={showHoverBubble}
        onMouseLeave={hideBubble}
        onFocus={showHoverBubble}
        onBlur={hideBubble}
        title="Chat with SentiBot"
        aria-label="Chat with SentiBot"
      >
        <SentiBotAvatar
          emotion={bubble ? "Normal" : (emotion || "idle")}
          size="md"
          animate={true}
        />
      </button>
    </div>
  );
}
