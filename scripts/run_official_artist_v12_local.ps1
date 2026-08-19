$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$TempScript = Join-Path $env:TEMP 'finalize-official-artist-v12.ps1'

Write-Host '[v12] Fetching validated finalizer base...'
$encoded = (& gh api --method GET "repos/$Repo/contents/scripts/finalize_official_artist_v7_local.ps1" -f "ref=$Branch" --jq '.content').Trim()
if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw 'Could not fetch finalizer base.' }
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($encoded -replace '\s','')))

Write-Host '[v12] Applying verified set + card-number dedupe rule...'
$dedupePattern = '(?s)\$seen = @\{\}.*?\$finalCount = \$finalRows\.Count'
$dedupeReplacement = @'
$seenIndex = @{}
$finalRows = New-Object System.Collections.Generic.List[object]
$dupes = New-Object System.Collections.Generic.List[object]
$nameConflicts = New-Object System.Collections.Generic.List[object]
foreach ($r in $rows.ToArray()) {
  $artistKey = Norm-Artist ([string]$r.artist)
  $setKey = ((([string]$r.set -replace '\s+', ' ').Trim()).ToLowerInvariant())
  $cardKey = ((([string]$r.cardNumber -replace '\s+', ' ').Trim()).ToLowerInvariant())
  $key = $artistKey + '|' + $setKey + '|' + $cardKey

  if ($seenIndex.ContainsKey($key)) {
    $idx = [int]$seenIndex[$key]
    $kept = $finalRows[$idx]

    $keptName = ((([string]$kept.name -replace '\s+', ' ').Trim()).ToLowerInvariant())
    $newName = ((([string]$r.name -replace '\s+', ' ').Trim()).ToLowerInvariant())
    if ($keptName -ne $newName) {
      $nameConflicts.Add([ordered]@{
        artist=$r.artist; set=$r.set; cardNumber=$r.cardNumber;
        keptName=$kept.name; duplicateName=$r.name;
        keptId=$kept.internalCardNum; duplicateId=$r.internalCardNum
      })
    }

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
      artist=$r.artist; set=$r.set; cardNumber=$r.cardNumber;
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

Write-Host '[v12] Repairing the one broken Korean card name...'
$needle = '$row = Copy-RowFromDetail $artist $id $detail'
$replacement = @'
$row = Copy-RowFromDetail $artist $id $detail
  if ((Clean-Id $id) -eq 'BS2023001173') {
    $row.name = [regex]::Unescape('\uD788\uC2A4\uC774 \uCC0C\uB9AC\uB9AC\uACF5')
  }
'@
$patched2 = $patched.Replace($needle, $replacement.TrimEnd())
if ($patched2 -eq $patched) { throw 'Could not patch HYOGONOSUKE name repair.' }
$patched = $patched2

# Use a fresh audit path for this final run.
$patched = $patched.Replace("official-artist-final-v7.json", "official-artist-final-v12.json")
$patched = $patched.Replace("tmp/official-artist-final-v7.json", "tmp/official-artist-final-v12.json")
$patched = $patched.Replace("Record final official artist validation v7", "Record final official artist validation v12")
$patched = $patched.Replace("artists-v7.json", "artists-v12.json")

# Enrich the final audit so ChatGPT can inspect the exact dedupe behavior after success.
$auditNeedle = '  duplicatesRemoved = $dupes.Count'
$auditReplacement = @'
  dedupeRule = 'artist+set+cardNumber'
  duplicatesRemoved = $dupes.Count
  nameConflictCount = $nameConflicts.Count
  nameConflictSamples = @($nameConflicts.ToArray() | Select-Object -First 20)
  duplicateSamples = @($dupes.ToArray() | Select-Object -First 30)
'@
$patched2 = $patched.Replace($auditNeedle, $auditReplacement.TrimEnd())
if ($patched2 -eq $patched) { throw 'Could not enrich final audit.' }
$patched = $patched2

$patched = $patched.Replace("SUCCESS - validated 2,448-card artists.json uploaded to the WORK BRANCH.", "SUCCESS - v12 validated 2,448-card artists.json uploaded to the WORK BRANCH.")
$patched = $patched.Replace("Return to ChatGPT and say: v7 complete", "Return to ChatGPT and say: v12 complete")

[IO.File]::WriteAllText($TempScript, $patched, (New-Object Text.UTF8Encoding($true)))
Write-Host '[v12] Running final validation and publishing to the work branch...' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TempScript
if ($LASTEXITCODE -ne 0) { throw "v12 finalizer exited with code $LASTEXITCODE" }
