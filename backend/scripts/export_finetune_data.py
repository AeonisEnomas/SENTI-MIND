#!/usr/bin/env python3
"""Export the balanced mixed corpus as fine-tuning splits with the SAME protocol
as scripts/train_model.py — fold 0 of the group-aware split, never touched by training.

Produces (in data/finetune/):
  train.csv / val.csv / test.csv   columns: text, label (int), status (str)
  labels.json                      {str label: int id} — MUST match inference code order
  adversarial.csv                  the 39 hand-written eval sentences (label set identical)
  sklearn_baseline.json            reference metrics copied from data/model_metadata.json

A fair sklearn-vs-transformer comparison REQUIRES identical splits. Do not regenerate
the splits with a different seed or the numbers are incomparable. This script reuses
train_model.py's group clustering verbatim.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(SCRIPTS_DIR))

import train_model as tm  # noqa: E402
from eval_cases import ADVERSARIAL_CASES  # noqa: E402

SRC = PROJECT_ROOT / "data" / "Combined Data (balanced).csv"
OUT = PROJECT_ROOT / "data" / "finetune"

# Fixed class order; used at training and MUST be reused at inference.
LABELS = sorted(["Anxiety", "Depression", "Normal", "Stress", "Suicidal"])
LABEL2ID = {label: i for i, label in enumerate(LABELS)}


def main() -> None:
    df = tm.load_data(SRC)
    texts = df["statement"].tolist()
    y = df["status"].map(LABEL2ID).to_numpy()

    print("recomputing group split (can take ~30s) ...")
    groups = tm.near_duplicate_groups(texts, tm.NEAR_DUP_JACCARD)
    fold0 = next(StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42).split(texts, y, groups))
    tr_idx, te_idx = fold0

    # 90/10 split of the training portion, group-aware, for validation.
    tr_groups = groups[tr_idx]
    texts_tr = np.array(texts, dtype=object)[tr_idx]
    y_tr = y[tr_idx]
    sub = next(
        StratifiedGroupKFold(n_splits=10, shuffle=True, random_state=42).split(texts_tr, y_tr, tr_groups)
    )
    final_tr_idx, va_idx = sub

    OUT.mkdir(parents=True, exist_ok=True)

    def write_split(name: str, indices: np.ndarray) -> None:
        sub_df = df.iloc[indices].copy()
        sub_df["label"] = sub_df["status"].map(LABEL2ID)
        sub_df = sub_df.rename(columns={"statement": "text"})[["text", "label", "status"]]
        path = OUT / f"{name}.csv"
        sub_df.to_csv(path, index=False)
        print(f"{name}: {len(sub_df)} rows -> {path}")
        print(sub_df["status"].value_counts().sort_index().to_string())

    write_split("train", tr_idx[final_tr_idx])
    write_split("val", tr_idx[va_idx])
    write_split("test", te_idx)

    adversarial = pd.DataFrame(ADVERSARIAL_CASES, columns=["text", "status"])
    adversarial["label"] = adversarial["status"].map(LABEL2ID)
    adversarial = adversarial[["text", "label", "status"]]
    adversarial.to_csv(OUT / "adversarial.csv", index=False)
    print(f"adversarial: {len(adversarial)} rows -> {OUT / 'adversarial.csv'}")

    (OUT / "labels.json").write_text(json.dumps(LABEL2ID, indent=2) + "\n")

    metadata = json.loads((PROJECT_ROOT / "data" / "model_metadata.json").read_text())
    baseline = {
        "macro_f1": metadata["macro_f1"],
        "accuracy": metadata["accuracy"],
        "cv_f1_macro_mean": metadata["cv_f1_macro_mean"],
        "cv_f1_macro_std": metadata["cv_f1_macro_std"],
        "per_class": {k: round(v["f1"], 4) for k, v in metadata["per_class_metrics"].items()},
        "adversarial_spot_check": metadata["adversarial_spot_check"],
        "samples_train": metadata["samples_train"],
    }
    (OUT / "sklearn_baseline.json").write_text(json.dumps(baseline, indent=2) + "\n")
    print("sklearn baseline (fold 0):", json.dumps(baseline))


if __name__ == "__main__":
    main()
