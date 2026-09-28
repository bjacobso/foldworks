#!/usr/bin/env bash
# Run the Polaris visual suite inside an Ubuntu 24.04 chroot that renders like CI.
#
# Chromium bundles FreeType, HarfBuzz, and fontconfig, so the only host inputs that
# change its pixels are the font files and /etc/fonts configuration. This builds a
# checksum-pinned Ubuntu base rootfs with the same fonts as the ubuntu-24.04 GitHub
# runner (the packages `playwright install --with-deps` adds, plus fonts that the
# runner image preinstalls), then runs Playwright in it against this checkout.
#
# Usage (Linux x86_64 with passwordless sudo, such as a Conductor cloud workspace):
#   pnpm --filter @foldworks/demo test:visual:ubuntu                        # compare
#   pnpm --filter @foldworks/demo test:visual:ubuntu --update-snapshots=all # rebaseline
#   apps/demo/visual/ubuntu-noble.sh --fingerprint         # font parity hash of the rootfs
#   apps/demo/visual/ubuntu-noble.sh --fingerprint --host  # same hash for this machine (CI)
#
# The rootfs is cached in $FOLDWORKS_VISUAL_ROOTFS (default ~/.cache/foldworks/visual-noble).
set -euo pipefail

UBUNTU_BASE="ubuntu-base-24.04.5-base-amd64.tar.gz"
UBUNTU_BASE_SHA256="e77b6f10c2590cef872b33ee9f635a0e3fd1f57fb074c0e52b5c7f56147a0c86"
NODE_VERSION="24.13.0" # Keep in sync with .github/workflows/ci.yml.
NODE_SHA256="e798599612f4bb71333a3397ab0d095fd62214e115aea45aa858a145fc72d67e"
# Fonts the ubuntu-24.04 runner image ships beyond Playwright's dependency list. Without
# DejaVu, generic `monospace` and fallback glyphs resolve to WenQuanYi instead.
RUNNER_FONTS="fonts-dejavu fonts-dejavu-core fonts-dejavu-extra fonts-dejavu-mono fonts-lato fonts-ubuntu-console"

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$DEMO_DIR/../.." && pwd)"
ROOTFS="${FOLDWORKS_VISUAL_ROOTFS:-$HOME/.cache/foldworks/visual-noble}"
PLAYWRIGHT_VERSION="$(node -p "require('$DEMO_DIR/node_modules/playwright/package.json').version")"
STAMP="$ROOTFS/.foldworks-provisioned"
STAMP_VALUE="$UBUNTU_BASE_SHA256 $NODE_SHA256 $PLAYWRIGHT_VERSION $RUNNER_FONTS"
USER_SPEC="$(id -u):$(id -g)"
CHROOT_HOME="/home/visual"

fingerprint() {
  # Hash of every font file plus the fontconfig rules and resolved generic families.
  local script='
    { ls /etc/fonts/conf.d
      for f in Inter "Noto Sans" sans-serif serif monospace ui-monospace; do fc-match "$f"; done
      fc-match -v sans-serif | grep -E "hintstyle|antialias|rgba|lcdfilter|autohint|embeddedbitmap"
      fc-list --format "%{file}\n" | sort | xargs sha256sum
    } | sha256sum | cut -c1-16'
  if [[ "${1:-}" == "--host" ]]; then bash -c "$script"; else in_chroot "$script"; fi
}

if [[ "${1:-}" == "--fingerprint" && "${2:-}" == "--host" ]]; then
  fingerprint --host
  exit 0
fi

if [[ "$(uname -s)-$(uname -m)" != "Linux-x86_64" ]]; then
  echo "ubuntu-noble.sh needs Linux x86_64; CI baselines are rendered on x86_64 Ubuntu." >&2
  exit 1
fi

in_chroot() {
  sudo chroot "$ROOTFS" /usr/bin/env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    DEBIAN_FRONTEND=noninteractive /bin/bash -euo pipefail -c "$1"
}

as_user() {
  sudo chroot --userspec="$USER_SPEC" "$ROOTFS" /usr/bin/env -i \
    PATH=/usr/local/bin:/usr/bin:/bin HOME="$CHROOT_HOME" CI="${CI:-}" \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 /bin/bash -euo pipefail -c "cd '$DEMO_DIR' && $1"
}

mount_rootfs() {
  mountpoint -q "$ROOTFS/proc" || sudo mount -t proc proc "$ROOTFS/proc"
  for dir in dev sys; do
    if ! mountpoint -q "$ROOTFS/$dir"; then
      sudo mount --rbind "/$dir" "$ROOTFS/$dir"
      sudo mount --make-rslave "$ROOTFS/$dir"
    fi
  done
  sudo mkdir -p "$ROOTFS$REPO_DIR"
  mountpoint -q "$ROOTFS$REPO_DIR" || sudo mount --bind "$REPO_DIR" "$ROOTFS$REPO_DIR"
  sudo cp -L /etc/resolv.conf "$ROOTFS/etc/resolv.conf"
}

unmount_rootfs() {
  for target in "$ROOTFS$REPO_DIR" "$ROOTFS/dev" "$ROOTFS/sys" "$ROOTFS/proc"; do
    if mountpoint -q "$target"; then sudo umount -R "$target" || sudo umount -R -l "$target"; fi
  done
}

fetch_verified() {
  local url="$1" sha256="$2" dest="$3"
  curl -fsSL --retry 3 -o "$dest" "$url"
  echo "$sha256  $dest" | sha256sum --check --quiet
}

provision() {
  echo "Provisioning Ubuntu 24.04 visual rootfs in $ROOTFS" >&2
  unmount_rootfs
  sudo rm -rf --one-file-system "$ROOTFS"
  sudo mkdir -p "$ROOTFS"
  local download
  download="$(mktemp -d)"
  fetch_verified "https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release/$UBUNTU_BASE" \
    "$UBUNTU_BASE_SHA256" "$download/base.tar.gz"
  fetch_verified "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
    "$NODE_SHA256" "$download/node.tar.xz"
  sudo tar -xzf "$download/base.tar.gz" -C "$ROOTFS"
  sudo tar -xJf "$download/node.tar.xz" -C "$ROOTFS/usr/local" --strip-components=1
  rm -rf "$download"

  mount_rootfs
  in_chroot "apt-get update -qq && apt-get upgrade -y -qq && \
    apt-get install -y -qq --no-install-recommends ca-certificates $RUNNER_FONTS"
  # Same dependency set as CI's `playwright install --with-deps chromium`.
  in_chroot "cd '$DEMO_DIR' && ./node_modules/.bin/playwright install-deps chromium && fc-cache -f"
  in_chroot "corepack enable pnpm && mkdir -p '$CHROOT_HOME' && chown '$USER_SPEC' '$CHROOT_HOME' && \
    (getent group $(id -g) >/dev/null || groupadd -o -g $(id -g) visual) && \
    (getent passwd $(id -u) >/dev/null || useradd -o -u $(id -u) -g $(id -g) -d '$CHROOT_HOME' -M visual)"
  echo "$STAMP_VALUE" | sudo tee "$STAMP" >/dev/null
}

trap unmount_rootfs EXIT
if [[ ! -f "$STAMP" || "$(cat "$STAMP")" != "$STAMP_VALUE" ]]; then
  provision
fi
mount_rootfs

if [[ "${1:-}" == "--fingerprint" ]]; then
  fingerprint
  exit 0
fi

echo "Renderer font fingerprint: $(fingerprint)" >&2
as_user "./node_modules/.bin/playwright install chromium >/dev/null"
as_user "cd '$REPO_DIR' && pnpm run build:packages >/dev/null"
as_user "pnpm exec playwright test --config playwright.visual.config.ts $(printf '%q ' "$@")"
