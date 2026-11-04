#!/usr/bin/env python3
"""Fit a temperature scalar for the ONNX transformer classifier on the validation fold.

Temperature Scaling (Guo et al., 2017): logits are divided by a learned T, which sharpens
soft confidence into honest coverage. Identity (T=1) preserves v8/v9's original softmax;
there is no guarantee that T<1 improves coverage or calibration alone — IT IS NOT AN
ACCURACY FIX. It only makes `confidence_tier` meaningful again when applied to a model
that is systematically over-confident.

Caveat: the val fold was also used for best-model selection (load_best_model_at_end),
so the fitted T is mildly biased. For a portfolio artifact this is acceptable; for any
commercial use, refit on a never-touched holdout.

Run:  python scripts/fit_temperature.py   # writes app/models/classifier_onnx/temperature.json
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import logsumexp

import onnxruntime as ort
from tokenizers import Tokenizer

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ONNX_DIR = PROJECT_ROOT / "app" / "models" / "classifier_onnx"
VAL = PROJECT_ROOT / "data" / "finetune" / "val.csv"

MAX_TOKENS = 512


def main() -> None:
    if not VAL.is_file():
        sys.exit(f"{VAL} not found")
    sess = ort.InferenceSession(str(ONNX_DIR / "model_int8.onnx"), providers=["CPUExecutionProvider"])
    tok = Tokenizer.from_file(str(ONNX_DIR / "tokenizer.json"))
    tok.enable_truncation(max_length=MAX_TOKENS)

    df = pd.read_csv(VAL)
    texts = df["text"].tolist()
    y = df["label"].to_numpy(dtype=np.int64)

    encs = [tok.encode(t) for t in texts]
    order = sorted(range(len(encs)), key=lambda i: len(encs[i].ids))
    logits = np.empty((len(encs), 5), dtype=np.float64)
    i = 0
    while i < len(order):
        batch = [encs[j] for j in order[i : i + 32]]
        max_len = max(len(e.ids) for e in batch)
        ids = np.full((len(batch), max_len), 1, dtype=np.int64)
        mask = np.zeros_like(ids)
        for j, e in enumerate(batch):
            ids[j, : len(e.ids)] = e.ids
            mask[j, : len(e.ids)] = 1
        out = sess.run(None, {"input_ids": ids, "attention_mask": mask})[0]
        logits[order[i : i + 32]] = out
        print(f"  ...{len(encs) - len(order[i:])}/{len(encs)}", flush=True)
        i += 32

    def nll(t):
        scaled = logits / t
        return float(np.mean(-scaled[np.arange(len(y)), y] + logsumexp(scaled, axis=1)))

    result = minimize(nll, x0=np.array([1.0]), method="Nelder-Mead",
                      options={"xtol": 1e-3, "maxiter": 500})
    t = float(result.x[0])

    # Diagnostics: accuracy before/after is identical (argmax unchanged by scaling)
    acc_before = float((logits.argmax(1) == y).mean())
    print(f"rows={len(y)}  accuracy(unaffected by scaling)={acc_before:.4f}")
    print(f"T_identity(nll)={nll(1.0):.4f}  nll({t:.3f})={nll(t):.4f}")

    out = {
        "temperature": round(t, 4),
        "fitted_on": "val.csv (2,118 rows; mild selection bias — refit on untouched holdout for commercial use)",
        "nll_before": round(nll(1.0), 4),
        "nll_after": round(nll(t), 4),
    }
    (ONNX_DIR / "temperature.json").write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
