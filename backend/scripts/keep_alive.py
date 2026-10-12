"""
keep_alive.py — Render free-tier cold-start prevention.

Pings the /wake endpoint so the service does not hit Render's 15-minute
inactivity threshold and spin down. The script exits after ONE ping; an
external scheduler is responsible for running it every ~10 minutes.

Scheduling options:
  - Render Cron Job (NOTE: cron jobs are a paid Render feature, they are not
    available on the free tier):
      Command : python backend/scripts/keep_alive.py
      Schedule: */10 * * * *
      Env var : RENDER_BACKEND_URL=https://senti-mind-majc.onrender.com
  - Free alternatives: a GitHub Actions scheduled workflow (`on: schedule`
    with `cron: "*/10 * * * *"`, running this script or a plain `curl` of
    /wake), or an external pinger such as cron-job.org or UptimeRobot pointed
    at https://<your-service>.onrender.com/wake.
"""

import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

BACKEND_URL = os.getenv("RENDER_BACKEND_URL", "https://senti-mind-majc.onrender.com").rstrip("/")
WAKE_PATH = "/wake"
TIMEOUT_SECONDS = 20


def ping() -> bool:
    url = BACKEND_URL + WAKE_PATH
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as resp:
            body = resp.read().decode()
            print(f"[{ts}] WAKE OK  {url}  ->  {body.strip()}")
            return True
    except urllib.error.HTTPError as exc:
        print(f"[{ts}] HTTP {exc.code} from {url}: {exc.reason}", file=sys.stderr)
    except urllib.error.URLError as exc:
        print(f"[{ts}] UNREACHABLE {url}: {exc.reason}", file=sys.stderr)
    except Exception as exc:  # noqa: BLE001
        print(f"[{ts}] ERROR pinging {url}: {exc}", file=sys.stderr)
    return False


if __name__ == "__main__":
    success = ping()
    sys.exit(0 if success else 1)
