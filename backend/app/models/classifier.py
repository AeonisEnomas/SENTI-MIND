import hashlib
import json
import logging
import os
from pathlib import Path

import joblib
import numpy as np
import sklearn

from app.core.preprocessing import preprocess

logger = logging.getLogger(__name__)

_data_dir = Path(__file__).parent.parent.parent / "data"
MODEL_PATH = Path(os.getenv("SENTIMIND_MODEL_PATH", _data_dir / "sentiment_model.joblib"))
VECTORIZER_PATH = Path(os.getenv("SENTIMIND_VECTORIZER_PATH", _data_dir / "vectorizer.joblib"))
# Written by scripts/train_model.py next to the artifacts.
METADATA_PATH = MODEL_PATH.parent / "model_metadata.json"

# Keys under metadata["sha256"] written by scripts/train_model.py.
_MODEL_HASH_KEY = "sentiment_model.joblib"
_VECTORIZER_HASH_KEY = "vectorizer.joblib"

_UNKNOWN_RESULT = {"category": "Unknown", "confidence": 0.0, "top_categories": [], "is_ambiguous": False, "alternative_category": None, "confidence_tier": "none"}

# Confidence thresholds. These only set `confidence_tier`; the category is
# always the top class (callers decide what to do with a "low" tier).
# Below this -> confidence_tier "low"
CONFIDENCE_THRESHOLD = 0.35
# If top-2 within this margin -> ambiguous
AMBIGUITY_MARGIN = 0.10
# Fewer -> "Insufficient"
MIN_MEANINGFUL_WORDS = 3


class ClassifierNotLoadedError(RuntimeError):
    pass


class ArtifactIntegrityError(RuntimeError):
    pass


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_metadata() -> dict:
    if not METADATA_PATH.exists():
        logger.warning("Model metadata not found at %s; skipping artifact checks.", METADATA_PATH)
        return {}
    try:
        with open(METADATA_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as exc:
        logger.warning("Could not read model metadata %s (%s); skipping artifact checks.", METADATA_PATH, exc)
        return {}


def _verify_artifacts(metadata: dict) -> None:
    """Check artifact SHA-256 hashes before unpickling them."""
    hashes = metadata.get("sha256") or {}
    expected = {
        MODEL_PATH: hashes.get(_MODEL_HASH_KEY),
        VECTORIZER_PATH: hashes.get(_VECTORIZER_HASH_KEY),
    }
    if not all(expected.values()):
        logger.warning("Model metadata has no artifact hashes; skipping integrity check.")
        return
    for path, want in expected.items():
        got = _sha256(path)
        if got != want:
            logger.error("SHA-256 mismatch for %s: expected %s, got %s", path, want, got)
            raise ArtifactIntegrityError(
                f"Refusing to load {path}: SHA-256 does not match {METADATA_PATH.name}. "
                "Retrain with scripts/train_model.py or restore the matching artifacts."
            )


def _check_sklearn_version(metadata: dict) -> None:
    trained_with = (metadata.get("environment") or {}).get("sklearn_version")
    if trained_with and trained_with != sklearn.__version__:
        logger.warning(
            "Classifier artifacts were trained with scikit-learn %s but %s is installed; "
            "predictions may differ or loading may fail. Pin scikit-learn==%s.",
            trained_with, sklearn.__version__, trained_with,
        )


class ClinicalClassifier:
    def __init__(self) -> None:
        self._model = None
        self._vectorizer = None
        self._classes = None
        self.model_version: str | None = None

    def load(self) -> None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model artifact not found: {MODEL_PATH}")
        if not VECTORIZER_PATH.exists():
            raise FileNotFoundError(f"Vectorizer artifact not found: {VECTORIZER_PATH}")

        metadata = _load_metadata()
        _verify_artifacts(metadata)
        _check_sklearn_version(metadata)

        try:
            self._model = joblib.load(MODEL_PATH)
            self._vectorizer = joblib.load(VECTORIZER_PATH)
        except Exception as exc:
            raise RuntimeError(f"Failed to load classifier artifacts: {exc}") from exc

        if not hasattr(self._model, "predict_proba"):
            raise RuntimeError(f"Model must support predict_proba: {type(self._model)}")
        if not hasattr(self._vectorizer, "transform"):
            raise RuntimeError(f"Unexpected vectorizer type: {type(self._vectorizer)}")

        self._classes = self._model.classes_
        self.model_version = metadata.get("model_version")
        logger.info(
            "ClinicalClassifier %s loaded. Classes: %s",
            self.model_version or "(unknown version)", list(self._classes),
        )

    def unload(self) -> None:
        self._model = None
        self._vectorizer = None
        self._classes = None
        self.model_version = None

    @property
    def is_loaded(self) -> bool:
        return self._model is not None and self._vectorizer is not None

    def predict(self, text: str) -> dict:
        if not self.is_loaded:
            raise ClassifierNotLoadedError("Call load() before predict().")

        if not isinstance(text, str) or not text.strip():
            return dict(_UNKNOWN_RESULT)

        # Preprocess using the shared pipeline (same as training)
        processed = preprocess(text)

        # Check minimum content after preprocessing
        words = [w for w in processed.split() if len(w) > 1 and not w.startswith(("NEG_", "INTENSE_", "DIM_", "PAST_", "CRISIS_"))]
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

        vec = self._vectorizer.transform([processed])
        probs = self._model.predict_proba(vec)[0]

        sorted_indices = np.argsort(probs)[::-1]
        best_idx = sorted_indices[0]
        second_idx = sorted_indices[1]

        best_conf = float(probs[best_idx])
        second_conf = float(probs[second_idx])

        top_categories = sorted(
            [
                {"category": str(cls), "confidence": round(float(p), 4)}
                for cls, p in zip(self._classes, probs)
            ],
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
        alternative_category = str(self._classes[second_idx]) if is_ambiguous else None

        return {
            "category": str(self._classes[best_idx]),
            "confidence": round(best_conf, 4),
            "top_categories": top_categories,
            "is_ambiguous": is_ambiguous,
            "alternative_category": alternative_category,
            "confidence_tier": confidence_tier,
        }


# Global classifier instance
classifier = ClinicalClassifier()
