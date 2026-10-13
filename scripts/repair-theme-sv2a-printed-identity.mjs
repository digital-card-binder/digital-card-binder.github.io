import {readFile,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const files=["001-030","031-060","061-090","091-120","121-150"].map(s=>
 "data/audits/theme-sv2a-"+s+"-art-review.json");
const progressPath="data/audits/theme-sv2a-set-progress-20261013.json";
const [series,legacy,themes,state,progress,images,...evidences]=await Promise.all([
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read(progressPath),
 read("data/audits/theme-image-selfhost-audit.json"),
 ...files.map(read)
]);
const master=[...series,...legacy].find(x=>String(x.code).toLowerCase()==="sv2a");
if(!master||master.cards?.length!==210||progress.appliedReviewThrough!==150||
 state.reviews?.[master.code]?.reviewedCardCount!==150||
 String(images.nextStart).toLowerCase()!=="sv2a canonical 151"||
 progress.batchEvidence?.length!==5)
 throw Error("Korean sv2a safe checkpoint changed; no data mutation.");
const numFromMaster=c=>String(c.code||"").match(/_(\d{3})\//)?.[1];
const numFromImage=item=>String(item.image||"").match(/SV2a_(\d{3})/i)?.[1];
const isNew=item=>/한국판|자체 보관|자가 저장/i.test(String(item.evidence||""));
const isSV=item=>String(item.set||"").toLowerCase()==="sv2a"||
 /^SV2a_\d{3}$/i.test(String(item.code||""));
const original=new Map();
let oldSlots=0,newBefore=0,changedKeys=0,duplicateNewRemoved=0;
for(const g of themes.groups){
 for(const item of g.cards||[]){
  if(!isSV(item))continue;
  const imageNum=numFromImage(item);
  if(!imageNum)throw Error("Korean SV2a theme without official source identity "+item.code);
  if(isNew(item)){newBefore++;continue;}
  const k="SV2a_"+imageNum;
  if(String(item.code||"").toUpperCase()!==k.toUpperCase())
   throw Error("Do not overwrite historical original theme identity "+item.code);
  if(!original.has(k))original.set(k,[]);
  original.get(k).push(g.code);oldSlots++;
 }
}
if(oldSlots!==24||newBefore<260)
 throw Error("Expected exactly 24 untouched original theme placements and >=260 new entries.");
const mapped=new Map(master.cards.map((c,i)=>[numFromMaster(c),{card:c,order:i+1}]));
if(mapped.size!==210)throw Error("Duplicate printed numbers in Korean master.");
const repaired=[],suppressed=[];
for(const g of themes.groups){
 const seen=new Map(),keep=[];
 for(const item of g.cards||[]){
  if(!isSV(item)){keep.push(item);continue;}
  const n=numFromImage(item),key="SV2a_"+n;
  if(!mapped.has(n))throw Error("No Korean master printed card for "+key);
  if(isNew(item) && String(item.code).toUpperCase()!==key.toUpperCase()){
    repaired.push({theme:g.code,from:item.code,to:key,name:item.name,imageNumber:n});
    changedKeys++;
    item.code=key;
  }
  const k=key.toUpperCase();
  if(seen.has(k)){
   const old=seen.get(k);
   if(numFromImage(old)!==n)throw Error("Duplicate theme key with distinct prints: "+key);
   if(!isNew(item))throw Error("Original historical placement duplicate: "+key);
   duplicateNewRemoved++;continue;
  }
  seen.set(k,item);keep.push(item);
 }
 g.cards=keep;
}
// The previously held color label for canonical card 23 was attached to
// printed 023 (아보), not printed 017 (피죤). Restore its confirmed visual.
const colorGroup=themes.groups.find(g=>g.code==="color");
const pigeon=master.cards[22],pigeonNumber=numFromMaster(pigeon);
if(pigeonNumber!=="017"||pigeon.name!=="피죤")throw Error("Printed Pidgeotto identity changed.");
if(!colorGroup.cards.some(x=>isSV(x)&&numFromImage(x)===pigeonNumber)){
 colorGroup.cards.push({
  code:"SV2a_017",name:"피죤",series:"SV",set:master.code,setName:"포켓몬카드 151",
  cardNumber:"017/165",rarity:pigeon.rarity||"",
  category:colorGroup.cards[0]?.category||colorGroup.name,
  evidence:"한국판 자가 저장 카드 시트(data/audits/theme-visual-evidence/sv2a/sv2a-02.webp.b64): 푸른 하늘과 산 능선 위의 피죤. 기존 컬러 중복 오인으로 누락됐던 배치 복구.",
  image:pigeon.sourceImage||pigeon.image
 });
}
const newThemes=new Map(),byGroup={};let newAfter=0;
for(const g of themes.groups)for(const item of g.cards||[]){
 if(!isSV(item))continue;
 const n=numFromImage(item),key="SV2a_"+n;
 if(String(item.code).toUpperCase()!==key.toUpperCase())
  throw Error("Uncorrected Korean print theme key: "+item.code);
 if(!isNew(item))continue;
 if(!newThemes.has(key))newThemes.set(key,[]);
 newThemes.get(key).push(g.code);
 byGroup[g.code]=(byGroup[g.code]||0)+1;newAfter++;
}
if(newAfter<250||newAfter>newBefore+1)throw Error("Unexpected number of new thematic prints.");
let rewrote=0;
for(let i=0;i<files.length;i++){
 const e=evidences[i],start=1+i*30;
 if(e.set!=="sv2a"||e.start!==start||e.cards?.length!==30)
  throw Error("Evidence set shape changed: "+files[i]);
 const summary={};const historic=[];
 for(let k=0;k<30;k++){
  const row=e.cards[k],n=start+k,masterCard=master.cards[n-1],printed=numFromMaster(masterCard);
  if(row.canonicalOrder!==n||row.printedNumber?.split("/")[0]!==printed)
   throw Error("Canonical vs printed evidence changed at "+n);
  const code="SV2a_"+printed;
  if(String(row.code).toUpperCase()!==code.toUpperCase()){
   row.originalOrdinalCode=row.code;row.code=code;rewrote++;
  }
  row.printIdentityVerifiedAgainstMaster=true;
  row.wasAlreadyInThemes=[...(original.get(code)||[])].sort();
  row.themesMatched=[...(newThemes.get(code)||[])].sort();
  for(const t of row.themesMatched)summary[t]=(summary[t]||0)+1;
  if(row.wasAlreadyInThemes.length)historic.push({code:row.code,themes:row.wasAlreadyInThemes});
  if(row.originalOrdinalCode && row.originalOrdinalCode!==row.code &&
     row.wasAlreadyInThemes.length===0 && ["sleeping","night","evolution","color"].some(t=>
       (row.wasAlreadyInThemes||[]).includes(t)))
   suppressed.push(row.code);
 }
 e.themeAdditions=summary;
 e.priorThemePlacementsPreserved=historic;
 e.identityCorrection={
  resolvedAt:"2026-10-13",policy:"theme code corresponds to Korean printed identifier, not catalog canonical ordering",
  canonicalRange:[start,start+29]
 };
}
progress.appliedThemeSlots=newAfter;
progress.appliedThemeAdditions=byGroup;
progress.identityCorrection={
 correctedAt:"2026-10-13",oldOriginalSlotsPreserved:oldSlots,
 newBefore,newAfter,changedKeys,duplicateNewRemoved,
 repairedEvidenceCardCodes:rewrote,verifiedAgainstMaster:true
};
progress.notes="SV2a canonical 001-150 visual reviews preserved. All theme IDs now use Korean printed card numbers rather than shuffled canonical order. Next canonical 151; ownership unchanged.";
state.reviews[master.code].newlyAddedThemeSlotCount=newAfter;
state.reviews[master.code].note="SV2a 001-150 12테마/한글명 검수; 인쇄번호와 canonical 순서의 차이를 복구, 기존 24개 테마 배치 유지. 남은 151-210 미완료.";
const audit={schemaVersion:1,recordedAt:"2026-10-13",set:"sv2a",
 summary:progress.identityCorrection,originalThemeSlots:Object.fromEntries(original),
 corrections:repaired,validatedMasterCount:mapped.size,
 note:"No card ownership, card images, other sets or independent dex data changed."};
await Promise.all([
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write(progressPath,progress),
 write("data/audits/theme-sv2a-identity-repair-20261013.json",audit),
 ...evidences.map((e,i)=>write(files[i],e))
]);
console.log(JSON.stringify({safe:true,...progress.identityCorrection,next:images.nextStart},null,2));
