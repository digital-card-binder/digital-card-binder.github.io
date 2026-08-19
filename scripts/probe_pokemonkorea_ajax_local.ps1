$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$Base = 'https://pokemoncard.co.kr'
$TempDir = Join-Path $env:TEMP 'pokemoncard-artist-probe2'
$HtmlPath = Join-Path $TempDir 'cards.html'
$CookiePath = Join-Path $TempDir 'cookies.txt'
$OutPath = Join-Path $TempDir 'pokemonkorea-ajax-probe.txt'
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

function CurlGet([string]$Url, [string]$Output) {
    & curl.exe -sS -L --fail-with-body -A $UA -H 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8' -c $CookiePath -b $CookiePath $Url -o $Output
    if ($LASTEXITCODE -ne 0) { throw "curl GET failed ($LASTEXITCODE): $Url" }
}

Write-Host '[1/4] Reading search form options...'
CurlGet "$Base/cards" $HtmlPath
$html = [IO.File]::ReadAllText($HtmlPath, [Text.Encoding]::UTF8)
$lines = New-Object System.Collections.Generic.List[string]

$select = [regex]::Match($html, '<select[^>]+name=["'']search_params["''][^>]*>([\s\S]*?)</select>', 'IgnoreCase').Groups[1].Value
$options = New-Object System.Collections.Generic.List[object]
foreach ($m in [regex]::Matches($select, '<option[^>]*value=["'']([^"'']*)["''][^>]*>([\s\S]*?)</option>', 'IgnoreCase')) {
    $value = $m.Groups[1].Value
    $label = (($m.Groups[2].Value -replace '<[^>]+>', '') -replace '\s+', ' ').Trim()
    $selected = $m.Value -match '\bselected\b'
    $options.Add([pscustomobject]@{ value=$value; label=$label; selected=$selected })
    $lines.Add("OPTION value=$value label=$label selected=$selected")
}
if ($options.Count -eq 0) {
    $lines.Add('NO_OPTIONS_PARSED')
}

$testValues = New-Object System.Collections.Generic.List[string]
foreach ($o in $options) { if (-not $testValues.Contains([string]$o.value)) { $testValues.Add([string]$o.value) } }
foreach ($fallback in @('', 'all', 'card_name', 'name', 'text', 'illustrator', 'artist')) { if (-not $testValues.Contains($fallback)) { $testValues.Add($fallback) } }

Write-Host '[2/4] Probing the official AJAX search endpoint...'
$artists = @('OKACHEKE','Narumi Sato')
foreach ($artist in $artists) {
    foreach ($searchParam in $testValues) {
        $safe = ($artist + '-' + ($searchParam -replace '[^A-Za-z0-9_-]','_')) -replace '\s+','_'
        $respPath = Join-Path $TempDir ("resp-$safe.txt")
        $args = @(
            '-sS','-L','--fail-with-body',
            '-A',$UA,
            '-H','Accept-Language: ko-KR,ko;q=0.9,en;q=0.8',
            '-c',$CookiePath,'-b',$CookiePath,
            '-F','action=search_text_cards',
            '-F',("search_text=$artist"),
            '-F',("search_params=$searchParam"),
            "$Base/v2/ajax2_dev2",
            '-o',$respPath
        )
        & curl.exe @args
        $exit = $LASTEXITCODE
        if ($exit -ne 0) {
            $lines.Add("AJAXERR artist=$artist search_params=$searchParam curl=$exit")
            continue
        }
        $raw = [IO.File]::ReadAllText($respPath, [Text.Encoding]::UTF8)
        $one = ($raw -replace '\s+',' ').Trim()
        $preview = if ($one.Length -gt 900) { $one.Substring(0,900) } else { $one }
        $jsonOk = $false
        $type = ''
        $count = -1
        $keys = ''
        try {
            $obj = $raw | ConvertFrom-Json
            $jsonOk = $true
            if ($obj -is [System.Array]) {
                $type = 'array'
                $count = $obj.Count
                if ($obj.Count -gt 0) { $keys = (($obj[0].PSObject.Properties.Name) -join ',') }
            } else {
                $type = 'object'
                $keys = (($obj.PSObject.Properties.Name) -join ',')
                foreach ($candidate in @('data','result','results','list','cards','items')) {
                    $prop = $obj.PSObject.Properties[$candidate]
                    if ($null -ne $prop -and $prop.Value -is [System.Array]) { $count = $prop.Value.Count; break }
                }
            }
        } catch {}
        $lines.Add("AJAX artist=$artist search_params=$searchParam chars=$($raw.Length) json=$jsonOk type=$type count=$count keys=$keys preview=$preview")
    }
}

Write-Host '[3/4] Saving result...'
[IO.File]::WriteAllLines($OutPath, $lines, (New-Object Text.UTF8Encoding($false)))

Write-Host '[4/4] Uploading result to the GitHub work branch...'
$endpoint = "repos/$Repo/contents/tmp/pokemonkorea-ajax-probe.txt"
$existingSha = (& gh api --method GET $endpoint -f ref=$Branch --jq '.sha' 2>$null)
if ($LASTEXITCODE -ne 0) { $existingSha = '' }
$content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($OutPath))
$ghArgs = @('--method','PUT',$endpoint,'-f','message=Record local Pokemon Korea AJAX probe','-f',"branch=$Branch",'-f',"content=$content")
if ($existingSha) { $ghArgs += @('-f',"sha=$($existingSha.Trim())") }
& gh api @ghArgs | Out-Null
if ($LASTEXITCODE -ne 0) { throw "gh api upload failed with exit code $LASTEXITCODE" }

Write-Host ''
Write-Host 'DONE - AJAX probe uploaded.' -ForegroundColor Green
Write-Host 'Return to ChatGPT and say: AJAX probe done'
