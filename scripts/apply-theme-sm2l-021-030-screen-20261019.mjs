#!/usr/bin/env node
// SM2L 021-030: Korean-set names, numbers, print-file inventory, matching SM2L artwork.
// No 021-030 Korean-language physical card has had its printed front/number independently
// decoded in this batch. Artwork-theme curation != strict KR print validation.
import assert from "node:assert/strict";
import fs from "node:fs";
const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (p,v) => fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n");
const themesFile="data/art-themes.json";
const auditFile="data/audits/theme-sm2l-021-030-artwork-screen-20261019.json";
const testFile="tests/theme-card-identity.test.mjs";
const themes=read(themesFile);
const set=read("data/series.json").find(s=>String(s.code).toLowerCase()==="sm2l");
assert.equal(set?.cards?.length,62);
assert.equal(themes.groups?.length,12);
const groups=Object.fromEntries(themes.groups.map(g=>[g.code,g]));
const count=()=>themes.groups.reduce((sum,g)=>sum+g.cards.length,0);
const norm=v=>String(v||"").replace(/\s+/g,"").toLowerCase();
const rows=[
  {n:21,name:"타타륜",rarity:"R",scene:"수면 위 햇빛이 관통하는 청록빛 해저에서 녹이 슨 닻과 해초가 보이는 타타륜",
    tags:{color:"청록·파랑",season:"햇살이 비치는 맑은 푸른 바닷속"},
    art:"https://okini.land/en/52833-pokemon-tcg-sm2l-021-050-r-dhelmise-the-pokemon-company.html",
    koreanCardPage:"https://collectory.cc/cards/65878a7e-902c-4d0e-b6e6-30c58211b341"},
  {n:22,name:"카푸나비나 GX",rarity:"RR",scene:"분홍색 카푸나비나와 노랑·금색 섬광이 겹친 그래픽 카드",
    tags:{color:"분홍·주황"},
    art:"https://www.pokemon-card.com/card-search/details.php/card/33438/"},
  {n:23,name:"글라이거",rarity:"C",scene:"흰 구름이 뜬 맑은 푸른 하늘, 초록빛 나무가 있는 숲 위를 날아가는 자주색 글라이거",
    tags:{color:"자주·하늘",season:"푸른 하늘과 흰 구름 아래 펼쳐진 초록 숲"},
    art:"https://okini.land/en/52835-pokemon-tcg-sm2l-023-050-c-gligar-the-pokemon-company.html"},
  {n:24,name:"글라이온",rarity:"U",scene:"모래가 흩날리는 해안의 야자나무와 푸른 바다, 회청색 몸의 글라이온",
    tags:{color:"파랑·회색",season:"야자나무가 있는 푸른 해안 풍경"},
    art:"https://snkrdunk.com/en/trading-cards/336259"},
  {n:25,name:"판짱",rarity:"C",scene:"초록색 풀밭 위, 도형으로 표현된 밝은 푸른 하늘을 배경으로 뛰는 판짱",
    tags:{color:"초록·하늘",season:"푸른 하늘 아래 초록 풀밭"},
    art:"https://snkrdunk.com/apparels/336260"},
  {n:26,name:"암멍이",rarity:"C",scene:"밝은 푸른 하늘과 작은 야자나무가 보이는 황갈색 바위지형의 암멍이",
    tags:{color:"갈색·청록",season:"밝은 하늘 아래 바위지형과 열대 나무"},
    art:"https://www.pokemon-card.com/card-search/details.php/card/33442/"},
  {n:27,name:"루가루암 GX",rarity:"RR",scene:"회색·검정 루가루암이 붉은 번개형 타격 이펙트와 함께 돌진하는 그래픽 원화",
    tags:{color:"회색·검정"},
    art:"https://kream.co.kr/products/660154"},
  {n:28,name:"메테노",rarity:"R",scene:"남색 별빛과 다색 운석 파편 사이에 분홍빛으로 빛나는 메테노",
    tags:{color:"분홍·남색",night:"어두운 별하늘과 빛나는 유성의 장면"},
    art:"https://www.pokemon-card.com/card-search/details.php/card/33444/"},
  {n:29,name:"니로우",rarity:"C",scene:"이끼 낀 나무 그루터기 속 다채로운 버섯과 작은 초록 식물에 앉은 남색 니로우",
    tags:{color:"남색·주황",season:"버섯과 이끼가 자라는 숲의 나무 그루터기"},
    art:"https://torecacamp-pokemon.com/products/rc_itd971qca3zs_4kcv"},
  {n:30,name:"돈크로우",rarity:"U",scene:"보랏빛 붉은 보름달 아래 날개를 펼친 돈크로우와 검은 새 실루엣들",
    tags:{color:"자주·검정",night:"붉은 보름달 아래 검은 새들이 나는 밤하늘"},
    art:"https://snkrdunk.com/apparels/336265"}
];
const allPrevious=Array.from({length:20},(_,i)=>"SM2L_"+String(i+1).padStart(3,"0"));
const current=rows.map(c=>"SM2L_"+String(c.n).padStart(3,"0"));
const deltas=Object.fromEntries(themes.groups.map(g=>[g.code,0]));
for(const row of rows)for(const k of Object.keys(row.tags))deltas[k]++;
assert.equal(rows.length,10);
assert.equal(rows.reduce((n,r)=>n+Object.keys(r.tags).length,0),18);
assert.equal(deltas.color,10);
assert.equal(deltas.season,6);
assert.equal(deltas.night,2);
const existing=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set).toLowerCase()==="sm2l").map(c=>({code:c.code,theme:g.code})));
const existingCodes=[...new Set(existing.map(r=>r.code))].sort();
if(fs.existsSync(auditFile)){
  assert.equal(count(),17962);
  assert.deepEqual(existingCodes,[...allPrevious,...current].sort());
  console.log("SM2L 021-030 already applied; skip");
  process.exit(0);
}
assert.equal(count(),17944,"Previous global theme count changed; refuse concurrent overwrite");
assert.deepEqual(existingCodes,allPrevious.sort(),"Previous SM2L 001-020 record drift; stop");
const before=Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length]));
const originalRows=JSON.stringify(existing);
const inserted=[];
for(const row of rows){
  const num=String(row.n).padStart(3,"0"), code="SM2L_"+num;
  const canon=set.cards.find(c=>String(c.code).toUpperCase()===code+"/050");
  assert.ok(canon,"Missing KR canonical "+code);
  assert.equal(norm(canon.name),norm(row.name),code+" Korean printed identity mismatch");
  assert.match(canon.image,new RegExp("/SM2L/SM2L_"+num+"\\.png$"),code+" canonical art path mismatch");
  for(const [group,category] of Object.entries(row.tags)){
    const target=groups[group];
    assert.ok(target,"Theme unavailable "+group);
    assert.ok(!target.cards.some(c=>c.code===code),"Already present "+code+" "+group);
    target.cards.push({
      code, name:canon.name, series:"SM", set:set.code, setName:set.displayName,
      cardNumber:num+"/050",rarity:row.rarity,category,image:canon.image,
      evidence:"한국 발매 세트 SM2L "+num+"/050의 국내 수록 카드명·번호와 한국판 파일 인덱스 확인. 일본 SM2L 동번호 원화 "+
         "이미지에서 색채·장면만 시각 검수; 한국어 인쇄 실물 카드의 하단 번호·이미지는 별도 확대 검증 전이므로 보류. "+
         row.scene+". 테마별 문맥이 불명확한 진화·연결·스토리 추측 삽입 없음. "+auditFile
    });
    inserted.push({code,theme:group,category});
  }
}
assert.equal(count(),17962);
assert.equal(inserted.length,18);
for(const g of themes.groups)assert.equal(g.cards.length,before[g.code]+deltas[g.code],g.code+" unexpected changes");
assert.equal(JSON.stringify(existing),originalRows);
const identity=fs.readFileSync(testFile,"utf8");
const old="assert.equal(total,17944); // SM2L 011-020: 1 Korean photographed, 9 matched-art screened";
assert.equal(identity.split(old).length,2,"Missing previous theme test count assertion");
const next=identity.replace(old,
  "assert.equal(total,17962); // SM2L 021-030: Korean names matched, artwork screened, print-photo holds");
const audit={
  schemaVersion:1,recordedAt:"2026-10-19",series:set.code,setName:set.displayName,
  previousCheckpoint:"data/audits/theme-sm2l-011-020-artwork-screen-20261019.json",
  scope:"Korean set 021-030 checked by domestic set lists; identical Japanese SM2L artwork observed. Korean printed card bottom number is not decoded.",
  dataGrade:"cross_language_artwork_screened_ko_catalogued_ko_print_pending",
  batchCodes:current,batchCardCount:10,themeRowsAdded:18,inserted,
  themeChangesByCategory:deltas,oldThemeTotal:17944,newThemeTotal:17962,
  artworkScreenedCumulative:30,unreviewedArtworkCountInSet:32,
  exactKoreanPhotoConfirmedPreviously:7,exactKoreanPhotoConfirmedThisBatch:0,
  exactKoreanPhotoConfirmedCumulative:7,
  koreanPrintPhotoPendingThisBatch:current,
  priorKoreanPrintPhotoHolds:13,totalKoreanPrintPhotoHolds:23,
  nextArtworkRange:"SM2L_031..040",
  knownCrossCatalogueAnomaly:"Some Japanese aggregators mislabeled SM2L 016; not part of this batch; original Korean master identity unchanged.",
  references:{
    koreanSet:"https://setory.site/sets/sm-alola-moonlight-kr",
    koreanCards:"https://collectory.cc/sets/4e36398c-b9e0-45b4-abf8-f8aa2fb62e82?region=us&sort=rarity_desc&type=POKEMON",
    koreanImageFileInventory:"https://k-tcgpanda.com/cardimg/SM/SM2L/",
    officialJapaneseCardList:"https://www.pokemon-card.com/card-search/",
    matchingJapaneseArtEvidence:rows.map(c=>({code:"SM2L_"+String(c.n).padStart(3,"0"),url:c.art}))
  },
  cardDetails:rows.map(c=>({code:"SM2L_"+String(c.n).padStart(3,"0"),name:c.name,printedNumber:String(c.n).padStart(3,"0")+"/050",rarity:c.rarity,scene:c.scene,tags:c.tags,artEvidence:c.art,
    koreanCatalogueChecked:true,krPrintedPhotoDecoded:false,
    sourceKoreanPrintedListing:c.koreanCardPage||null})),
  safeguards:{existingThemesAltered:0,masterCardsChanged:0,firestoreAndOwnershipChanged:0,imageFilesChanged:0,guessworkEvolutionOrConnectionAdded:0},
  before,after:Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length]))
};
themes.updatedAt="2026-10-19";
write(themesFile,themes);
write(auditFile,audit);
fs.writeFileSync(testFile,next);
console.log("SM2L_021_030_SCREEN",JSON.stringify({new:10,themeRows:18,allThemeRows:count(),screenedCumulative:30,remaining:32,koPrintHolds:23}));
