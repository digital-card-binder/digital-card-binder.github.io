$ErrorActionPreference = 'Stop'

$Repo = 'digital-card-binder/digital-card-binder.github.io'
$Branch = 'agent/rebuild-artist-dex-official-20260819'
$WorkDir = Join-Path $env:TEMP 'pokemoncard-official-artist-rebuild'
$CandidatesPath = Join-Path $WorkDir 'official-artist-candidates.json'
$AuditPath = Join-Path $WorkDir 'official-artist-rebuild-audit.json'
$CachePath = Join-Path $WorkDir 'detail-cache.json'
$OutPath = Join-Path $WorkDir 'official-artist-dedupe-v11.json'

Add-Type -AssemblyName System.Web.Extensions
$Ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$Ser.MaxJsonLength = 268435456
$Ser.RecursionLimit = 300

function Read-Json([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "Missing local file: $Path" }
  return $Ser.DeserializeObject([IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8))
}
function Field($Obj,[string]$Name) {
  if ($null -eq $Obj) { return $null }
  if ($Obj -is [System.Collections.IDictionary]) { return $Obj[$Name] }
  return $Obj.$Name
}
function Norm-Artist([string]$v) {
  $x=(($v -replace '\s+',' ').Trim()).ToLowerInvariant()
  if($x.EndsWith('.')){$x=$x.Substring(0,$x.Length-1).TrimEnd()}
  return $x
}
function Clean-Id([string]$v){ return (($v -replace '\s','').Trim()) }
function Canon-Id([string]$v){ $x=Clean-Id $v; if($x -match '^(.*\d)m$'){return $Matches[1]}; return $x }
function Norm-Text([string]$v){ return (($v -replace '\s+',' ').Trim()).ToLowerInvariant() }
function Norm-ImageExact([string]$v){ return ((($v -split '\?')[0]).Trim()).ToLowerInvariant() }
function Norm-ImageMirror([string]$v){
  $x=Norm-ImageExact $v
  $x=[regex]::Replace($x,'_m(?=\.[a-z0-9]+$)','', 'IgnoreCase')
  return $x
}
function Make-Row([string]$artist,[string]$id,$d) {
  $clean=Clean-Id $id
  $set=[string](Field $d 'set'); $rarity=[string](Field $d 'rarity')
  $printed=[string](Field $d 'printedNumber'); $card=[string](Field $d 'cardNumber')
  if(-not $printed){
    $digits=''; if($clean -match '(\d{3})$'){$digits=$Matches[1]} elseif($clean -match '(\d+)$'){$digits=$Matches[1]}
    if($digits -and $set){$printed="$digits/$set"} elseif($digits){$printed=$digits}
    $card=if($rarity){"$printed $rarity"}else{$printed}
  }
  return [pscustomobject]@{
    artist=$artist; id=$clean; canonical=Canon-Id $clean;
    name=[string](Field $d 'name'); set=$set; rarity=$rarity;
    printed=$printed; cardNumber=$card; image=[string](Field $d 'image')
  }
}
function Find-Detail($cache,[string]$id){
  $clean=Clean-Id $id
  if($cache.ContainsKey($clean)){return $cache[$clean]}
  $canon=Canon-Id $clean
  if($cache.ContainsKey($canon)){return $cache[$canon]}
  if($cache.ContainsKey($canon+'m')){return $cache[$canon+'m']}
  return $null
}
function Unique-Count($rows,[scriptblock]$keyFn){
  $h=@{}
  foreach($r in $rows){ $k=& $keyFn $r; if(-not $h.ContainsKey($k)){$h[$k]=$true} }
  return $h.Count
}
function Duplicate-Groups($rows,[scriptblock]$keyFn,[int]$limit=40){
  $g=@{}
  foreach($r in $rows){
    $k=& $keyFn $r
    if(-not $g.ContainsKey($k)){$g[$k]=New-Object System.Collections.Generic.List[object]}
    $g[$k].Add($r)
  }
  $out=New-Object System.Collections.Generic.List[object]
  foreach($k in $g.Keys){
    if($g[$k].Count -gt 1){
      $items=@($g[$k].ToArray() | ForEach-Object {[ordered]@{artist=$_.artist;id=$_.id;name=$_.name;set=$_.set;cardNumber=$_.cardNumber;image=$_.image}})
      $out.Add([ordered]@{key=$k;count=$items.Count;items=$items})
    }
  }
  return @($out.ToArray() | Sort-Object count -Descending | Select-Object -First $limit)
}

$candidates=Read-Json $CandidatesPath
$audit=Read-Json $AuditPath
$cache=Read-Json $CachePath
$rows=New-Object System.Collections.Generic.List[object]
$excluded=0
$promoted=0
$recovered=0

foreach($r in (Field $candidates 'exact')){
  $id=[string](Field $r 'internalCardNum')
  $d=Find-Detail $cache $id
  if($null -eq $d){throw "Missing exact cache: $id"}
  $rows.Add((Make-Row ([string](Field $r 'artist')) $id $d))
}
foreach($p in (Field $candidates 'partial')){
  $artist=[string](Field $p 'artist'); $actual=[string](Field $p 'actualIllustrator'); $id=[string](Field $p 'internalCardNum')
  if((Norm-Artist $artist) -eq (Norm-Artist $actual)){
    $d=Find-Detail $cache $id; if($null -eq $d){throw "Missing promoted cache: $id"}
    $rows.Add((Make-Row $artist $id $d)); $promoted++
  } else {$excluded++}
}
foreach($u in (Field $audit 'unprocessedRows')){
  $artist=[string](Field $u 'artist'); $id=[string](Field $u 'internalCardNum')
  $d=Find-Detail $cache $id; if($null -eq $d){throw "Missing recovered cache: $artist / $id"}
  if((Norm-Artist $artist) -ne (Norm-Artist ([string](Field $d 'illustrator')))){throw "Recovered artist mismatch: $artist / $id / $([string](Field $d 'illustrator'))"}
  $rows.Add((Make-Row $artist $id $d)); $recovered++
}
$all=$rows.ToArray()

$keyCanonical={param($r) (Norm-Artist $r.artist)+'|'+$r.canonical.ToLowerInvariant()}
$keyImageExact={param($r) (Norm-Artist $r.artist)+'|'+(Norm-ImageExact $r.image)}
$keyImageMirror={param($r) (Norm-Artist $r.artist)+'|'+(Norm-ImageMirror $r.image)}
$keySetCard={param($r) (Norm-Artist $r.artist)+'|'+(Norm-Text $r.set)+'|'+(Norm-Text $r.cardNumber)}
$keySetCardName={param($r) (Norm-Artist $r.artist)+'|'+(Norm-Text $r.set)+'|'+(Norm-Text $r.cardNumber)+'|'+(Norm-Text $r.name)}
$keySetPrintedNameRarity={param($r) (Norm-Artist $r.artist)+'|'+(Norm-Text $r.set)+'|'+(Norm-Text $r.printed)+'|'+(Norm-Text $r.name)+'|'+(Norm-Text $r.rarity)}
$keyNameCard={param($r) (Norm-Artist $r.artist)+'|'+(Norm-Text $r.name)+'|'+(Norm-Text $r.cardNumber)}

$counts=[ordered]@{
  raw=$all.Count
  canonicalInternal=(Unique-Count $all $keyCanonical)
  exactImage=(Unique-Count $all $keyImageExact)
  mirrorNormalizedImage=(Unique-Count $all $keyImageMirror)
  setCardNumber=(Unique-Count $all $keySetCard)
  setCardNumberName=(Unique-Count $all $keySetCardName)
  setPrintedNameRarity=(Unique-Count $all $keySetPrintedNameRarity)
  nameCardNumber=(Unique-Count $all $keyNameCard)
}

$out=[ordered]@{
  search=[int](Field $audit 'officialSearchResults')
  promotedPunctuation=$promoted
  excluded=$excluded
  recovered=$recovered
  counts=$counts
  target=2448
  mirrorImageDuplicateSamples=(Duplicate-Groups $all $keyImageMirror 60)
  canonicalDuplicateSamples=(Duplicate-Groups $all $keyCanonical 20)
  setCardNameDuplicateSamples=(Duplicate-Groups $all $keySetCardName 30)
}
[IO.File]::WriteAllText($OutPath,($out|ConvertTo-Json -Depth 12),(New-Object Text.UTF8Encoding($false)))

Write-Host '[v11] Dedupe comparison:' -ForegroundColor Cyan
$counts.GetEnumerator() | ForEach-Object { Write-Host ("  {0,-24} {1}" -f $_.Key,$_.Value) }

$payload=[ordered]@{message='Upload artist dedupe diagnostic v11';branch=$Branch;content=[Convert]::ToBase64String([IO.File]::ReadAllBytes($OutPath))}
$payloadPath=Join-Path $WorkDir 'v11-upload.json'
[IO.File]::WriteAllText($payloadPath,($payload|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
& gh api --method PUT "repos/$Repo/contents/tmp/official-artist-dedupe-v11.json" --input $payloadPath | Out-Null
if($LASTEXITCODE -ne 0){throw 'v11 diagnostic upload failed'}
Write-Host 'DONE - v11 dedupe diagnostic uploaded.' -ForegroundColor Green
Write-Host 'Return to ChatGPT and say: v11 done'
