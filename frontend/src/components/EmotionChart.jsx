import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Radar,
  Tooltip,
} from "recharts";

// Medical-grade emotion colors - sage green theme with accessibility
const EMOTION_COLORS = {
  joy: "#5a7c5a",       // Sage green
  sadness: "#7296b0",   // Muted blue-gray
  anger: "#b87068",     // Soft terracotta
  fear: "#c9916b",      // Warm amber
  love: "#a67c9c",      // Muted mauve
  surprise: "#6b8fa8",  // Dusty blue
  neutral: "#a8a29e",   // Warm gray
  disgust: "#7c8c6a",   // Sage olive
};

const EMOTION_ICONS = {
  joy: "😊",
  sadness: "😢",
  anger: "😤",
  fear: "😰",
  love: "🥰",
  surprise: "😮",
  neutral: "😐",
  disgust: "🤢",
};

// Medical-friendly emotion labels
const EMOTION_LABELS = {
  joy: "Joy",
  sadness: "Sadness",
  anger: "Anger",
  fear: "Fear",
  love: "Love",
  surprise: "Surprise",
  neutral: "Neutral",
  disgust: "Disgust",
};

export default function EmotionChart({ emotions }) {
  // Emotion analysis is honest when unavailable — never show fabricated scores.
  if (!Array.isArray(emotions) || emotions.length === 0) {
    return (
      <div className="rounded-2xl border border-warm-200 bg-warm-50 p-6 text-center">
        <p className="text-warm-600 font-medium">Emotion analysis is temporarily unavailable.</p>
        <p className="text-xs text-warm-500 mt-2">The rest of your analysis is unaffected.</p>
      </div>
    );
  }

  // Get dominant emotion
  const dominantEmotion = emotions[0];
  const dominantColor = EMOTION_COLORS[dominantEmotion.label] || EMOTION_COLORS.neutral;
  const dominantIcon = EMOTION_ICONS[dominantEmotion.label] || "😐";
  const dominantLabel = EMOTION_LABELS[dominantEmotion.label] || dominantEmotion.label;

  // Prepare radar data - ensure all emotions are present
  const allEmotions = ["joy", "sadness", "anger", "fear", "surprise", "neutral", "disgust"];
  const emotionMap = new Map(emotions.map((e) => [e.label, e.score]));

  const radarData = allEmotions.map((emotion) => ({
    emotion: EMOTION_LABELS[emotion],
    fullMark: 100,
    score: Math.round((emotionMap.get(emotion) || 0) * 100),
    color: EMOTION_COLORS[emotion],
  }));

  // Top emotions for the bar chart
  const topEmotions = emotions.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Dominant Emotion Display */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 transition-all"
        style={{
          background: `linear-gradient(135deg, ${dominantColor}12 0%, ${dominantColor}05 100%)`,
          border: `1px solid ${dominantColor}25`,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="medical-label text-xs mb-2 opacity-70">Dominant Emotion</p>
            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden="true">{dominantIcon}</span>
              <div>
                <p
                  className="text-2xl font-bold capitalize"
                  style={{ color: dominantColor }}
                >
                  {dominantLabel}
                </p>
                <p className="text-sm text-warm-500 mt-0.5">
                  {(dominantEmotion.score * 100).toFixed(0)}% confidence
                </p>
              </div>
            </div>
          </div>
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-medical"
            style={{ backgroundColor: dominantColor }}
          >
            {(dominantEmotion.score * 100).toFixed(0)}
          </div>
        </div>
      </div>

      {/* Emotion Breakdown Bars */}
      <div className="space-y-3">
        <p className="medical-label">Emotion Breakdown</p>
        <div className="space-y-3">
          {topEmotions.map((emotion) => {
            const color = EMOTION_COLORS[emotion.label] || EMOTION_COLORS.neutral;
            const icon = EMOTION_ICONS[emotion.label] || "😐";
            const label = EMOTION_LABELS[emotion.label] || emotion.label;
            const percentage = (emotion.score * 100).toFixed(0);
            
            return (
              <div key={emotion.label} className="flex items-center gap-3">
                <span className="text-xl w-8 text-center" aria-hidden="true">{icon}</span>
                <span className="text-sm w-20 capitalize text-warm-600 font-medium">
                  {label}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-warm-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-10 text-right text-warm-700">
                  {percentage}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Radar Chart */}
      <div className="h-72 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="#e7e5e4" />
            <PolarAngleAxis
              dataKey="emotion"
              tick={{ fill: "#78716c", fontSize: 11, fontWeight: 500 }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Emotion"
              dataKey="score"
              stroke={dominantColor}
              fill={dominantColor}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(255, 255, 255, 0.98)",
                border: `1px solid ${dominantColor}40`,
                borderRadius: "12px",
                fontSize: "13px",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
              }}
              formatter={(value) => [`${value}%`, "Score"]}
              labelStyle={{ color: "#44403c", fontWeight: 600 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
