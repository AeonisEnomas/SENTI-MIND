#!/usr/bin/env python3
"""Train the clinical text classifier (TF-IDF + calibrated LinearSVC).

Evaluation protocol
-------------------
The training data is synthetic and template-heavy, so a plain random split
puts near-identical sentences on both sides and inflates every metric. This
script therefore:

1. Clusters near-duplicates into groups (union-find over pairs whose
   normalised token sets have Jaccard similarity >= NEAR_DUP_JACCARD).
2. Holds out a test set with StratifiedGroupKFold, so no group is split
   between train and test.
3. Runs hyper-parameter search with group-aware CV on the TRAIN split only.
   The test set is not used for model selection or CV.
4. Fits the final model on the train split (the saved artifact is exactly the
   model the test metrics describe), then scores it on the held-out test set
   and on the hand-written adversarial cases in eval_cases.py.
5. Records leakage statistics, library versions, the git commit and SHA-256
   hashes of the data and artifacts in data/model_metadata.json.

The numbers describe performance on synthetic sentences only. They are not a
clinical validation.
"""

import hashlib
import json
import logging
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(SCRIPTS_DIR))

from app.core.preprocessing import preprocess  # noqa: E402
from eval_cases import ADVERSARIAL_CASES, jaccard, normalize_sentence, tokens  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MODEL_VERSION = "v5"
RANDOM_STATE = 42
NEAR_DUP_JACCARD = 0.6
TEST_FOLDS = 5  # 1 of 5 group-stratified folds is held out -> ~20% test
CV_FOLDS = 5

DATA_DIR = PROJECT_ROOT / "data"
CSV_PATH = DATA_DIR / "Combined Data.csv"
MODEL_PATH = DATA_DIR / "sentiment_model.joblib"
VECTORIZER_PATH = DATA_DIR / "vectorizer.joblib"
METADATA_PATH = DATA_DIR / "model_metadata.json"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def git_commit() -> dict:
    try:
        sha = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=PROJECT_ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
        dirty = bool(subprocess.run(
            ["git", "status", "--porcelain", "--", "scripts", "app/core"],
            cwd=PROJECT_ROOT, capture_output=True, text=True, check=True,
        ).stdout.strip())
        return {"sha": sha, "training_code_dirty": dirty}
    except (OSError, subprocess.CalledProcessError):
        return {"sha": None, "training_code_dirty": None}


def load_data(csv_path: Path) -> pd.DataFrame:
    logger.info("Loading data from %s", csv_path)
    df = pd.read_csv(csv_path)
    df.columns = [c.strip() for c in df.columns]
    df = df.dropna(subset=["statement", "status"])
    df["statement"] = df["statement"].astype(str).str.strip()
    df = df[df["statement"].str.len() > 0]

    before = len(df)
    df = df[~df["statement"].map(normalize_sentence).duplicated()].reset_index(drop=True)
    if len(df) != before:
        logger.warning("Dropped %d duplicate rows after normalisation", before - len(df))

    logger.info("Loaded %d samples", len(df))
    for cls, cnt in df["status"].value_counts().items():
        logger.info("  %-25s %d (%.1f%%)", cls, cnt, cnt / len(df) * 100)
    return df


def near_duplicate_groups(texts: list[str], threshold: float) -> np.ndarray:
    """Union-find over all pairs with token Jaccard >= threshold."""
    toks = [tokens(t) for t in texts]
    parent = list(range(len(toks)))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i in range(len(toks)):
        a = toks[i]
        for j in range(i + 1, len(toks)):
            if jaccard(a, toks[j]) >= threshold:
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[ri] = rj

    roots = [find(i) for i in range(len(toks))]
    _, groups = np.unique(roots, return_inverse=True)
    return groups


def leakage_stats(train_texts, test_texts, threshold: float) -> dict:
    """How many test rows have a near-duplicate (or exact duplicate) in train."""
    train_toks = [tokens(t) for t in train_texts]
    train_norm = {normalize_sentence(t) for t in train_texts}
    max_sims = []
    for t in test_texts:
        tt = tokens(t)
        max_sims.append(max((jaccard(tt, tr) for tr in train_toks), default=0.0))
    max_sims = np.array(max_sims)
    exact = sum(normalize_sentence(t) in train_norm for t in test_texts)
    stats = {
        "test_rows": int(len(test_texts)),
        "exact_duplicates_in_train": int(exact),
        "near_duplicates_in_train": int((max_sims >= threshold).sum()),
        "near_duplicate_rate": round(float((max_sims >= threshold).mean()), 4),
        "mean_max_jaccard_to_train": round(float(max_sims.mean()), 4),
    }
    return stats, max_sims


def make_pipeline(ngram_range=(1, 2), max_features=20000, C=1.0) -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            stop_words="english",
            lowercase=True,
            strip_accents="unicode",
            sublinear_tf=True,
            min_df=2,
            max_df=0.95,
            ngram_range=ngram_range,
            max_features=max_features,
        )),
        ("clf", CalibratedClassifierCV(
            LinearSVC(class_weight="balanced", max_iter=10000, random_state=RANDOM_STATE, dual="auto", C=C),
            method="sigmoid",
            cv=3,
        )),
    ])


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def grid_search(X_train, y_train, groups_train) -> GridSearchCV:
    """Group-aware CV grid search on the training split only."""
    logger.info("Running GridSearchCV (StratifiedGroupKFold, %d folds, train split only)...", CV_FOLDS)
    param_grid = {
        "tfidf__ngram_range": [(1, 2), (1, 3)],
        "tfidf__max_features": [15000, 20000, 30000],
        "clf__estimator__C": [0.1, 0.5, 1.0, 2.0, 5.0],
    }
    cv = StratifiedGroupKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    gs = GridSearchCV(make_pipeline(), param_grid, cv=cv, scoring="f1_macro", n_jobs=-1, verbose=1)
    gs.fit(X_train, y_train, groups=groups_train)
    logger.info("Best params: %s", gs.best_params_)
    logger.info("Best CV F1-macro: %.4f", gs.best_score_)
    return gs


def run_adversarial_check(pipeline) -> tuple[list[bool], dict]:
    """Score the hand-written adversarial cases (never seen in training)."""
    logger.info("=" * 70)
    logger.info("ADVERSARIAL SPOT-CHECK")
    logger.info("=" * 70)

    ok = 0
    hits: list[bool] = []
    per_class: dict[str, list[int]] = {}
    for text, expected in ADVERSARIAL_CASES:
        processed = preprocess(text)
        pred = pipeline.predict([processed])[0]
        conf = float(pipeline.predict_proba([processed])[0].max())
        hit = bool(pred == expected)
        ok += hit
        hits.append(hit)
        per_class.setdefault(expected, [0, 0])
        per_class[expected][0] += hit
        per_class[expected][1] += 1
        logger.info(
            "[%s] %-55s -> %-25s %.1f%%  (expected: %s)",
            "OK  " if hit else "FAIL", f'"{text[:50]}"', pred, conf * 100, expected,
        )

    logger.info("Spot-check: %d/%d correct (%.0f%%)", ok, len(ADVERSARIAL_CASES), ok / len(ADVERSARIAL_CASES) * 100)
    return hits, {k: f"{v[0]}/{v[1]}" for k, v in sorted(per_class.items())}


def train() -> None:
    logger.info("=" * 70)
    logger.info("SENTI-MIND Model Training %s", MODEL_VERSION)
    logger.info("=" * 70)

    if not CSV_PATH.exists():
        sys.exit(f"{CSV_PATH} not found. Run `cd scripts && python generate_training_data.py` first.")

    df = load_data(CSV_PATH)
    texts = df["statement"].tolist()

    logger.info("Clustering near-duplicates (token Jaccard >= %.2f)...", NEAR_DUP_JACCARD)
    groups = near_duplicate_groups(texts, NEAR_DUP_JACCARD)
    group_sizes = np.bincount(groups)
    logger.info(
        "%d rows -> %d groups (largest %d, singletons %d)",
        len(texts), len(group_sizes), group_sizes.max(), int((group_sizes == 1).sum()),
    )

    logger.info("Preprocessing text with shared preprocessor...")
    df["processed"] = df["statement"].apply(preprocess)
    X = df["processed"].to_numpy()
    y = df["status"].to_numpy()

    # --- Group-aware held-out split ---
    outer = StratifiedGroupKFold(n_splits=TEST_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    train_idx, test_idx = next(outer.split(X, y, groups))
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    groups_train = groups[train_idx]
    assert not set(groups[train_idx]) & set(groups[test_idx]), "group leaked across split"
    logger.info("Train: %d | Test: %d", len(train_idx), len(test_idx))

    # --- Leakage check: group split vs. the naive random split it replaces ---
    raw_train = [texts[i] for i in train_idx]
    raw_test = [texts[i] for i in test_idx]
    leak_group, _ = leakage_stats(raw_train, raw_test, NEAR_DUP_JACCARD)
    rnd_train, rnd_test = train_test_split(texts, test_size=0.2, stratify=y, random_state=RANDOM_STATE)
    leak_random, _ = leakage_stats(rnd_train, rnd_test, NEAR_DUP_JACCARD)
    adv_texts = [t for t, _ in ADVERSARIAL_CASES]
    leak_adv, adv_sims = leakage_stats(raw_train, adv_texts, NEAR_DUP_JACCARD)
    logger.info("Leakage (group split):  %s", leak_group)
    logger.info("Leakage (random split, for reference): %s", leak_random)
    logger.info("Adversarial cases vs train: %s", leak_adv)

    # --- Model selection on train only ---
    gs = grid_search(X_train, y_train, groups_train)
    best = gs.best_params_
    best_i = gs.best_index_
    cv_mean = float(gs.cv_results_["mean_test_score"][best_i])
    cv_std = float(gs.cv_results_["std_test_score"][best_i])

    # --- Final model: fit on the train split only ---
    logger.info("Fitting final model with best params on the train split...")
    final_pipeline = make_pipeline(
        ngram_range=best["tfidf__ngram_range"],
        max_features=best["tfidf__max_features"],
        C=best["clf__estimator__C"],
    )
    final_pipeline.fit(X_train, y_train)
    classes = final_pipeline.classes_

    # --- Held-out test set ---
    y_pred = final_pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average="macro")
    weighted_f1 = f1_score(y_test, y_pred, average="weighted")
    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, y_pred, average=None, labels=classes
    )

    logger.info("=" * 70)
    logger.info("HELD-OUT TEST SET RESULTS (group-aware split)")
    logger.info("=" * 70)
    logger.info("Accuracy:    %.4f", acc)
    logger.info("Macro F1:    %.4f", macro_f1)
    logger.info("Weighted F1: %.4f", weighted_f1)
    logger.info("\n%s", classification_report(y_test, y_pred, digits=4))
    cm = confusion_matrix(y_test, y_pred, labels=classes)
    logger.info("Confusion Matrix (rows=true, cols=pred): %s", list(classes))
    for i, row in enumerate(cm):
        logger.info("  %-25s %s", classes[i], row)

    spot_hits, spot_per_class = run_adversarial_check(final_pipeline)
    spot_ok, spot_total = sum(spot_hits), len(spot_hits)
    # Adversarial cases with no near-duplicate in the train split: the
    # stricter number, since the others partly measure memorisation.
    novel = [
        hit for hit, sim in zip(spot_hits, adv_sims)
        if sim < NEAR_DUP_JACCARD
    ]
    logger.info("Spot-check on cases without a train near-duplicate: %d/%d", sum(novel), len(novel))

    # --- Save artifacts ---
    logger.info("=" * 70)
    logger.info("SAVING MODEL ARTIFACTS (%s)", MODEL_VERSION)
    logger.info("=" * 70)
    joblib.dump(final_pipeline.named_steps["tfidf"], VECTORIZER_PATH)
    joblib.dump(final_pipeline.named_steps["clf"], MODEL_PATH)
    logger.info("Saved vectorizer -> %s", VECTORIZER_PATH)
    logger.info("Saved classifier -> %s", MODEL_PATH)

    metadata = {
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "environment": {
            "python_version": platform.python_version(),
            "sklearn_version": sklearn.__version__,
            "numpy_version": np.__version__,
            "joblib_version": joblib.__version__,
        },
        "git": git_commit(),
        "sha256": {
            "training_csv": sha256_file(CSV_PATH),
            "sentiment_model.joblib": sha256_file(MODEL_PATH),
            "vectorizer.joblib": sha256_file(VECTORIZER_PATH),
        },
        "data": {
            "source": "synthetic, hand-written sentence pools in scripts/training_data/ (not clinical data)",
            "samples_total": int(len(df)),
            "class_counts": {k: int(v) for k, v in df["status"].value_counts().sort_index().items()},
        },
        "evaluation": {
            "split_method": (
                f"StratifiedGroupKFold(n_splits={TEST_FOLDS}, shuffle=True, random_state={RANDOM_STATE}); "
                f"fold 0 held out as test. Groups = union-find clusters of rows with token "
                f"Jaccard >= {NEAR_DUP_JACCARD}."
            ),
            "cv_method": (
                f"GridSearchCV with StratifiedGroupKFold(n_splits={CV_FOLDS}) on the train split only; "
                "the test set is never used for CV or model selection."
            ),
            "final_model_fit_on": "train split only",
            "near_dup_jaccard_threshold": NEAR_DUP_JACCARD,
            "groups": {
                "count": int(len(group_sizes)),
                "largest": int(group_sizes.max()),
                "singletons": int((group_sizes == 1).sum()),
            },
            "leakage_check": {
                "group_split": leak_group,
                "random_split_reference": leak_random,
                "adversarial_vs_train": leak_adv,
            },
            "caveats": [
                "Synthetic, template-generated sentences; metrics do not reflect real-world or clinical performance.",
                "The model is not clinically validated and must not be used for diagnosis.",
                "Calibration inside CalibratedClassifierCV uses ungrouped 3-fold CV.",
            ],
        },
        "samples_train": int(len(train_idx)),
        "samples_test": int(len(test_idx)),
        "classes": classes.tolist(),
        "best_params": {
            "C": best["clf__estimator__C"],
            "ngram_range": list(best["tfidf__ngram_range"]),
            "max_features": best["tfidf__max_features"],
        },
        "accuracy": float(acc),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
        "cv_f1_macro_mean": cv_mean,
        "cv_f1_macro_std": cv_std,
        "per_class_metrics": {
            cls: {
                "precision": float(precision[i]),
                "recall": float(recall[i]),
                "f1": float(f1[i]),
                "support": int(support[i]),
            }
            for i, cls in enumerate(classes)
        },
        "confusion_matrix": {"labels": classes.tolist(), "matrix": cm.tolist()},
        "adversarial_spot_check": f"{spot_ok}/{spot_total}",
        "adversarial_spot_check_without_train_near_dups": f"{sum(novel)}/{len(novel)}",
        "adversarial_per_class": spot_per_class,
        "has_calibration": True,
        "preprocessing": "shared app.core.preprocessing (contractions + negation_scope + intensity + temporal + crisis)",
    }

    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)
        f.write("\n")
    logger.info("Saved metadata -> %s", METADATA_PATH)
    logger.info("TRAINING COMPLETE — macro F1 %.4f (test), CV %.4f ± %.4f, adversarial %d/%d",
                macro_f1, cv_mean, cv_std, spot_ok, spot_total)


if __name__ == "__main__":
    train()
