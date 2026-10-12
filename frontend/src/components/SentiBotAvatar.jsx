import { useId, useState } from "react";

/**
 * SentiBotAvatar — Premium EVE-style Therapist Companion Bot.
 *
 * Props:
 *  - emotion: "Normal"|"Stress"|"Anxiety"|"Depression"|"Bipolar"|"Suicidal"|"Personality Disorder"|"idle"|"loading"|null
 *  - size: "xs" (36px) | "sm" (48px) | "md" (80px) | "lg" (120px)
 *  - animate: boolean (default true)
 *  - showLabel: boolean — show emotion label below
 *  - onClick: optional click handler
 *  - className: extra classes
 */

const EMOTION_THEMES = {
  idle: {
    primary: "#a8d5ba", // Calm mint
    visor: "#1a1f1c",   // Deep dark sage
    glow: "rgba(168, 213, 186, 0.4)",
    eyeShape: "relaxed",
    mouth: "neutral",
    animClass: "sentibot-breathe",
    label: "Idle",
  },
  loading: {
    primary: "#a8d5ba",
    visor: "#1a1f1c",
    glow: "rgba(168, 213, 186, 0.6)",
    eyeShape: "blink",
    mouth: "neutral",
    animClass: "sentibot-thinking",
    label: "Thinking...",
  },
  Normal: {
    primary: "#a8d5ba",
    visor: "#1a1f1c",
    glow: "rgba(168, 213, 186, 0.4)",
    eyeShape: "happy",
    mouth: "smile",
    animClass: "sentibot-breathe",
    label: "Calm & Balanced",
  },
  Stress: {
    primary: "#fbd888", // Bright amber
    visor: "#262015",
    glow: "rgba(251, 216, 136, 0.5)",
    eyeShape: "wide",
    mouth: "tight",
    animClass: "sentibot-pulse-fast",
    label: "Stressed",
  },
  Anxiety: {
    primary: "#ffb48a", // Bright orange
    visor: "#261a14",
    glow: "rgba(255, 180, 138, 0.5)",
    eyeShape: "worried",
    mouth: "wavy",
    animClass: "sentibot-tremble",
    label: "Anxious",
  },
  Depression: {
    primary: "#a9c4ed", // Soft cool blue
    visor: "#141821",
    glow: "rgba(169, 196, 237, 0.4)",
    eyeShape: "droopy",
    mouth: "frown",
    animClass: "sentibot-heavy",
    label: "Low Mood",
  },
  Bipolar: {
    primary: "#c8b8fa", // Purple
    visor: "#1e1826",
    glow: "rgba(200, 184, 250, 0.5)",
    eyeShape: "shifting",
    mouth: "mixed",
    animClass: "sentibot-cycle",
    label: "Mood Cycling",
  },
  Suicidal: {
    primary: "#ff6b66", // Emergency red
    visor: "#261010",
    glow: "rgba(255, 107, 102, 0.6)",
    eyeShape: "sad",
    mouth: "flat",
    animClass: "sentibot-alert",
    label: "Crisis Detected",
  },
  "Personality Disorder": {
    primary: "#d4b3fa", // Violet
    visor: "#201826",
    glow: "rgba(212, 179, 250, 0.5)",
    eyeShape: "split",
    mouth: "neutral",
    animClass: "sentibot-split",
    label: "Identity Pattern",
  },
};

const SIZES = {
  xs: 36,
  sm: 48,
  md: 80,
  lg: 120,
  xl: 160,
};

/* ─── Eye paths for each expression ─── */
function Eyes({ shape, size, primary }) {
  const s = size / 120;
  const cx1 = 40, cx2 = 80, cy = 54;
  const r = 6;
  const strokeWidth = 3.5 * s; // Very prominent LED lines

  switch (shape) {
    case "happy":
      return (
        <g className="sentibot-led-glow sentibot-blink-natural">
          <g className="sentibot-look-around">
            <path d={`M${cx1 - r * s} ${cy * s} Q${cx1 * s} ${(cy - 8) * s} ${(cx1 + r) * s} ${cy * s}`} stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
            <path d={`M${(cx2 - r) * s} ${cy * s} Q${cx2 * s} ${(cy - 8) * s} ${(cx2 + r) * s} ${cy * s}`} stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
          </g>
        </g>
      );
    case "wide":
      return (
        <g className="sentibot-led-glow">
          <circle cx={cx1 * s} cy={cy * s} r={5 * s} fill="none" stroke={primary} strokeWidth={strokeWidth} />
          <circle cx={cx2 * s} cy={cy * s} r={5 * s} fill="none" stroke={primary} strokeWidth={strokeWidth} />
        </g>
      );
    case "worried":
      return (
        <g className="sentibot-led-glow">
          <circle cx={cx1 * s} cy={cy * s} r={4 * s} fill="none" stroke={primary} strokeWidth={strokeWidth} />
          <circle cx={cx2 * s} cy={cy * s} r={4 * s} fill="none" stroke={primary} strokeWidth={strokeWidth} />
          <line x1={(cx1 - 6) * s} y1={(cy - 10) * s} x2={(cx1 + 4) * s} y2={(cy - 8) * s} stroke={primary} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1={(cx2 + 6) * s} y1={(cy - 10) * s} x2={(cx2 - 4) * s} y2={(cy - 8) * s} stroke={primary} strokeWidth={strokeWidth} strokeLinecap="round" />
        </g>
      );
    case "droopy":
      return (
        <g className="sentibot-led-glow">
          <line x1={(cx1 - 6) * s} y1={(cy + 2) * s} x2={(cx1 + 6) * s} y2={(cy + 2) * s} stroke={primary} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1={(cx2 - 6) * s} y1={(cy + 2) * s} x2={(cx2 + 6) * s} y2={(cy + 2) * s} stroke={primary} strokeWidth={strokeWidth} strokeLinecap="round" />
        </g>
      );
    case "sad":
      return (
        <g className="sentibot-led-glow">
          <path d={`M${cx1 - r * s} ${(cy+2) * s} Q${cx1 * s} ${(cy - 4) * s} ${(cx1 + r) * s} ${(cy+2) * s}`} stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
          <path d={`M${(cx2 - r) * s} ${(cy+2) * s} Q${cx2 * s} ${(cy - 4) * s} ${(cx2 + r) * s} ${(cy+2) * s}`} stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
          <rect x={(cx1 + 4) * s} y={(cy + 8) * s} width={3 * s} height={6 * s} rx={1.5 * s} fill={primary} className="sentibot-tear" />
        </g>
      );
    case "shifting":
      return (
        <g className="sentibot-led-glow sentibot-eye-shift">
          <circle cx={cx1 * s} cy={cy * s} r={4 * s} fill={primary} />
          <circle cx={cx2 * s} cy={cy * s} r={4 * s} fill={primary} />
        </g>
      );
    case "split":
      return (
        <g className="sentibot-led-glow">
          <path d={`M${(cx1 - r) * s} ${cy * s} Q${cx1 * s} ${(cy - 8) * s} ${(cx1 + r) * s} ${cy * s}`} stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
          <line x1={(cx2 - 5) * s} y1={(cy + 2) * s} x2={(cx2 + 5) * s} y2={(cy + 2) * s} stroke={primary} strokeWidth={strokeWidth} strokeLinecap="round" />
        </g>
      );
    case "blink":
      return (
        <g className="sentibot-led-glow sentibot-blink">
          <circle cx={cx1 * s} cy={cy * s} r={4 * s} fill="none" stroke={primary} strokeWidth={strokeWidth} />
          <circle cx={cx2 * s} cy={cy * s} r={4 * s} fill="none" stroke={primary} strokeWidth={strokeWidth} />
        </g>
      );
    default: // relaxed
      return (
        <g className="sentibot-led-glow sentibot-blink-natural">
          <g className="sentibot-look-around">
            <circle cx={cx1 * s} cy={cy * s} r={4 * s} fill="none" stroke={primary} strokeWidth={strokeWidth} />
            <circle cx={cx2 * s} cy={cy * s} r={4 * s} fill="none" stroke={primary} strokeWidth={strokeWidth} />
          </g>
        </g>
      );
  }
}

/* ─── Mouth paths for each expression ─── */
function Mouth({ shape, size, primary }) {
  const s = size / 120;
  const cx = 60, my = 72;
  const strokeWidth = 3 * s;

  switch (shape) {
    case "smile":
      return <path d={`M${(cx - 10) * s} ${(my - 2) * s} Q${cx * s} ${(my + 8) * s} ${(cx + 10) * s} ${(my - 2) * s}`} stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" className="sentibot-led-glow" />;
    case "frown":
      return <path d={`M${(cx - 10) * s} ${(my + 4) * s} Q${cx * s} ${(my - 4) * s} ${(cx + 10) * s} ${(my + 4) * s}`} stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" className="sentibot-led-glow" />;
    case "tight":
      return <line x1={(cx - 8) * s} y1={my * s} x2={(cx + 8) * s} y2={my * s} stroke={primary} strokeWidth={strokeWidth} strokeLinecap="round" className="sentibot-led-glow" />;
    case "wavy":
      return <path d={`M${(cx - 10) * s} ${my * s} Q${(cx - 5) * s} ${(my - 4) * s} ${cx * s} ${my * s} Q${(cx + 5) * s} ${(my + 4) * s} ${(cx + 10) * s} ${my * s}`} stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" className="sentibot-wavy-mouth sentibot-led-glow" />;
    case "flat":
      return <line x1={(cx - 6) * s} y1={(my + 2) * s} x2={(cx + 6) * s} y2={(my + 2) * s} stroke={primary} strokeWidth={strokeWidth} strokeLinecap="round" className="sentibot-led-glow" />;
    case "mixed":
      return (
        <g className="sentibot-mouth-shift sentibot-led-glow">
          <path d={`M${(cx - 10) * s} ${my * s} Q${cx * s} ${(my + 6) * s} ${(cx + 10) * s} ${my * s}`} stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        </g>
      );
    default: // neutral
      return <path d={`M${(cx - 6) * s} ${my * s} Q${cx * s} ${(my + 2) * s} ${(cx + 6) * s} ${my * s}`} stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" className="sentibot-led-glow" />;
  }
}

export default function SentiBotAvatar({
  emotion = null,
  size = "md",
  animate = true,
  showLabel = false,
  onClick = null,
  className = "",
}) {
  const [isTouched, setIsTouched] = useState(false);
  const px = SIZES[size] || SIZES.md;
  const state = emotion || "idle";
  
  // Clone the theme so we can override it during touch
  const baseTheme = EMOTION_THEMES[state] || EMOTION_THEMES.idle;
  const theme = { ...baseTheme };
  
  if (isTouched) {
    theme.eyeShape = "happy";
    theme.mouth = "smile";
  }

  const s = px / 120;

  // useId is stable and unique per instance; strip ":" so the id is safe inside url(#...).
  const botId = `sentibot-${useId().replace(/:/g, "")}`;

  return (
    <div
      className={`sentibot-container ${animate ? theme.animClass : ""} ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{ width: px, height: showLabel ? px + 24 : px }}
      onClick={onClick}
      onPointerDown={() => setIsTouched(true)}
      onPointerUp={() => setIsTouched(false)}
      onPointerLeave={() => setIsTouched(false)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? "Open AI Chat" : `SentiBot — ${theme.label || state}`}
    >
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`sentibot-svg ${isTouched ? "sentibot-touched" : ""}`}
        style={{ transition: "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)" }}
      >
        <defs>
          {/* LED Glow filter */}
          <filter id={`${botId}-led-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={1.5 * s} result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={4 * s} result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* White casing specular highlight */}
          <linearGradient id={`${botId}-highlight`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="30%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#e2e8e4" stopOpacity="0.8" />
          </linearGradient>

          {/* Visor inner shadow / glass curve */}
          <linearGradient id={`${botId}-visor-glass`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="20%" stopColor="#ffffff" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        <style>
          {`
            .sentibot-led-glow { filter: url(#${botId}-led-glow); }
          `}
        </style>

        {/* ─── AMBIENT HALO (Replaces antenna) ─── */}
        <circle 
          cx={60 * s} cy={60 * s} r={58 * s} 
          fill={theme.glow} 
          className={animate ? "sentibot-halo-pulse" : ""} 
          filter={`url(#${botId}-led-glow)`}
        />

        {/* ─── SLEEK WHITE CASING ─── */}
        <rect 
          x={10 * s} y={15 * s} 
          width={100 * s} height={90 * s} 
          rx={40 * s} ry={40 * s} 
          fill={`url(#${botId}-highlight)`} 
          stroke="#cbd5d0" strokeWidth={1 * s} 
          className="sentibot-casing"
        />

        {/* ─── THERAPIST ACCENTS ─── */}
        {/* Side Silicone Grips */}
        <rect x={10 * s} y={45 * s} width={4 * s} height={30 * s} rx={2 * s} fill="#a8d5ba" opacity="0.8" />
        <rect x={106 * s} y={45 * s} width={4 * s} height={30 * s} rx={2 * s} fill="#a8d5ba" opacity="0.8" />
        
        {/* Medical Cross Badge (Upper Left) */}
        <g opacity="0.6" transform={`translate(${28 * s}, ${22 * s})`}>
          <rect x={-3 * s} y={-1 * s} width={6 * s} height={2 * s} fill="#a8d5ba" rx={0.5 * s} />
          <rect x={-1 * s} y={-3 * s} width={2 * s} height={6 * s} fill="#a8d5ba" rx={0.5 * s} />
        </g>

        {/* Empathy Core / Breathing Metronome (Bottom Center) */}
        <g className={animate ? "sentibot-empathy-breathe" : ""} transform={`translate(${60 * s}, ${98 * s})`} filter={`url(#${botId}-led-glow)`}>
          <path 
            d={`M0 ${(2) * s} 
                C${(0) * s} ${(0) * s}, ${(-3) * s} ${(-2) * s}, ${(-3) * s} ${(-4) * s} 
                C${(-3) * s} ${(-5.5) * s}, ${(-1.5) * s} ${(-6.5) * s}, ${(0) * s} ${(-4.5) * s} 
                C${(1.5) * s} ${(-6.5) * s}, ${(3) * s} ${(-5.5) * s}, ${(3) * s} ${(-4) * s} 
                C${(3) * s} ${(-2) * s}, ${(0) * s} ${(0) * s}, 0 ${(2) * s} Z`} 
            fill={theme.primary} 
            opacity="0.9"
          />
        </g>

        {/* ─── DARK SEAMLESS VISOR ─── */}
        <rect 
          x={18 * s} y={30 * s} 
          width={84 * s} height={60 * s} 
          rx={26 * s} ry={26 * s} 
          fill={theme.visor} 
        />
        {/* Visor glass reflection */}
        <rect 
          x={18 * s} y={30 * s} 
          width={84 * s} height={60 * s} 
          rx={26 * s} ry={26 * s} 
          fill={`url(#${botId}-visor-glass)`} 
          pointerEvents="none"
        />

        {/* Active Listening Waveform */}
        <g transform={`translate(${60 * s}, ${85 * s})`} opacity="0.4" className={animate ? "sentibot-waveform" : ""}>
          <rect x={-6 * s} y={0} width={2 * s} height={2 * s} rx={1 * s} fill={theme.primary} />
          <rect x={-2 * s} y={0} width={2 * s} height={2 * s} rx={1 * s} fill={theme.primary} />
          <rect x={2 * s} y={0} width={2 * s} height={2 * s} rx={1 * s} fill={theme.primary} />
          <rect x={6 * s} y={0} width={2 * s} height={2 * s} rx={1 * s} fill={theme.primary} />
        </g>

        {/* Visor scan line (loading) */}
        {state === "loading" && animate && (
          <line 
            x1={20 * s} y1={36 * s} x2={100 * s} y2={36 * s} 
            stroke={theme.primary} strokeWidth={2.5 * s} strokeOpacity={0.6} 
            className="sentibot-scan-line" 
            filter={`url(#${botId}-led-glow)`}
          />
        )}

        {/* ─── FACE ELEMENTS ─── */}
        <Eyes shape={theme.eyeShape} size={px} primary={theme.primary} />
        <Mouth shape={theme.mouth} size={px} primary={theme.primary} />

        {/* Alert state warning ring */}
        {state === "Suicidal" && (
          <rect 
            x={10 * s} y={15 * s} 
            width={100 * s} height={90 * s} 
            rx={40 * s} ry={40 * s} 
            fill="none"
            stroke="#ff6b66"
            strokeWidth={3 * s}
            className="sentibot-alert-ring"
            opacity="0.6"
          />
        )}
      </svg>

      {/* Label */}
      {showLabel && theme.label && (
        <div
          className="sentibot-label"
          style={{ color: "#7889a0", marginTop: '4px' }}
        >
          {theme.label}
        </div>
      )}
    </div>
  );
}


