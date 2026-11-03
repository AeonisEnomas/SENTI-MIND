# Fine-tuning vs. sklearn: a fair fight for the clinical classifier

Goal: decide whether a fine-tuned transformer beats the current calibrated
LinearSVC + TF-IDF classifier (v7) **on identical held-out rows**, then ship the winner
for free (Render/with HF's free inference or local ONNX). Never let a model win on
split-easy data: the comparison uses fold 0 of the same group-aware split v7 was
measured on, so both models face identical unseen rows.

**Reference implementation to beat (v7, in `backend/data/model_metadata.json`):**

| Metric | Value |
|---|---|
| Macro F1 | 0.645 |
| Accuracy | 0.664 |
| Suicidal recall | 0.733 |
| Normal recall | 0.698 |
| Stress recall | 0.443 |
| Adversarial spot-check | 29/39 |
| CV (grouped 5-fold) | 0.625 ± 0.008 |

(Copied verbatim into `data/finetune/sklearn_baseline.json` by the exporter.)

---

## Step 1 — Export the splits (done)

`backend/scripts/export_finetune_data.py` produced (in `backend/data/finetune/`, all
git-ignored via `*.csv`):

| File | Rows | Contents |
|---|---|---|
| `train.csv` | 19,059 | text, label (int), status |
| `val.csv` | 2,118 | 10% group-aware carve-out of train (selection) |
| `test.csv` | 5,294 | fold 0 of the v7 split — v7 was never trained on it; score only |
| `adversarial.csv` | 39 | hand-written hard negatives — qualitative only |
| `labels.json` | — | fixed class order used at inference time |
| `sklearn_baseline.json` | — | the numbers above, for the comparison table |

Upload all six (small, ~8 MB) to Colab or Kaggle with Step 2.

## Step 2 — Fine-tune in Colab (free)

Runtime: **GPU → T4**. If T4 is unavailable, use Kaggle (30 GPU-hours/week free).

```python
!pip -q install "transformers>=4.44" datasets accelerate evaluate scikit-learn
```

```python
import json
import pandas as pd
from datasets import Dataset

LABEL2ID = json.load(open("labels.json"))
train = Dataset.from_pandas(pd.read_csv("train.csv")[["text", "label"]])
val   = Dataset.from_pandas(pd.read_csv("val.csv")[["text", "label"]])
test  = pd.read_csv("test.csv")
print(train, val, test.shape)
```

```python
from transformers import AutoTokenizer
MODEL_ID = "distilroberta-base"   # 66M params: fast enough for free T4,
                                  # strong enough for 20k rows / 5 classes
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)

def tok(batch):
    return tokenizer(batch["text"], truncation=True, max_length=128, padding=False)

train = train.map(tok, batched=True).rename_column("label", "labels").remove_columns("text")
val   = val.map(tok, batched=True).rename_column("label", "labels").remove_columns("text")
train.set_format("torch"); val.set_format("torch")
print(train)
```

```python
from transformers import (AutoModelForSequenceClassification, DataCollatorWithPadding,
                          Trainer, TrainingArguments)
import numpy as np, evaluate

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_ID, num_labels=5, id2label={i: k for k, i in LABEL2ID.items()},
)
f1_macro = evaluate.load("f1")
acc = evaluate.load("accuracy")

def compute_metrics(p):
    preds, labels = np.argmax(p.predictions, axis=1), p.label_ids
    return {"accuracy": acc.compute(predictions=preds, references=labels)["accuracy"],
            "f1_macro": f1_macro.compute(predictions=preds, references=labels, average="macro")["f1"]}

args = TrainingArguments(
    output_dir="./finetuned",
    num_train_epochs=3,
    per_device_train_batch_size=32,     # T4 can take more; drop to 16 if OOM
    per_device_eval_batch_size=64,
    learning_rate=2e-5,
    weight_decay=0.01,
    warmup_ratio=0.06,
    eval_strategy="epoch",              # use evaluation_strategy= if transformers <4.41
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1_macro",
    fp16=True,
    seed=42,
    report_to="none",
)

trainer = Trainer(model=model, args=args, train_dataset=train, eval_dataset=val,
                  data_collator=DataCollatorWithPadding(tokenizer),
                  compute_metrics=compute_metrics)
trainer.train()
metrics = trainer.evaluate(val)
metrics
```

Expected wall time: **~10–20 minutes** for 19k rows × 3 epochs on a T4.

```python
test_ids = tokenizer(list(test["text"]), truncation=True, max_length=128,
                     padding=True, return_tensors="pt").to(model.device)
model.eval()
import torch
with torch.no_grad():
    logits = model(**test_ids).logits
pred = logits.argmax(-1).cpu().numpy()

from sklearn.metrics import classification_report, accuracy_score, f1_score
print("accuracy:", accuracy_score(test["label"], pred))
print("macro F1:", f1_score(test["label"], pred, average="macro"))
print(classification_report(test["label"], pred,
      target_names=sorted(LABEL2ID, key=LABEL2ID.get)))
# confusion matrix rows=true, cols=pred — same shape as the sklearn report
from sklearn.metrics import confusion_matrix
print("confusion (true x pred, order Anxiety, Depression, Normal, Stress, Suicidal):")
print(confusion_matrix(test["label"], pred,
      labels=[LABEL2ID[k] for k in sorted(LABEL2ID, key=LABEL2ID.get)]))
```

Also score adversarial:

```python
adv = pd.read_csv("adversarial.csv")
ids = tokenizer(list(adv["text"]), truncation=True, max_length=128,
                padding=True, return_tensors="pt").to(model.device)
with torch.no_grad():
    adv_pred = model(**ids).logits.argmax(-1).cpu().numpy()
print((adv_pred == adv["label"].to_numpy()).sum(), "/", len(adv_pred))
```

## Step 3 — Optional stronger variant (same session, if Step 2 goes well)

Repeat Step 2 with `MODEL_ID = "mental/mental-roberta-base"` (mental-domain pretraining
on Reddit text) — one line change. It may be a bit slower and heavier (~125M) but is
the more domain-relevant prior. Compare its test metrics against the distilroberta run
and the sklearn baseline. Don't chase more exotic architectures — at 19k rows the
gains stop after the base model choice.

## Step 4 — Decision criteria (agree before you look)

Ship the transformer **iff all** of these hold on the same `test.csv`:

1. Macro F1 ≥ **0.66** (sklearn: 0.645) **and**
2. Confusion balanced: no class collapses (per-class F1 ≥ ~0.5, Suicidal recall ≥ sklearn's 0.73 **and** Normal recall ≥ 0.70) **and**
3. Adversarial spot-check no worse than sklearn's **29/39** (the Reddit-prior hard negatives are where transformers usually win) **and**
4. ONNX-INT8 export ≤ **~90 MB** with CPU inference **< ~80 ms** per sentence (check on a laptop; Render free tier CPU is 0.1 vCPU — measure there or accept the sklearn path).

If it misses 1–2: keep sklearn, record the negative result, stop here. If it wins
narrowly (1 but not balanced): keep sklearn — its failure modes are more legible and it
costs 150 KB on disk vs ~90 MB + torch runtime. If it wins decisively: it becomes v8.

## Step 5 — If it wins: ONNX export for free hosting

```python
!pip -q install optimum[onnxruntime]
!optimum-cli export onnx --model finetuned --task text-classification onnx_model
```

```python
from onnxruntime.quantization import quantize_dynamic, QuantType
quantize_dynamic("onnx_model/model.onnx", "onnx_model/model_int8.onnx",
                  weight_type=QuantType.QInt8)
```

Then mirror `emotions.py` exactly: `backend/app/models/classifier_onnx.py` with lazy
load + `asyncio.to_thread` inference, preserving the same output dict contract
(`category`, `confidence`, `top_categories`, `is_ambiguous`, `confidence_tier`) via
softmax + ranking (sklearn gives calibrated probabilities; softmax on logits is not
identical calibration — expect slightly different tiers; note it in the PR).
SHA-256 the exported `model_int8.onnx` into metadata like the current artifacts.

## Honest expectations

- Plausible outcome: **+0.02–0.06 macro F1**, better short-text behaviour, better
  negation handling. Big wins are unlikely at 19k rows.
- Cost of shipping: ~90 MB artifact, ~150–300 ms/request on free CPU (vs ~5 ms sklearn),
  one more runtime dependency (`onnxruntime`).
- The transformer will NOT fix: weak labels, synthetic anchor bias, Reddit≠journal-domain,
  clinical-validation, license terms. Those require steps 2–3 of the improvement plan,
  not a new model.

## After the fight — record it either way

Append a short table to `data/model_metadata.json`? No — model_metadata is for the
shipped artifact. Instead add the result table to `docs/FINE_TUNING.md` §Results (create
it in the PR) or the PR description. Negative results are cheap and useful; don't
re-run this comparison without a new external test set.
