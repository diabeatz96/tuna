# Tuna image: the upstream neko Brave image (the desktop, Brave, Xorg, the
# runtime libraries) with this repo's server and client built on top. Only
# the two are compiled, so a build takes minutes, not the hour of the full
# ./build script. The server stage is upstream's server/Dockerfile; both are
# Debian trixie, so the binary matches the base image's libraries.
ARG BASE_IMAGE=ghcr.io/m1k1o/neko/brave:latest

FROM golang:1.25-trixie AS server
WORKDIR /src
ENV DEBIAN_FRONTEND=noninteractive
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libx11-dev libxrandr-dev libxtst-dev libgtk-3-dev libxcvt-dev \
        libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev; \
    rm -rf /var/lib/apt/lists/*
# the modules first, so a code change does not download them again
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
RUN ./build

FROM node:24-trixie-slim AS client
WORKDIR /src
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

FROM ${BASE_IMAGE}
LABEL org.opencontainers.image.source="https://github.com/diabeatz96/tuna"
LABEL org.opencontainers.image.description="Tuna: a self hosted virtual browser for watching and browsing together. Based on n.eko by m1k1o."
LABEL org.opencontainers.image.licenses="Apache-2.0"
COPY --from=server /src/bin/plugins/ /etc/neko/plugins/
COPY --from=server /src/bin/neko /usr/bin/neko
COPY --from=client /src/dist/ /var/www

# Launch Brave through a wrapper that clears stale profile locks, and drop
# guest mode (--bwsi) so site logins persist in the profile volume.
COPY deploy/brave-launch.sh /usr/local/bin/brave-launch
RUN chmod 755 /usr/local/bin/brave-launch \
 && sed -i -e 's|^command=/usr/bin/brave-browser|command=/usr/local/bin/brave-launch|' \
           -e '/--bwsi/d' /etc/neko/supervisord/brave.conf \
 && grep -q brave-launch /etc/neko/supervisord/brave.conf

# The media plugin drives the video over Brave's DevTools protocol (localhost
# only, see brave-launch.sh), which upstream's policy turns off with the rest of
# DevTools. Allow DevTools but block its pages (devtools://), so nobody in the
# room can open the DevTools window (and read the logged-in sites' cookies).
RUN P=/etc/brave/policies/managed/policies.json \
 && sed -i -e 's/"DeveloperToolsAvailability": 2/"DeveloperToolsAvailability": 1/' \
           -e 's|"chrome://policy"|"chrome://policy",\n      "devtools://*"|' "$P" \
 && grep -q '"DeveloperToolsAvailability": 1' "$P" \
 && grep -q '"devtools://\*"' "$P"
