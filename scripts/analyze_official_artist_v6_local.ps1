$ErrorActionPreference = 'Stop'

$Repo='digital-card-binder/digital-card-binder.github.io'
$Branch='agent/rebuild-artist-dex-official-20260819'
$Base='https://pokemoncard.co.kr'
$WorkDir=Join-Path $env:TEMP 'pokemoncard-official-artist-rebuild'
$CachePath=Join-Path $WorkDir 'detail-cache.json'
$OutPath=Join-Path $WorkDir 'official-artist-v6-diagnostic.json'
$CookiePath=Join-Path $WorkDir 'official-v6-cookies.txt'
$UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
$Artists=@('Narumi Sato','OKACHEKE','Shinji Kanda','Asako Ito','Gapao','Yukihiro Tada','Tetsu Kayama','Jerky','Pani kobayashi','Ounishi','Sachiko Adachi','Yuka Morii','Tomokazu Komiya','AKIRA EGAWA','OOYAMA','HYOGONOSUKE','miki kudo','Miki Tanaka','sui','Atsuko Nishida','Aya Kusube','Shibuzoh','Saya Tsuruta','ryoma uratsuka','Tika Matsuno','sowsow','Yukiko Baba','Sekio','Naoyo Kimura')

function Norm([string]$s){ (($s -replace '\s+',' ').Trim()).ToLowerInvariant() }
function Canon([string]$s){ $v=($s -replace '\s',''); if($v -match '^(.*\d)m$'){return $Matches[1]}; return $v }

if(-not (Test-Path $CachePath)){ throw "Missing cache: $CachePath" }
$cacheObj=Get-Content -Raw -LiteralPath $CachePath | ConvertFrom-Json
$cache=@{}
foreach($p in $cacheObj.PSObject.Properties){$cache[$p.Name]=$p.Value}

# Prime the same official browser session used by the successful AJAX2 probe.
$prime=Join-Path $WorkDir 'v6-prime.html'
& curl.exe -sS -L --fail-with-body --compressed -A $UA -H 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8' -c $CookiePath -b $CookiePath "$Base/cards" -o $prime
if($LASTEXITCODE -ne 0){throw 'Could not prime official session'}

function SearchArtist([string]$artist){
  $rows=New-Object System.Collections.Generic.List[object]
  $limit=0
  while($true){
    $resp=Join-Path $WorkDir ('v6-'+[Guid]::NewGuid().ToString('N')+'.txt')
    $args=@('-sS','-L','--fail-with-body','--compressed','-A',$UA,'-H','Accept-Language: ko-KR,ko;q=0.9,en;q=0.8','-H','Accept: application/json, text/javascript, */*; q=0.01','-H','X-Requested-With: XMLHttpRequest','-H',"Referer: $Base/cards",'-H',"Origin: $Base",'-c',$CookiePath,'-b',$CookiePath,'-F','action=search_text_cards','-F',("search_text=$artist"))
    if($limit -eq 0){$args+=@('-F','search_params=all')}else{$args+=@('-F',("limit=$limit"))}
    $args+=@("$Base/v2/ajax2_dev2",'-o',$resp)
    try{ & curl.exe @args; if($LASTEXITCODE -ne 0){throw "AJAX failed: $artist limit=$limit"}; $raw=[IO.File]::ReadAllText($resp,[Text.Encoding]::UTF8) } finally {Remove-Item $resp -Force -ErrorAction SilentlyContinue}
    $i=$raw.IndexOf('{'); if($i -lt 0){throw "No JSON: $artist limit=$limit"}
    Add-Type -AssemblyName System.Web.Extensions
    $ser=New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $ser.MaxJsonLength=67108864
    $obj=$ser.DeserializeObject($raw.Substring($i))
    $count=[int]$obj['count']; if($count -le 0){break}
    $result=$obj['result']
    if($result -is [System.Collections.IDictionary]){foreach($k in $result.Keys){$v=$result[$k];$rows.Add([pscustomobject]@{artist=$artist;id=([string]$v['CardNum']).Trim();image=[string]$v['feature_image']})}}
    else{foreach($v in $result){$rows.Add([pscustomobject]@{artist=$artist;id=([string]$v['CardNum']).Trim();image=[string]$v['feature_image']})}}
    $next=[int]$obj['limit']; if($next -eq $limit){throw "Pagination loop: $artist $limit"}; $limit=$next
  }
  return $rows.ToArray()
}

$all=New-Object System.Collections.Generic.List[object]
foreach($a in $Artists){$r=@(SearchArtist $a);foreach($x in $r){$all.Add($x)}}

$strict=New-Object System.Collections.Generic.List[object]
$partial=New-Object System.Collections.Generic.List[object]
$unprocessed=New-Object System.Collections.Generic.List[object]
$containsQuery=New-Object System.Collections.Generic.List[object]
foreach($c in $all){
  $id=$c.id
  $lookup=$id
  if(-not $cache.ContainsKey($lookup)){
    $noSpace=$id -replace '\s',''
    if($cache.ContainsKey($noSpace)){$lookup=$noSpace}
  }
  if(-not $cache.ContainsKey($lookup)){$unprocessed.Add([pscustomobject]@{artist=$c.artist;id=$id;reason='cache_missing';hasWhitespace=($id -match '\s')});continue}
  $d=$cache[$lookup]
  if(-not $d.illustrator -or -not $d.name -or -not $d.printedNumber){$unprocessed.Add([pscustomobject]@{artist=$c.artist;id=$id;lookup=$lookup;reason='cache_parse_incomplete';illustrator=$d.illustrator;name=$d.name;printed=$d.printedNumber;hasWhitespace=($id -match '\s')});continue}
  $qa=Norm $c.artist; $ia=Norm ([string]$d.illustrator)
  $row=[pscustomobject]@{artist=$c.artist;id=$id;lookup=$lookup;actualIllustrator=[string]$d.illustrator;name=[string]$d.name;printedNumber=[string]$d.printedNumber;canonical=(Canon $id)}
  if($qa -eq $ia){$strict.Add($row)}else{$partial.Add($row);if($ia.Contains($qa)){$containsQuery.Add($row)}}
}

$pairs=@($partial.ToArray() | Group-Object { $_.artist+' => '+$_.actualIllustrator } | Sort-Object Count -Descending | ForEach-Object {[pscustomobject]@{pair=$_.Name;count=$_.Count}})
$containsPairs=@($containsQuery.ToArray() | Group-Object { $_.artist+' => '+$_.actualIllustrator } | Sort-Object Count -Descending | ForEach-Object {[pscustomobject]@{pair=$_.Name;count=$_.Count}})
$strictFinal=@($strict.ToArray() | Group-Object { (Norm $_.artist)+'|'+$_.canonical.ToLowerInvariant() }).Count
$loose=$strict.Count+$containsQuery.Count
$looseRows=@($strict.ToArray())+@($containsQuery.ToArray())
$looseFinal=@($looseRows | Group-Object { (Norm $_.artist)+'|'+$_.canonical.ToLowerInvariant() }).Count

$out=[ordered]@{
  searchCount=$all.Count
  strictExact=$strict.Count
  strictPartial=$partial.Count
  unprocessed=$unprocessed.Count
  substringPartialCount=$containsQuery.Count
  strictFinal=$strictFinal
  substringFinal=$looseFinal
  substringExact=$loose
  remainingPartialAfterSubstring=($partial.Count-$containsQuery.Count)
  partialPairs=$pairs
  substringPairs=$containsPairs
  unprocessedRows=@($unprocessed.ToArray())
}
[IO.File]::WriteAllText($OutPath,($out|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))

# New filename: no preliminary GET, so no harmless 404 becomes a terminating error.
$payload=[ordered]@{message='Upload artist v6 diagnostic';branch=$Branch;content=[Convert]::ToBase64String([IO.File]::ReadAllBytes($OutPath))}
$payloadPath=Join-Path $WorkDir 'v6-upload.json'
[IO.File]::WriteAllText($payloadPath,($payload|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
& gh api --method PUT "repos/$Repo/contents/tmp/official-artist-v6-diagnostic.json" --input $payloadPath | Out-Null
if($LASTEXITCODE -ne 0){throw 'GitHub diagnostic upload failed'}
Write-Host 'DONE - v6 diagnostic uploaded.' -ForegroundColor Green
Write-Host 'Return to ChatGPT and say: v6 done'
