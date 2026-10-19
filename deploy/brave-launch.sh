#!/bin/sh
# Clear Brave's profile lock before starting. The profile is a persistent
# volume, so a lock left by a previous container (different hostname)
# would otherwise stop Brave from starting.
PROFILE=/home/neko/.config/brave
rm -f "$PROFILE/SingletonLock" "$PROFILE/SingletonCookie" "$PROFILE/SingletonSocket"
exec /usr/bin/brave-browser "$@"
