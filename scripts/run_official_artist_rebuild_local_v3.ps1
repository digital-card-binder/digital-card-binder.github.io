$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$TempScript = Join-Path $env:TEMP 'rebuild-official-artist-dex-v3.ps1'

Write-Host '[runner-v3] Fetching rebuild script from GitHub API...'
$encoded = (& gh api --method GET "repos/$Repo/contents/scripts/rebuild_official_artist_dex_local.ps1" -f "ref=$Branch" --jq '.content').Trim()
if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw 'Could not fetch rebuild script content.' }
$encoded = $encoded -replace '\s',''
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))

Write-Host '[runner-v3] Replacing AJAX search with the browser-compatible curl method...'
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

    if ($obj.result -is [System.Array]) {
      foreach ($val in $obj.result) {
        $rows.Add([pscustomobject]@{
          artist = $Artist
          internalCardNum = ([string]$val.CardNum).Trim()
          featureImage = [string]$val.feature_image
          searchLimit = $limit
        })
      }
    } else {
      foreach ($prop in $obj.result.PSObject.Properties) {
        $val = $prop.Value
        $rows.Add([pscustomobject]@{
          artist = $Artist
          internalCardNum = ([string]$val.CardNum).Trim()
          featureImage = [string]$val.feature_image
          searchLimit = $limit
        })
      }
    }

    $next = [int]$obj.limit
    if ($next -eq $limit) { throw "Pagination did not advance for $Artist at $limit" }
    $limit = $next
  }

  return ,$rows.ToArray()
}

'@
$patched = [regex]::Replace($text, $searchPattern, $searchReplacement)
if ($patched -eq $text) { throw 'Could not patch Search-Artist.' }

Write-Host '[runner-v3] Patching large-file GitHub uploads...'
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
  [IO.File]::WriteAllText(
    $payloadPath,
    ($payload | ConvertTo-Json -Depth 5 -Compress),
    (New-Object Text.UTF8Encoding($false))
  )
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

$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText($TempScript, $patched2, $utf8Bom)
$bytes = [IO.File]::ReadAllBytes($TempScript)
if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
  throw 'UTF-8 BOM verification failed.'
}
Write-Host '[runner-v3] UTF-8 BOM verified.'
Write-Host '[runner-v3] Starting official rebuild. This can take several minutes.' -ForegroundColor Cyan

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TempScript
if ($LASTEXITCODE -ne 0) { throw "Rebuild script exited with code $LASTEXITCODE" }
