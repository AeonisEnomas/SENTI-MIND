"""Held-out evaluation sentences for the clinical classifier.

These sentences are NEVER used for training: generate_training_data.py drops
any pool sentence that matches one of them, or a sentence asserted on in
tests/test_classifier.py, after normalisation. Keep this list hand-written and
do not copy sentences from scripts/training_data/ into it.
"""

import re
from pathlib import Path

ADVERSARIAL_CASES: list[tuple[str, str]] = [
    # Normal — clear
    ("I had a great day today", "Normal"),
    ("My mood was good yesterday", "Normal"),
    ("I enjoyed dinner with friends tonight", "Normal"),
    ("Life is going well and I feel content", "Normal"),
    ("I got a promotion and I'm really happy", "Normal"),
    # Normal — hard negatives (clinical words, non-clinical context)
    ("My friend's stress about exams is contagious", "Normal"),
    ("We discussed depression in psychology class", "Normal"),
    ("I used to be anxious about flying but got over it", "Normal"),
    ("My panic attacks stopped since starting medication", "Normal"),
    ("I was in a dark place last year but I've recovered", "Normal"),
    ("I talked about suicidal thoughts I had years ago with my therapist", "Normal"),
    ("My colleague mentioned her bipolar diagnosis openly", "Normal"),
    ("I'm no longer depressed thanks to good support", "Normal"),
    ("I felt hopeless about the job search but got an offer today", "Normal"),
    ("I used to struggle with self-worth but therapy helped a lot", "Normal"),
    # Stress — including negation patterns
    ("I'm not suicidal just really stressed", "Stress"),
    ("Work deadlines are overwhelming me completely", "Stress"),
    ("I can't keep up with all my responsibilities", "Stress"),
    ("I'm burnt out but I can't afford to slow down", "Stress"),
    ("I don't want to die I just need a break from work", "Stress"),
    ("The pressure at work is making me physically ill", "Stress"),
    # Depression — clear
    ("I feel empty and hopeless every single day", "Depression"),
    ("Nothing brings me joy anymore everything is grey", "Depression"),
    ("I can't get out of bed and I don't see the point", "Depression"),
    ("I feel numb and disconnected from everything", "Depression"),
    ("I've lost interest in all my hobbies", "Depression"),
    ("I feel like a burden to everyone around me", "Depression"),
    # Suicidal — clear
    ("I want to end my life", "Suicidal"),
    ("I've been thinking about killing myself", "Suicidal"),
    ("I have a plan to end it all tonight", "Suicidal"),
    ("I don't want to be alive anymore", "Suicidal"),
    ("I've been self-harming to cope with the pain", "Suicidal"),
    ("Nobody would miss me if I was gone", "Suicidal"),
    # Anxiety — clear
    ("My heart races before every meeting", "Anxiety"),
    ("I can't stop worrying about things that haven't happened", "Anxiety"),
    ("I had a panic attack in the grocery store", "Anxiety"),
    ("I avoid crowded places because they make me panic", "Anxiety"),
    ("I feel a constant sense of dread that won't go away", "Anxiety"),
    ("I check the door lock five times before leaving", "Anxiety"),
    # Bipolar — clear
    ("My moods swing from elated to crushing depression", "Bipolar"),
    ("I spent thousands impulsively during a manic phase", "Bipolar"),
    ("I cycle between feeling invincible and completely worthless", "Bipolar"),
    ("I barely slept for three days and felt amazing until I crashed", "Bipolar"),
    ("I feel like two different people depending on my phase", "Bipolar"),
    ("I go from extreme highs to devastating lows", "Bipolar"),
    # Personality disorder — clear
    ("I feel disconnected and don't know who I am", "Personality disorder"),
    ("I push everyone away before they can leave me", "Personality disorder"),
    ("My sense of self changes depending on who I'm with", "Personality disorder"),
    ("I idealize people then devalue them when they disappoint me", "Personality disorder"),
    ("I feel chronically empty even when things are fine", "Personality disorder"),
    ("I have an intense fear of abandonment that destroys relationships", "Personality disorder"),
]


_TOKEN_RE = re.compile(r"[a-z0-9']+")
_TEST_FILE = Path(__file__).resolve().parent.parent / "tests" / "test_classifier.py"
_PREDICT_CALL_RE = re.compile(r'classifier\.predict\(\s*"([^"]+)"\s*\)')


def normalize_sentence(text: str) -> str:
    """Lowercase and keep only word tokens, for exact-match leakage checks."""
    return " ".join(_TOKEN_RE.findall(text.lower()))


def tokens(text: str) -> frozenset[str]:
    """Token set used for near-duplicate (Jaccard) checks."""
    return frozenset(_TOKEN_RE.findall(text.lower()))


def jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / (len(a) + len(b) - inter)


def classifier_test_sentences() -> list[str]:
    """Sentences passed to classifier.predict() in tests/test_classifier.py."""
    if not _TEST_FILE.exists():
        return []
    return _PREDICT_CALL_RE.findall(_TEST_FILE.read_text(encoding="utf-8"))


def held_out_sentences() -> list[str]:
    """Every sentence that must never appear in the training data."""
    return [text for text, _ in ADVERSARIAL_CASES] + classifier_test_sentences()
