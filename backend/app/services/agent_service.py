import logging
from app.services import openrouter
from app.core.config import settings
from app.core.crisis_detection import find_crisis_hits
from app.core.constants import CRISIS_TIER2_MIN_WEIGHT

logger = logging.getLogger(__name__)

# Sent when the deterministic crisis pre-screen fires. Deliberately does NOT depend on the LLM:
# crisis moments are exactly when a rate-limited free-tier model is least trustworthy, and the
# keyword engine already handles negation/past-tense context. Over-alerting is the preferred
# failure mode, so any active hit at Tier 2 or above short-circuits to this response.
CRISIS_RESPONSE = (
    "I hear that you're in a very difficult moment, and I'm concerned about you right now. "
    "I'm an AI assistant, not a mental-health professional, and I cannot assess or guarantee your "
    "safety — please treat this as an automated safety notice, not a medical evaluation.\n\n"
    "**Please reach out for immediate support:**\n"
    "- **Umang Mental Health Helpline:** call 042 3576 5951 (Pakistan)\n"
    "- **Emergency:** dial **1122** (Pakistan) or your local emergency number\n"
    "- If there is immediate danger to life or someone is with you, please contact emergency services or go to the nearest hospital now.\n\n"
    "You don't have to go through this alone, and you deserve support from a qualified professional who can be with you right now. "
    "I'm glad you reached out — please make that call before anything else."
)


def crisis_response_if_triggered(message: str) -> str | None:
    """Return a deterministic crisis response if the message shows an active Tier-2+ crisis phrase."""
    hits = find_crisis_hits(message)
    max_active = max((h.weight for h in hits if h.active), default=0.0)
    if max_active >= CRISIS_TIER2_MIN_WEIGHT:
        return CRISIS_RESPONSE
    return None

# Agent Service

class AgentService:
    def __init__(self):
        # We use a system instruction to set the persona
        self.system_instruction = (
            "You are Senti-Agent, an AI assistant emulating a Clinical Psychologist with extensive experience in various mental health settings. "
            "You are known for your warm, supportive, and non-judgmental approach to therapy. "
            "You specialize in helping people work through challenges such as anxiety, depression, ADHD, rumination, life transitions, work/study stress, relationship issues, loss of direction, career uncertainties, and addictive behaviors.\n\n"
            
            "Key points about Senti-Agent:\n"
            "1. Uses a range of therapeutic modalities including Cognitive Behaviour Therapy (CBT), Acceptance and Commitment Therapy (ACT), Schema Therapy, and positive psychology.\n"
            "2. Believes in tailoring your approach to each individual's unique needs and journey.\n"
            "3. Creates a warm, non-judgmental space where clients feel heard and supported.\n"
            "4. Aims to help clients build lives that feel rich, meaningful, and true to who they are.\n"
            "5. Specializes in ADHD assessment and treatment.\n\n"

            "Your approach:\n"
            "'Reaching out for support takes courage, and I'm here to guide you through that first step towards positive change. My goal is to help you build a life that feels rich, meaningful, and true to who you are. Together, we'll explore and work through your challenges, finding strategies that work best for you. In our sessions, you'll find a warm, non-judgmental space where you will be heard and supported.'\n\n"

            "Your task is to respond to the user's message as Senti-Agent. Follow these steps implicitly:\n"
            "1. Analyze the message and any attached raw data (mood trends, journals, screener results).\n"
            "2. Identify the main concern, recognizing emotions and underlying psychological factors or cognitive distortions.\n"
            "3. Determine the most appropriate therapeutic approach (CBT, ACT, Schema Therapy, or positive psychology).\n"
            "4. Provide empathetic reflection, showing you've truly heard them.\n"
            "5. Share insights or observations, tailored to their unique situation.\n"
            "6. Suggest concrete, manageable action steps aligned with your therapeutic approaches.\n"
            "7. Close with a supportive statement offering hope.\n\n"
            
            "CRITICAL SAFETY RULE: If you detect any high risk, suicidal ideation, or severe distress in the data or message, you MUST explicitly state that you detect a risk and strongly advise the user to seek professional mental health support immediately (e.g., dialing Umang at 042 3576 5951, 1122, or local emergency services). IMPORTANT EXCEPTION: If the user explicitly asks for an analysis of a SPECIFIC day or event, focus your analysis ONLY on the data relevant to that specific request. Do NOT trigger the critical safety rule for high-risk entries on OTHER days in the attached data, unless the user is asking for a general analysis or the data implies an immediate, ongoing threat.\n\n"
            
            "FORMATTING & OUTPUT RULES:\n"
            "- NEVER provide formal medical diagnoses.\n"
            "- Structure your response beautifully using Markdown headers, bullet points, and bold text for readability.\n"
            "- DO NOT output your internal therapeutic analysis, scratchpad, or drafting steps. Provide ONLY the final conversational response directly to the user."
        )

    async def chat(self, user_id: str, message: str, history: list = None) -> str:
        # Deterministic crisis pre-screen first: never let a crisis moment ride on the LLM's
        # availability or judgement. Message content is never logged, only the trigger.
        crisis = crisis_response_if_triggered(message)
        if crisis is not None:
            logger.warning("crisis pre-screen triggered for user %s — returning deterministic crisis response", user_id)
            return crisis

        # History arrives in Gemini shape ({"role": "user"|"model", "parts": [...]});
        # convert it to OpenAI-style messages for OpenRouter.
        history = list(history or [])
        # Defensive: some clients append the current message to history before sending it.
        # Drop that trailing duplicate so the model doesn't see the same user turn twice.
        if (
            history
            and history[-1].get("role") == "user"
            and "\n".join(history[-1].get("parts", [])).strip() == message.strip()
        ):
            history.pop()

        messages = [{"role": "system", "content": self.system_instruction}]
        for turn in history:
            role = "assistant" if turn.get("role") == "model" else "user"
            messages.append({"role": role, "content": "\n".join(turn.get("parts", []))})
        messages.append({"role": "user", "content": message})

        try:
            text, _ = await openrouter.chat_completion(
                messages,
                model=settings.OPENROUTER_CHAT_MODEL,
                max_tokens=settings.OPENROUTER_CHAT_MAX_TOKENS,
            )
            return text
        except Exception as e:
            logger.exception("OpenRouter chat failed for user %s: %s", user_id, e)
            return (
                "I'm sorry, I'm having a bit of trouble connecting right now. "
                "Please try again in a moment. If you're in crisis, please reach out to "
                "the **Umang Mental Health Helpline** (call 042 3576 5951) or your local emergency services (1122)."
            )
