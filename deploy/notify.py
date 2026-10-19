"""Tuna's Discord notifier: posts to a Discord webhook when the room goes live.

Polls the server's session list with the API token (NEKO_SESSION_API_TOKEN on the
tuna service) and posts once when the first person connects to an empty room. The
room counts as empty again after nobody has been connected for EMPTY_MINUTES, so a
quick reconnect does not post twice. Standard library only: it runs as-is on the
python image, see docker-compose.yml.

Environment:
  DISCORD_WEBHOOK_URL  the channel's webhook; without it the notifier only idles
  TUNA_API_TOKEN       the same token the tuna service gets as NEKO_SESSION_API_TOKEN
  TUNA_URL             the room's public address, linked in the message
  TUNA_API             the server inside the compose network (default http://tuna:8080)
  POLL_SECONDS         how often to look (default 20)
  EMPTY_MINUTES        how long empty before the next join posts again (default 10)
"""

import json
import os
import sys
import time
import urllib.request

WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
TOKEN = os.environ.get("TUNA_API_TOKEN", "").strip()
URL = os.environ.get("TUNA_URL", "").strip()
API = os.environ.get("TUNA_API", "http://tuna:8080").rstrip("/")
POLL = int(os.environ.get("POLL_SECONDS", "20"))
EMPTY = int(os.environ.get("EMPTY_MINUTES", "10")) * 60
# Discord's edge refuses Python's default user agent
UA = "TunaNotify/1.0"


def log(*args):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), *args, flush=True)


def connected_names():
    req = urllib.request.Request(
        API + "/api/sessions", headers={"Authorization": "Bearer " + TOKEN, "User-Agent": UA}
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        sessions = json.load(res)
    return sorted(s["profile"]["name"] for s in sessions if s["state"]["is_connected"])


def message(names):
    who = ", ".join(names[:5]) + (f" and {len(names) - 5} more" if len(names) > 5 else "")
    text = f"\U0001f41f **Tuna is live**: {who} {'is' if len(names) == 1 else 'are'} watching."
    return text + (f"\n{URL}" if URL else "")


def post(text):
    body = json.dumps({"content": text, "allowed_mentions": {"parse": []}}).encode()
    req = urllib.request.Request(
        WEBHOOK, data=body, headers={"Content-Type": "application/json", "User-Agent": UA}
    )
    urllib.request.urlopen(req, timeout=10).close()


def main():
    if not WEBHOOK or not TOKEN:
        log("DISCORD_WEBHOOK_URL or TUNA_API_TOKEN not set, nothing to do")
        while True:
            time.sleep(3600)

    live = False
    empty_since = time.monotonic()
    log("watching", API)
    while True:
        try:
            names = connected_names()
            if names:
                empty_since = None
                if not live:
                    post(message(names))
                    log("posted: live with", len(names))
                    live = True
            else:
                if empty_since is None:
                    empty_since = time.monotonic()
                if live and time.monotonic() - empty_since >= EMPTY:
                    live = False
                    log("room empty, next join posts again")
        except Exception as err:  # the server restarting, Discord down: try again next round
            log("error:", err)
        time.sleep(POLL)


if __name__ == "__main__":
    sys.exit(main())
