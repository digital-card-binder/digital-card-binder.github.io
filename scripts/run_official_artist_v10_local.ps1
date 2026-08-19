$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$WorkDir = Join-Path $env:TEMP 'pokemoncard-official-artist-rebuild'
$CachePath = Join-Path $WorkDir 'detail-cache.json'
$TempV7 = Join-Path $env:TEMP 'finalize-official-artist-v7-v10.ps1'

Add-Type -AssemblyName System.Web.Extensions
$Ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$Ser.MaxJsonLength = 268435456
$Ser.RecursionLimit = 200

function Read-Json([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "Missing local file: $Path" }
  $text = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
  return $Ser.DeserializeObject($text)
}

function Norm-Artist([string]$Value) {
  $v = (($Value -replace '\s+', ' ').Trim()).ToLowerInvariant()
  if ($v.EndsWith('.')) { $v = $v.Substring(0, $v.Length - 1).TrimEnd() }
  return $v
}

function Cache-Complete($Detail, [string]$ExpectedArtist) {
  if ($null -eq $Detail) { return $false }
  if (-not $Detail['illustrator'] -or -not $Detail['name'] -or -not $Detail['printedNumber'] -or -not $Detail['image']) { return $false }
  return ((Norm-Artist ([string]$Detail['illustrator'])) -eq (Norm-Artist $ExpectedArtist))
}

Write-Host '[v10] Loading completed local cache...'
$cache = Read-Json $CachePath

# 1) Pokemon Korea search returned "BS2022003102 m" for the mirror/reprint row.
# The mirror detail page is unusable; copy the already validated canonical base metadata.
$akiraBase = 'BS2022003102'
$akiraMirror = 'BS2022003102m'
if (-not $cache.ContainsKey($akiraBase) -or -not (Cache-Complete $cache[$akiraBase] 'AKIRA EGAWA')) {
  throw "AKIRA canonical base metadata missing from completed cache: $akiraBase"
}
$akiraDetail = $cache[$akiraBase]
$mirrorCopy = @{}
foreach ($k in $akiraDetail.Keys) { $mirrorCopy[$k] = $akiraDetail[$k] }
$mirrorCopy['internalCardNum'] = $akiraMirror
$mirrorCopy['canonicalInternal'] = $akiraBase
$cache[$akiraMirror] = $mirrorCopy
Write-Host "[v10] AKIRA mirror recovered from canonical base: $akiraMirror"
Write-Host "      $($akiraDetail['illustrator']) / $($akiraDetail['name']) / $($akiraDetail['cardNumber'])"

# 2) Pokemon Korea search returns malformed CardNum "BS202300117 3" for S12a 173/172.
# Its detail page is missing/broken on Pokemon Korea, while the card itself is present in the official search.
# Preserve the Korean official image path and verified card metadata so this one broken detail page
# does not cause the official search result to be dropped.
$hyogoId = 'BS2023001173'
$hyogoDetail = [ordered]@{
  internalCardNum = $hyogoId
  canonicalInternal = $hyogoId
  illustrator = 'HYOGONOSUKE'
  name = '히스이 찌리리공'
  set = 'S12a'
  rarity = 'AR'
  printedNumber = '173/172'
  cardNumber = '173/172 AR'
  image = 'https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S12a/S12a_173.png?w=400'
  source = 'https://pokemoncard.co.kr/cards'
}
$cache[$hyogoId] = $hyogoDetail
Write-Host "[v10] HYOGONOSUKE broken detail page recovered: $hyogoId"
Write-Host "      $($hyogoDetail.illustrator) / $($hyogoDetail.name) / $($hyogoDetail.cardNumber)"

Write-Host '[v10] Saving repaired cache...'
[IO.File]::WriteAllText($CachePath, $Ser.Serialize($cache), (New-Object Text.UTF8Encoding($false)))

Write-Host '[v10] Downloading v7 finalizer...'
$encoded = (& gh api --method GET "repos/$Repo/contents/scripts/finalize_official_artist_v7_local.ps1" -f "ref=$Branch" --jq '.content').Trim()
if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw 'Could not fetch v7 finalizer.' }
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($encoded -replace '\s','')))
[IO.File]::WriteAllText($TempV7, $text, (New-Object Text.UTF8Encoding($true)))

Write-Host '[v10] Running final 2,448-card validation...' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TempV7
if ($LASTEXITCODE -ne 0) { throw "v7 finalizer exited with code $LASTEXITCODE" }
