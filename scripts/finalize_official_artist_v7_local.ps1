$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$WorkDir = Join-Path $env:TEMP 'pokemoncard-official-artist-rebuild'
$CandidatesPath = Join-Path $WorkDir 'official-artist-candidates.json'
$AuditPath = Join-Path $WorkDir 'official-artist-rebuild-audit.json'
$CachePath = Join-Path $WorkDir 'detail-cache.json'
$OutputPath = Join-Path $WorkDir 'artists-v7.json'
$FinalAuditPath = Join-Path $WorkDir 'official-artist-final-v7.json'

$Artists = @(
  'Narumi Sato','OKACHEKE','Shinji Kanda','Asako Ito','Gapao','Yukihiro Tada',
  'Tetsu Kayama','Jerky','Pani kobayashi','Ounishi','Sachiko Adachi','Yuka Morii',
  'Tomokazu Komiya','AKIRA EGAWA','OOYAMA','HYOGONOSUKE','miki kudo','Miki Tanaka',
  'sui','Atsuko Nishida','Aya Kusube','Shibuzoh','Saya Tsuruta','ryoma uratsuka',
  'Tika Matsuno','sowsow','Yukiko Baba','Sekio','Naoyo Kimura'
)

Add-Type -AssemblyName System.Web.Extensions
$Ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$Ser.MaxJsonLength = 268435456
$Ser.RecursionLimit = 200

function Read-Json([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "Missing local file: $Path" }
  $text = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
  return $Ser.DeserializeObject($text)
}

function Field($Obj, [string]$Name) {
  if ($null -eq $Obj) { return $null }
  if ($Obj -is [System.Collections.IDictionary]) { return $Obj[$Name] }
  return $Obj.$Name
}

function Norm-Artist([string]$Value) {
  $v = (($Value -replace '\s+', ' ').Trim()).ToLowerInvariant()
  # Pokemon Korea has both "Shibuzoh" and "Shibuzoh." on detail pages.
  if ($v.EndsWith('.')) { $v = $v.Substring(0, $v.Length - 1).TrimEnd() }
  return $v
}

function Canon-Id([string]$Value) {
  $v = ($Value -replace '\s', '').Trim()
  if ($v -match '^(.*\d)m$') { return $Matches[1] }
  return $v
}

function Clean-Id([string]$Value) {
  return (($Value -replace '\s', '').Trim())
}

function Copy-RowFromDetail([string]$Artist, [string]$Id, $Detail) {
  $cleanId = Clean-Id $Id
  $set = [string](Field $Detail 'set')
  $printed = [string](Field $Detail 'printedNumber')
  $rarity = [string](Field $Detail 'rarity')
  $cardNumber = [string](Field $Detail 'cardNumber')

  if (-not $printed) {
    # Some legacy/promotional detail pages omit a textual printed number.
    # For promo IDs the numeric suffix plus the official set code is the printed number.
    $digits = ''
    if ($cleanId -match '(\d{3})$') { $digits = $Matches[1] }
    elseif ($cleanId -match '(\d+)$') { $digits = $Matches[1] }
    if ($digits -and $set) { $printed = "$digits/$set" }
    elseif ($digits) { $printed = $digits }
    if ($rarity) { $cardNumber = "$printed $rarity" } else { $cardNumber = $printed }
  }

  return [ordered]@{
    artist = $Artist
    internalCardNum = $cleanId
    canonicalInternal = Canon-Id $cleanId
    name = [string](Field $Detail 'name')
    set = $set
    rarity = $rarity
    printedNumber = $printed
    cardNumber = $cardNumber
    image = [string](Field $Detail 'image')
    source = [string](Field $Detail 'source')
  }
}

function Find-Detail($Cache, [string]$Id) {
  $clean = Clean-Id $Id
  if ($Cache.ContainsKey($clean)) { return $Cache[$clean] }
  $canon = Canon-Id $clean
  if ($Cache.ContainsKey($canon)) { return $Cache[$canon] }
  if ($Cache.ContainsKey($canon + 'm')) { return $Cache[$canon + 'm'] }
  return $null
}

function Upload-Json([string]$LocalPath, [string]$RemotePath, [string]$Message, [bool]$Existing) {
  $sha = ''
  if ($Existing) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      $found = (& gh api --method GET "repos/$Repo/contents/$RemotePath" -f "ref=$Branch" --jq '.sha' 2>$null)
      $code = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $old
    }
    if ($code -ne 0 -or -not $found) { throw "Could not resolve existing file SHA: $RemotePath" }
    $sha = ([string]$found).Trim()
  }

  $payload = [ordered]@{
    message = $Message
    branch = $Branch
    content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($LocalPath))
  }
  if ($sha) { $payload.sha = $sha }
  $payloadPath = Join-Path $WorkDir ('v7-upload-' + [Guid]::NewGuid().ToString('N') + '.json')
  [IO.File]::WriteAllText($payloadPath, ($payload | ConvertTo-Json -Depth 5 -Compress), (New-Object Text.UTF8Encoding($false)))
  try {
    & gh api --method PUT "repos/$Repo/contents/$RemotePath" --input $payloadPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "GitHub upload failed: $RemotePath" }
  } finally {
    Remove-Item -LiteralPath $payloadPath -Force -ErrorAction SilentlyContinue
  }
}

Write-Host '[v7] Reading the completed v5 crawl and UTF-8 cache...'
$candidates = Read-Json $CandidatesPath
$audit = Read-Json $AuditPath
$cacheRaw = Read-Json $CachePath
$cache = @{}
foreach ($key in $cacheRaw.Keys) { $cache[[string]$key] = $cacheRaw[$key] }

$rows = New-Object System.Collections.Generic.List[object]
$excluded = New-Object System.Collections.Generic.List[object]
$promotedPunctuation = New-Object System.Collections.Generic.List[object]
$recoveredUnprocessed = New-Object System.Collections.Generic.List[object]

foreach ($r in (Field $candidates 'exact')) {
  $rows.Add([ordered]@{
    artist = [string](Field $r 'artist')
    internalCardNum = Clean-Id ([string](Field $r 'internalCardNum'))
    canonicalInternal = Canon-Id ([string](Field $r 'internalCardNum'))
    name = [string](Field $r 'name')
    set = [string](Field $r 'set')
    rarity = [string](Field $r 'rarity')
    printedNumber = [string](Field $r 'printedNumber')
    cardNumber = [string](Field $r 'cardNumber')
    image = [string](Field $r 'image')
    source = [string](Field $r 'source')
  })
}

foreach ($p in (Field $candidates 'partial')) {
  $artist = [string](Field $p 'artist')
  $actual = [string](Field $p 'actualIllustrator')
  $id = [string](Field $p 'internalCardNum')
  if ((Norm-Artist $artist) -eq (Norm-Artist $actual)) {
    $detail = Find-Detail $cache $id
    if ($null -eq $detail) { throw "Missing cached detail for punctuation-normalized match: $artist / $id" }
    $row = Copy-RowFromDetail $artist $id $detail
    $rows.Add($row)
    $promotedPunctuation.Add([ordered]@{artist=$artist;actualIllustrator=$actual;internalCardNum=(Clean-Id $id)})
  } else {
    $excluded.Add([ordered]@{artist=$artist;actualIllustrator=$actual;internalCardNum=(Clean-Id $id)})
  }
}

foreach ($u in (Field $audit 'unprocessedRows')) {
  $artist = [string](Field $u 'artist')
  $id = [string](Field $u 'internalCardNum')
  $detail = Find-Detail $cache $id
  if ($null -eq $detail) {
    # The two malformed IDs are mirror/reprint variants. Their canonical base is already cached.
    $clean = Clean-Id $id
    $canon = Canon-Id $clean
    $detail = Find-Detail $cache $canon
  }
  if ($null -eq $detail) { throw "Could not recover unprocessed candidate from cache: $artist / $id" }
  if ((Norm-Artist $artist) -ne (Norm-Artist ([string](Field $detail 'illustrator')))) {
    throw "Recovered candidate illustrator mismatch: $artist / $id / $([string](Field $detail 'illustrator'))"
  }
  $row = Copy-RowFromDetail $artist $id $detail
  $rows.Add($row)
  $recoveredUnprocessed.Add([ordered]@{artist=$artist;internalCardNum=(Clean-Id $id);printedNumber=$row.printedNumber})
}

$exactCount = $rows.Count
$partialCount = $excluded.Count

$seen = @{}
$finalRows = New-Object System.Collections.Generic.List[object]
$dupes = New-Object System.Collections.Generic.List[object]
foreach ($r in $rows.ToArray()) {
  $key = (Norm-Artist ([string]$r.artist)) + '|' + ([string]$r.canonicalInternal).ToLowerInvariant()
  if ($seen.ContainsKey($key)) {
    $dupes.Add([ordered]@{artist=$r.artist;kept=$seen[$key];removed=$r.internalCardNum;cardNumber=$r.cardNumber})
    continue
  }
  $seen[$key] = $r.internalCardNum
  $finalRows.Add($r)
}

$finalCount = $finalRows.Count
$checks = [ordered]@{
  searchCount = ([int](Field $audit 'officialSearchResults') -eq 2781)
  exactMatchCount = ($exactCount -eq 2662)
  partialExcludedCount = ($partialCount -eq 119)
  promotedPunctuationCount = ($promotedPunctuation.Count -eq 133)
  recoveredUnprocessedCount = ($recoveredUnprocessed.Count -eq 6)
  finalCardCount = ($finalCount -eq 2448)
  everyFinalHasName = (@($finalRows.ToArray() | Where-Object { -not $_.name }).Count -eq 0)
  everyFinalHasImage = (@($finalRows.ToArray() | Where-Object { -not $_.image }).Count -eq 0)
  everyFinalHasCardNumber = (@($finalRows.ToArray() | Where-Object { -not $_.cardNumber }).Count -eq 0)
}
$allPass = (@($checks.Values | Where-Object { -not $_ }).Count -eq 0)

$finalAudit = [ordered]@{
  sourceSearchCount = [int](Field $audit 'officialSearchResults')
  strictV5Exact = [int](Field $audit 'exactArtistMatches')
  punctuationNormalizedPromoted = $promotedPunctuation.Count
  recoveredUnprocessed = $recoveredUnprocessed.Count
  exactMatches = $exactCount
  partialExcluded = $partialCount
  duplicatesRemoved = $dupes.Count
  finalCardCount = $finalCount
  checks = $checks
  allChecksPass = $allPass
  excludedPairs = @($excluded.ToArray() | Group-Object { $_.artist + ' => ' + $_.actualIllustrator } | Sort-Object Count -Descending | ForEach-Object { [ordered]@{pair=$_.Name;count=$_.Count} })
  promotedPairs = @($promotedPunctuation.ToArray() | Group-Object { $_.artist + ' => ' + $_.actualIllustrator } | Sort-Object Count -Descending | ForEach-Object { [ordered]@{pair=$_.Name;count=$_.Count} })
  recoveredRows = $recoveredUnprocessed.ToArray()
}
[IO.File]::WriteAllText($FinalAuditPath, ($finalAudit | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding($false)))

Write-Host "[v7] Search       : $([int](Field $audit 'officialSearchResults')) / 2781"
Write-Host "[v7] Exact        : $exactCount / 2662"
Write-Host "[v7] Excluded     : $partialCount / 119"
Write-Host "[v7] Shibuzoh dot : $($promotedPunctuation.Count) / 133"
Write-Host "[v7] Recovered    : $($recoveredUnprocessed.Count) / 6"
Write-Host "[v7] Final cards  : $finalCount / 2448"

# Always publish the small final audit under a new path.
Upload-Json $FinalAuditPath 'tmp/official-artist-final-v7.json' 'Record final official artist validation v7' $false

if (-not $allPass) {
  Write-Host ''
  Write-Host 'VALIDATION MISMATCH - artists.json was NOT changed.' -ForegroundColor Yellow
  Write-Host 'Return to ChatGPT and say: v7 mismatch'
  exit 0
}

$groups = New-Object System.Collections.Generic.List[object]
foreach ($artist in $Artists) {
  $cards = New-Object System.Collections.Generic.List[object]
  $order = 0
  foreach ($r in ($finalRows.ToArray() | Where-Object { $_.artist -eq $artist })) {
    $order++
    $cards.Add([ordered]@{
      order = $order
      name = $r.name
      owned = $false
      set = $r.set
      rarity = $r.rarity
      image = $r.image
      imageBw = ''
      source = $r.source
      cardNumber = $r.cardNumber
    })
  }
  $groups.Add([ordered]@{name=$artist;cards=$cards.ToArray()})
}

$payload = [ordered]@{
  source = 'Pokemon Korea official card search'
  sourceUrl = 'https://pokemoncard.co.kr/cards'
  artistCount = 29
  cardCount = $finalCount
  ownedCount = 0
  artists = $groups.ToArray()
}
$json = $payload | ConvertTo-Json -Depth 12 -Compress
[IO.File]::WriteAllText($OutputPath, $json, (New-Object Text.UTF8Encoding($false)))
Upload-Json $OutputPath 'data/artists.json' 'Rebuild artist dex from Pokemon Korea official data' $true

Write-Host ''
Write-Host 'SUCCESS - validated 2,448-card artists.json uploaded to the WORK BRANCH.' -ForegroundColor Green
Write-Host 'Nothing has been merged to main.'
Write-Host 'Return to ChatGPT and say: v7 complete'
