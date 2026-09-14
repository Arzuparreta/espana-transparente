#!/usr/bin/env bash
# Install the app's pinned Node runtime without changing the system Node.
set -euo pipefail
REPO="${ET_REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
VERSION="$(cat "$REPO/web/.node-version")"
[[ "$VERSION" =~ ^22\.[0-9]+\.[0-9]+$ ]] || { echo 'Invalid Node 22 version' >&2; exit 1; }
case "$(uname -m)" in
  x86_64) ARCH=x64 ;;
  aarch64) ARCH=arm64 ;;
  *) echo 'Unsupported runtime architecture' >&2; exit 1 ;;
esac
RUNTIME_ROOT="${ET_RUNTIME_ROOT:-/opt/espana-transparente}"
PACKAGE="node-v${VERSION}-linux-${ARCH}"
RUNTIME="$RUNTIME_ROOT/$PACKAGE"
if [[ ! -x "$RUNTIME/bin/node" ]]; then
  mkdir -p "$RUNTIME_ROOT"
  TMP_RUNTIME="$(mktemp -d)"
  trap 'rm -rf "$TMP_RUNTIME"' EXIT
  (
    cd "$TMP_RUNTIME"
    curl -fsS --retry 3 --connect-timeout 10 --max-time 120 \
      "https://nodejs.org/dist/v${VERSION}/${PACKAGE}.tar.xz" -o "${PACKAGE}.tar.xz"
    curl -fsS --retry 3 --connect-timeout 10 --max-time 30 \
      "https://nodejs.org/dist/v${VERSION}/SHASUMS256.txt" -o SHASUMS256.txt
    sha256sum --check --ignore-missing SHASUMS256.txt >&2
    tar -xJf "${PACKAGE}.tar.xz"
    mv "$PACKAGE" "$RUNTIME"
  )
fi
[[ "$("$RUNTIME/bin/node" --version)" == "v$VERSION" ]]
printf '%s\n' "$RUNTIME"
