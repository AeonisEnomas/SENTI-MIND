#!/usr/bin/env python3
"""Fetch or verify the v8 ONNX classifier artifacts in app/models/classifier_onnx/.

The v8 model is a distilroberta fine-tune produced in Colab (see docs/FINE_TUNING.md).
It is distributed two ways, in order of preference:

  1. CLASSIFIER_MODEL_REPO env var set to a Hugging Face repo id containing
     model_int8.onnx / config.json / tokenizer.json
     (e.g. CLASSIFIER_MODEL_REPO=AeonisEnomas/sentimind-classifier-onnx).
  2. The files are already in app/models/classifier_onnx/ (e.g. baked into the
     Docker image, or copied from a Colab download) — this script just verifies them.

All files are pinned to a revision and verified by SHA-256 (embedded below once known);
a mismatch fails the build loudly rather than booting a degraded classifier.

    python scripts/download_classifier_model.py          # fetch/verify
    python scripts/download_classifier_model.py --check  # verify only
"""

import hashlib
import os
import sys
import urllib.request
from pathlib import Path

REVISION = "main"  # pinned to a commit SHA once the artifacts are published
MODEL_DIR = Path(__file__).resolve().parent.parent / "app" / "models" / "classifier_onnx"

# Filename -> expected sha256, pinned at REVISION. Filled in after the v8 export
# lands locally (see docs/FINE_TUNING.md); empty values disable fetching but not verification.
FILES: dict[str, str] = {
    "model_int8.onnx": "e0db31ae868a4bf9792f56dd2ed5c055be665ab69a19eabcfd41a63da0aee452",
    "tokenizer.json": "847bbeab6174d66a88898f729d52fa8d355fafe1bea101cf960dd404581df70e",
    # distilroberta-base tokenizer/config copied from ./finetuned at export time;
    # config.json is optional — the backend falls back to the alphabetical class order
    # (Anxiety, Depression, Normal, Stress, Suicidal), which is what v8 was trained with.
    "config.json": "bb5b155d79499ddaf544309ba9a1e6cd09eddfd5b3d8bb2fd2ce8addccf79756",
}


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _file_ok(path: Path, sha: str) -> bool:
    return path.is_file() and (not sha or _sha256(path) == sha)


def main() -> int:
    check_only = "--check" in sys.argv
    repo = os.getenv("CLASSIFIER_MODEL_REPO", "").strip()
    missing = [n for n, s in FILES.items() if not _file_ok(MODEL_DIR / n, s)]

    if check_only:
        if missing:
            print(f"v8 ONNX classifier incomplete/absent in {MODEL_DIR}: {', '.join(missing)}")
            return 1
        print("v8 ONNX classifier present and verified.")
        return 0

    # Nothing to fetch if everything is present (e.g. baked into the image).
    if not missing:
        print(f"v8 ONNX classifier already present in {MODEL_DIR}")
        return 0

    if not repo:
        print(
            f"Missing {', '.join(missing)} in {MODEL_DIR} and CLASSIFIER_MODEL_REPO is not set.\n"
            "Set CLASSIFIER_MODEL_REPO to an HF repo id with the exported artifacts, or place them in\n"
            f"{MODEL_DIR} (see docs/FINE_TUNING.md). sklearn v7 remains the fallback.",
            file=sys.stderr,
        )
        return 1

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, sha in FILES.items():
        dest = MODEL_DIR / name
        if _file_ok(dest, sha):
            print(f"ok (cached): {name}")
            continue
        url = f"https://huggingface.co/{repo}/resolve/{REVISION}/{name}"
        print(f"downloading {url}")
        tmp = dest.with_suffix(dest.suffix + ".part")
        try:
            urllib.request.urlretrieve(url, tmp)  # noqa: S310 - pinned URL + sha256
        except Exception as exc:
            tmp.unlink(missing_ok=True)
            print(f"FAILED to download {name}: {exc}", file=sys.stderr)
            return 1
        if sha and not _file_ok(tmp, sha):
            tmp.unlink(missing_ok=True)
            print(f"FAILED sha256 verification for {name}", file=sys.stderr)
            return 1
        tmp.replace(dest)
        if sha:
            (MODEL_DIR / f"{name}.sha256").write_text(f"{sha}  {name}\n")
        print(f"ok: {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
