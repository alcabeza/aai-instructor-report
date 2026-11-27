#!/usr/bin/env bash
# Builds the distributable packages into dist/:
#   - aai-instructor-report-extension-vX.Y.Z.zip  (the Chrome extension folder)
#   - AAI-Report-Installer-vX.Y.Z.zip             (Windows installer + extension)
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
DIST=dist
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

rm -rf "$DIST" && mkdir -p "$DIST"

# The installer expects the extension in a folder named "aai-bilan" next to it.
mkdir -p "$STAGE/aai-bilan" "$STAGE/AAI-Report-Installer/aai-bilan"
cp -r extension/. "$STAGE/aai-bilan/"
cp -r extension/. "$STAGE/AAI-Report-Installer/aai-bilan/"
cp installer/windows/Installer.bat installer/windows/installer.ps1 installer/windows/README.txt "$STAGE/AAI-Report-Installer/"

(cd "$STAGE" && zip -rq "$OLDPWD/$DIST/aai-instructor-report-extension-v$VERSION.zip" aai-bilan)
(cd "$STAGE" && zip -rq "$OLDPWD/$DIST/AAI-Report-Installer-v$VERSION.zip" AAI-Report-Installer)

echo "Built version $VERSION:"
ls -1 "$DIST"
