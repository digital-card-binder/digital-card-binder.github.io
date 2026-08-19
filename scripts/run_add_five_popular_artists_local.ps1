$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/add-five-popular-artists-ko-20260819'
$RemotePath = 'scripts/add_five_popular_artists_local.ps1'
$TempScript = Join-Path $env:TEMP 'add-five-popular-artists-local.ps1'

Write-Host '[runner] Fetching artist crawler from GitHub...'
$encoded = (& gh api --method GET "repos/$Repo/contents/$RemotePath" -f "ref=$Branch" --jq '.content').Trim()
if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw 'Could not fetch crawler script.' }
$encoded = $encoded -replace '\s',''
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))

Write-Host '[runner] Enabling alphabetical artist ordering...'
$needle = @'
foreach ($artistObj in $newArtistObjects.ToArray()) { $combinedArtists.Add($artistObj) }

$newOwnedCount = 0
'@
$replacement = @'
foreach ($artistObj in $newArtistObjects.ToArray()) { $combinedArtists.Add($artistObj) }

$sortedArtistObjects = @($combinedArtists.ToArray() | Sort-Object { (Normalize-Text $_.name) })
$combinedArtists = New-Object System.Collections.Generic.List[object]
foreach ($artistObj in $sortedArtistObjects) { $combinedArtists.Add($artistObj) }

$newOwnedCount = 0
'@
if (-not $text.Contains($needle)) { throw 'Could not apply alphabetical-order patch.' }
$text = $text.Replace($needle, $replacement)

$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText($TempScript, $text, $utf8Bom)

Write-Host '[runner] Starting official Korean crawl for 5 artists...' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TempScript
if ($LASTEXITCODE -ne 0) { throw "Artist crawler exited with code $LASTEXITCODE" }
