import { useState, useRef, useEffect } from "react";
import { chatService } from "../services/chatService";
import { listJournalEntries } from "../services/journalService";
import { getMoodTrends } from "../services/moodService";
import { getScreenerHistory } from "../services/screenerService";
import ReactMarkdown from "react-markdown";
import SentiBotAvatar from "../components/SentiBotAvatar";
import { buildChatHistory, composeChatPayload, MAX_MESSAGE_CHARS } from "../lib/chatHistory";
import { getErrorMessage, isRateLimited } from "../lib/errors";

const QUICK_ACTIONS = [
  { id: "mood", label: "📊 Analyze Mood Trends", action: "mood" },
  { id: "journal", label: "📝 Review Recent Journals", action: "journal" },
  { id: "screener", label: "🩺 Check Screener History", action: "screener" }
];

const DEFAULT_PROMPTS = {
  mood: "Please analyze my recent mood trends.",
  journal: "Please review my recent journal entries.",
  screener: "Please analyze my recent mental health screener results.",
};

// Per-entry cap for attached journal text so several entries fit in one message.
const ATTACHED_JOURNAL_CHARS = 500;

const GREETING = {
  role: "model",
  parts: ["Hi there! I'm Senti-Agent. You can ask me for advice, or use the quick buttons below to attach your data to your message so we can review it together."],
  excludeFromHistory: true,
};

async function fetchAttachmentText(kind) {
  if (kind === "mood") {
    const data = await getMoodTrends(7);
    return `Attached Data (Mood Trends): ${JSON.stringify(data)}`;
  }
  if (kind === "journal") {
    const data = await listJournalEntries(5);
    const slim = (Array.isArray(data) ? data : []).map((e) => ({
      created_at: e.created_at,
      category: e.category,
      risk_level: e.risk_level,
      raw_text: typeof e.raw_text === "string" ? e.raw_text.slice(0, ATTACHED_JOURNAL_CHARS) : e.raw_text,
    }));
    return `Attached Data (Journal Entries): ${JSON.stringify(slim)}`;
  }
  if (kind === "screener") {
    const data = await getScreenerHistory();
    return `Attached Data (Screener History): ${JSON.stringify(data)}`;
  }
  return "";
}

// Links in model replies open in a new tab without exposing window.opener.
const MARKDOWN_COMPONENTS = {
  strong: ({ node, ...props }) => <span className="font-bold text-sage-900" {...props} />,
  h1: ({ node, ...props }) => <h1 className="text-lg font-bold mt-3 mb-1 text-sage-900" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-md font-bold mt-3 mb-1 text-sage-800" {...props} />,
  h3: ({ node, ...props }) => <h3 className="text-sm font-bold mt-2 mb-1 text-sage-800" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
  li: ({ node, ...props }) => <li className="pl-1" {...props} />,
  p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
  a: ({ node, ...props }) => (
    <a className="text-sage-700 underline hover:text-sage-900" {...props} target="_blank" rel="noopener noreferrer" />
  ),
};

export default function ChatPage() {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleQuickAction = (actionType) => {
    setPendingAttachment((current) => (current === actionType ? null : actionType));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !pendingAttachment) return;
    if (isLoading) return;

    const currentAttachment = pendingAttachment;
    const userMessage = input.trim() || DEFAULT_PROMPTS[currentAttachment] || "";
    if (!userMessage) return;

    // History is built from the turns BEFORE this one; the backend appends `message`.
    const history = buildChatHistory(messages);
    const userTurn = { id: Date.now(), role: "user", parts: [userMessage] };

    setInput("");
    setPendingAttachment(null);
    setIsLoading(true);
    setMessages((prev) => [...prev, userTurn]);

    try {
      const attachedText = currentAttachment ? await fetchAttachmentText(currentAttachment) : "";
      const payload = composeChatPayload(userMessage, attachedText);

      // Remember what was actually sent so follow-ups keep the attached context,
      // while the bubble keeps showing only what the user typed.
      setMessages((prev) => prev.map((m) => (m.id === userTurn.id ? { ...m, sentContent: payload } : m)));

      const responseData = await chatService.sendMessage(payload, history);

      setMessages((prev) => [...prev, { role: "model", parts: [responseData.response] }]);
    } catch (error) {
      console.error("Chat error:", error);
      const text = isRateLimited(error)
        ? `${getErrorMessage(error)} Your last message wasn't sent, so feel free to send it again.`
        : `Sorry, I couldn't respond just now. ${getErrorMessage(error, "Please try again in a moment.")}`;
      setMessages((prev) => [
        // The failed turn never reached the server, so keep it out of future history.
        ...prev.map((m) => (m.id === userTurn.id ? { ...m, excludeFromHistory: true } : m)),
        { role: "model", parts: [text], excludeFromHistory: true, isError: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const attachmentLabel = QUICK_ACTIONS.find((a) => a.action === pendingAttachment)?.label;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] md:h-[calc(100vh-120px)] bg-white rounded-2xl shadow-sm border border-sage-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-sage-100 bg-sage-50/50 flex items-center gap-3">
        <SentiBotAvatar emotion="idle" size="md" animate={true} />
        <div>
          <h2 className="font-semibold text-warm-800">SentiBot</h2>
          <p className="text-xs text-sage-600 font-medium">AI Therapist Companion</p>
        </div>
      </div>

      {/* Chat Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-sage-50/30"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation with SentiBot"
      >
        {messages.map((msg, idx) => (
          <div key={msg.id ?? idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role !== "user" && (
              <div className="flex-shrink-0 mr-2 mt-1">
                <SentiBotAvatar emotion="Normal" size="sm" animate={true} />
              </div>
            )}
            <div
              className={`max-w-[80%] md:max-w-[70%] p-3 px-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-sage-600 text-white rounded-br-sm shadow-md"
                  : msg.isError
                    ? "bg-rose-50 text-rose-800 border border-rose-200 shadow-sm rounded-bl-sm"
                    : "bg-white text-warm-800 border border-sage-100 shadow-sm rounded-bl-sm"
              }`}
            >
              {msg.role === "user" ? (
                <span className="whitespace-pre-wrap break-words">{msg.parts[0]}</span>
              ) : (
                <ReactMarkdown components={MARKDOWN_COMPONENTS}>{msg.parts[0]}</ReactMarkdown>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start" role="status" aria-label="SentiBot is typing">
            <div className="flex-shrink-0 mr-2 mt-1">
              <SentiBotAvatar emotion="loading" size="sm" animate={true} />
            </div>
            <div className="bg-white border border-sage-100 shadow-sm rounded-2xl rounded-bl-sm p-4 text-warm-800 text-sm flex gap-1" aria-hidden="true">
              <span className="w-2 h-2 bg-sage-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-sage-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-2 h-2 bg-sage-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions & Input Area */}
      <div className="bg-white border-t border-sage-100">
        {/* Quick Actions Scroller */}
        <div className="flex overflow-x-auto p-3 gap-2 scrollbar-hide border-b border-sage-50/50" role="group" aria-label="Attach your data">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.id}
              type="button"
              onClick={() => handleQuickAction(action.action)}
              disabled={isLoading}
              aria-pressed={pendingAttachment === action.action}
              className={`flex-shrink-0 px-4 py-1.5 text-xs font-semibold rounded-full border transition-colors disabled:opacity-50 ${
                pendingAttachment === action.action
                  ? 'bg-sage-600 text-white border-sage-700 shadow-inner'
                  : 'bg-sage-50 hover:bg-sage-100 text-sage-700 border-sage-200'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Pending Attachment Indicator */}
        {pendingAttachment && (
          <div className="px-4 pt-3 pb-0 bg-white flex items-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sage-100 text-sage-800 text-xs font-semibold rounded-full border border-sage-200">
              <span className="opacity-70" aria-hidden="true">📎</span>
              {attachmentLabel}
              <button
                type="button"
                onClick={() => setPendingAttachment(null)}
                aria-label={`Remove attachment: ${attachmentLabel}`}
                className="ml-1 text-sage-500 hover:text-sage-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 rounded"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </div>
        )}

        {/* Input Form */}
        <div className="p-4 pt-3">
          <form onSubmit={handleSend} className="relative">
            <label htmlFor="chat-input" className="sr-only">Message SentiBot</label>
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={MAX_MESSAGE_CHARS}
              placeholder="Ask a question or request analysis..."
              className="w-full bg-sage-50/50 border border-sage-200 rounded-full py-3 pl-5 pr-12 text-sm text-warm-800 focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100 transition-all placeholder:text-warm-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !pendingAttachment) || isLoading}
              aria-label="Send message"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50 transition-all"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
