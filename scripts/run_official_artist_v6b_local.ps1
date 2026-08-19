$ErrorActionPreference='Stop'
$Repo='digital-card-binder/digital-card-binder.github.io'
$Branch='agent/rebuild-artist-dex-official-20260819'
$Target=Join-Path $env:TEMP 'artist-v6b-diagnostic.ps1'

Write-Host '[v6b] Fetching diagnostic script...'
$encoded=(& gh api --method GET "repos/$Repo/contents/scripts/analyze_official_artist_v6_local.ps1" -f "ref=$Branch" --jq '.content').Trim()
if($LASTEXITCODE -ne 0 -or -not $encoded){throw 'Could not fetch v6 diagnostic script.'}
$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($encoded -replace '\s','')))

$old=@'
$cacheObj=Get-Content -Raw -LiteralPath $CachePath | ConvertFrom-Json
$cache=@{}
foreach($p in $cacheObj.PSObject.Properties){$cache[$p.Name]=$p.Value}
'@
$new=@'
Add-Type -AssemblyName System.Web.Extensions
$cacheText=[IO.File]::ReadAllText($CachePath,[Text.Encoding]::UTF8)
$cacheSerializer=New-Object System.Web.Script.Serialization.JavaScriptSerializer
$cacheSerializer.MaxJsonLength=134217728
$cacheObj=$cacheSerializer.DeserializeObject($cacheText)
$cache=@{}
foreach($key in $cacheObj.Keys){
  $v=$cacheObj[$key]
  $cache[$key]=[pscustomobject]@{
    illustrator=[string]$v['illustrator']
    name=[string]$v['name']
    printedNumber=[string]$v['printedNumber']
  }
}
'@
if(-not $text.Contains($old)){throw 'Could not locate cache parser in v6 script.'}
$text=$text.Replace($old,$new)

$utf8Bom=New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText($Target,$text,$utf8Bom)
Write-Host '[v6b] UTF-8 cache parser patched.'
Write-Host '[v6b] Running diagnostic...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Target
if($LASTEXITCODE -ne 0){throw "v6b diagnostic exited with code $LASTEXITCODE"}
