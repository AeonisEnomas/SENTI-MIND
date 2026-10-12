#!/usr/bin/env python3
"""Build data/Combined Data.csv from the hand-written sentence pools.

Every unique sentence in scripts/training_data/ is written exactly once.
Sentences are de-duplicated after normalisation (case and punctuation), and
anything that matches a held-out evaluation sentence (eval_cases.py or
tests/test_classifier.py) is dropped so it can never leak into training.
Class imbalance is handled in train_model.py with class_weight="balanced".

The data is synthetic. It is not clinical data and the resulting model is not
clinically validated.
"""

import csv
import random
import sys
from pathlib import Path

from eval_cases import held_out_sentences, normalize_sentence
from training_data.anxiety import ANXIETY
from training_data.bipolar import BIPOLAR
from training_data.depression import DEPRESSION
from training_data.normal import NORMAL
from training_data.personality_disorder import PERSONALITY_DISORDER
from training_data.stress import STRESS
from training_data.suicidal import SUICIDAL

SEED = 314
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "Combined Data.csv"

CATEGORIES = [
    (DEPRESSION, "Depression"),
    (ANXIETY, "Anxiety"),
    (SUICIDAL, "Suicidal"),
    (STRESS, "Stress"),
    (BIPOLAR, "Bipolar"),
    (PERSONALITY_DISORDER, "Personality disorder"),
    (NORMAL, "Normal"),
]


def main() -> int:
    print("=" * 70)
    print("SENTI-MIND Training Data Generator")
    print("=" * 70)

    held_out = {normalize_sentence(s) for s in held_out_sentences()}
    seen: dict[str, str] = {}  # normalised sentence -> label
    rows: list[tuple[str, str]] = []
    conflicts: list[str] = []

    for sentences, label in CATEGORIES:
        kept = dup = leaked = 0
        for sentence in sentences:
            sentence = sentence.strip()
            key = normalize_sentence(sentence)
            if not key:
                continue
            if key in held_out:
                leaked += 1
                continue
            if key in seen:
                dup += 1
                if seen[key] != label:
                    conflicts.append(f"{sentence!r}: {seen[key]} vs {label}")
                continue
            seen[key] = label
            rows.append((sentence, label))
            kept += 1
        print(
            f"  {label:25s}: {kept:4d} unique  "
            f"({len(sentences)} in pool, {dup} duplicates, {leaked} held-out removed)"
        )
        if leaked:
            print(f"    WARNING: {leaked} held-out eval sentence(s) found in the {label} pool; "
                  "remove them from scripts/training_data/.")

    if conflicts:
        print("\nERROR: sentences appear under more than one label:", file=sys.stderr)
        for c in conflicts:
            print("  " + c, file=sys.stderr)
        return 1

    random.Random(SEED).shuffle(rows)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["statement", "status"])
        writer.writerows(rows)

    print(f"\nTotal samples: {len(rows)} unique sentences across {len(CATEGORIES)} classes")
    print(f"Saved to: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
