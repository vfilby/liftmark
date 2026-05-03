#!/usr/bin/env bash
# Extracts named PNG attachments from an .xcresult bundle into an output
# directory. The screenshot UI test action sets `attachment.name` to a stable
# slug (e.g. "01-home"); this script renames the exported files to
# `<name>.png` so the output is deterministic and ready for App Store upload.

set -euo pipefail

if [[ $# -lt 2 ]]; then
    echo "usage: $0 <result-bundle> <output-dir>" >&2
    exit 2
fi

BUNDLE="$1"
OUT_DIR="$2"

if [[ ! -d "$BUNDLE" ]]; then
    echo "result bundle not found: $BUNDLE" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"
STAGING="$(mktemp -d -t liftmark-screenshots)"
trap 'rm -rf "$STAGING"' EXIT

# Xcode 16+ ships `xcresulttool export attachments`. The legacy `--legacy`
# graph traversal is gone in Xcode 26, so this is the only path.
xcrun xcresulttool export attachments \
    --path "$BUNDLE" \
    --output-path "$STAGING" >/dev/null

MANIFEST="$STAGING/manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
    echo "no manifest.json produced — xcresulttool version mismatch?" >&2
    exit 1
fi

# Each manifest entry has the original suggestedHumanReadableName (which we
# set to "01-home" etc) plus the exportedFileName under the staging dir.
# Walk the manifest with python so we don't depend on jq being installed.
python3 - "$MANIFEST" "$STAGING" "$OUT_DIR" <<'PY'
import json, os, shutil, sys, re

manifest_path, staging, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
with open(manifest_path) as f:
    manifest = json.load(f)

count = 0
for test in manifest:
    for attach in test.get("attachments", []):
        name = attach.get("suggestedHumanReadableName") or ""
        exported = attach.get("exportedFileName")
        if not exported or not name:
            continue
        # Only screenshot attachments we set a name on — skip xctest framework
        # attachments (e.g. system diagnostics, accessibility snapshots).
        # Xcode appends `_<index>_<UUID>.png` for uniqueness; strip it back to
        # the original action.name we set.
        m = re.match(r"^(\d+-[A-Za-z0-9_-]+?)(?:_\d+_[A-F0-9-]+)?\.png$", name)
        if not m:
            continue
        slug = m.group(1)
        src = os.path.join(staging, exported)
        if not os.path.isfile(src):
            continue
        dest = os.path.join(out_dir, f"{slug}.png")
        shutil.copyfile(src, dest)
        count += 1
        print(f"  -> {dest}")

if count == 0:
    print("warning: no named screenshot attachments found in result bundle", file=sys.stderr)
    sys.exit(1)
PY
