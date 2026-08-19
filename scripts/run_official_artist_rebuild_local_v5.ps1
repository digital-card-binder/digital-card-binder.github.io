$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$TempScript = Join-Path $env:TEMP 'rebuild-official-artist-dex-v5.ps1'

Write-Host '[runner-v5] Fetching rebuild script from GitHub API...'
$encoded = (& gh api --method GET "repos/$Repo/contents/scripts/rebuild_official_artist_dex_local.ps1" -f "ref=$Branch" --jq '.content').Trim()
if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw 'Could not fetch rebuild script content.' }
$encoded = $encoded -replace '\s',''
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))

Write-Host '[runner-v5] Applying browser-compatible official AJAX search...'
$searchPattern = '(?s)function Search-Artist\(\[string\]\$Artist\) \{.*?\r?\n\}\r?\n\r?\n(?=function Load-Cache)'
$searchReplacement = @'
function Search-Artist([string]$Artist) {
  $rows = New-Object System.Collections.Generic.List[object]
  $limit = 0
  $seenLimits = @{}
  $cookiePath = Join-Path $WorkDir 'official-search-cookies.txt'
  $primePath = Join-Path $WorkDir 'official-search-prime.html'
  $ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

  if (-not (Test-Path $cookiePath)) {
    & curl.exe -sS -L --fail-with-body --compressed -A $ua `
      -H 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8' `
      -c $cookiePath -b $cookiePath `
      "$Base/cards" -o $primePath
    if ($LASTEXITCODE -ne 0) { throw "Could not initialize official search session for $Artist" }
  }

  while ($true) {
    if ($seenLimits.ContainsKey([string]$limit)) { throw "Pagination loop for $Artist at limit=$limit" }
    $seenLimits[[string]$limit] = $true

    $respPath = Join-Path $WorkDir ("ajax-" + ([Guid]::NewGuid().ToString('N')) + '.txt')
    $curlArgs = @(
      '-sS','-L','--fail-with-body','--compressed',
      '-A',$ua,
      '-H','Accept-Language: ko-KR,ko;q=0.9,en;q=0.8',
      '-H','Accept: application/json, text/javascript, */*; q=0.01',
      '-H','X-Requested-With: XMLHttpRequest',
      '-H',"Referer: $Base/cards",
      '-H',"Origin: $Base",
      '-c',$cookiePath,'-b',$cookiePath,
      '-F','action=search_text_cards',
      '-F',("search_text=$Artist"),
      '-F','search_params=all',
      '-F',("limit=$limit"),
      "$Base/v2/ajax2_dev2",
      '-o',$respPath
    )

    try {
      & curl.exe @curlArgs
      if ($LASTEXITCODE -ne 0) { throw "curl AJAX failed for $Artist limit=$limit with exit code $LASTEXITCODE" }
      $raw = [IO.File]::ReadAllText($respPath, [Text.Encoding]::UTF8)
    } finally {
      Remove-Item -LiteralPath $respPath -Force -ErrorAction SilentlyContinue
    }

    $jsonStart = $raw.IndexOf('{')
    if ($jsonStart -lt 0) { throw "No JSON returned for $Artist limit=$limit : $raw" }
    $obj = $raw.Substring($jsonStart) | ConvertFrom-Json
    $count = [int]$obj.count
    if ($count -le 0) { break }

    $pageRows = New-Object System.Collections.Generic.List[object]
    if ($obj.result -is [System.Array]) {
      foreach ($val in $obj.result) { $pageRows.Add($val) }
    } else {
      foreach ($prop in $obj.result.PSObject.Properties) { $pageRows.Add($prop.Value) }
    }

    if ($pageRows.Count -ne $count) {
      Add-Type -AssemblyName System.Web.Extensions
      $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
      $serializer.MaxJsonLength = 67108864
      $dict = $serializer.DeserializeObject($raw.Substring($jsonStart))
      $pageRows.Clear()
      $resultObj = $dict['result']
      if ($resultObj -is [System.Collections.IDictionary]) {
        foreach ($key in $resultObj.Keys) { $pageRows.Add($resultObj[$key]) }
      } elseif ($resultObj -is [System.Collections.IEnumerable]) {
        foreach ($val in $resultObj) { $pageRows.Add($val) }
      }
    }

    if ($pageRows.Count -ne $count) {
      throw "Parsed row count mismatch for $Artist limit=$limit : server count=$count parsed=$($pageRows.Count)"
    }

    foreach ($val in $pageRows.ToArray()) {
      if ($val -is [System.Collections.IDictionary]) {
        $cardNum = [string]$val['CardNum']
        $featureImage = [string]$val['feature_image']
      } else {
        $cardNum = [string]$val.CardNum
        $featureImage = [string]$val.feature_image
      }
      $rows.Add([pscustomobject]@{
        artist = $Artist
        internalCardNum = $cardNum.Trim()
        featureImage = $featureImage
        searchLimit = $limit
      })
    }

    $next = [int]$obj.limit
    if ($next -eq $limit) { throw "Pagination did not advance for $Artist at $limit" }
    $limit = $next
  }

  # IMPORTANT: do not unary-comma this array. The caller already wraps it in @().
  # Unary comma caused every artist's complete result array to be counted as one item.
  return $rows.ToArray()
}

'@
$patched = [regex]::Replace($text, $searchPattern, $searchReplacement)
if ($patched -eq $text) { throw 'Could not patch Search-Artist.' }

Write-Host '[runner-v5] Patching large-file GitHub uploads...'
$uploadPattern = '(?s)function Upload-File\(\[string\]\$LocalPath, \[string\]\$RemotePath, \[string\]\$Message\) \{.*?\r?\n\}\r?\n\r?\n(?=Write-Host ''=== Official Pokemon Korea artist-dex rebuild ==='')'
$uploadReplacement = @'
function Upload-File([string]$LocalPath, [string]$RemotePath, [string]$Message) {
  $endpoint = "repos/$Repo/contents/$RemotePath"
  $sha = ''
  $found = (& gh api --method GET $endpoint -f "ref=$Branch" --jq '.sha' 2>$null)
  if ($LASTEXITCODE -eq 0 -and $found) { $sha = ([string]$found).Trim() }

  $payload = [ordered]@{
    message = $Message
    branch = $Branch
    content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($LocalPath))
  }
  if ($sha) { $payload.sha = $sha }

  $payloadPath = Join-Path $WorkDir ('gh-upload-' + [Guid]::NewGuid().ToString('N') + '.json')
  [IO.File]::WriteAllText($payloadPath, ($payload | ConvertTo-Json -Depth 5 -Compress), (New-Object Text.UTF8Encoding($false)))
  try {
    & gh api --method PUT $endpoint --input $payloadPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "GitHub upload failed: $RemotePath" }
  } finally {
    Remove-Item -LiteralPath $payloadPath -Force -ErrorAction SilentlyContinue
  }
}

'@
$patched2 = [regex]::Replace($patched, $uploadPattern, $uploadReplacement)
if ($patched2 -eq $patched) { throw 'Could not patch Upload-File.' }
$patched = $patched2

Write-Host '[runner-v5] Fixing Windows PowerShell 5.1 collection handling...'
# The base script intentionally uses Generic.List for speed. Windows PowerShell 5.1
# has a binder edge case when @($genericList) is embedded in hashtables/JSON pipelines.
$patched = $patched.Replace('return ,$list.ToArray()', 'return $list.ToArray()')
$patched = $patched.Replace('@($exact | Group-Object', '@($exact.ToArray() | Group-Object')
$patched = $patched.Replace('@($finalRows | Where-Object', '@($finalRows.ToArray() | Where-Object')
$patched = $patched.Replace('@($partial | Select-Object -First 50)', '@($partial.ToArray() | Select-Object -First 50)')
$patched = $patched.Replace('@($duplicates | Select-Object -First 50)', '@($duplicates.ToArray() | Select-Object -First 50)')
$patched = $patched.Replace('unprocessedRows = @($unprocessed)', 'unprocessedRows = $unprocessed.ToArray()')
$patched = $patched.Replace('exact=@($exact); partial=@($partial); duplicates=@($duplicates)', 'exact=$exact.ToArray(); partial=$partial.ToArray(); duplicates=$duplicates.ToArray()')
$patched = $patched.Replace('foreach ($row in ($finalRows | Where-Object', 'foreach ($row in ($finalRows.ToArray() | Where-Object')
$patched = $patched.Replace('cards=@($cards)', 'cards=$cards.ToArray()')
$patched = $patched.Replace('artists = @($groups)', 'artists = $groups.ToArray()')

$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText($TempScript, $patched, $utf8Bom)
$bytes = [IO.File]::ReadAllBytes($TempScript)
if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) { throw 'UTF-8 BOM verification failed.' }

Write-Host '[runner-v5] UTF-8 BOM verified.'
Write-Host '[runner-v5] Starting official rebuild. This can take several minutes.' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TempScript
if ($LASTEXITCODE -ne 0) { throw "Rebuild script exited with code $LASTEXITCODE" }
