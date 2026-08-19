$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$WorkDir = Join-Path $env:TEMP 'pokemoncard-official-artist-rebuild'

$files = @(
  @{ Local = (Join-Path $WorkDir 'official-artist-rebuild-audit.json'); Remote = 'tmp/official-artist-rebuild-audit-v5.json'; Message = 'Upload official artist rebuild audit v5' },
  @{ Local = (Join-Path $WorkDir 'official-artist-candidates.json'); Remote = 'tmp/official-artist-candidates-v5.json'; Message = 'Upload official artist rebuild candidates v5' }
)

function Upload-NewFile([string]$LocalPath, [string]$RemotePath, [string]$Message) {
  if (-not (Test-Path -LiteralPath $LocalPath)) { throw "Missing local file: $LocalPath" }
  $payload = [ordered]@{
    message = $Message
    branch = $Branch
    content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($LocalPath))
  }
  $payloadPath = Join-Path $WorkDir ('upload-' + [Guid]::NewGuid().ToString('N') + '.json')
  [IO.File]::WriteAllText($payloadPath, ($payload | ConvertTo-Json -Depth 5 -Compress), (New-Object Text.UTF8Encoding($false)))
  try {
    & gh api --method PUT "repos/$Repo/contents/$RemotePath" --input $payloadPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "GitHub upload failed: $RemotePath" }
  } finally {
    Remove-Item -LiteralPath $payloadPath -Force -ErrorAction SilentlyContinue
  }
}

Write-Host '[1/2] Uploading audit...'
Upload-NewFile $files[0].Local $files[0].Remote $files[0].Message
Write-Host '[2/2] Uploading candidates...'
Upload-NewFile $files[1].Local $files[1].Remote $files[1].Message
Write-Host ''
Write-Host 'DONE - v5 audit and candidates uploaded.' -ForegroundColor Green
Write-Host 'Return to ChatGPT and say: audit uploaded'
