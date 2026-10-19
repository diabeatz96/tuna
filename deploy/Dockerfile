# Tuna image: the upstream neko image with the Tuna client layered on top.
# Fast to build because only the client is compiled. Switch to the full
# ./build script once the Go server has changes of its own.
ARG BASE_IMAGE=ghcr.io/m1k1o/neko/firefox:latest

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
COPY --from=client /src/dist/ /var/www
