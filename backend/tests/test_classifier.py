#!/usr/bin/env python3
"""Comprehensive tests for the clinical classifier."""

import json
import shutil

import pytest

import app.models.classifier as classifier_module
from app.models.classifier import ArtifactIntegrityError, ClinicalClassifier, classifier


@pytest.fixture(scope="module", autouse=True)
def load_classifier():
    classifier.load()
    yield
    classifier.unload()


# ── Standard classification tests ──────────────────────────────────────

class TestStandardClassification:
    def test_normal(self):
        result = classifier.predict("I had a great day at work today")
        assert result["category"] == "Normal"

    def test_depression(self):
        result = classifier.predict("I feel empty and hopeless every single day")
        assert result["category"] == "Depression"

    def test_suicidal(self):
        result = classifier.predict("I want to end my life I can't take this anymore")
        assert result["category"] == "Suicidal"

    def test_anxiety(self):
        result = classifier.predict("My heart races and I can't stop worrying about everything")
        assert result["category"] == "Anxiety"

    def test_stress(self):
        result = classifier.predict("Work deadlines are completely overwhelming me right now")
        assert result["category"] == "Stress"

    def test_bipolar(self):
        result = classifier.predict("I spent thousands impulsively during a manic phase and now I've crashed")
        assert result["category"] == "Bipolar"

    def test_personality_disorder(self):
        result = classifier.predict("My sense of self changes depending on who I'm with and I don't know who I am")
        assert result["category"] == "Personality disorder"


# ── Edge case tests ────────────────────────────────────────────────────

class TestEdgeCases:
    def test_empty_string(self):
        result = classifier.predict("")
        assert result["category"] == "Unknown"

    def test_none_input(self):
        result = classifier.predict(None)
        assert result["category"] == "Unknown"

    def test_whitespace_only(self):
        result = classifier.predict("   \n\t  ")
        assert result["category"] == "Unknown"

    def test_single_word(self):
        result = classifier.predict("hello")
        assert result["category"] == "Insufficient"

    def test_two_words(self):
        result = classifier.predict("feeling bad")
        assert result["category"] == "Insufficient"

    def test_gibberish(self):
        result = classifier.predict("asdf jkl qwerty")
        # Should return something with low confidence
        assert result["confidence_tier"] in ("low", "medium", "none")

    def test_numbers_only(self):
        result = classifier.predict("12345")
        assert result["category"] in ("Unknown", "Insufficient")

    def test_punctuation_only(self):
        result = classifier.predict("!!!???...")
        assert result["category"] in ("Unknown", "Insufficient")


# ── Negation tests ─────────────────────────────────────────────────────

class TestNegation:
    def test_not_suicidal_stressed(self):
        result = classifier.predict("I'm not suicidal just really stressed about work")
        assert result["category"] != "Suicidal", f"Got {result['category']} instead of non-Suicidal"

    def test_not_depressed(self):
        result = classifier.predict("I'm not depressed I'm just having a rough week at work")
        assert result["category"] != "Depression"

    def test_negated_with_stress_context(self):
        result = classifier.predict("I don't want to die I just desperately need a break from work")
        assert result["category"] != "Suicidal"


# ── Confidence and ambiguity tests ─────────────────────────────────────

class TestConfidence:
    def test_high_confidence_for_clear_text(self):
        result = classifier.predict("I want to end my life I have a plan to kill myself tonight")
        assert result["confidence"] >= 0.5
        assert result["confidence_tier"] in ("high", "medium")

    def test_result_has_top_categories(self):
        result = classifier.predict("I feel really sad and overwhelmed")
        assert len(result["top_categories"]) > 0

    def test_result_has_confidence_tier(self):
        result = classifier.predict("Life is going well and I feel content")
        assert result["confidence_tier"] in ("high", "medium", "low", "none")

    def test_result_has_ambiguity_fields(self):
        result = classifier.predict("I feel really empty and disconnected from everything")
        assert "is_ambiguous" in result
        assert "alternative_category" in result


# ── Past tense / recovery tests ────────────────────────────────────────

class TestRecovery:
    def test_past_depression_recovery(self):
        result = classifier.predict("I was in a dark place last year but I've recovered well and I feel great now")
        assert result["category"] == "Normal", f"Got {result['category']} instead of Normal"

    def test_no_longer_depressed(self):
        result = classifier.predict("I'm no longer depressed thanks to good support and treatment")
        assert result["category"] == "Normal"

    def test_academic_discussion(self):
        result = classifier.predict("We discussed depression and suicide prevention in my psychology class today")
        assert result["category"] == "Normal"


# ── Classifier state tests ─────────────────────────────────────────────

class TestClassifierState:
    def test_is_loaded(self):
        assert classifier.is_loaded

    def test_predict_returns_dict(self):
        result = classifier.predict("test input with enough words")
        assert isinstance(result, dict)
        assert "category" in result
        assert "confidence" in result

    def test_model_version_from_metadata(self):
        metadata = json.loads(classifier_module.METADATA_PATH.read_text())
        assert classifier.model_version == metadata["model_version"]


# ── Artifact integrity tests ───────────────────────────────────────────

@pytest.fixture
def artifact_copy(tmp_path, monkeypatch):
    """Copy the real artifacts + metadata to tmp_path and point the loader there."""
    paths = {}
    for name in ("sentiment_model.joblib", "vectorizer.joblib", "model_metadata.json"):
        dst = tmp_path / name
        shutil.copy(classifier_module._data_dir / name, dst)
        paths[name] = dst
    monkeypatch.setattr(classifier_module, "MODEL_PATH", paths["sentiment_model.joblib"])
    monkeypatch.setattr(classifier_module, "VECTORIZER_PATH", paths["vectorizer.joblib"])
    monkeypatch.setattr(classifier_module, "METADATA_PATH", paths["model_metadata.json"])
    return paths


class TestArtifactIntegrity:
    def test_metadata_hashes_match_committed_artifacts(self):
        metadata = json.loads(classifier_module.METADATA_PATH.read_text())
        hashes = metadata["sha256"]
        assert hashes["sentiment_model.joblib"] == classifier_module._sha256(classifier_module.MODEL_PATH)
        assert hashes["vectorizer.joblib"] == classifier_module._sha256(classifier_module.VECTORIZER_PATH)

    def test_refuses_tampered_model(self, artifact_copy):
        with open(artifact_copy["sentiment_model.joblib"], "ab") as f:
            f.write(b"tampered")
        clf = ClinicalClassifier()
        with pytest.raises(ArtifactIntegrityError):
            clf.load()
        assert not clf.is_loaded

    def test_loads_without_hashes_in_metadata(self, artifact_copy, caplog):
        meta_path = artifact_copy["model_metadata.json"]
        metadata = json.loads(meta_path.read_text())
        metadata.pop("sha256")
        meta_path.write_text(json.dumps(metadata))
        clf = ClinicalClassifier()
        clf.load()
        assert clf.is_loaded
        assert "no artifact hashes" in caplog.text

    def test_warns_on_sklearn_version_mismatch(self, artifact_copy, caplog):
        meta_path = artifact_copy["model_metadata.json"]
        metadata = json.loads(meta_path.read_text())
        metadata["environment"]["sklearn_version"] = "0.0.0"
        meta_path.write_text(json.dumps(metadata))
        clf = ClinicalClassifier()
        clf.load()
        assert clf.is_loaded
        assert "trained with scikit-learn 0.0.0" in caplog.text
