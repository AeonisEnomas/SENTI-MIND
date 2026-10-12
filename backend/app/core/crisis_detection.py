"""Crisis-keyword detection with per-occurrence negation and tense context.

Each occurrence of a crisis phrase is judged on its own:

* negated: a negator sits immediately before the phrase in the same clause
  ("not suicidal", "I don't want to die", "no thoughts of suicide"). Only a
  short list of filler words may come between them, so "I don't know why I
  want to die" and "No, I want to die" are NOT negated.
* past: the phrase is marked as historical in the same clause ("I used to
  want to die", "I was suicidal", "suicidal years ago"). A present-tense
  marker ("now", "again", "still", "tonight", "today", ...) in the same
  sentence segment cancels the past reading.
* idiom: the phrase is part of a figurative expression listed in
  CRISIS_IDIOM_PATTERNS ("going to die of embarrassment"). These are dropped.
"""

import re
from dataclasses import dataclass

from app.core.constants import (
    CRISIS_IDIOM_PATTERNS,
    CRISIS_KEYWORDS,
    RISK_ONLY_CRISIS_KEYWORDS,
)

# Weight multipliers for occurrences that are negated or historical.
NEGATED_WEIGHT_FACTOR = 0.15
PAST_WEIGHT_FACTOR = 0.2

ALL_CRISIS_KEYWORDS: dict[str, float] = {**CRISIS_KEYWORDS, **RISK_ONLY_CRISIS_KEYWORDS}

_APOSTROPHES = str.maketrans({"’": "'", "‘": "'", "ʼ": "'", "′": "'", "`": "'"})

_TOKEN_RE = re.compile(r"[a-z0-9']+")

# Clause boundaries: punctuation, line breaks, spaced dashes, and conjunctions.
_CLAUSE_BOUNDARY_RE = re.compile(
    r"[.!?,;:()\[\]\"\n]|\s[-–—]+\s|[–—]"
    r"|\b(?:but|and|or|so|because|though|although|however|yet|while|whereas|then|except)\b"
)
# Sentence segments used for the present-tense override: sentences, further
# split at contrastive conjunctions ("I used to be suicidal but now I'm fine").
_SEGMENT_BOUNDARY_RE = re.compile(
    r"[.!?;\n]|\b(?:but|though|although|however|yet|whereas|except)\b"
)

NEGATORS = {
    "not", "never", "no", "nor", "without",
    "don't", "dont", "doesn't", "doesnt", "didn't", "didnt",
    "won't", "wont", "wouldn't", "wouldnt",
    "isn't", "isnt", "aren't", "arent", "wasn't", "wasnt", "ain't",
}
# Words allowed between a negator and the crisis phrase.
NEGATION_FILLERS = {
    "really", "actually", "even", "ever", "currently", "seriously", "honestly",
    "feel", "feeling", "felt", "am", "be", "being", "been", "have", "having",
    "want", "wanna", "wanted", "wanting", "to", "going", "gonna",
    "plan", "planning", "planned", "plans", "intend", "intending", "intention", "intentions",
    "think", "thinking", "thought", "thoughts", "about", "of", "any", "a", "the",
    "urge", "urges", "desire", "try", "trying", "tried", "attempt", "attempting",
    "consider", "considering", "considered", "at", "all",
}
NEGATION_MAX_FILLERS = 4

# Past markers that must sit right before the phrase (fillers allowed).
_PAST_MARKERS_SINGLE = {
    "was", "were", "had", "once", "formerly", "previously", "overcame",
    "survived", "beat",
}
_PAST_MARKERS_DOUBLE = {
    ("no", "longer"), ("had", "been"), ("recovered", "from"), ("got", "over"),
    ("got", "through"), ("healed", "from"),
}
PAST_FILLERS = {
    "feel", "feeling", "felt", "be", "being", "been", "having", "so", "really",
    "very", "quite", "pretty", "extremely", "severely", "deeply", "actually",
    "also", "always", "often", "briefly", "kind", "sort", "of", "a", "bit",
    "little", "my", "the", "from", "once",
}
PAST_MAX_FILLERS = 3
# "used to" is unambiguously habitual-past: any few words may follow it.
USED_TO_MAX_GAP = 4

_PAST_TIME_AFTER_RE = re.compile(
    r"^(?:\s+[a-z0-9']+){0,3}?\s+(?:years ago|months ago|long ago|a long time ago|last year"
    r"|in the past|back then|back in|as a (?:teen|teenager|kid|child)|in high school|in college"
    r"|when i was (?:younger|a kid|a teen|a teenager|little|in school))\b"
)

_PRESENT_MARKERS_RE = re.compile(
    r"\b(?:now|again|tonight|still|today|currently|these days|lately|this week|this morning"
    r"|last night|yesterday)\b"
)
# Recovery statements that contain a present marker but mean "I am fine".
_RECOVERY_RE = re.compile(
    r"\b(?:better|fine|ok|okay|good|great|safe|happy|well|healthy|stable|alright|recovered|in a good place)\s+now\b"
    r"|\bnow\s+(?:i'm|i am|im)\s+(?:better|fine|ok|okay|good|great|safe|happy|well|healthy|stable|alright|doing)\b"
)


def normalize(text: str) -> str:
    text = (text or "").translate(_APOSTROPHES).lower()
    return re.sub(r"\s+", " ", text).strip()


def _keyword_pattern(phrase: str) -> re.Pattern:
    parts = []
    for word in phrase.split():
        word = re.escape(word).replace("'", "'?").replace(r"\-", r"[\s-]?")
        parts.append(word)
    return re.compile(r"(?<![\w'])" + r"\s+".join(parts) + r"(?![\w'])")


_KEYWORD_RES = {kw: _keyword_pattern(kw) for kw in ALL_CRISIS_KEYWORDS}
_IDIOM_RES = [re.compile(p) for p in CRISIS_IDIOM_PATTERNS]


@dataclass(frozen=True)
class CrisisHit:
    keyword: str
    weight: float
    start: int
    end: int
    negated: bool
    past: bool

    @property
    def active(self) -> bool:
        return not (self.negated or self.past)

    @property
    def effective_weight(self) -> float:
        if self.negated:
            return self.weight * NEGATED_WEIGHT_FACTOR
        if self.past:
            return self.weight * PAST_WEIGHT_FACTOR
        return self.weight


def _clause_prefix(text: str, pos: int) -> str:
    start = 0
    for m in _CLAUSE_BOUNDARY_RE.finditer(text, 0, pos):
        start = m.end()
    return text[start:pos]


def _clause_suffix(text: str, pos: int) -> str:
    m = _CLAUSE_BOUNDARY_RE.search(text, pos)
    return text[pos: m.start() if m else len(text)]


def _segment(text: str, start: int, end: int) -> str:
    seg_start = 0
    for m in _SEGMENT_BOUNDARY_RE.finditer(text, 0, start):
        seg_start = m.end()
    m = _SEGMENT_BOUNDARY_RE.search(text, end)
    return text[seg_start: m.start() if m else len(text)]


def _is_negated(prefix_tokens: list[str]) -> bool:
    fillers = 0
    for tok in reversed(prefix_tokens):
        if tok in NEGATORS:
            return True
        if tok in NEGATION_FILLERS and fillers < NEGATION_MAX_FILLERS:
            fillers += 1
            continue
        return False
    return False


def _is_past(prefix_tokens: list[str], suffix: str) -> bool:
    # "used to <up to N words> <phrase>"
    tail = prefix_tokens[-(USED_TO_MAX_GAP + 2):]
    if any(a == "used" and b == "to" for a, b in zip(tail, tail[1:])):
        return True

    # "<past marker> <fillers> <phrase>"
    toks = list(prefix_tokens)
    fillers = 0
    while toks:
        if len(toks) >= 2 and (toks[-2], toks[-1]) in _PAST_MARKERS_DOUBLE:
            return True
        if toks[-1] in _PAST_MARKERS_SINGLE:
            return True
        if toks[-1] in PAST_FILLERS and fillers < PAST_MAX_FILLERS:
            fillers += 1
            toks.pop()
            continue
        break

    # "<phrase> ... years ago"
    return bool(_PAST_TIME_AFTER_RE.match(suffix))


def _has_present_marker(segment: str) -> bool:
    return bool(_PRESENT_MARKERS_RE.search(_RECOVERY_RE.sub(" ", segment)))


def find_crisis_hits(text: str) -> list[CrisisHit]:
    """Return every crisis-keyword occurrence in ``text`` with its context flags.

    Hits are ordered by keyword (in ALL_CRISIS_KEYWORDS order), then position.
    """
    norm = normalize(text)
    if not norm:
        return []
    idiom_spans = [m.span() for rx in _IDIOM_RES for m in rx.finditer(norm)]

    hits: list[CrisisHit] = []
    for kw, rx in _KEYWORD_RES.items():
        for m in rx.finditer(norm):
            s, e = m.span()
            if any(s < ie and e > is_ for is_, ie in idiom_spans):
                continue
            prefix_tokens = _TOKEN_RE.findall(_clause_prefix(norm, s))
            negated = _is_negated(prefix_tokens)
            past = False
            if not negated and _is_past(prefix_tokens, _clause_suffix(norm, e)):
                past = not _has_present_marker(_segment(norm, s, e))
            hits.append(CrisisHit(kw, ALL_CRISIS_KEYWORDS[kw], s, e, negated, past))
    return hits
