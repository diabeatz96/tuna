#!/bin/sh
# Clear Brave's profile lock before starting. The profile is a persistent
# volume, so a lock left by a previous container (different hostname)
# would otherwise stop Brave from starting.
PROFILE=/home/neko/.config/brave
rm -f "$PROFILE/SingletonLock" "$PROFILE/SingletonCookie" "$PROFILE/SingletonSocket"
# The DevTools port, for the server's media plugin (room-wide play, pause and
# seek). Bound to 127.0.0.1: reachable inside the container only, never published.
exec /usr/bin/brave-browser --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 "$@"
