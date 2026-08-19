$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$Base = 'https://pokemoncard.co.kr'
$ExpectedSearch = 2781
$ExpectedExact = 2662
$ExpectedPartial = 119
$ExpectedFinal = 2448

$Artists = @(
  'Narumi Sato','OKACHEKE','Shinji Kanda','Asako Ito','Gapao','Yukihiro Tada',
  'Tetsu Kayama','Jerky','Pani kobayashi','Ounishi','Sachiko Adachi','Yuka Morii',
  'Tomokazu Komiya','AKIRA EGAWA','OOYAMA','HYOGONOSUKE','miki kudo','Miki Tanaka',
  'sui','Atsuko Nishida','Aya Kusube','Shibuzoh','Saya Tsuruta','ryoma uratsuka',
  'Tika Matsuno','sowsow','Yukiko Baba','Sekio','Naoyo Kimura'
)

$WorkDir = Join-Path $env:TEMP 'pokemoncard-official-artist-rebuild'
$CachePath = Join-Path $WorkDir 'detail-cache.json'
$AuditPath = Join-Path $WorkDir 'official-artist-rebuild-audit.json'
$CandidatesPath = Join-Path $WorkDir 'official-artist-candidates.json'
$OutputPath = Join-Path $WorkDir 'artists.json'
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

Add-Type -AssemblyName System.Net.Http
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.AllowAutoRedirect = $true
$handler.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
$handler.CookieContainer = New-Object System.Net.CookieContainer
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(45)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36')
$client.DefaultRequestHeaders.AcceptLanguage.ParseAdd('ko-KR')
$client.DefaultRequestHeaders.AcceptLanguage.ParseAdd('ko;q=0.9')

function Normalize-Artist([string]$Value) {
  return (($Value -replace '\s+', ' ').Trim()).ToLowerInvariant()
}

function Get-SetCode([string]$FeatureImage) {
  $path = (($FeatureImage -split '\?')[0]).Trim('/')
  $parts = @($path -split '/')
  if ($parts.Count -ge 2) { return $parts[$parts.Count - 2] }
  $file = if ($parts.Count) { $parts[$parts.Count - 1] } else { $path }
  if ($file -match '^([^_]+)_') { return $Matches[1] }
  return ''
}

function Get-CanonicalInternal([string]$CardNum) {
  $v = $CardNum.Trim()
  # Official mirror / Monster Ball variants use the same printed number with an m suffix.
  if ($v -match '^(.*\d)m$') { return $Matches[1] }
  return $v
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
  return ,$list.ToArray()
}

function Parse-Detail([string]$Html, [string]$InternalCardNum, [string]$FeatureImage) {
  $lines = @(Convert-HtmlToLines $Html)
  $illustrator = ''
  $artistIndex = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -eq '일러스트' -or $lines[$i] -match '^일러스트\s*$') {
      for ($j = $i + 1; $j -lt [Math]::Min($lines.Count, $i + 6); $j++) {
        if ($lines[$j]) { $illustrator = $lines[$j].Trim(); $artistIndex = $j; break }
      }
      if ($illustrator) { break }
    }
  }

  $cardName = ''
  if ($artistIndex -ge 0) {
    for ($j = $artistIndex + 1; $j -lt [Math]::Min($lines.Count, $artistIndex + 12); $j++) {
      $candidate = $lines[$j].Trim()
      if (-not $candidate) { continue }
      if ($candidate -match '^HP\s*\d+') { continue }
      if ($candidate -match '^카드 종류\s*:') { continue }
      if ($candidate -match '^Image(?:Image)*') { continue }
      if ($candidate -match '^\d{1,3}/') { continue }
      if ($candidate -in @('관련카드','특성','약점','저항력','후퇴')) { continue }
      $cardName = $candidate
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

  $setCode = Get-SetCode $FeatureImage
  $image = if ($FeatureImage -match '^https?://') { $FeatureImage } else { "https://cards.image.pokemonkorea.co.kr/data/$FeatureImage" }
  $formattedNumber = if ($rarity) { "$printed $rarity" } else { $printed }

  return [ordered]@{
    internalCardNum = $InternalCardNum.Trim()
    canonicalInternal = Get-CanonicalInternal $InternalCardNum
    illustrator = $illustrator
    name = $cardName
    set = $setCode
    rarity = $rarity
    printedNumber = $printed
    cardNumber = $formattedNumber
    image = $image
    source = "$Base/cards/detail/$($InternalCardNum.Trim())"
  }
}

function Get-TextWithRetry([string]$Url) {
  $last = $null
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try {
      $res = $client.GetAsync($Url).Result
      if (-not $res.IsSuccessStatusCode) { throw "HTTP $([int]$res.StatusCode)" }
      return $res.Content.ReadAsStringAsync().Result
    } catch {
      $last = $_
      Start-Sleep -Milliseconds (250 * $attempt)
    }
  }
  throw $last
}

function Search-Artist([string]$Artist) {
  $rows = New-Object System.Collections.Generic.List[object]
  $limit = 0
  $seenLimits = @{}
  while ($true) {
    if ($seenLimits.ContainsKey([string]$limit)) { throw "Pagination loop for $Artist at limit=$limit" }
    $seenLimits[[string]$limit] = $true

    $form = New-Object System.Net.Http.MultipartFormDataContent
    $form.Add((New-Object System.Net.Http.StringContent('search_text_cards')), 'action')
    $form.Add((New-Object System.Net.Http.StringContent($Artist)), 'search_text')
    $form.Add((New-Object System.Net.Http.StringContent('all')), 'search_params')
    $form.Add((New-Object System.Net.Http.StringContent([string]$limit)), 'limit')
    try {
      $response = $client.PostAsync("$Base/v2/ajax2_dev2", $form).Result
      $raw = $response.Content.ReadAsStringAsync().Result
    } finally {
      $form.Dispose()
    }
    $jsonStart = $raw.IndexOf('{')
    if ($jsonStart -lt 0) { throw "No JSON returned for $Artist limit=$limit : $raw" }
    $obj = $raw.Substring($jsonStart) | ConvertFrom-Json
    $count = [int]$obj.count
    if ($count -le 0) { break }
    foreach ($prop in $obj.result.PSObject.Properties) {
      $val = $prop.Value
      $rows.Add([pscustomobject]@{
        artist = $Artist
        internalCardNum = ([string]$val.CardNum).Trim()
        featureImage = [string]$val.feature_image
        searchLimit = $limit
      })
    }
    $next = [int]$obj.limit
    if ($next -eq $limit) { throw "Pagination did not advance for $Artist at $limit" }
    $limit = $next
  }
  return ,$rows.ToArray()
}

function Load-Cache() {
  $map = @{}
  if (Test-Path $CachePath) {
    try {
      $saved = Get-Content -Raw -LiteralPath $CachePath | ConvertFrom-Json
      foreach ($p in $saved.PSObject.Properties) { $map[$p.Name] = $p.Value }
    } catch { Write-Host 'Existing cache could not be read; starting a clean cache.' -ForegroundColor Yellow }
  }
  return $map
}

function Save-Cache($Map) {
  $obj = [ordered]@{}
  foreach ($key in ($Map.Keys | Sort-Object)) { $obj[$key] = $Map[$key] }
  [IO.File]::WriteAllText($CachePath, ($obj | ConvertTo-Json -Depth 8 -Compress), (New-Object Text.UTF8Encoding($false)))
}

function Upload-File([string]$LocalPath, [string]$RemotePath, [string]$Message) {
  $endpoint = "repos/$Repo/contents/$RemotePath"
  $sha = ''
  & gh api --method GET $endpoint -f "ref=$Branch" --jq '.sha' 2>$null | ForEach-Object { $script:__sha = $_ }
  if ($LASTEXITCODE -eq 0) { $sha = [string]$script:__sha } else { $sha = '' }
  $content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($LocalPath))
  $args = @('--method','PUT',$endpoint,'-f',"message=$Message",'-f',"branch=$Branch",'-f',"content=$content")
  if ($sha) { $args += @('-f',"sha=$($sha.Trim())") }
  & gh api @args | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "GitHub upload failed: $RemotePath" }
}

Write-Host '=== Official Pokemon Korea artist-dex rebuild ===' -ForegroundColor Cyan
Write-Host '[1/5] Checking official site...'
$null = Get-TextWithRetry "$Base/cards"

Write-Host '[2/5] Collecting official search results for 29 artists...'
$allCandidates = New-Object System.Collections.Generic.List[object]
$artistSearchCounts = [ordered]@{}
foreach ($artist in $Artists) {
  $items = @(Search-Artist $artist)
  $artistSearchCounts[$artist] = $items.Count
  foreach ($item in $items) { $allCandidates.Add($item) }
  Write-Host ("  {0,-20} {1,4} results" -f $artist, $items.Count)
}
$searchCount = $allCandidates.Count
Write-Host "  Search results total: $searchCount"

Write-Host '[3/5] Verifying exact illustrator names on official detail pages...'
$cache = Load-Cache
$exact = New-Object System.Collections.Generic.List[object]
$partial = New-Object System.Collections.Generic.List[object]
$unprocessed = New-Object System.Collections.Generic.List[object]
$detailFetches = 0
$processed = 0
foreach ($candidate in $allCandidates) {
  $processed++
  $id = $candidate.internalCardNum.Trim()
  try {
    if ($cache.ContainsKey($id)) {
      $detail = $cache[$id]
    } else {
      $html = Get-TextWithRetry "$Base/cards/detail/$id"
      $detailHash = Parse-Detail $html $id $candidate.featureImage
      $detail = [pscustomobject]$detailHash
      $cache[$id] = $detail
      $detailFetches++
      if (($detailFetches % 100) -eq 0) { Save-Cache $cache }
    }

    if (-not $detail.illustrator -or -not $detail.name -or -not $detail.printedNumber) {
      $unprocessed.Add([pscustomobject]@{artist=$candidate.artist; internalCardNum=$id; reason='detail_parse_incomplete'; illustrator=$detail.illustrator; name=$detail.name; printedNumber=$detail.printedNumber})
    } elseif ((Normalize-Artist $detail.illustrator) -eq (Normalize-Artist $candidate.artist)) {
      $exact.Add([pscustomobject]@{
        artist = $candidate.artist
        internalCardNum = $id
        canonicalInternal = [string]$detail.canonicalInternal
        name = [string]$detail.name
        set = [string]$detail.set
        rarity = [string]$detail.rarity
        printedNumber = [string]$detail.printedNumber
        cardNumber = [string]$detail.cardNumber
        image = [string]$detail.image
        source = [string]$detail.source
      })
    } else {
      $partial.Add([pscustomobject]@{artist=$candidate.artist; internalCardNum=$id; actualIllustrator=$detail.illustrator; name=$detail.name; cardNumber=$detail.cardNumber})
    }
  } catch {
    $unprocessed.Add([pscustomobject]@{artist=$candidate.artist; internalCardNum=$id; reason=[string]$_.Exception.Message})
  }
  if (($processed % 100) -eq 0) { Write-Host "  Verified $processed / $searchCount" }
}
Save-Cache $cache

$exactCount = $exact.Count
$partialCount = $partial.Count
$unprocessedCount = $unprocessed.Count

Write-Host '[4/5] Applying duplicate / printed-number rules...'
$seenCanonical = @{}
$finalRows = New-Object System.Collections.Generic.List[object]
$duplicates = New-Object System.Collections.Generic.List[object]
foreach ($row in $exact) {
  $key = (Normalize-Artist $row.artist) + '|' + ([string]$row.canonicalInternal).ToLowerInvariant()
  if ($seenCanonical.ContainsKey($key)) {
    $duplicates.Add([pscustomobject]@{artist=$row.artist; kept=$seenCanonical[$key]; removed=$row.internalCardNum; cardNumber=$row.cardNumber; name=$row.name})
    continue
  }
  $seenCanonical[$key] = $row.internalCardNum
  $finalRows.Add($row)
}
$finalCount = $finalRows.Count

# Diagnostic alternative counts make any mismatch explainable without re-scraping.
$rawInternalCount = @($exact | Group-Object { (Normalize-Artist $_.artist) + '|' + $_.internalCardNum.ToLowerInvariant() }).Count
$printedSetCount = @($exact | Group-Object { (Normalize-Artist $_.artist) + '|' + $_.set.ToLowerInvariant() + '|' + $_.printedNumber.ToLowerInvariant() }).Count
$namePrintedSetRarityCount = @($exact | Group-Object { (Normalize-Artist $_.artist) + '|' + $_.name.ToLowerInvariant() + '|' + $_.set.ToLowerInvariant() + '|' + $_.printedNumber.ToLowerInvariant() + '|' + $_.rarity.ToLowerInvariant() }).Count

$checks = [ordered]@{
  artistCount = ($Artists.Count -eq 29)
  searchCount = ($searchCount -eq $ExpectedSearch)
  exactMatchCount = ($exactCount -eq $ExpectedExact)
  partialExcludedCount = ($partialCount -eq $ExpectedPartial)
  exactPlusPartialEqualsSearch = (($exactCount + $partialCount) -eq $searchCount)
  unprocessedZero = ($unprocessedCount -eq 0)
  finalCardCount = ($finalCount -eq $ExpectedFinal)
  everyFinalHasName = (@($finalRows | Where-Object { -not $_.name }).Count -eq 0)
  everyFinalHasImage = (@($finalRows | Where-Object { -not $_.image }).Count -eq 0)
  everyFinalHasPrintedNumber = (@($finalRows | Where-Object { -not $_.printedNumber }).Count -eq 0)
  everyFinalHasExactArtist = (@($finalRows | Where-Object { (Normalize-Artist $_.artist) -ne (Normalize-Artist $cache[$_.internalCardNum].illustrator) }).Count -eq 0)
}
$allChecksPass = (@($checks.Values | Where-Object { -not $_ }).Count -eq 0)

$audit = [ordered]@{
  generatedAt = (Get-Date).ToString('o')
  source = "$Base/cards"
  artistCount = $Artists.Count
  officialSearchResults = $searchCount
  exactArtistMatches = $exactCount
  partialMatchesExcluded = $partialCount
  unprocessed = $unprocessedCount
  duplicateRowsRemoved = $duplicates.Count
  finalCardCount = $finalCount
  alternativeDedupCounts = [ordered]@{
    rawInternal = $rawInternalCount
    stripMirrorMSuffix = $finalCount
    printedNumberAndSet = $printedSetCount
    namePrintedNumberSetRarity = $namePrintedSetRarityCount
  }
  expected = [ordered]@{search=$ExpectedSearch; exact=$ExpectedExact; partial=$ExpectedPartial; final=$ExpectedFinal; unprocessed=0}
  checks = $checks
  allChecksPass = $allChecksPass
  artistSearchCounts = $artistSearchCounts
  partialSamples = @($partial | Select-Object -First 50)
  duplicateSamples = @($duplicates | Select-Object -First 50)
  unprocessedRows = @($unprocessed)
}
[IO.File]::WriteAllText($AuditPath, ($audit | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText($CandidatesPath, ([ordered]@{exact=@($exact); partial=@($partial); duplicates=@($duplicates)} | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding($false)))

Write-Host "  Official search : $searchCount / expected $ExpectedSearch"
Write-Host "  Exact matches   : $exactCount / expected $ExpectedExact"
Write-Host "  Partial excluded: $partialCount / expected $ExpectedPartial"
Write-Host "  Unprocessed     : $unprocessedCount / expected 0"
Write-Host "  Final cards     : $finalCount / expected $ExpectedFinal"

Write-Host '[5/5] Publishing audit to GitHub work branch...'
Upload-File $AuditPath 'tmp/official-artist-rebuild-audit.json' 'Record official artist rebuild audit'
Upload-File $CandidatesPath 'tmp/official-artist-candidates.json' 'Record official artist rebuild candidates'

if ($allChecksPass) {
  $groups = New-Object System.Collections.Generic.List[object]
  foreach ($artist in $Artists) {
    $cards = New-Object System.Collections.Generic.List[object]
    $order = 0
    foreach ($row in ($finalRows | Where-Object { $_.artist -eq $artist })) {
      $order++
      $cards.Add([ordered]@{
        order = $order
        name = $row.name
        status = '미보유'
        owned = $false
        set = $row.set
        rarity = $row.rarity
        image = $row.image
        imageBw = ''
        source = $row.source
        cardNumber = $row.cardNumber
      })
    }
    $groups.Add([ordered]@{name=$artist; cards=@($cards)})
  }
  $payload = [ordered]@{
    source = '포켓몬코리아 카드검색'
    sourceUrl = "$Base/cards"
    artistCount = $Artists.Count
    cardCount = $finalCount
    ownedCount = 0
    artists = @($groups)
  }
  [IO.File]::WriteAllText($OutputPath, ($payload | ConvertTo-Json -Depth 10 -Compress), (New-Object Text.UTF8Encoding($false)))
  Upload-File $OutputPath 'data/artists.json' 'Rebuild artist dex from Pokemon Korea official search'
  Write-Host ''
  Write-Host 'SUCCESS - 2,448-card official artist dex uploaded to the WORK BRANCH.' -ForegroundColor Green
  Write-Host 'Nothing has been merged to main yet.'
  Write-Host 'Return to ChatGPT and say: rebuild complete'
} else {
  Write-Host ''
  Write-Host 'VALIDATION MISMATCH - main data was NOT changed.' -ForegroundColor Yellow
  Write-Host 'The audit was uploaded so ChatGPT can inspect the mismatch without repeating the crawl.'
  Write-Host 'Return to ChatGPT and say: rebuild audit uploaded'
}

$client.Dispose()
$handler.Dispose()
