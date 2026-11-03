import asyncio
import json
import logging
import threading
from pathlib import Path

import httpx
import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

# Emotion model: local, INT8-quantised ONNX export of j-hartmann/emotion-english-distilroberta-base
# (onnx-community), fetched by scripts/download_emotion_model.py. Runs fully offline and free.
_MODEL_DIR = Path(__file__).resolve().parent / "emotion_onnx"
_MODEL_PATH = _MODEL_DIR / "model_int8.onnx"
_TOKENIZER_PATH = _MODEL_DIR / "tokenizer.json"
_CONFIG_PATH = _MODEL_DIR / "config.json"

# HF Inference API is only a fallback, and only when a token is configured; free HF credits
# no longer exist, so local inference is the default path.
HF_EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base"
HF_API_URL = f"https://router.huggingface.co/hf-inference/models/{HF_EMOTION_MODEL}"
HF_TIMEOUT = 15.0

# Which backend served the last successful prediction ("local-onnx" | "hf" | None).
# Used by analysis.py to report model provenance honestly instead of claiming an API call.
_last_backend: str | None = None


def last_backend() -> str | None:
    return _last_backend


def _model_available() -> bool:
    return _MODEL_PATH.is_file() and _TOKENIZER_PATH.is_file() and _CONFIG_PATH.is_file()


_session = None
_tokenizer = None
_id2label: dict[int, str] | None = None
_lock = threading.Lock()


def _load_onnx():
    global _session, _tokenizer, _id2label
    if _session is None:
        with _lock:
            if _session is None:
                import onnxruntime as ort
                from tokenizers import Tokenizer

                config = json.loads(_CONFIG_PATH.read_text())
                _id2label = {int(k): v.lower() for k, v in config["id2label"].items()}
                tokenizer = Tokenizer.from_file(str(_TOKENIZER_PATH))
                tokenizer.enable_truncation(max_length=512)
                session = ort.InferenceSession(
                    str(_MODEL_PATH), providers=["CPUExecutionProvider"]
                )
                _tokenizer, _session = tokenizer, session
    return _session, _tokenizer, _id2label


def _predict_local(text: str) -> list[dict]:
    session, tokenizer, id2label = _load_onnx()
    encoded = tokenizer.encode(text)
    feed = {
        "input_ids": np.array([encoded.ids], dtype=np.int64),
        "attention_mask": np.array([encoded.attention_mask], dtype=np.int64),
    }
    logits = session.run(None, feed)[0][0].astype(np.float64)
    probs = np.exp(logits - logits.max())
    probs /= probs.sum()
    emotions = [{"label": id2label[i], "score": round(float(p), 4)} for i, p in enumerate(probs)]
    emotions.sort(key=lambda x: x["score"], reverse=True)
    return emotions


def available() -> bool:
    """True if local emotion inference can run (used for honest telemetry)."""
    return _model_available()


# Shared client for the optional HF fallback: reuses TLS connections across requests.
_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


def _get_client() -> httpx.AsyncClient:
    global _client, _client_loop
    loop = asyncio.get_running_loop()
    # Recreate if closed or bound to a different event loop (e.g. tests that spin up new loops).
    if _client is None or _client.is_closed or _client_loop is not loop:
        _client = httpx.AsyncClient(timeout=HF_TIMEOUT)
        _client_loop = loop
    return _client


async def aclose_client() -> None:
    global _client, _client_loop
    # A client bound to another (already closed) event loop can't be closed from this one;
    # its connections died with that loop, so just drop the reference.
    if _client is not None and not _client.is_closed and _client_loop is asyncio.get_running_loop():
        await _client.aclose()
    _client = None
    _client_loop = None


async def _detect_via_hf(text: str) -> list[dict]:
    """Optional HF Inference API fallback. Returns [] on any failure (never fabricates)."""
    headers = {"Authorization": f"Bearer {settings.HF_API_TOKEN}"}
    try:
        response = await _get_client().post(HF_API_URL, headers=headers, json={"inputs": text})
        if response.status_code != 200:
            logger.warning("HF API returned %s: %s", response.status_code, response.text[:200])
            return []
        results = response.json()
        if isinstance(results, list) and results:
            if isinstance(results[0], list):
                results = results[0]
        emotions = [
            {"label": str(r.get("label", "")).lower(), "score": round(float(r.get("score", 0.0)), 4)}
            for r in results
            if isinstance(r, dict) and r.get("label")
        ]
        emotions.sort(key=lambda x: x["score"], reverse=True)
        return emotions
    except httpx.TimeoutException:
        logger.error("HF API timed out after %ss", HF_TIMEOUT)
        return []
    except httpx.HTTPError as exc:
        logger.error("HF API HTTP error: %s", exc)
        return []
    except Exception as exc:
        logger.exception("HF API unexpected error: %s", exc)
        return []


async def detect_emotions(text: str) -> list[dict]:
    """Return emotion scores, best first. Returns [] when emotion analysis is unavailable.

    Never fabricates a result: callers can distinguish 'model ran' (non-empty list)
    from 'unavailable' (empty list), and risk_engine treats an empty list as no signal.
    """
    global _last_backend
    _last_backend = None
    if not isinstance(text, str) or not text.strip():
        return []

    if _model_available():
        try:
            emotions = await asyncio.to_thread(_predict_local, text)
            _last_backend = "local-onnx"
            return emotions
        except Exception as exc:
            logger.exception("Local ONNX emotion inference failed: %s", exc)

    if settings.HF_API_TOKEN:
        emotions = await _detect_via_hf(text)
        if emotions:
            _last_backend = "hf"
            return emotions
    elif not _model_available():
        logger.warning(
            "Emotion model not downloaded (run scripts/download_emotion_model.py) "
            "and HF_API_TOKEN not set — emotions unavailable."
        )
    return []
