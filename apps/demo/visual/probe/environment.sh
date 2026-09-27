#!/usr/bin/env bash
# Dump the parts of the host that can influence Chromium's raster output.
set -u
echo "## os";        cat /etc/os-release | head -4; uname -a
echo "## cpu";       grep -m1 'model name' /proc/cpuinfo; nproc
grep -m1 flags /proc/cpuinfo | tr ' ' '\n' | grep -E '^(sse4_2|avx|avx2|fma|f16c|avx512f|avx512bw|avx512vl|avx512_vnni)$' | tr '\n' ' '; echo
echo "## fontconfig conf.d"; ls /etc/fonts/conf.d
for f in Inter "Noto Sans" sans-serif serif monospace ui-monospace "Liberation Mono" Arial; do echo "fc-match '$f': $(fc-match "$f")"; done
echo "## sans-serif render settings"; fc-match -v sans-serif | grep -E 'hintstyle|hinting|antialias|rgba|lcdfilter|autohint|embeddedbitmap|file:'
echo "## font files"; fc-list --format '%{file}\n' | sort | xargs sha256sum
if command -v dpkg-query >/dev/null; then echo "## packages"; dpkg-query -W -f '${Package} ${Version}\n' | grep -E 'font|freetype|harfbuzz|mesa|libc6 ' ; fi
