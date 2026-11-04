#!/usr/bin/env python3
"""Compare the sklearn (v7) and ONNX transformer (v8) classifiers on the exact same
group-aware held-out fold used by scripts/train_model.py, bucketed by input length.

Purpose: check how each classifier behaves on longer journal-style input rather than
the short phrasings the synthetic pool favours. Neither model was trained on these
rows (fold 0 of StratifiedGroupKFold(5, shuffle=True, random_state=42)).
"""

import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import StratifiedGroupKFold

SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(SCRIPTS_DIR))

from app.core.preprocessing import preprocess  # noqa: E402
import train_model as tm  # noqa: E402
from app.models.classifier import ClinicalClassifier  # noqa: E402
from app.models import classifier_onnx  # noqa: E402

CSV = PROJECT_ROOT / "data" / "Combined Data (balanced).csv"
TEST_FOLDS = 5
RANDOM_STATE = 42


def load_test_split():
    df = tm.load_data(CSV)
    texts = df["statement"].tolist()
    groups = tm.near_duplicate_groups(texts, tm.NEAR_DUP_JACCARD)
    X = df["statement"].map(preprocess).to_numpy()
    y = df["status"].to_numpy()
    outer = StratifiedGroupKFold(n_splits=TEST_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    _, test_idx = next(outer.split(X, y, groups))
    return df.iloc[test_idx].reset_index(drop=True)


def evaluate(name, predict_fn, df, buckets):
    print(f"\n=== {name} ===")
    print(f"{'length':<14}{'n':>6}{'acc':>8}{'macroF1':>9}{'suicidal':>10}{'lowTier':>9}")
    for lo, hi, label in buckets:
        m = df["n_words"].ge(lo) & df["n_words"].lt(hi)
        if m.sum() == 0:
            print(f"{label:<14}{0:>6}   (empty)")
            continue
        preds = [predict_fn(t) for t in df.loc[m, "statement"]]
        cats = [p["category"] for p in preds]
        y = df.loc[m, "status"]
        print(
            f"{label:<14}{int(m.sum()):>6}"
            f"{accuracy_score(y, cats):>8.3f}"
            f"{f1_score(y, cats, average='macro'):>9.3f}"
            f"{f1_score(np.array(y) == 'Suicidal', np.array(cats) == 'Suicidal'):>10.3f}"
            f"{np.mean([p['confidence_tier'] == 'low' for p in preds]):>9.2f}"
        )
    # Overall row
    preds = [predict_fn(t) for t in df["statement"]]
    cats = [p["category"] for p in preds]
    print(
        f"{'ALL':<14}{len(df):>6}"
        f"{accuracy_score(df['status'], cats):>8.3f}"
        f"{f1_score(df['status'], cats, average='macro'):>9.3f}"
    )


def main():
    df = load_test_split()
    df["n_words"] = df["statement"].str.split().str.len()
    buckets = [(0, 25, "<25 words"), (25, 60, "25-60"), (60, 120, "60-120"), (120, 260, "120-260"), (260, 10**9, ">260")]
    print("held-out fold:", df.shape)
    print(df["n_words"].describe().round(1).to_string())
    token_lens = [len(t.split()) for t in df["statement"]]
    print("longest:", max(token_lens), "words; >128 words (transformer max_seq/2):", sum(x > 128 for x in token_lens))
    print(
        "\nNote: v8 truncates at 256 subword tokens; rows above 256 *tokens* (subwords) get truncated. Token-word counts above are a proxy only."
    )

    sklearn_model = ClinicalClassifier()
    sklearn_model.load()
    onnx = classifier_onnx.ClinicalClassifierONNX()
    onnx.load()

    evaluate("v7 sklearn (TF-IDF LinearSVC)", sklearn_model.predict, df, buckets)
    evaluate("v8 transformer (ONNX distilroberta)", onnx.predict, df, buckets)


if __name__ == "__main__":
    main()
