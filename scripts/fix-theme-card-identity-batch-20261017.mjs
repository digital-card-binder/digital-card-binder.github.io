import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (p,v) => fs.writeFileSync(p, JSON.stringify(v,null,2)+"\n");
const hash = s => crypto.createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
const themesPath="data/art-themes.json";
const seriesPath="data/series.json";
const theme=read(themesPath);
const series=read(seriesPath);
const legacy=read("data/series-legacy.json");
const corrections={
  "sv5m_075":"냐오불", "s12a_196":"히스이 미끄래곤",
  "sv7_112":"꼴깍몬", "m2a_183":"누룩스시티",
  "m1l_060":"파이팅공", "m1l_083":"파이팅공"
};
const master = new Map();
const changes={ master:[], names:[], codes:[], pair:[] };
for(const g of [...series,...legacy]){
  for(const card of g.cards||[]){
    const match=String(card.code||"").match(/^([^_]+)_(\d{3})\//i);
    if(!match)continue;
    const key=match[1].toLowerCase()+"_"+match[2];
    if(corrections[key]&&card.name!==corrections[key]){
      changes.master.push({key,before:card.name,after:corrections[key]});
      card.name=corrections[key];
    }
    if(card.name)master.set(key,card.name);
  }
}
assert.equal(changes.master.length,6,"Master name correction baseline moved");
const oldKeys = [];
const copyId=(card)=>card.legacyIdentityCode || card.code;
const normalize=s=>String(s||"").replace(/\s+/g,"");
let rowsBefore=0;
for(const group of theme.groups||[]){
  for(const [index,card] of (group.cards||[]).entries()){
    rowsBefore++;
    const oldKey=copyId(card);
    if((group.code==="connected"||group.code==="evolution") &&
      ((card.code==="SV5K_073"&&card.name==="사철록") ||
       (card.code==="SV5K_074"&&card.name==="바라철록"))){
      const n=card.code.endsWith("073")?"073":"074";
      card.legacyIdentityCode ||= card.code;
      card.code="SV5M_"+n;
      card.set="sv5M";
      card.setName="사이버저지";
      card.image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV5M/SV5M_"+n+".png";
      card.cardNumber=n+"/071";
      card.rarity="AR";
      changes.pair.push({group:group.code,number:n,previous:oldKey,corrected:card.code});
    }
    const image=String(card.image||"").match(/\/([A-Za-z0-9-]+)_(\d{3})\.(?:png|jpe?g|webp)(?:\?|$)/i);
    const printed=String(card.cardNumber||"").match(/^(\d{1,3})/);
    if(!image||!printed||printed[1].padStart(3,"0")!==image[2]||
       String(card.set||"").toLowerCase()!==image[1].toLowerCase())continue;
    const sourceKey=image[1].toLowerCase()+"_"+image[2];
    const official=master.get(sourceKey);
    if(!official)continue;
    const code=String(card.code||"").match(/^([^_]+)_(\d{3})$/i);
    if(code&&code[1].toLowerCase()===image[1].toLowerCase()&&code[2]!==image[2]){
      const was=card.code;
      card.legacyIdentityCode ||=was;
      card.code=code[1]+"_"+image[2];
      changes.codes.push({group:group.code,previous:was,corrected:card.code,index});
    }
    if(normalize(card.name)!==normalize(official)){
      changes.names.push({group:group.code,code:card.code,previous:card.name,corrected:official});
      card.name=official;
    }
    // Unchanged ownership identity after correcting the visible card code.
    assert.equal(copyId(card),oldKey,"Ownership key changed for "+group.code+"/"+index);
  }
}
assert.equal(rowsBefore,17799,"Theme card count baseline shifted");
assert.equal(changes.pair.length,4,"Connected and evolution corrections");
assert.equal(changes.codes.length,782,"Confirmed mismatched canonical code count");
assert.equal(changes.names.length,27,"Confirmed mismatched Korean title count");
// Do not overwrite a verified Korean print with the wrong set or number.
const unresolved=[];
const sourceOpaque={count:0,groupCounts:{}};
const duplicates=[];
for(const group of theme.groups||[]){
  const seen=new Map();
  for(const card of group.cards||[]){
    const image=String(card.image||"").match(/\/([A-Za-z0-9-]+)_(\d{3})\.(?:png|jpe?g|webp)(?:\?|$)/i);
    if(!image){sourceOpaque.count++;sourceOpaque.groupCounts[group.code]=(sourceOpaque.groupCounts[group.code]||0)+1;continue;}
    const key=image[1].toLowerCase()+"_"+image[2];
    const official=master.get(key);
    if(official && normalize(card.name)!==normalize(official))unresolved.push({group:group.code,code:card.code,key,name:card.name,official});
    const prev=seen.get(key)||[];
    prev.push(card.code);
    seen.set(key,prev);
  }
  for(const [image,codes] of seen)if(codes.length>1)duplicates.push({group:group.code,image,codes});
}
assert.equal(unresolved.length,0,"Unresolved name/image conflict against corrected master");
assert.equal(duplicates.length,6,"Previously detected duplicate print count changed; preserve ownership");
write(seriesPath,series);
write(themesPath,theme);
const updatedCatalogSha=hash(fs.readFileSync(themesPath,"utf8"));
const review=read("data/art-theme-story-review.json");
for(const group of ["connected","evolution"]){
  const records=review.groups?.[group]?.cards;
  assert.ok(records,"Story evidence missing "+group);
  for(const n of ["073","074"]){
    const old="SV5K_"+n,newCode="SV5M_"+n;
    assert.ok(records[old] && !records[newCode],"Story status collision "+group+old);
    records[newCode]={...records[old],imageMatch:"korean-sv5m-print-verified"};
    delete records[old];
  }
}
review.catalogSha=updatedCatalogSha;
review.reviewPolicy += " 2026-10-17 세트 식별자 일괄 정정 후 기존 보유 저장 키는 legacyIdentityCode로 유지.";
write("data/art-theme-story-review.json",review);
for(const [group,file] of [
  ["connected","data/art-themes-connected-audit.json"],
  ["evolution","data/art-themes-evolution-audit.json"]]){
  const a=read(file);
  let found=0;
  const replace=value=>{
    if(typeof value==="string"){
      if(value==="SV5K_073"||value==="SV5K_074"){found++;return value.replace("SV5K_","SV5M_");}
      return value;
    }
    if(Array.isArray(value))return value.map(replace);
    if(value&&typeof value==="object"){for(const [k,v] of Object.entries(value))value[k]=replace(v);}
    return value;
  };
  replace(a);
  assert.equal(found,2,"Audit entry count moved: "+group);
  a.updatedAt="2026-10-17";
  write(file,a);
}
const identityPath="core/catalog/card-identity.js";
let identity=fs.readFileSync(identityPath,"utf8");
const oldExpr="card?.meta || card?.code || card?.name || cardIndex,";
const newExpr="(collectionId === \"artThemes\" && card?.legacyIdentityCode) || card?.meta || card?.code || card?.name || cardIndex,";
assert.ok(identity.includes(oldExpr),"Card-identity anchor missing");
identity=identity.replace(oldExpr,newExpr);
fs.writeFileSync(identityPath,identity);
const rendererPath="art-themes.js";
let renderer=fs.readFileSync(rendererPath,"utf8");
const start=renderer.indexOf("  // Historical SV5K slot keys");
const end=renderer.indexOf("  function reviewedCards(group)",start);
assert.ok(start>0&&end>start,"Old runtime workaround not found");
renderer=renderer.slice(0,start)+renderer.slice(end);
assert.ok(renderer.includes("      if (!EEVEE_MODE) repairCyberJudgeArtwork(dataset.groups);"));
renderer=renderer.replace("      if (!EEVEE_MODE) repairCyberJudgeArtwork(dataset.groups);\n","");
fs.writeFileSync(rendererPath,renderer);
let html=fs.readFileSync("art-themes.html","utf8");
html=html.replace(/core\/catalog\/card-identity\.js\?v=[^"]+/,
 "core/catalog/card-identity.js?v="+hash(identity).slice(0,12));
html=html.replace(/art-themes\.js\?v=[^"]+/,"art-themes.js?v="+hash(renderer).slice(0,12));
fs.writeFileSync("art-themes.html",html);
const audit={
  schemaVersion:1,recordedAt:"2026-10-17",baselineThemeCardCount:rowsBefore,
  conclusion:"fixed_verified_identities_preserved_legacy_ownership_keys",
  corrected:{masterNames:changes.master.length,themeVisibleCodes:changes.codes.length,themeNames:changes.names.length,connectedEvolutionSetImages:changes.pair.length},
  masterCorrections:changes.master,connectedEvolutionRepairs:changes.pair,
  updatedCatalogGitBlobSha:updatedCatalogSha,
  ownershipPreservation:"legacyIdentityCode retains the previous Firebase card code and original group/card index; no card removed or re-ordered.",
  unverifiedOpaqueImagePaths:sourceOpaque.count,
  unverifiedOpaqueByGroup:sourceOpaque.groupCounts,
  duplicatePrintSlotsPreservedForOwnership:duplicates,
  nameCorrections:changes.names,
  codeCorrectionsCountByGroup:changes.codes.reduce((a,c)=>(a[c.group]=(a[c.group]||0)+1,a),{}),
  sourceNotes:["Existing Korean master index (with six independent evidence corrections)","AR catalog", "Pokemon Korea official Korean printed card assets","Cardondo, Collectory, SETORY and Trainers cross-check of suspect titles"],
  holdPolicy:"Opaque image filenames and existing duplicate slots are not silently removed; a future owner-state-safe migration or direct visual verification is required."
};
write("data/audits/theme-identity-batch-20261017.json",audit);
console.log(JSON.stringify({fixed:audit.corrected,cardCount:rowsBefore,unverifiedOpaquePaths:sourceOpaque.count,duplicatesRetained:duplicates.length,blob:updatedCatalogSha},null,2));
