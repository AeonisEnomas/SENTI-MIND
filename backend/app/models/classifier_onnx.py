"""Local ONNX inference for the fine-tuned transformer classifier (v8).

Drop-in compatible with app.models.classifier.ClinicalClassifier: same load()/unload()/
is_loaded/predict() contract and identical output dict, so nothing else in the app needs
to know which backend answered. Used when

  1. ENV=CLASSIFIER_BACKEND=onnx is set, or
  2. CLASSIFIER_BACKEND=auto (default) and the ONNX artifacts are present.

Otherwise the app falls back to the sklearn v7 classifier. The ONNX artifacts are
downloaded by scripts/download_classifier_model.py (pinned revision + SHA-256); they
never call any API, so inference is free and offline. Softmax over the logits is used —
it is NOT calibrated like the sklearn model's probabilities, so `confidence_tier` bands
(0.70 high / 0.35 medium) are indicative, not comparable bin-for-bin with v7.
"""

import json
import logging
import threading
from pathlib import Path

import numpy as np


logger = logging.getLogger(__name__)

_MODEL_DIR = Path(__file__).resolve().parent / "classifier_onnx"
_MODEL_PATH = _MODEL_DIR / "model_int8.onnx"
_TOKENIZER_PATH = _MODEL_DIR / "tokenizer.json"
_CONFIG_PATH = _MODEL_DIR / "config.json"
_HASH_PATH = _MODEL_DIR / "model_int8.onnx.sha256"

_UNKNOWN_RESULT = {"category": "Unknown", "confidence": 0.0, "top_categories": [], "is_ambiguous": False, "alternative_category": None, "confidence_tier": "none"}
CONFIDENCE_THRESHOLD = 0.35
AMBIGUITY_MARGIN = 0.10
MIN_MEANINGFUL_WORDS = 3
MAX_TOKENS = 256
# Fallback class order if the exported config.json can't be parsed.
_FALLBACK_LABELS = sorted(["Anxiety", "Depression", "Normal", "Stress", "Suicidal"])


class ClassifierNotLoadedError(RuntimeError):
    pass


def available() -> bool:
    """True if the ONNX artifacts are present locally (used by the backend auto-select)."""
    return _MODEL_PATH.is_file() and _TOKENIZER_PATH.is_file()


def _sha256(path: Path) -> str:
    import hashlib

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


class ClinicalClassifierONNX:
    """Fine-tuned distilroberta, INT8 ONNX, fully local."""

    MODEL_DESCRIPTION = "transformer, local ONNX INT8"

    def __init__(self) -> None:
        self._session = None
        self._tokenizer = None
        self._id2label: dict[int, str] | None = None
        self.model_version: str | None = "v8"
        self._lock = threading.Lock()

    @property
    def is_loaded(self) -> bool:
        return self._session is not None and self._tokenizer is not None

    def load(self) -> None:
        if self.is_loaded:
            return
        if not _MODEL_PATH.is_file():
            raise FileNotFoundError(
                f"ONNX classifier artifact not found: {_MODEL_PATH}. "
                "Run scripts/download_classifier_model.py (or set CLASSIFIER_BACKEND=sklearn)."
            )
        if not _TOKENIZER_PATH.is_file():
            raise FileNotFoundError(f"Tokenizer not found: {_TOKENIZER_PATH}")
        if not _CONFIG_PATH.is_file():
            logger.info("No config.json in %s; using the alphabetical class order for the label mapping", _MODEL_DIR)
        if _HASH_PATH.is_file():
            expected = _HASH_PATH.read_text().split()[0]
            got = _sha256(_MODEL_PATH)
            if got != expected:
                raise RuntimeError(
                    f"SHA-256 mismatch for {_MODEL_PATH}: expected {expected}, got {got}. Refusing to load."
                )

        import onnxruntime as ort
        from tokenizers import Tokenizer

        try:
            config = json.loads(_CONFIG_PATH.read_text())
            id2label = {int(k): v for k, v in config.get("id2label", {}).items()}
            if sorted(id2label) != list(range(len(id2label))):
                raise ValueError("id2label keys are not contiguous 0..N-1")
            self._id2label = {i: v.strip() for i, v in id2label.items()}
        except Exception as exc:
            logger.warning("Could not parse id2label from %s (%s); using fallback order %s",
                           _CONFIG_PATH, exc, _FALLBACK_LABELS)
            self._id2label = {i: label for i, label in enumerate(_FALLBACK_LABELS)}

        tokenizer = Tokenizer.from_file(str(_TOKENIZER_PATH))
        tokenizer.enable_truncation(max_length=MAX_TOKENS)
        session = ort.InferenceSession(str(_MODEL_PATH), providers=["CPUExecutionProvider"])
        self._tokenizer, self._session = tokenizer, session
        logger.info("ClinicalClassifier v8 (local ONNX) loaded. Classes: %s", list(self._id2label.values()))

    def unload(self) -> None:
        with self._lock:
            self._session = None
            self._tokenizer = None
            self._id2label = None

    def predict(self, text: str) -> dict:
        if not self.is_loaded:
            raise ClassifierNotLoadedError("Call load() before predict().")
        with self._lock:
            return self._predict(text)

    def _predict(self, text: str) -> dict:
        if not isinstance(text, str) or not text.strip():
            return dict(_UNKNOWN_RESULT)

        # The transformer was trained on raw journal/reddit text — do NOT apply the
        # NEG_/INTENSE_ preprocessing here; it would destroy its learned vocabulary.
        words = [w for w in text.split() if len(w) > 1]
        if len(words) < 1:
            return dict(_UNKNOWN_RESULT)
        if len(words) < MIN_MEANINGFUL_WORDS:
            return {
                "category": "Insufficient",
                "confidence": 0.0,
                "top_categories": [],
                "is_ambiguous": False,
                "alternative_category": None,
                "confidence_tier": "none",
            }

        encoded = self._tokenizer.encode(text)
        feed = {
            "input_ids": np.array([encoded.ids], dtype=np.int64),
            "attention_mask": np.array([encoded.attention_mask], dtype=np.int64),
        }
        logits = self._session.run(None, feed)[0][0].astype(np.float64)
        probs = np.exp(logits - logits.max())
        probs /= probs.sum()

        labels = [self._id2label[i] for i in range(len(self._id2label))]
        order = np.argsort(probs)[::-1]
        best_idx, second_idx = int(order[0]), int(order[1])
        best_conf, second_conf = float(probs[best_idx]), float(probs[second_idx])

        top_categories = sorted(
            [{"category": labels[i], "confidence": round(float(p), 4)} for i, p in enumerate(probs)],
            key=lambda x: x["confidence"],
            reverse=True,
        )
        if best_conf >= 0.70:
            confidence_tier = "high"
        elif best_conf >= CONFIDENCE_THRESHOLD:
            confidence_tier = "medium"
        else:
            confidence_tier = "low"

        is_ambiguous = (best_conf - second_conf) < AMBIGUITY_MARGIN
        alternative_category = labels[second_idx] if is_ambiguous else None

        return {
            "category": labels[best_idx],
            "confidence": round(best_conf, 4),
            "top_categories": top_categories,
            "is_ambiguous": is_ambiguous,
            "alternative_category": alternative_category,
            "confidence_tier": confidence_tier,
        }
