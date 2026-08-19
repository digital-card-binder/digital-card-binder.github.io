$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/add-five-popular-artists-ko-20260819'
$Base = 'https://pokemoncard.co.kr'
$Targets = @(
  'Mitsuhiro Arita',
  'Kagemaru Himeno',
  'Kouki Saitou',
  'Naoki Saito',
  'kawayoo'
)

$WorkDir = Join-Path $env:TEMP 'pokemoncard-add-five-popular-artists'
$CachePath = Join-Path $WorkDir 'detail-cache.json'
$AuditPath = Join-Path $WorkDir 'add-five-popular-artists-audit.json'
$OutputPath = Join-Path $WorkDir 'artists.json'
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

function Normalize-Text([string]$Value) {
  if ($null -eq $Value) { return '' }
  return (($Value -replace '\s+', ' ').Trim()).ToLowerInvariant()
}

function Normalize-InternalId([string]$Value) {
  return (($Value -replace '\s+', '').Trim())
}

function Get-SetCode([string]$FeatureImage) {
  $path = (($FeatureImage -split '\?')[0]).Trim('/')
  $parts = @($path -split '/')
  if ($parts.Count -ge 2) { return [string]$parts[$parts.Count - 2] }
  $file = if ($parts.Count) { [string]$parts[$parts.Count - 1] } else { $path }
  if ($file -match '^([^_]+)_') { return [string]$Matches[1] }
  return ''
}

function Get-ImageUrl([string]$FeatureImage) {
  $v = ([string]$FeatureImage).Trim()
  if ($v -match '^https?://') { return $v }
  return "https://cards.image.pokemonkorea.co.kr/data/$v"
}

function Convert-HtmlToLines([string]$Html) {
  $s = [regex]::Replace($Html, '<script\b[\s\S]*?</script>', ' ', 'IgnoreCase')
  $s = [regex]::Replace($s, '<style\b[\s\S]*?</style>', ' ', 'IgnoreCase')
  $s = [regex]::Replace($s, '<br\s*/?>', "`n", 'IgnoreCase')
  $s = [regex]::Replace($s, '</(div|p|li|dt|dd|h1|h2|h3|h4|h5|span|strong|a|td|tr|section|article)>', "`n", 'IgnoreCase')
  $s = [regex]::Replace($s, '<[^>]+>', ' ')
  $s = [System.Net.WebUtility]::HtmlDecode($s)
  $list = New-Object System.Collections.Generic.List[string]
  foreach ($line in ($s -split "`r?`n")) {
    $clean = ($line -replace '\s+', ' ').Trim()
    if ($clean) { $list.Add($clean) }
  }
  return $list.ToArray()
}

function Parse-Detail([string]$Html, [string]$InternalCardNum, [string]$FeatureImage, [string]$SourceId) {
  $lines = @(Convert-HtmlToLines $Html)
  $illustrator = ''
  $artistIndex = -1

  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -eq '일러스트' -or $lines[$i] -match '^일러스트\s*$') {
      for ($j = $i + 1; $j -lt [Math]::Min($lines.Count, $i + 6); $j++) {
        if ($lines[$j]) {
          $illustrator = ([string]$lines[$j]).Trim()
          $artistIndex = $j
          break
        }
      }
      if ($illustrator) { break }
    }
  }

  $cardName = ''
  if ($artistIndex -ge 0) {
    for ($j = $artistIndex + 1; $j -lt [Math]::Min($lines.Count, $artistIndex + 14); $j++) {
      $candidate = ([string]$lines[$j]).Trim()
      if (-not $candidate) { continue }
      if ($candidate -match '^HP\s*\d+') { continue }
      if ($candidate -match '^카드 종류\s*:') { continue }
      if ($candidate -match '^Image(?:Image)*') { continue }
      if ($candidate -match '^\d{1,4}/') { continue }
      if ($candidate -in @('관련카드','특성','약점','저항력','후퇴')) { continue }
      $cardName = $candidate
      break
    }
  }

  $printed = ''
  $rarity = ''
  foreach ($line in $lines) {
    $m = [regex]::Match([string]$line, '(?<!\d)(\d{1,4}/(?:\d{1,4}|[A-Za-z][A-Za-z0-9-]*))(?:\s+([A-Z][A-Z0-9]*))?')
    if ($m.Success) {
      $printed = $m.Groups[1].Value
      if ($m.Groups[2].Success) { $rarity = $m.Groups[2].Value }
      break
    }
  }

  $formattedNumber = if ($rarity) { "$printed $rarity" } else { $printed }
  return [pscustomobject][ordered]@{
    internalCardNum = $InternalCardNum
    detailSourceId = $SourceId
    illustrator = $illustrator
    name = $cardName
    set = Get-SetCode $FeatureImage
    rarity = $rarity
    printedNumber = $printed
    cardNumber = $formattedNumber
    image = Get-ImageUrl $FeatureImage
    source = "$Base/cards/detail/$SourceId"
  }
}

function Read-Utf8Json([string]$Path) {
  $raw = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
  return ($raw | ConvertFrom-Json)
}

function Load-Cache() {
  $map = @{}
  if (-not (Test-Path -LiteralPath $CachePath)) { return $map }
  try {
    $saved = Read-Utf8Json $CachePath
    foreach ($p in $saved.PSObject.Properties) { $map[$p.Name] = $p.Value }
  } catch {
    Write-Host '[cache] Existing cache is unreadable; starting clean.' -ForegroundColor Yellow
  }
  return $map
}

function Save-Cache($Map) {
  $ordered = [ordered]@{}
  foreach ($key in ($Map.Keys | Sort-Object)) { $ordered[$key] = $Map[$key] }
  [IO.File]::WriteAllText(
    $CachePath,
    ($ordered | ConvertTo-Json -Depth 10 -Compress),
    (New-Object Text.UTF8Encoding($false))
  )
}

function Invoke-CurlText([string[]]$Args, [string]$OutPath) {
  & curl.exe @Args -o $OutPath
  if ($LASTEXITCODE -ne 0) { throw "curl failed with exit code $LASTEXITCODE" }
  return [IO.File]::ReadAllText($OutPath, [Text.Encoding]::UTF8)
}

$CookiePath = Join-Path $WorkDir 'cookies.txt'
$PrimePath = Join-Path $WorkDir 'prime.html'
$UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

function Ensure-Session() {
  if (Test-Path -LiteralPath $CookiePath) { return }
  $args = @(
    '-sS','-L','--fail-with-body','--compressed',
    '-A',$UserAgent,
    '-H','Accept-Language: ko-KR,ko;q=0.9,en;q=0.8',
    '-c',$CookiePath,'-b',$CookiePath,
    "$Base/cards"
  )
  $null = Invoke-CurlText $args $PrimePath
}

function Search-Artist([string]$Artist) {
  Ensure-Session
  $rows = New-Object System.Collections.Generic.List[object]
  $limit = 0
  $seen = @{}

  while ($true) {
    if ($seen.ContainsKey([string]$limit)) { throw "Pagination loop for $Artist at limit=$limit" }
    $seen[[string]$limit] = $true

    $path = Join-Path $WorkDir ('ajax-' + [Guid]::NewGuid().ToString('N') + '.json')
    $args = @(
      '-sS','-L','--fail-with-body','--compressed',
      '-A',$UserAgent,
      '-H','Accept-Language: ko-KR,ko;q=0.9,en;q=0.8',
      '-H','Accept: application/json, text/javascript, */*; q=0.01',
      '-H','X-Requested-With: XMLHttpRequest',
      '-H',"Referer: $Base/cards",
      '-H',"Origin: $Base",
      '-c',$CookiePath,'-b',$CookiePath,
      '-F','action=search_text_cards',
      '-F',("search_text=$Artist"),
      '-F','search_params=all',
      '-F',("limit=$limit"),
      "$Base/v2/ajax2_dev2"
    )

    try {
      $raw = Invoke-CurlText $args $path
    } finally {
      Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
    }

    $jsonStart = $raw.IndexOf('{')
    if ($jsonStart -lt 0) { throw "No JSON returned for $Artist limit=$limit" }
    $jsonText = $raw.Substring($jsonStart)
    $obj = $jsonText | ConvertFrom-Json
    $count = [int]$obj.count
    if ($count -le 0) { break }

    $pageRows = New-Object System.Collections.Generic.List[object]
    if ($obj.result -is [System.Array]) {
      foreach ($v in $obj.result) { $pageRows.Add($v) }
    } else {
      foreach ($prop in $obj.result.PSObject.Properties) { $pageRows.Add($prop.Value) }
    }

    if ($pageRows.Count -ne $count) {
      Add-Type -AssemblyName System.Web.Extensions
      $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
      $serializer.MaxJsonLength = 67108864
      $dict = $serializer.DeserializeObject($jsonText)
      $pageRows.Clear()
      $resultObj = $dict['result']
      if ($resultObj -is [System.Collections.IDictionary]) {
        foreach ($key in $resultObj.Keys) { $pageRows.Add($resultObj[$key]) }
      } elseif ($resultObj -is [System.Collections.IEnumerable]) {
        foreach ($v in $resultObj) { $pageRows.Add($v) }
      }
    }

    if ($pageRows.Count -ne $count) {
      throw "Parsed row count mismatch for $Artist limit=$limit : server=$count parsed=$($pageRows.Count)"
    }

    foreach ($v in $pageRows.ToArray()) {
      if ($v -is [System.Collections.IDictionary]) {
        $cardNum = [string]$v['CardNum']
        $featureImage = [string]$v['feature_image']
      } else {
        $cardNum = [string]$v.CardNum
        $featureImage = [string]$v.feature_image
      }
      $rows.Add([pscustomobject]@{
        artist = $Artist
        internalCardNum = ([string]$cardNum).Trim()
        featureImage = $featureImage
        searchLimit = $limit
      })
    }

    $next = [int]$obj.limit
    if ($next -eq $limit) { throw "Pagination did not advance for $Artist at $limit" }
    $limit = $next
  }

  return $rows.ToArray()
}

function Fetch-Detail([object]$Candidate, $Cache) {
  $rawId = ([string]$Candidate.internalCardNum).Trim()
  $id = Normalize-InternalId $rawId
  $cacheKey = "$id|$($Candidate.featureImage)"
  if ($Cache.ContainsKey($cacheKey)) { return $Cache[$cacheKey] }

  $attemptIds = New-Object System.Collections.Generic.List[string]
  if ($id) { $attemptIds.Add($id) }
  if ($id -match '^(.*\d)m$') {
    $baseId = [string]$Matches[1]
    if (-not $attemptIds.Contains($baseId)) { $attemptIds.Add($baseId) }
  }

  $lastError = ''
  foreach ($detailId in $attemptIds.ToArray()) {
    $path = Join-Path $WorkDir ('detail-' + [Guid]::NewGuid().ToString('N') + '.html')
    $args = @(
      '-sS','-L','--fail-with-body','--compressed',
      '-A',$UserAgent,
      '-H','Accept-Language: ko-KR,ko;q=0.9,en;q=0.8',
      '-H',"Referer: $Base/cards",
      '-c',$CookiePath,'-b',$CookiePath,
      "$Base/cards/detail/$detailId"
    )
    try {
      try {
        $html = Invoke-CurlText $args $path
      } catch {
        $lastError = [string]$_.Exception.Message
        continue
      }
      $detail = Parse-Detail $html $id $Candidate.featureImage $detailId
      if ($detail.illustrator -and $detail.name -and $detail.printedNumber) {
        $Cache[$cacheKey] = $detail
        return $detail
      }
      $lastError = "parse incomplete for $detailId"
    } finally {
      Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
    }
  }

  throw "Could not parse detail for $rawId ($lastError)"
}

function Get-RepoFileText([string]$RemotePath) {
  $encoded = (& gh api --method GET "repos/$Repo/contents/$RemotePath" -f "ref=$Branch" --jq '.content').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw "Could not fetch $RemotePath from GitHub." }
  $encoded = $encoded -replace '\s',''
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
}

function Upload-ExistingFile([string]$LocalPath, [string]$RemotePath, [string]$Message) {
  $endpoint = "repos/$Repo/contents/$RemotePath"
  $sha = (& gh api --method GET $endpoint -f "ref=$Branch" --jq '.sha').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $sha) { throw "Could not get current SHA for $RemotePath" }

  $payload = [ordered]@{
    message = $Message
    branch = $Branch
    sha = $sha
    content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($LocalPath))
  }
  $payloadPath = Join-Path $WorkDir ('upload-' + [Guid]::NewGuid().ToString('N') + '.json')
  [IO.File]::WriteAllText($payloadPath, ($payload | ConvertTo-Json -Depth 5 -Compress), (New-Object Text.UTF8Encoding($false)))
  try {
    & gh api --method PUT $endpoint --input $payloadPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "GitHub upload failed: $RemotePath" }
  } finally {
    Remove-Item -LiteralPath $payloadPath -Force -ErrorAction SilentlyContinue
  }
}

function Upload-NewFile([string]$LocalPath, [string]$RemotePath, [string]$Message) {
  $endpoint = "repos/$Repo/contents/$RemotePath"
  $payload = [ordered]@{
    message = $Message
    branch = $Branch
    content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($LocalPath))
  }
  $payloadPath = Join-Path $WorkDir ('upload-' + [Guid]::NewGuid().ToString('N') + '.json')
  [IO.File]::WriteAllText($payloadPath, ($payload | ConvertTo-Json -Depth 5 -Compress), (New-Object Text.UTF8Encoding($false)))
  try {
    & gh api --method PUT $endpoint --input $payloadPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "GitHub upload failed: $RemotePath" }
  } finally {
    Remove-Item -LiteralPath $payloadPath -Force -ErrorAction SilentlyContinue
  }
}

Write-Host '=== Add 5 popular artists from Pokemon Korea ===' -ForegroundColor Cyan
Write-Host '[1/6] Loading current official artist dex from work branch...'
$currentText = Get-RepoFileText 'data/artists.json'
$current = $currentText | ConvertFrom-Json
if ([int]$current.artistCount -ne 29) {
  throw "Expected current artistCount=29, got $($current.artistCount)."
}
$currentNames = @($current.artists | ForEach-Object { Normalize-Text $_.name })
foreach ($target in $Targets) {
  if ($currentNames -contains (Normalize-Text $target)) {
    throw "Target artist already exists: $target"
  }
}
$oldCardCount = [int]$current.cardCount
Write-Host "  Current: $($current.artistCount) artists / $oldCardCount cards"

Write-Host '[2/6] Collecting official Korean search results for 5 artists...'
$allCandidates = New-Object System.Collections.Generic.List[object]
$searchCounts = [ordered]@{}
foreach ($artist in $Targets) {
  $items = @(Search-Artist $artist)
  $searchCounts[$artist] = $items.Count
  foreach ($item in $items) { $allCandidates.Add($item) }
  Write-Host ("  {0,-18} {1,4} search rows" -f $artist, $items.Count)
}
$searchTotal = $allCandidates.Count
if ($searchTotal -le 0) { throw 'Official search returned zero rows.' }
Write-Host "  Search total: $searchTotal"

Write-Host '[3/6] Verifying exact illustrator names on official detail pages...'
$cache = Load-Cache
$exact = New-Object System.Collections.Generic.List[object]
$partial = New-Object System.Collections.Generic.List[object]
$unprocessed = New-Object System.Collections.Generic.List[object]
$processed = 0
$cacheMiss = 0

foreach ($candidate in $allCandidates.ToArray()) {
  $processed++
  try {
    $before = $cache.Count
    $detail = Fetch-Detail $candidate $cache
    if ($cache.Count -gt $before) { $cacheMiss++ }

    if ((Normalize-Text $detail.illustrator) -eq (Normalize-Text $candidate.artist)) {
      $exact.Add([pscustomobject][ordered]@{
        artist = $candidate.artist
        internalCardNum = Normalize-InternalId $candidate.internalCardNum
        name = [string]$detail.name
        set = [string]$detail.set
        rarity = [string]$detail.rarity
        printedNumber = [string]$detail.printedNumber
        cardNumber = [string]$detail.cardNumber
        image = [string]$detail.image
        source = [string]$detail.source
      })
    } else {
      $partial.Add([pscustomobject]@{
        artist = $candidate.artist
        internalCardNum = Normalize-InternalId $candidate.internalCardNum
        actualIllustrator = [string]$detail.illustrator
        name = [string]$detail.name
        cardNumber = [string]$detail.cardNumber
      })
    }
  } catch {
    $unprocessed.Add([pscustomobject]@{
      artist = $candidate.artist
      internalCardNum = [string]$candidate.internalCardNum
      featureImage = [string]$candidate.featureImage
      reason = [string]$_.Exception.Message
    })
  }

  if (($processed % 100) -eq 0 -or $processed -eq $searchTotal) {
    Write-Host "  Verified $processed / $searchTotal"
  }
  if (($cacheMiss % 100) -eq 0 -and $cacheMiss -gt 0) { Save-Cache $cache }
}
Save-Cache $cache

Write-Host '[4/6] Applying same-card dedupe rule...'
$finalByArtist = [ordered]@{}
$duplicateCount = 0
foreach ($artist in $Targets) {
  $seen = [ordered]@{}
  $artistRows = @($exact.ToArray() | Where-Object { (Normalize-Text $_.artist) -eq (Normalize-Text $artist) })
  foreach ($row in $artistRows) {
    $key = (Normalize-Text $row.artist) + '|' + (Normalize-Text $row.set) + '|' + (Normalize-Text $row.cardNumber) + '|' + (Normalize-Text $row.name)
    if ($seen.Contains($key)) {
      $duplicateCount++
      $existing = $seen[$key]
      $existingMirror = ([string]$existing.image) -match '_m\.'
      $newMirror = ([string]$row.image) -match '_m\.'
      if ($existingMirror -and -not $newMirror) { $seen[$key] = $row }
      continue
    }
    $seen[$key] = $row
  }
  $finalByArtist[$artist] = @($seen.Values)
}

$exactCount = $exact.Count
$partialCount = $partial.Count
$unprocessedCount = $unprocessed.Count
$addedCount = 0
$artistFinalCounts = [ordered]@{}
foreach ($artist in $Targets) {
  $count = @($finalByArtist[$artist]).Count
  $artistFinalCounts[$artist] = $count
  $addedCount += $count
}

$audit = [ordered]@{
  generatedAt = (Get-Date).ToString('o')
  source = 'Pokemon Korea official card search'
  sourceUrl = "$Base/cards"
  targets = $Targets
  currentArtistCount = [int]$current.artistCount
  currentCardCount = $oldCardCount
  searchCounts = $searchCounts
  searchTotal = $searchTotal
  exactMatches = $exactCount
  partialExcluded = $partialCount
  unprocessed = $unprocessedCount
  duplicatesRemoved = $duplicateCount
  finalCounts = $artistFinalCounts
  cardsToAdd = $addedCount
  expectedNewArtistCount = ([int]$current.artistCount + $Targets.Count)
  expectedNewCardCount = ($oldCardCount + $addedCount)
  partialSamples = @($partial.ToArray() | Select-Object -First 40)
  unprocessedRows = $unprocessed.ToArray()
}
[IO.File]::WriteAllText($AuditPath, ($audit | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding($false)))

$auditRemote = 'tmp/add-five-popular-artists-audit.json'
Write-Host '[5/6] Uploading audit to work branch...'
try {
  Upload-NewFile $AuditPath $auditRemote 'Upload five-artist Korean crawl audit'
} catch {
  Write-Host "  Audit upload warning: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host ("  Search rows     : {0}" -f $searchTotal)
Write-Host ("  Exact matches   : {0}" -f $exactCount)
Write-Host ("  Partial excluded: {0}" -f $partialCount)
Write-Host ("  Unprocessed     : {0}" -f $unprocessedCount)
Write-Host ("  Duplicates      : {0}" -f $duplicateCount)
Write-Host ("  Cards to add    : {0}" -f $addedCount)
foreach ($artist in $Targets) {
  Write-Host ("    {0,-18} {1,4}" -f $artist, $artistFinalCounts[$artist])
}

if ($unprocessedCount -gt 0) {
  Write-Host ''
  Write-Host 'STOP - Some official rows could not be processed. artists.json was NOT changed.' -ForegroundColor Yellow
  Write-Host 'Return to ChatGPT and say: five artists audit uploaded'
  exit 2
}
foreach ($artist in $Targets) {
  if ([int]$artistFinalCounts[$artist] -le 0) {
    throw "No exact Korean cards found for $artist. artists.json was NOT changed."
  }
}
if (($exactCount + $partialCount) -ne $searchTotal) {
  throw 'Classification total mismatch. artists.json was NOT changed.'
}

Write-Host '[6/6] Building and uploading updated artists.json...'
$newArtistObjects = New-Object System.Collections.Generic.List[object]
foreach ($artist in $Targets) {
  $cards = New-Object System.Collections.Generic.List[object]
  $order = 0
  foreach ($row in @($finalByArtist[$artist])) {
    $order++
    if (-not $row.name -or -not $row.set -or -not $row.cardNumber -or -not $row.image) {
      throw "Required field missing for $artist / $($row.internalCardNum)"
    }
    if ([string]$row.image -notmatch '^https://cards\.image\.pokemonkorea\.co\.kr/') {
      throw "Non-official image URL for $artist / $($row.internalCardNum)"
    }
    $cards.Add([pscustomobject][ordered]@{
      order = $order
      name = [string]$row.name
      owned = $false
      set = [string]$row.set
      rarity = [string]$row.rarity
      image = [string]$row.image
      imageBw = ''
      source = [string]$row.source
      cardNumber = [string]$row.cardNumber
    })
  }
  $newArtistObjects.Add([pscustomobject][ordered]@{
    name = $artist
    cards = $cards.ToArray()
  })
}

$combinedArtists = New-Object System.Collections.Generic.List[object]
foreach ($artistObj in @($current.artists)) { $combinedArtists.Add($artistObj) }
foreach ($artistObj in $newArtistObjects.ToArray()) { $combinedArtists.Add($artistObj) }

$newOwnedCount = 0
$newCardCount = 0
foreach ($artistObj in $combinedArtists.ToArray()) {
  foreach ($card in @($artistObj.cards)) {
    $newCardCount++
    if ([bool]$card.owned) { $newOwnedCount++ }
  }
}

if ($combinedArtists.Count -ne 34) { throw "Final artist count is $($combinedArtists.Count), expected 34." }
if ($newCardCount -ne ($oldCardCount + $addedCount)) {
  throw "Final card count is $newCardCount, expected $($oldCardCount + $addedCount)."
}

$output = [ordered]@{
  source = 'Pokemon Korea official card search'
  sourceUrl = "$Base/cards"
  artistCount = $combinedArtists.Count
  cardCount = $newCardCount
  ownedCount = $newOwnedCount
  artists = $combinedArtists.ToArray()
}
[IO.File]::WriteAllText($OutputPath, ($output | ConvertTo-Json -Depth 10 -Compress), (New-Object Text.UTF8Encoding($false)))
Upload-ExistingFile $OutputPath 'data/artists.json' 'Add five popular artists from Korean official cards'

Write-Host ''
Write-Host 'SUCCESS - 5 artists added to the WORK BRANCH only.' -ForegroundColor Green
Write-Host ("New total: {0} artists / {1} cards" -f $combinedArtists.Count, $newCardCount)
Write-Host 'Nothing has been merged to main.'
Write-Host 'Return to ChatGPT and say: five artists complete'
