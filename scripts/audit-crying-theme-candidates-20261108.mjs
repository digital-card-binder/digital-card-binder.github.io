import fs from "node:fs";
const root=new URL("../",import.meta.url);
const read=(p)=>JSON.parse(fs.readFileSync(new URL(p,root),"utf8"));
const write=(p,v)=>fs.writeFileSync(new URL(p,root),JSON.stringify(v,null,2)+"\n");
const all=[...read("data/series.json"),...read("data/series-legacy.json")];
const ref=read("data/audits/crying-theme-reference-pool-20261108.json").sources;
const existing=read("data/art-themes-crying.json").group.cards;
const ko={
"Sandygast":"모래꿍","Drowzee":"슬리프","Mabosstiff":"마피티프",
"Hisuian Goodra":"히스이 미끄래곤","Hisuian Goodra V":"히스이 미끄래곤 V","Hisuian Goodra VSTAR":"히스이 미끄래곤 VSTAR",
"Pikachu":"피카츄","Sobble":"울머기","Mimikyu":"따라큐","Lombre":"로토스","Wooper":"우파",
"Psyduck":"고라파덕","Smoliv":"미니브","Litten":"냐오불","Wishiwashi":"약어리",
"Cubone":"탕구리","Rockruff":"암멍이","Trubbish":"깨봉이","Elgyem":"리그레",
"Natu":"네이티","Bonsly":"꼬지지","Electabuzz":"에레브","Smoochum δ":"뽀뽀라",
"Smoochum":"뽀뽀라","Omanyte":"암나이트","Ledyba":"레디바","Recycle":"리사이클",
"Misty's Tears":"이슬의 눈물","Froslass":"눈여아","Castaway":"표류자","Feebas":"빈티나",
"Persian":"페르시온","Zoroark":"조로아크","Team Rocket's Weezing":"로켓단의 또도가스",
"Cynthia's Roserade":"난천의 로즈레이드","Flabébé":"플라베베","Chatot":"페라페",
"Piloswine":"메꾸리","Spikemuth":"스파이크마을","Ralts":"랄토스","Litwick":"불켜미",
"Houndstone":"묘두기","Beldum":"메탕","Gloom":"냄새꼬","Cottonee":"소미안",
"Drifblim":"둥실라이드","Shuppet":"어둠대신","Duskull":"해골몽","Aron":"가보리",
"Dusclops":"미라몽","Grusha":"그루샤","Galarian Articuno V":"가라르 프리져 V",
"Glaceon V":"글레이시아 V","Gothita":"고디탱","Morty's Conviction":"유빈의 집념",
"Spewpa":"분떠도리","Mandibuzz":"버랜지나","Ting-Lu ex":"딩루 ex",
"Shadow Rider Calyrex V":"흑마 버드렉스 V","Accelgor":"어지리더","Mienshao":"비조도"
};
const groupsByName=new Map();
for(const g of all) for(const c of g.cards||[]){
 const name=String(c.name||"").trim();
 if(!name) continue;
 const m=String(c.code||"").match(/^[^_]+_([0-9]+)(?:[/ ]|$)/);
 if(!m) continue;
 const v={
  key:String(g.code).toUpperCase()+"_"+m[1].padStart(3,"0"),name,
  set:g.code,setName:g.name||"",no:m[1].padStart(3,"0"),
  code:c.code,rarity:c.rarity||"",image:c.image||"",
  source:c.source||""
 };
 if(!groupsByName.has(name)) groupsByName.set(name,[]);
 groupsByName.get(name).push(v);
}
const already=new Set(existing.map(c=>c.code.toUpperCase()));
const primary=ref.find(x=>x.id==="pokecardlists").list;
const extra=ref.find(x=>x.id==="woahpoke").list.filter(x=>x.setEn==="Japanese PokeKyun Promo");
const refs=[...primary,...extra];
const items=refs.map((r,i)=>{
 const nameKo=ko[r.nameEn]||null;
 const possible=(groupsByName.get(nameKo)||[]).filter(c=>c.image);
 return {index:i+1,english:r.nameEn,englishSet:r.setEn,englishNumber:r.numberEn,
 koreanName:nameKo,existingMatches:possible.filter(p=>already.has(p.key)).map(p=>p.key),
 numberOfKoreanNameCandidates:possible.length,
 status:possible.length?"requires_artwork_confirmation":"no_exact_korean_name_in_master",
 candidates:possible.map(({key,name,set,setName,no,rarity,image,source})=>({key,name,set,setName,no,rarity,image,source})).slice(0,110),
 truncatedCandidates:Math.max(0,possible.length-110)
 };
});
const illudex=ref.find(x=>x.id==="illudex").list.map((r,i)=>{
 const nameKo=ko[r.nameEn]||null;
 const matches=(groupsByName.get(nameKo)||[]).filter(c=>c.image);
 return {index:i+1,english:r.nameEn,artist:r.artistEn,koreanName:nameKo,koreanNameMatches:matches.length,
 matches:matches.slice(0,50).map(({key,set,setName,no,image})=>({key,set,setName,no,image})),
 artistAndArtworkNotVerified:true};
});
write("data/audits/crying-theme-all-candidate-index-20261108.json",{
 schemaVersion:1,createdAt:"2026-11-08",policy:"Name matching is candidate discovery ONLY; never assert same artwork or release without visual verification.",
 koreanMasterSetCount:all.length,referencePrimary:primary.length,referenceExtra:extra.length,
 currentThemeCardCount:existing.length,
 primary:items,illudex,
 summary:{primaryWithKoreanNameCandidates:items.filter(x=>x.numberOfKoreanNameCandidates).length,
 primaryNoKoreanNameCandidates:items.filter(x=>!x.numberOfKoreanNameCandidates).length,
 totalPrimaryCandidates:items.reduce((n,x)=>n+x.numberOfKoreanNameCandidates,0),
 illudexWithKoreanNameCandidates:illudex.filter(x=>x.koreanNameMatches).length}
});
console.log(JSON.stringify({primary:items.map(x=>({name:x.english,set:x.englishSet,number:x.englishNumber,ko:x.koreanName,count:x.numberOfKoreanNameCandidates,existing:x.existingMatches})),summary:{total:items.reduce((n,x)=>n+x.numberOfKoreanNameCandidates,0)}},null,2));