import pytest
from app.models import emotions as emotions_module
from app.models.emotions import detect_emotions, available
from app.services.preprocessor import clean_text

pytestmark = pytest.mark.asyncio

MODEL_PRESENT = available()
LABELS = {"anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise"}
requires_model = pytest.mark.skipif(
    not MODEL_PRESENT, reason="emotion ONNX model not downloaded (scripts/download_emotion_model.py)"
)


@requires_model
async def test_emotion_detection_joy():
    text, _ = clean_text("I am so incredibly happy today!")
    emotions = await detect_emotions(text)
    assert emotions, "local ONNX model should produce scores"
    assert emotions[0]["label"] == "joy"


@requires_model
async def test_emotion_detection_anger():
    text, _ = clean_text("This makes me furious and I hate it.")
    emotions = await detect_emotions(text)
    assert emotions
    assert emotions[0]["label"] == "anger"


@requires_model
async def test_emotion_detection_fear():
    text, _ = clean_text("I'm terrified of what might happen.")
    emotions = await detect_emotions(text)
    assert emotions
    assert emotions[0]["label"] == "fear"


@requires_model
async def test_emotion_detection_emojis():
    # clean_text translates emoji clusters into words for the emotion model
    text, _ = clean_text("😭😭😭")
    emotions = await detect_emotions(text)
    assert emotions
    assert emotions[0]["label"] == "sadness"


@requires_model
async def test_emotion_output_contract():
    text, _ = clean_text("I feel anxious and can't sleep.")
    emotions = await detect_emotions(text)
    labels = [e["label"] for e in emotions]
    scores = [e["score"] for e in emotions]
    assert set(labels) <= LABELS
    assert scores == sorted(scores, reverse=True)
    assert all(0.0 <= s <= 1.0 for s in scores)


@requires_model
async def test_telemetry_backend_is_local():
    import app.models.emotions as em
    text, _ = clean_text("I am furious about this!")
    await detect_emotions(text)
    assert em.last_backend() == "local-onnx"


async def test_emotion_empty_input():
    assert await detect_emotions("") == []
    assert await detect_emotions("   ") == []


async def test_unavailable_returns_empty_not_fabricated(monkeypatch):
    # Force "model missing" and "no HF token" — the honest outcome is [], not a fake neutral.
    monkeypatch.setattr(emotions_module, "_model_available", lambda: False)
    monkeypatch.setattr(emotions_module.settings, "HF_API_TOKEN", "")
    emotions = await detect_emotions("I am happy today")
    assert emotions == []
