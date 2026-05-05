# DartVoice Chrome extension packager.
#
# Usage (from repo root or this folder):
#   pwsh ./chrome_extension/build_zip.ps1
#
# Output: dist/dartvoice-extension-v<version>.zip
# Contents: only the files Chrome Web Store cares about. Anything not in the
# explicit allow-list (README, screenshots, _metadata/, .DS_Store, etc) is
# excluded so we don't get reviewer warnings.

$ErrorActionPreference = 'Stop'
$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$root    = Split-Path -Parent $here
$distDir = Join-Path $root 'dist'
$manifest = Get-Content (Join-Path $here 'manifest.json') -Raw | ConvertFrom-Json
$version  = $manifest.version

# Files to ship. Add new ones here as the extension grows.
$include = @(
    'manifest.json',
    'background.js',
    'content.js',
    'dartcounter-inject.js',
    'auth-bridge.js',
    'audio-patch.js',
    'camera-patch.js',
    'popup.html',
    'popup.js',
    'rules.json',
    'icon16.png',
    'icon48.png',
    'icon128.png'
)

# Stage into a temp folder so the zip has a clean root.
$stage = Join-Path $env:TEMP "dv-ext-$version-$([guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $stage -Force | Out-Null
foreach ($f in $include) {
    $src = Join-Path $here $f
    if (-not (Test-Path $src)) { throw "Missing required file: $src" }
    Copy-Item $src (Join-Path $stage $f)
}

# Make sure dist/ exists.
New-Item -ItemType Directory -Path $distDir -Force | Out-Null
$zipPath = Join-Path $distDir "dartvoice-extension-v$version.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item $stage -Recurse -Force

$bytes = (Get-Item $zipPath).Length
Write-Host "Built $zipPath ($([math]::Round($bytes/1024,1)) KB) - version $version" -ForegroundColor Green
Write-Host "Upload to https://chrome.google.com/webstore/devconsole" -ForegroundColor Cyan
