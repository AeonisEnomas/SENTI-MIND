#!/usr/bin/env python3
"""Merge real-world research datasets into the classifier's training corpus.

WHY: the built-in pool is synthetic, which caps the classifier no matter how
good the model is. Two free, real, research-grade Reddit corpora fit our 5-class
label set:

  SWMH  — "Reddit SuicideWatch and Mental Health Collection" (Ji et al., 2022).
          ~54k posts. Reddit-of-origin labels: depression, anxiety, suicidewatch,
          offmychest (treated as Normal), bipolar (dropped).
          CC-BY-NC and RESEARCH-USE ONLY. Access is gated: https://huggingface.co/datasets/AIMH/SWMH
          (you must accept the terms; an institutional email is usually required).
          Download train.csv / val.csv / test.csv into a directory and pass it with --swmh.

  Dreaddit — Turcan & McKeown (LOUHI 2019). ~3.5k Reddit posts, binary stress labels.
          Research use; cite the paper. Official distribution is the Columbia zip:
          http://www.cs.columbia.edu/~eturcan/data/dreaddit.zip
          Unzipped it contains dreaddit-train.csv / dreaddit-test.csv (labels 1 = stress, 0 = not).
          Pass either the directory (both files) or a single CSV with --dreaddit.

Neither corpus is clinician-labeled: subreddit-of-origin is WEAK SUPERVISION.
They are not clinical ground truth. Do not present metrics as clinical validation.
Both are non-commercial; keep this project non-commercial while training on them.

Usage:
  python scripts/ingest_external.py --swmh external/swmh --dreaddit external/dreaddit \\
      --out "data/Combined Data (mixed).csv" --merge

Then retrain (metadata, provenance and caveats are recorded automatically):
  python scripts/train_model.py "data/Combined Data (mixed).csv"

Without --merge, only the external rows are written (useful for inspection).
The synthetic pools are NEVER modified.
"""

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SYNTHETIC_CSV = PROJECT_ROOT / "data" / "Combined Data.csv"

LABEL_MAP_SWMH = {
    "depression": "Depression",
    "anxiety": "Anxiety",
    "suicidewatch": "Suicidal",
    "offmychest": "Normal",
    # bipolar is deliberately unmapped: unlearnable from this signal, dropped with a count
}
LABEL_MAP_DREADDIT = {
    "stress": "Stress",
    "nostress": "Normal",
    "no-stress": "Normal",
    "no_stress": "Normal",
    "non-stress": "Normal",
    "not stressed": "Normal",
    "not_stressed": "Normal",
    # Numeric labels as shipped by the official Columbia CSVs (1 = stressed, 0 = not).
    "1": "Stress",
    "0": "Normal",
}
TEXT_COLUMNS = ["text", "selftext", "content", "body", "statement", "post"]
LABEL_COLUMNS = ["label", "subreddit", "class", "target", "status"]

_TOKEN_RE = re.compile(r"[a-z0-9']+")


def _normalize_text(text: str) -> str:
    return " ".join(_TOKEN_RE.findall(str(text).lower()))


def _detect_column(df: pd.DataFrame, candidates: list[str], what: str, fname: str):
    lowered = {c.lower().strip(): c for c in df.columns}
    for cand in candidates:
        if cand in lowered:
            return lowered[cand]
    sys.exit(f"[{fname}] could not detect a {what} column. Columns present: {list(df.columns)}")


def _norm_label(value: str) -> str:
    v = str(value).strip().lower()
    v = re.sub(r"^self\.", "", v)      # Reddit subreddit prefix: "self.suicidewatch" -> "suicidewatch"
    v = v.rsplit("/", 1)[-1]           # r/depression -> depression
    v = v.removeprefix("r/").removeprefix("u/")
    v = re.sub(r"[^a-z0-9]+", "", v)   # "no-stress" -> "nostress"; keep digits for 0/1 binary labels
    return v


def load_swmh(path: Path) -> pd.DataFrame:
    files = [path] if path.is_file() else sorted(path.glob("*.csv"))
    if not files:
        sys.exit(f"No CSV files found at {path}")
    frames = []
    for f in files:
        df = pd.read_csv(f, low_memory=False)
        text_col = _detect_column(df, TEXT_COLUMNS, "text", f.name)
        label_col = _detect_column(df, LABEL_COLUMNS, "label", f.name)
        out = pd.DataFrame({"statement": df[text_col].astype(str), "status": df[label_col].map(_norm_label)})
        frames.append(out)
        print(f"  {f.name}: {len(out)} rows")
    df = pd.concat(frames, ignore_index=True)
    df["status"] = df["status"].map(LABEL_MAP_SWMH)
    dropped = df["status"].isna().sum()
    if dropped:
        print(f"  dropped {dropped} rows with labels outside the 5-class mapping (e.g. bipolar)")
    return df.dropna(subset=["status"])


def load_dreaddit(path: Path) -> pd.DataFrame:
    files = [path] if path.is_file() else sorted(path.glob("*.csv"))
    if not files:
        sys.exit(f"No CSV files found at {path}")
    frames = []
    for f in files:
        df = pd.read_csv(f, low_memory=False)
        text_col = _detect_column(df, TEXT_COLUMNS, "text", f.name)
        label_col = _detect_column(df, LABEL_COLUMNS, "label", f.name)
        out = pd.DataFrame({"statement": df[text_col].astype(str), "status": df[label_col].map(_norm_label)})
        frames.append(out)
        print(f"  {f.name}: {len(out)} rows")
    df = pd.concat(frames, ignore_index=True)
    before = sorted(df["status"].dropna().unique())
    df["status"] = df["status"].map(LABEL_MAP_DREADDIT)
    unknown = df["status"].isna().sum()
    print(f"  label values seen: {before}")
    if unknown:
        print(f"  dropped {unknown} rows whose labels are not mapped to Stress/Normal")
    return df.dropna(subset=["status"])


def clean(df: pd.DataFrame, min_chars: int = 25) -> pd.DataFrame:
    df = df.dropna(subset=["statement", "status"])
    df["statement"] = df["statement"].astype(str).str.strip()
    df = df[df["statement"].str.len() >= min_chars]
    df = df[df["statement"].str.contains(r"[A-Za-z]")]           # drop link-only posts
    before = len(df)
    df = df[~df["statement"].map(_normalize_text).duplicated()].reset_index(drop=True)
    print(f"  cleaned: {before} -> {len(df)} rows (dropped {before - len(df)} duplicates/short/non-text)")
    return df


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--swmh", type=Path, default=None, help="Directory with SWMH CSVs (or a single CSV)")
    ap.add_argument("--dreaddit", type=Path, default=None, help="Dreaddit CSV or directory with dreaddit-train.csv / dreaddit-test.csv")
    ap.add_argument("--out", type=Path, required=True, help="Output CSV, e.g. data/Combined Data (mixed).csv")
    ap.add_argument("--merge", action="store_true", help="Concatenate with the synthetic pool in data/Combined Data.csv")
    ap.add_argument("--seed", type=int, default=314)
    args = ap.parse_args()

    if not args.swmh and not args.dreaddit:
        sys.exit("nothing to do: pass --swmh and/or --dreaddit")

    frames, sources, attribution = [], [], []
    print("Loading SWMH ..." if args.swmh else "", end="" if args.swmh else "")
    if args.swmh:
        sw = load_swmh(args.swmh)
        frames.append(sw)
        sources.append("SWMH (Ji et al., 2022; Reddit; CC-BY-NC)")
        attribution.append(
            "Ji, S., Li, X., Huang, Z. & Cambria, E. (2022). Suicidal ideation and mental "
            "disorder detection with attentive relation networks. Neural Computing and Applications, 32."
        )
    if args.dreaddit:
        print("Loading Dreaddit ...")
        dr = load_dreaddit(args.dreaddit)
        frames.append(dr)
        sources.append("Dreaddit (Turcan & McKeown, 2019; Reddit; research use; official Columbia distribution)")
        attribution.append(
            "Turcan, E. & McKeown, K. (2019). Dreaddit: A Reddit dataset for stress analysis "
            "in social media. Proc. 5th Workshop on Noisy User-generated Text (W-NUT), 97–107."
        )

    ext = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=["statement", "status"])
    ext = clean(ext)
    print(f"External rows kept: {len(ext)}")
    print(ext["status"].value_counts().to_string())

    out = ext
    if args.merge:
        if not SYNTHETIC_CSV.is_file():
            sys.exit(f"{SYNTHETIC_CSV} not found; run generate_training_data.py first or drop --merge")
        pool = pd.read_csv(SYNTHETIC_CSV)
        out = pd.concat([pool, ext], ignore_index=True).sample(frac=1.0, random_state=args.seed).reset_index(drop=True)
        print(f"Merged: {len(pool)} synthetic + {len(ext)} external = {len(out)} rows")
        merged_note = True
    else:
        print("Writing external rows only (no merge).")
        merged_note = False

    out = out[["statement", "status"]]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.out, index=False, quoting=csv.QUOTE_MINIMAL)

    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "merged_with_synthetic_pool": merged_note,
        "sources": sources,
        "attribution": attribution,
        "license_note": (
            "SWMH is CC-BY-NC and research-use only. Dreaddit is research-use. "
            "Neither is clinical ground truth and both are non-commercial; do NOT use the "
            "trained model commercially, and do NOT present metrics as clinical validation."
        ),
        "external_rows": int(len(ext)),
        "class_counts": {k: int(v) for k, v in ext["status"].value_counts().items()},
    }
    args.out.with_suffix(args.out.suffix + ".manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {args.out} and its .manifest.json")
    print("Next: python scripts/train_model.py \"" + str(args.out) + "\"")
    return 0


if __name__ == "__main__":
    sys.exit(main())
