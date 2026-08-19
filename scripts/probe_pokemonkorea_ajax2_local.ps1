$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$Base = 'https://pokemoncard.co.kr'
$TempDir = Join-Path $env:TEMP 'pokemoncard-artist-probe3'
$HtmlPath = Join-Path $TempDir 'cards.html'
$CookiePath = Join-Path $TempDir 'cookies.txt'
$OutPath = Join-Path $TempDir 'pokemonkorea-ajax2-probe.txt'
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

Write-Host '[1/4] Downloading card-search page...'
& curl.exe -sS -L --fail-with-body -A $UA -H 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8' -c $CookiePath -b $CookiePath "$Base/cards" -o $HtmlPath
if ($LASTEXITCODE -ne 0) { throw "page download failed" }
$html = [IO.File]::ReadAllText($HtmlPath, [Text.Encoding]::UTF8)
$lines = New-Object System.Collections.Generic.List[string]

Write-Host '[2/4] Extracting official search JavaScript...'
$start = $html.IndexOf('function search_text(status)')
$end = if ($start -ge 0) { $html.IndexOf('function search_keyword()', $start) } else { -1 }
if ($start -ge 0) {
    if ($end -lt 0) { $end = [Math]::Min($html.Length, $start + 12000) }
    $snippet = $html.Substring($start, $end - $start)
    $lines.Add('=== SEARCH_FUNCTIONS ===')
    $lines.Add($snippet)
} else {
    $lines.Add('SEARCH_FUNCTION_NOT_FOUND')
}

$select = [regex]::Match($html, '<select[^>]+name=["'']search_params["''][^>]*>([\s\S]*?)</select>', 'IgnoreCase').Groups[1].Value
foreach ($m in [regex]::Matches($select, '<option[^>]*value=["'']([^"'']*)["''][^>]*>([\s\S]*?)</option>', 'IgnoreCase')) {
    $value = $m.Groups[1].Value
    $label = (($m.Groups[2].Value -replace '<[^>]+>', '') -replace '\s+', ' ').Trim()
    $lines.Add("OPTION value=$value label=$label")
}

Write-Host '[3/4] Testing AJAX with browser headers...'
foreach ($artist in @('OKACHEKE','Narumi Sato')) {
    foreach ($searchParam in @('all','cardname','cardtext')) {
        $resp = Join-Path $TempDir ("resp-$($artist -replace '\s+','_')-$searchParam.txt")
        $args = @(
            '-sS','-L','--fail-with-body','--compressed',
            '-A',$UA,
            '-H','Accept-Language: ko-KR,ko;q=0.9,en;q=0.8',
            '-H','Accept: application/json, text/javascript, */*; q=0.01',
            '-H','X-Requested-With: XMLHttpRequest',
            '-H',"Referer: $Base/cards",
            '-H',"Origin: $Base",
            '-c',$CookiePath,'-b',$CookiePath,
            '-F','action=search_text_cards',
            '-F',("search_text=$artist"),
            '-F',("search_params=$searchParam"),
            "$Base/v2/ajax2_dev2",
            '-o',$resp
        )
        & curl.exe @args
        if ($LASTEXITCODE -ne 0) {
            $lines.Add("AJAXERR artist=$artist param=$searchParam exit=$LASTEXITCODE")
            continue
        }
        $raw = [IO.File]::ReadAllText($resp, [Text.Encoding]::UTF8)
        $compact = ($raw -replace '\s+',' ').Trim()
        $preview = if ($compact.Length -gt 6000) { $compact.Substring(0,6000) } else { $compact }
        $json = $false; $type=''; $count=-1; $keys=''
        try {
            $obj = $raw | ConvertFrom-Json
            $json = $true
            if ($obj -is [System.Array]) {
                $type='array'; $count=$obj.Count
                if ($obj.Count -gt 0) { $keys=(($obj[0].PSObject.Properties.Name)-join ',') }
            } else {
                $type='object'; $keys=(($obj.PSObject.Properties.Name)-join ',')
                foreach ($candidate in @('data','result','results','list','cards','items')) {
                    $p=$obj.PSObject.Properties[$candidate]
                    if ($null -ne $p -and $p.Value -is [System.Array]) { $count=$p.Value.Count; break }
                }
            }
        } catch {}
        $lines.Add("=== AJAX artist=$artist param=$searchParam chars=$($raw.Length) json=$json type=$type count=$count keys=$keys ===")
        $lines.Add($preview)
    }
}

[IO.File]::WriteAllLines($OutPath, $lines, (New-Object Text.UTF8Encoding($false)))

Write-Host '[4/4] Uploading result...'
$content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($OutPath))
& gh api --method PUT "repos/$Repo/contents/tmp/pokemonkorea-ajax2-probe.txt" -f 'message=Record local Pokemon Korea AJAX2 probe' -f "branch=$Branch" -f "content=$content" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "upload failed" }

Write-Host ''
Write-Host 'DONE - AJAX2 probe uploaded.' -ForegroundColor Green
Write-Host 'Return to ChatGPT and say: AJAX2 done'
