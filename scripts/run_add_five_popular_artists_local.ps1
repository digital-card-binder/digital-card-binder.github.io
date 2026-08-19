$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/add-five-popular-artists-ko-20260819'
$RemotePath = 'scripts/add_five_popular_artists_local.ps1'

Write-Host '[runner] Fetching artist crawler from GitHub...'
$encoded = (& gh api --method GET "repos/$Repo/contents/$RemotePath" -f "ref=$Branch" --jq '.content').Trim()
if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw 'Could not fetch crawler script.' }
$encoded = $encoded -replace '\s',''
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))

Write-Host '[runner] Fixing curl argument binding for Windows PowerShell...'
$oldCurlSignature = 'function Invoke-CurlText([string[]]$Args, [string]$OutPath) {'
$newCurlSignature = 'function Invoke-CurlText([string[]]$CurlArgs, [string]$OutPath) {'
if (-not $text.Contains($oldCurlSignature)) { throw 'Could not find Invoke-CurlText signature.' }
$text = $text.Replace($oldCurlSignature, $newCurlSignature)
$oldCurlCall = '& curl.exe @Args -o $OutPath'
$newCurlCall = '& curl.exe @CurlArgs -o $OutPath'
if (-not $text.Contains($oldCurlCall)) { throw 'Could not find curl invocation.' }
$text = $text.Replace($oldCurlCall, $newCurlCall)

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

Write-Host '[runner] Starting official Korean crawl for 5 artists in memory...' -ForegroundColor Cyan
$scriptBlock = [ScriptBlock]::Create($text)
& $scriptBlock
