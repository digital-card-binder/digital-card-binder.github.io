$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$Base = 'https://pokemoncard.co.kr'
$WorkDir = Join-Path $env:TEMP 'pokemoncard-official-artist-rebuild'
$CachePath = Join-Path $WorkDir 'detail-cache.json'
$TempV7 = Join-Path $env:TEMP 'finalize-official-artist-v7-recovered.ps1'
$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

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

function Html-Lines([string]$Html) {
  $s = [regex]::Replace($Html, '<script\b[\s\S]*?</script>', ' ', 'IgnoreCase')
  $s = [regex]::Replace($s, '<style\b[\s\S]*?</style>', ' ', 'IgnoreCase')
  $s = [regex]::Replace($s, '<br\s*/?>', "`n", 'IgnoreCase')
  $s = [regex]::Replace($s, '</(div|p|li|dt|dd|h1|h2|h3|h4|h5|span|strong|a|td|tr|section|article)>', "`n", 'IgnoreCase')
  $s = [regex]::Replace($s, '<[^>]+>', ' ')
  $s = [System.Net.WebUtility]::HtmlDecode($s)
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($line in ($s -split "`r?`n")) {
    $clean = ($line -replace '\s+', ' ').Trim()
    if ($clean) { $out.Add($clean) }
  }
  return $out.ToArray()
}

function Parse-OfficialDetail([string]$Html, [string]$Id) {
  $lines = @(Html-Lines $Html)
  $illustratorLabel = [regex]::Unescape('\uC77C\uB7EC\uC2A4\uD2B8')
  $illustrator = ''
  $artistIndex = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq $illustratorLabel) {
      for ($j = $i + 1; $j -lt [Math]::Min($lines.Count, $i + 6); $j++) {
        if ($lines[$j]) { $illustrator = $lines[$j].Trim(); $artistIndex = $j; break }
      }
      if ($illustrator) { break }
    }
  }

  $name = ''
  if ($artistIndex -ge 0) {
    for ($j = $artistIndex + 1; $j -lt [Math]::Min($lines.Count, $artistIndex + 12); $j++) {
      $candidate = $lines[$j].Trim()
      if (-not $candidate) { continue }
      if ($candidate -match '^HP\s*\d+') { continue }
      if ($candidate -match '^Image(?:Image)*') { continue }
      if ($candidate -match '^\d{1,3}/') { continue }
      $name = $candidate
      break
    }
  }

  $printed = ''
  $rarity = ''
  foreach ($line in $lines) {
    $m = [regex]::Match($line, '(?<!\d)(\d{1,3}/(?:\d{1,3}|[A-Za-z][A-Za-z0-9-]*))(?:\s+([A-Z][A-Z0-9]*))?')
    if ($m.Success) {
      $printed = $m.Groups[1].Value
      if ($m.Groups[2].Success) { $rarity = $m.Groups[2].Value }
      break
    }
  }

  $image = ''
  $imgMatches = [regex]::Matches($Html, 'https://cards\.image\.pokemonkorea\.co\.kr/data/[^"''<>\s]+', 'IgnoreCase')
  if ($imgMatches.Count -gt 0) {
    $image = [System.Net.WebUtility]::HtmlDecode($imgMatches[0].Value)
  }

  $set = ''
  if ($image) {
    $path = (($image -split '\?')[0]).Trim('/')
    $parts = @($path -split '/')
    if ($parts.Count -ge 2) { $set = $parts[$parts.Count - 2] }
  }

  $cardNumber = if ($rarity) { "$printed $rarity" } else { $printed }
  return [ordered]@{
    internalCardNum = $Id
    canonicalInternal = if ($Id -match '^(.*\d)m$') { $Matches[1] } else { $Id }
    illustrator = $illustrator
    name = $name
    set = $set
    rarity = $rarity
    printedNumber = $printed
    cardNumber = $cardNumber
    image = $image
    source = "$Base/cards/detail/$Id"
  }
}

function Fetch-Detail([string]$Id, [string]$ExpectedArtist) {
  $htmlPath = Join-Path $WorkDir ('recover-' + $Id + '.html')
  & curl.exe -sS -L --fail-with-body --compressed -A $UA -H 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8' "$Base/cards/detail/$Id" -o $htmlPath
  if ($LASTEXITCODE -ne 0) { throw "Official detail fetch failed for corrected ID: $Id" }
  $html = [IO.File]::ReadAllText($htmlPath, [Text.Encoding]::UTF8)
  $detail = Parse-OfficialDetail $html $Id
  if (-not $detail.illustrator -or -not $detail.name -or -not $detail.printedNumber -or -not $detail.image) {
    throw "Recovered detail parse incomplete: $Id / illustrator=$($detail.illustrator) / name=$($detail.name) / number=$($detail.printedNumber)"
  }
  if ((Norm-Artist $detail.illustrator) -ne (Norm-Artist $ExpectedArtist)) {
    throw "Recovered detail illustrator mismatch: expected=$ExpectedArtist actual=$($detail.illustrator) id=$Id"
  }
  return $detail
}

Write-Host '[v8] Loading completed local detail cache...'
$cache = Read-Json $CachePath

$recover = @(
  @{ original = 'BS2022003102 m'; clean = 'BS2022003102m'; artist = 'AKIRA EGAWA' },
  @{ original = 'BS202300117 3'; clean = 'BS2023001173'; artist = 'HYOGONOSUKE' }
)

$changed = $false
foreach ($spec in $recover) {
  $id = [string]$spec.clean
  if ($cache.ContainsKey($id)) {
    Write-Host "[v8] Cache already has corrected ID: $id"
    continue
  }
  Write-Host "[v8] Recovering malformed official ID: $($spec.original) -> $id"
  $detail = Fetch-Detail $id ([string]$spec.artist)
  $cache[$id] = $detail
  $changed = $true
  Write-Host "      $($detail.illustrator) / $($detail.name) / $($detail.cardNumber)"
}

if ($changed) {
  Write-Host '[v8] Saving repaired cache...'
  $json = $Ser.Serialize($cache)
  [IO.File]::WriteAllText($CachePath, $json, (New-Object Text.UTF8Encoding($false)))
}

Write-Host '[v8] Downloading the v7 finalizer...'
$encoded = (& gh api --method GET "repos/$Repo/contents/scripts/finalize_official_artist_v7_local.ps1" -f "ref=$Branch" --jq '.content').Trim()
if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw 'Could not fetch v7 finalizer.' }
$encoded = $encoded -replace '\s',''
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
[IO.File]::WriteAllText($TempV7, $text, (New-Object Text.UTF8Encoding($true)))

Write-Host '[v8] Running final 2,448-card validation...' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TempV7
if ($LASTEXITCODE -ne 0) { throw "v7 finalizer exited with code $LASTEXITCODE" }
