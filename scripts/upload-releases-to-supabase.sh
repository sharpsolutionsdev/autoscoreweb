#!/usr/bin/env bash
# Seed the current APK + Windows installer + extension zip into the public
# Supabase Storage "releases" bucket.
#
# Usage (Bash / WSL / Git Bash):
#   SUPABASE_SERVICE_ROLE_KEY=sbp_xxx ./scripts/upload-releases-to-supabase.sh
#
# Get the service role key from:
#   https://supabase.com/dashboard/project/poyjykgqsvgimssbhsuz/settings/api
set -euo pipefail

SUPABASE_URL=https://poyjykgqsvgimssbhsuz.supabase.co
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Set SUPABASE_SERVICE_ROLE_KEY before running."
  exit 1
fi

# Pulls the latest binaries straight from the existing public GitHub releases
# and re-uploads them to Supabase. Safe to re-run — x-upsert overwrites.
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

declare -A FILES=(
  [DartVoice.apk]="https://github.com/sharpsolutionsdev/autoscoreweb/releases/latest/download/DartVoice.apk"
  [DartVoice_Setup.exe]="https://github.com/sharpsolutionsdev/autoscoreweb/releases/download/windows-latest/DartVoice_Setup.exe"
)
declare -A MIME=(
  [DartVoice.apk]=application/vnd.android.package-archive
  [DartVoice_Setup.exe]=application/vnd.microsoft.portable-executable
)

for name in "${!FILES[@]}"; do
  url="${FILES[$name]}"
  path="$tmpdir/$name"
  echo "→ Downloading $name from GitHub Releases…"
  curl -sSL -o "$path" "$url"
  echo "→ Uploading $name to Supabase Storage…"
  curl --fail-with-body -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: ${MIME[$name]}" \
    -H "x-upsert: true" \
    --data-binary @"$path" \
    "$SUPABASE_URL/storage/v1/object/releases/$name" | tee /dev/stderr
  echo ""
done

# Also push the local extension zip if present
if [[ -f downloads/dartvoice-extension.zip ]]; then
  echo "→ Uploading dartvoice-extension.zip from local repo…"
  curl --fail-with-body -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/zip" \
    -H "x-upsert: true" \
    --data-binary @downloads/dartvoice-extension.zip \
    "$SUPABASE_URL/storage/v1/object/releases/dartvoice-extension.zip" | tee /dev/stderr
  echo ""
fi

echo "Done. Public URLs:"
echo "  $SUPABASE_URL/storage/v1/object/public/releases/DartVoice.apk"
echo "  $SUPABASE_URL/storage/v1/object/public/releases/DartVoice_Setup.exe"
echo "  $SUPABASE_URL/storage/v1/object/public/releases/dartvoice-extension.zip"
