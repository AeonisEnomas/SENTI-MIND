# Classifier: data, training and evaluation

SentiMind assigns every journal entry one of five categories: **Normal, Stress, Anxiety,
Depression, Suicidal**. The category feeds the risk engine and the UI. It is a signal,
not a diagnosis, and the crisis-keyword engine (not this model) is the safety gate.

## Models shipped

| Version | Model | Where | Role |
|---|---|---|---|
| v9 | `distilroberta-base` fine-tune, max_length 512, temperature-scaled softmax (T = 1.34), INT8 ONNX | `backend/app/models/classifier_onnx/` | Default |
| v7 | Calibrated LinearSVC over TF-IDF (1–2 grams), with negation-scoped preprocessing | `backend/data/*.joblib` | Fallback |

`CLASSIFIER_BACKEND=auto` (the default) loads v9 when its files are present and falls back
to v7 otherwise. Both sets of artifacts are SHA-256-verified against
`backend/data/model_metadata.json` at load time; a mismatch refuses to load.

## Data

| Source | Rows used | Labels | Licence |
|---|---|---|---|
| Synthetic pool (`backend/scripts/training_data/`) | 2,779 | all five classes | this repository |
| [SWMH](https://huggingface.co/datasets/AIMH/SWMH) (Ji et al., 2022) | depression, anxiety, suicidewatch → Suicidal, offmychest → Normal | subreddit membership | CC-BY-NC, research use only |
| [Dreaddit](http://www.cs.columbia.edu/~eturcan/data/dreaddit.zip) (Turcan & McKeown, 2019) | stress → Stress | annotated stress | research use only |

Rows are de-duplicated and downsampled to at most 6,000 per class: 25,471 unique rows
(21,177 train / 5,294 test). The datasets are not redistributed; `*.csv` is git-ignored and
`scripts/ingest_external.py` rebuilds the corpus from the original downloads, writing a
provenance manifest that `train_model.py` copies into the metadata.

Labels come from community membership (weak supervision), not clinical assessment, and
Reddit posts are not journal entries. Read every number below with that in mind.

## Evaluation protocol

- **Group-aware split.** Near-duplicate texts (token Jaccard ≥ 0.6, found with a
  rarest-token inverted index and union-find) form groups. The test set is fold 0 of
  `StratifiedGroupKFold(5, shuffle=True, random_state=42)`, so no group spans train and test.
- **Same rows for every model.** v7, v8 and v9 are scored on that identical held-out fold.
  `scripts/export_finetune_data.py` exports it for the transformer runs.
- **Adversarial spot-check.** 39 hand-written hard cases in `scripts/eval_cases.py`
  (negation, past tense, idioms, academic mentions). They are excluded from training and
  reported separately; they are a sanity check, not a benchmark.

## Results

Held-out fold, 5,294 rows.

| Version | Macro F1 | Accuracy | Suicidal recall | Stress recall | Adversarial |
|---|---|---|---|---|---|
| v7 (TF-IDF + LinearSVC) | 0.645 | 0.664 | 0.733 | 0.443 | 29/39 |
| v8 (distilroberta, 256 tokens) | 0.722 | 0.714 | 0.75 | 0.85 | 30/39 |
| **v9 (distilroberta, 512 tokens)** | **0.742** | **0.734** | **0.77** | **0.88** | **36/39** |

v9 per-class F1: Anxiety 0.84 · Stress 0.81 · Suicidal 0.75 · Normal 0.71 · Depression 0.60.

Temperature scaling was fit on a 2,118-row validation carve-out of the training split
(NLL 0.7324 → 0.6983). It improves the spread of probabilities, but the confidence tiers
(`high` ≥ 0.70, `medium` ≥ 0.35) have not been validated against that fold, so treat them
as directional.

### What was thrown away, and why

An earlier synthetic-only model (v6) reported 0.814 macro F1 and 35/39 adversarial. Those
numbers were measured on text from the same generator it was trained on; on real Reddit
rows the same model scored **0.401**. v7 replaced it with real data and is lower and honest.
Do not quote v6-era figures.

## Known limitations

- **Negation.** v9 over-reads distress: "I don't want to die, I just need a break" is
  predicted Suicidal and "no longer depressed thanks to support" Depression. Both are
  tracked as `xfail` in `backend/tests/test_classifier.py`. Over-alerting is the preferred
  failure mode, and the deterministic keyword engine handles negation itself.
- **Domain shift.** Reddit is a proxy for journal writing. A hand-labelled journal-style
  benchmark is the most useful next evaluation.
- **Depression vs. Normal/Suicidal** remains the weakest boundary (F1 0.60).
- **Licence.** The fine-tuned weights inherit the non-commercial terms of their training data.

## Reproducing

```bash
cd backend
pip install -r requirements-train.txt

python scripts/generate_training_data.py                     # synthetic pool
python scripts/ingest_external.py --swmh external/swmh --dreaddit external/dreaddit \
    --out "data/Combined Data (mixed).csv" --merge          # real data + merge
# downsample to <= 6,000 per class (seed 314) -> data/Combined Data (balanced).csv
python scripts/train_model.py "data/Combined Data (balanced).csv"   # v7 + metadata
pytest tests/test_classifier.py
```

The v9 fine-tune runs on a free Colab/Kaggle GPU:
[`classifier_max_performance.ipynb`](classifier_max_performance.ipynb) is the recipe and
[`FINE_TUNING.md`](FINE_TUNING.md) is the full log of the v7-vs-transformer comparison.

Changing `app/core/preprocessing.py` or `CRISIS_KEYWORDS` in `app/core/constants.py`
changes the v7 feature space and requires a retrain. `scikit-learn` must stay at the
version recorded in `model_metadata.json`.
