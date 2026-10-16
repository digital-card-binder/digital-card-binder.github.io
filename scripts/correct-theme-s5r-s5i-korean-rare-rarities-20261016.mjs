import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const DB="data/series.json";
const A="data/audits/theme-s5r-s5i-082-091-Korean-rarity-corrections-20261016.json";
const H="data/audits/theme-s5r-s5i-082-091-Japanese-image-holds-20261016.json";
const GLOBAL="s6K Korean print source pending: 089,090,092,094";
const [db,old,reports,held,registry]=await Promise.all([
 read(DB),read("data/series-legacy.json"),read(A),read(H),
 read("data/audits/theme-series-review-status.json")
]);
if(reports.status!=="verified_rare_tier_metadata_only"||reports.rarityCorrections?.length!==8||
 held.status!=="pending_Korean_image_provenance"||
 held.globalCheckpointPreserved!==GLOBAL||reports.globalCheckpointPreserved!==GLOBAL||
 registry.execution?.nextStart!==GLOBAL||
 reports.cardCountChange!==0||reports.masterCodeChanges!==0||
 reports.ownershipChanges!==0||reports.themeMembershipChanges!==0||
 reports.koreanImageVerifiedCount!==0)throw Error("Rarity provenance / original Korean image holds changed");
const expected=[82,83,89,90];
const snapshot={},changes=[];
for(const setName of ["s5r","s5i"]){
 const list=[...db,...old].filter(s=>String(s.code||"").toLowerCase()===setName);
 if(list.length!==1||list[0].cards.length!==91||!db.includes(list[0]))
  throw Error("Expected one 91-card modern "+setName+" master");
 const set=list[0];
 snapshot[setName]=set.cards.map(c=>[c.code,c.name,c.image,c.sourceImage,c.cardNumber]);
 if(registry.reviews?.[set.code]?.reviewedCardCount!==81&&
 !Object.entries(registry.reviews||{}).some(([k,v])=>k.toLowerCase()===setName&&v.reviewedCardCount===81))
  throw Error("Prior approved 81-card theme review changed: "+setName);
 for(let i=0;i<91;i++){
  const card=set.cards[i],num=String(i+1).padStart(3,"0");
  if(String(card.code||"").toLowerCase()!==setName+"_"+num+"/070")
   throw Error("Canonical ownership card order changed: "+setName+" "+num);
 }
 const actual=reports.rarityCorrections.filter(row=>row.set===setName);
 if(JSON.stringify(actual.map(x=>x.canonicalOrder))!==JSON.stringify(expected))
  throw Error("Rare correction list wrong for "+setName);
 const states=[];
 for(const row of actual){
  const card=set.cards[row.canonicalOrder-1];
  if(row.code!==card.code.toLowerCase()||
    row.from!==([82,83].includes(row.canonicalOrder)?"SR":"HR")||
    row.to!==([82,83].includes(row.canonicalOrder)?"HR":"UR")||
    ![row.from,row.to].includes(card.rarity))
   throw Error("Unrecognized rarity or key: "+row.code);
  states.push(card.rarity===row.from?"old":"done");
 }
 if(states.some(x=>x!==states[0]))throw Error("Partial rarity fix state: "+setName);
 if(states[0]==="old")for(const row of actual){
  set.cards[row.canonicalOrder-1].rarity=row.to;
  changes.push(row.code);
 }
 const rare=set.cards.slice(81).reduce((sum,c)=>(sum[c.rarity]=(sum[c.rarity]||0)+1,sum),{});
 if(rare.HR!==7||rare.UR!==3||Object.keys(rare).length!==2)
  throw Error("Expected seven HR and three UR Korean rare cards: "+setName);
 if(snapshot[setName].some((row,i)=>JSON.stringify(row)!==JSON.stringify(
  [set.cards[i].code,set.cards[i].name,set.cards[i].image,set.cards[i].sourceImage,set.cards[i].cardNumber])))
  throw Error("Image/identity/ownership data mutated "+setName);
}
if(changes.length===0){console.log("All eight metadata changes already present. Safe no-op.");process.exit(0);}
if(changes.length!==8)throw Error("Partial edits unacceptable; do not publish");
await writeFile(DB,JSON.stringify(db,null,2)+"\n","utf8");
console.log(JSON.stringify({corrected:changes,changedCount:8,masterKeysUntouched:true,
 userOwnershipUntouched:true,themeMembershipsUntouched:true,
 koreanImageApprovalUntouched:true,JapaneseHoldsPreserved:20,globalHold:GLOBAL}));
