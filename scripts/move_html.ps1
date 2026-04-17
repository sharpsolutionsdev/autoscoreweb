$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$htmlFiles = Get-ChildItem -Path $root -Filter *.html -File | Where-Object { $_.Directory.FullName -eq $root } | Select-Object -ExpandProperty Name
if (-not $htmlFiles) { Write-Output 'No top-level HTML files found; exiting.'; exit 0 }
$escaped = $htmlFiles | ForEach-Object { [regex]::Escape($_) }
$pattern = ($escaped -join '|')
Write-Output 'HTML files to move:'
$htmlFiles | ForEach-Object { Write-Output " - $_" }
Write-Output 'Searching for references to these filenames in tracked files...'
$refs = @()
try { $refs = & git grep -l -E $pattern 2>$null } catch { $refs = @() }
if ($refs -and $refs.Count -gt 0) {
    Write-Output 'Files referencing these HTML files:'
    $refs | ForEach-Object { Write-Output " - $_" }
    foreach ($ref in $refs) {
        $content = Get-Content -Raw $ref
        $new = [regex]::Replace($content, $pattern, 'html/$&')
        if ($new -ne $content) {
            Set-Content -Path $ref -Value $new -Encoding utf8
            Write-Output "Updated references in $ref"
        }
    }
} else { Write-Output 'No references found in tracked files.' }
# create branch
$newBranch = 'organize-html'
try { & git rev-parse --verify $newBranch > $null 2>&1; & git checkout $newBranch } catch { & git checkout -b $newBranch }
# create html dir
if (-not (Test-Path -Path html)) { New-Item -ItemType Directory -Force -Path html | Out-Null }
# move files with git mv
foreach ($f in $htmlFiles) {
    Write-Output "Moving $f -> html/$f"
    & git mv -- "$f" "html/$f"
}
# commit and push
& git add -A
try {
    & git commit -m 'chore: move top-level HTML into html/ and update internal references'
} catch {
    Write-Output 'No changes to commit.'
}
try { & git push -u origin $newBranch } catch { Write-Output 'Push failed (check remote)'; exit 1 }
Write-Output 'HTML reorganization complete.'
Get-ChildItem -Path html -Filter *.html -File | Select-Object -ExpandProperty Name
