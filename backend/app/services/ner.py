import threading

import spacy

_nlp = None
_lock = threading.Lock()


def _load_nlp():
    global _nlp
    if _nlp is None:
        # Requests run in a threadpool, so guard against two threads loading the model at once.
        with _lock:
            if _nlp is None:
                _nlp = spacy.load("en_core_web_sm")
    return _nlp


def load() -> None:
    """Eagerly load the spaCy model (called from the app lifespan). Lazy loading remains the fallback."""
    _load_nlp()


def extract_entities(text: str) -> list[dict]:
    nlp = _load_nlp()
    doc = nlp(text)
    return [
        {
            "text": ent.text,
            "label": ent.label_,
            "start": ent.start_char,
            "end": ent.end_char,
        }
        for ent in doc.ents
    ]
