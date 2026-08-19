$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$TempScript = Join-Path $env:TEMP 'rebuild-official-artist-dex-v2.ps1'

Write-Host '[runner-v2] Fetching rebuild script directly from GitHub API...'
$apiJson = (& gh api --method GET "repos/$Repo/contents/scripts/rebuild_official_artist_dex_local.ps1" -f "ref=$Branch")
if ($LASTEXITCODE -ne 0 -or -not $apiJson) { throw 'Could not fetch rebuild script from GitHub API.' }
$obj = $apiJson | ConvertFrom-Json
$base64 = ([string]$obj.content) -replace '\s',''
if (-not $base64) { throw 'GitHub API returned empty file content.' }
$bytes = [Convert]::FromBase64String($base64)
$text = [Text.Encoding]::UTF8.GetString($bytes)

# Patch uploads so large JSON files are sent through a UTF-8 payload file. This
# avoids Windows command-line length limits and PowerShell JSON/BOM issues.
$pattern = '(?s)function Upload-File\(\[string\]\$LocalPath, \[string\]\$RemotePath, \[string\]\$Message\) \{.*?\n\}\r?\n\r?\n(?=Write-Host ''=== Official Pokemon Korea artist-dex rebuild ==='')'
$replacement = @'
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
$patched = [regex]::Replace($text, $pattern, $replacement)
if ($patched -eq $text) { throw 'Could not patch the upload helper in the rebuild script.' }

# Windows PowerShell 5.1 requires a BOM to reliably parse UTF-8 source containing Korean.
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText($TempScript, $patched, $utf8Bom)

# Confirm that the BOM is really present before starting the child process.
$check = [IO.File]::ReadAllBytes($TempScript)
if ($check.Length -lt 3 -or $check[0] -ne 0xEF -or $check[1] -ne 0xBB -or $check[2] -ne 0xBF) {
  throw 'UTF-8 BOM verification failed.'
}

Write-Host '[runner-v2] UTF-8 BOM verified.' -ForegroundColor Green
Write-Host '[runner-v2] Starting official rebuild. This can take several minutes.' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TempScript
if ($LASTEXITCODE -ne 0) { throw "Rebuild script exited with code $LASTEXITCODE" }
