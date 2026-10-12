"""
keep_alive.py — keep the free-tier backend and database awake.

Pings the backend's /keepalive endpoint once and exits. The request wakes the
Render service (which spins down after ~15 minutes idle) and the endpoint makes
a tiny Supabase query, so the free-tier project isn't paused for inactivity.
Exits 1 if the backend is unreachable or reports a database failure (HTTP 503).

Scheduling: .github/workflows/keep-alive.yml runs the same ping every 10 minutes
on GitHub Actions (free for public repos). Render cron jobs are a paid feature.
External pingers such as cron-job.org or UptimeRobot pointed at
https://<your-service>.onrender.com/keepalive work as a backup.

Usage: RENDER_BACKEND_URL=https://<your-service>.onrender.com python backend/scripts/keep_alive.py
"""

import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

BACKEND_URL = os.getenv("RENDER_BACKEND_URL", "https://senti-mind-majc.onrender.com").rstrip("/")
WAKE_PATH = "/keepalive"
# A cold start on Render's free tier can take close to a minute.
TIMEOUT_SECONDS = 90


def ping() -> bool:
    url = BACKEND_URL + WAKE_PATH
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as resp:
            body = resp.read().decode()
            print(f"[{ts}] KEEPALIVE OK  {url}  ->  {body.strip()}")
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
