$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$TempScript = Join-Path $env:TEMP 'rebuild-official-artist-dex-patched.ps1'

Write-Host '[runner] Downloading the validated rebuild script...'
$url = (& gh api --method GET "repos/$Repo/contents/scripts/rebuild_official_artist_dex_local.ps1" -f "ref=$Branch" --jq '.download_url').Trim()
if ($LASTEXITCODE -ne 0 -or -not $url) { throw 'Could not resolve rebuild script URL.' }
& curl.exe -sS -L --fail-with-body $url -o $TempScript
if ($LASTEXITCODE -ne 0) { throw 'Could not download rebuild script.' }

# Patch large-file GitHub uploads to use a UTF-8 JSON payload file rather than a
# command-line form field. This avoids Windows command-length limits and BOM issues.
$text = [IO.File]::ReadAllText($TempScript, [Text.Encoding]::UTF8)
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
[IO.File]::WriteAllText($TempScript, $patched, (New-Object Text.UTF8Encoding($false)))

Write-Host '[runner] Starting official rebuild. This can take several minutes.' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TempScript
if ($LASTEXITCODE -ne 0) { throw "Rebuild script exited with code $LASTEXITCODE" }
