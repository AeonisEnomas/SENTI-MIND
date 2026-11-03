#!/usr/bin/env python3
"""Download the ONNX emotion-classification model into app/models/emotion_onnx/.

The model is an INT8-quantised export of j-hartmann/emotion-english-distilroberta-base
(https://huggingface.co/onnx-community/emotion-english-distilroberta-base-ONNX),
created by the Hugging Face onnx-community project. It runs fully locally, so the
backend needs no HuggingFace token and the free tier never pays for inference.

Files are pinned to an exact revision and verified by SHA-256, so builds are
reproducible and a corrupted/incomplete download is never mistaken for the model.
The directory is git-ignored; run this at setup/build time:

    python scripts/download_emotion_model.py          # download if missing/stale
    python scripts/download_emotion_model.py --check  # verify only, exit 1 if absent

Exits 0 on success, 1 on failure. An absent model is NOT fatal to the app:
emotion detection reports itself unavailable instead of fabricating scores.
"""

import hashlib
import sys
import urllib.request
from pathlib import Path

REVISION = "f4407dc20b99ae081ab2e4f089595e70c1609f59"
BASE_URL = (
    "https://huggingface.co/onnx-community/emotion-english-distilroberta-base-ONNX"
    f"/resolve/{REVISION}/"
)
MODEL_DIR = Path(__file__).resolve().parent.parent / "app" / "models" / "emotion_onnx"

# filename -> expected sha256 (pinned at REVISION)
FILES: dict[str, str] = {
    "config.json": "c7d066c43f9412da026b1517d3bc3b22317715e7c62340a255c6cccc268cfdfd",
    "tokenizer.json": "4638eb0eae8b1e4dfd58155f9b2a798253ef06da7776a76d295e5c033f429f5a",
    "model_int8.onnx": "bb7779bc1a2c8019e52446219c00ac183432298578bb240ac241653559be16a4",
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _verify(path: Path, expected: str) -> bool:
    return path.is_file() and _sha256(path) == expected


def main() -> int:
    check_only = "--check" in sys.argv

    missing = [name for name, sha in FILES.items() if not _verify(MODEL_DIR / name, sha)]
    if check_only:
        if missing:
            print(f"emotion model incomplete/absent in {MODEL_DIR}: {', '.join(missing)}")
            return 1
        print("emotion model present and verified.")
        return 0

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, sha in FILES.items():
        dest = MODEL_DIR / name
        if _verify(dest, sha):
            print(f"ok (cached): {name}")
            continue
        print(f"downloading {name} ({REVISION[:7]}) ...")
        tmp = dest.with_suffix(dest.suffix + ".part")
        try:
            urllib.request.urlretrieve(BASE_URL + name, tmp)  # noqa: S310 - pinned URL + sha256
        except Exception as exc:
            tmp.unlink(missing_ok=True)
            print(f"FAILED to download {name}: {exc}", file=sys.stderr)
            return 1
        if not _verify(tmp, sha):
            tmp.unlink(missing_ok=True)
            print(f"FAILED sha256 verification for {name}", file=sys.stderr)
            return 1
        tmp.replace(dest)
        print(f"ok: {name}")

    print(f"emotion model ready in {MODEL_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
