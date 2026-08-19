$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$Base = 'https://pokemoncard.co.kr'
$TempDir = Join-Path $env:TEMP 'pokemoncard-artist-probe'
$HtmlPath = Join-Path $TempDir 'cards.html'
$CookiePath = Join-Path $TempDir 'cookies.txt'
$OutPath = Join-Path $TempDir 'pokemonkorea-local-probe.txt'
$PayloadPath = Join-Path $TempDir 'payload.json'
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

Write-Host '[1/4] Downloading Pokemon Korea card-search page...'
& curl.exe -sS -L --fail-with-body -A $UA -H 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8' -c $CookiePath -b $CookiePath "$Base/cards" -o $HtmlPath
if ($LASTEXITCODE -ne 0) { throw "curl failed with exit code $LASTEXITCODE" }

$html = [IO.File]::ReadAllText($HtmlPath, [Text.Encoding]::UTF8)
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("HTML_CHARS $($html.Length)")
$title = [regex]::Match($html, '<title[^>]*>([\s\S]*?)</title>', 'IgnoreCase').Groups[1].Value -replace '\s+', ' '
$lines.Add("TITLE $title")

$lines.Add('FORMS')
$formMatches = [regex]::Matches($html, '<form\b[\s\S]*?</form>', 'IgnoreCase')
foreach ($fm in $formMatches) {
    $form = $fm.Value
    $action = [regex]::Match($form, 'action=["'']([^"'']*)', 'IgnoreCase').Groups[1].Value
    $method = [regex]::Match($form, 'method=["'']([^"'']*)', 'IgnoreCase').Groups[1].Value
    $names = [regex]::Matches($form, 'name=["'']([^"'']+)', 'IgnoreCase') | ForEach-Object { $_.Groups[1].Value }
    $lines.Add("action=$action method=$method names=$($names -join ',')")
}

$scriptUrls = New-Object System.Collections.Generic.List[string]
foreach ($m in [regex]::Matches($html, '<script[^>]+src=["'']([^"'']+)', 'IgnoreCase')) {
    $src = $m.Groups[1].Value
    if ($src.StartsWith('//')) { $src = 'https:' + $src }
    elseif ($src.StartsWith('/')) { $src = $Base + $src }
    elseif (-not ($src -match '^https?://')) { $src = "$Base/$($src.TrimStart('/'))" }
    if (-not $scriptUrls.Contains($src)) { $scriptUrls.Add($src) }
}
$lines.Add('SCRIPTS')
foreach ($u in $scriptUrls) { $lines.Add($u) }

$lines.Add('HTML_INTERESTING')
foreach ($line in ($html -split "`n")) {
    $low = $line.ToLowerInvariant()
    if ($low.Contains('ajax') -or $low.Contains('axios') -or $low.Contains('fetch(') -or $low.Contains('/cards') -or $low.Contains('search') -or $low.Contains('loadmore') -or $low.Contains('load-more')) {
        $clean = ($line -replace '\s+', ' ').Trim()
        if ($clean.Length -gt 0 -and $clean.Length -lt 1800) { $lines.Add($clean) }
    }
}

Write-Host '[2/4] Inspecting local JavaScript referenced by the page...'
$index = 0
foreach ($u in $scriptUrls) {
    if (-not $u.StartsWith($Base)) { continue }
    $index++
    $jsPath = Join-Path $TempDir ("script-$index.js")
    try {
        & curl.exe -sS -L --fail-with-body -A $UA -H 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8' -c $CookiePath -b $CookiePath $u -o $jsPath
        if ($LASTEXITCODE -ne 0) { continue }
        $js = [IO.File]::ReadAllText($jsPath, [Text.Encoding]::UTF8)
        $hits = New-Object System.Collections.Generic.List[string]
        foreach ($line in ($js -split "`n")) {
            $low = $line.ToLowerInvariant()
            if ($low.Contains('ajax') -or $low.Contains('axios') -or $low.Contains('fetch(') -or $low.Contains('/cards') -or $low.Contains('search') -or $low.Contains('loadmore') -or $low.Contains('load-more') -or $low.Contains('cardlist') -or $low.Contains('card-list')) {
                $clean = ($line -replace '\s+', ' ').Trim()
                if ($clean.Length -gt 0 -and $clean.Length -lt 2400) { $hits.Add($clean) }
            }
        }
        if ($hits.Count -gt 0) {
            $lines.Add("JS $u")
            foreach ($hit in ($hits | Select-Object -First 150)) { $lines.Add($hit) }
        }
    } catch {
        $lines.Add("JSERR $u $($_.Exception.Message)")
    }
}

Write-Host '[3/4] Testing likely artist-search parameters...'
foreach ($artist in @('OKACHEKE','Narumi Sato')) {
    foreach ($param in @('s','keyword','q','search','searchWord','word','searchKeyword','cardName','illustrator')) {
        $encodedArtist = [uri]::EscapeDataString($artist)
        $testUrl = "$Base/cards?$param=$encodedArtist"
        $testPath = Join-Path $TempDir 'query.html'
        try {
            & curl.exe -sS -L --fail-with-body -A $UA -H 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8' -c $CookiePath -b $CookiePath $testUrl -o $testPath
            if ($LASTEXITCODE -ne 0) { continue }
            $body = [IO.File]::ReadAllText($testPath, [Text.Encoding]::UTF8)
            $detailMatches = [regex]::Matches($body, '/cards/(?:detail/)?[A-Za-z0-9_-]+', 'IgnoreCase') | ForEach-Object { $_.Value } | Sort-Object -Unique
            $hasArtist = $body.IndexOf($artist, [StringComparison]::OrdinalIgnoreCase) -ge 0
            $lines.Add("QUERY param=$param artist=$artist chars=$($body.Length) detailLike=$($detailMatches.Count) containsArtist=$hasArtist sample=$(($detailMatches | Select-Object -First 5) -join ',')")
        } catch {
            $lines.Add("QUERYERR param=$param artist=$artist $($_.Exception.Message)")
        }
    }
}

[IO.File]::WriteAllLines($OutPath, $lines, (New-Object Text.UTF8Encoding($false)))

Write-Host '[4/4] Uploading diagnostic result to the GitHub work branch...'
$endpoint = "repos/$Repo/contents/tmp/pokemonkorea-local-probe.txt"
$existingSha = ''
try {
    $existingSha = (& gh api --method GET $endpoint -f ref=$Branch --jq '.sha' 2>$null).Trim()
} catch { $existingSha = '' }
$payload = [ordered]@{
    message = 'Record local Pokemon Korea search probe'
    branch = $Branch
    content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($OutPath))
}
if ($existingSha) { $payload.sha = $existingSha }
$payload | ConvertTo-Json -Compress | Set-Content -LiteralPath $PayloadPath -Encoding UTF8
& gh api --method PUT $endpoint --input $PayloadPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "gh api upload failed with exit code $LASTEXITCODE" }

Write-Host ''
Write-Host 'DONE - local probe uploaded to the work branch.' -ForegroundColor Green
Write-Host 'You can return to ChatGPT and say: 실행했어'
