$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$TempScript = Join-Path $env:TEMP 'finalize-official-artist-v14.ps1'

Write-Host '[v14] Fetching validated finalizer base...'
$encoded = (& gh api --method GET "repos/$Repo/contents/scripts/finalize_official_artist_v7_local.ps1" -f "ref=$Branch" --jq '.content').Trim()
if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw 'Could not fetch finalizer base.' }
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($encoded -replace '\s','')))

Write-Host '[v14] Applying corrected dedupe identity...'
$dedupePattern = '(?s)\$seen = @\{\}.*?\$finalCount = \$finalRows\.Count'
$dedupeReplacement = @'
$seenIndex = @{}
$finalRows = New-Object System.Collections.Generic.List[object]
$dupes = New-Object System.Collections.Generic.List[object]
foreach ($r in $rows.ToArray()) {
  $artistKey = Norm-Artist ([string]$r.artist)
  $setKey = ((([string]$r.set -replace '\s+', ' ').Trim()).ToLowerInvariant())
  $cardKey = ((([string]$r.cardNumber -replace '\s+', ' ').Trim()).ToLowerInvariant())
  $nameKey = ((([string]$r.name -replace '\s+', ' ').Trim()).ToLowerInvariant())
  $key = $artistKey + '|' + $setKey + '|' + $cardKey + '|' + $nameKey

  if ($seenIndex.ContainsKey($key)) {
    $idx = [int]$seenIndex[$key]
    $kept = $finalRows[$idx]

    $keptMirror = ([string]$kept.image -match '_m(?=\.[A-Za-z0-9]+(?:\?|$))')
    $newMirror = ([string]$r.image -match '_m(?=\.[A-Za-z0-9]+(?:\?|$))')
    if ($keptMirror -and -not $newMirror) {
      $removedId = $kept.internalCardNum
      $finalRows[$idx] = $r
      $keptId = $r.internalCardNum
    } else {
      $removedId = $r.internalCardNum
      $keptId = $kept.internalCardNum
    }

    $dupes.Add([ordered]@{
      artist=$r.artist; set=$r.set; cardNumber=$r.cardNumber; name=$r.name;
      kept=$keptId; removed=$removedId
    })
    continue
  }

  $seenIndex[$key] = $finalRows.Count
  $finalRows.Add($r)
}

$finalCount = $finalRows.Count
'@
$patched = [regex]::Replace($text, $dedupePattern, $dedupeReplacement)
if ($patched -eq $text) { throw 'Could not patch dedupe block.' }

Write-Host '[v14] Applying Unicode-safe card-name repair...'
$needle = '$row = Copy-RowFromDetail $artist $id $detail'
$replacement = @'
$row = Copy-RowFromDetail $artist $id $detail
  if ((Clean-Id $id) -eq 'BS2023001173') {
    $row.name = [regex]::Unescape('\uD788\uC2A4\uC774 \uCC0C\uB9AC\uB9AC\uACF5')
  }
'@
$patched2 = $patched.Replace($needle, $replacement.TrimEnd())
if ($patched2 -eq $patched) { throw 'Could not patch card-name repair.' }
$patched = $patched2

$patched = $patched.Replace('$finalCount -eq 2448', '$finalCount -eq 2451')
$patched = $patched.Replace('/ 2448', '/ 2451')
$patched = $patched.Replace('2,448-card', '2,451-card')
$patched = $patched.Replace('official-artist-final-v7.json', 'official-artist-final-v14.json')
$patched = $patched.Replace('tmp/official-artist-final-v7.json', 'tmp/official-artist-final-v14.json')
$patched = $patched.Replace('Record final official artist validation v7', 'Record final official artist validation v14')
$patched = $patched.Replace('artists-v7.json', 'artists-v14.json')
$patched = $patched.Replace('Return to ChatGPT and say: v7 complete', 'Return to ChatGPT and say: v14 complete')

$auditNeedle = '  duplicatesRemoved = $dupes.Count'
$auditReplacement = @'
  dedupeRule = 'artist+set+cardNumber+name'
  duplicatesRemoved = $dupes.Count
  duplicateSamples = @($dupes.ToArray() | Select-Object -First 30)
'@
$patched2 = $patched.Replace($auditNeedle, $auditReplacement.TrimEnd())
if ($patched2 -eq $patched) { throw 'Could not enrich final audit.' }
$patched = $patched2

$checksNeedle = '  everyFinalHasCardNumber = (@($finalRows.ToArray() | Where-Object { -not $_.cardNumber }).Count -eq 0)'
$checksReplacement = @'
  everyFinalHasCardNumber = (@($finalRows.ToArray() | Where-Object { -not $_.cardNumber }).Count -eq 0)
  preservesBw6CollisionIds = (@($finalRows.ToArray() | Where-Object { $_.internalCardNum -in @('BS2012009008','BS2012008008') }).Count -eq 2)
  preservesS10CollisionIds = (@($finalRows.ToArray() | Where-Object { $_.internalCardNum -in @('BS2022008018','BS2022007018') }).Count -eq 2)
  preservesS7CollisionIds = (@($finalRows.ToArray() | Where-Object { $_.internalCardNum -in @('BS2021012055','BS2021011055') }).Count -eq 2)
'@
$patched2 = $patched.Replace($checksNeedle, $checksReplacement.TrimEnd())
if ($patched2 -eq $patched) { throw 'Could not add collision checks.' }
$patched = $patched2

$patched = $patched.Replace('SUCCESS - validated 2,451-card artists.json uploaded to the WORK BRANCH.', 'SUCCESS - v14 validated 2,451-card artists.json uploaded to the WORK BRANCH.')

[IO.File]::WriteAllText($TempScript, $patched, (New-Object Text.UTF8Encoding($true)))
Write-Host '[v14] Running corrected final validation and publishing to the work branch...' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TempScript
if ($LASTEXITCODE -ne 0) { throw "v14 finalizer exited with code $LASTEXITCODE" }
