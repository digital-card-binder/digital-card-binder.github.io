import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const DATA="data/series.json";
const REVIEW="data/audits/theme-s5a-071-096-Korean-print-rarity-review-20261016.json";
const PROOF="data/audits/theme-visual-evidence/s5a/071-096/rare-source-triage.json";
const GLOBAL="s6K Korean print source pending: 089,090,092,094";
const [modern,legacy,review,proof,progress]=await Promise.all([
 read(DATA),read("data/series-legacy.json"),read(REVIEW),read(PROOF),
 read("data/audits/theme-s5a-061-070-progress-20261016.json")
]);
const matching=modern.filter(s=>String(s.code||"").toLowerCase()==="s5a");
if(matching.length!==1||legacy.some(s=>String(s.code||"").toLowerCase()==="s5a")||
 matching[0].cards?.length!==96)
 throw Error("Expected exactly one 96-card S5a Korean master on modern registry");
const set=matching[0],oldIds=set.cards.map(c=>c.code);
if(review.set!=="s5a"||review.range!=="071-096"||
 review.inspectedRarePrints!==26||review.decodedOwnedSourceCount!==26||
 review.rarityCorrections?.length!==6||review.noCardIdOrOwnershipKeyChanges!==true||
 review.globalCheckpointPreserved!==GLOBAL||
 JSON.stringify(review.reviewedPrintNumbers)!==JSON.stringify(Array.from({length:26},(_,i)=>71+i))||
 proof.checkedCardCount!==26||proof.decodedCandidateCount!==26||
 proof.ownedArchiveDecodedCount!==26||proof.ownedArchiveMissingCount!==0||
 proof.heldCardNumbers?.length!==26||
 progress.artworkReviewed!==70||progress.complete!==false||
 progress.globalCheckpointPreserved!==GLOBAL)
 throw Error("Korean rare source review and prior protected checkpoints are inconsistent");
const corrections=review.rarityCorrections;
const expected=[
 [71,"번치코 V","U","SR"],[72,"파치래곤 V","U","SR"],
 [85,"번치코 VMAX","SR","HR"],[86,"번치코 VMAX","SR","HR"],
 [93,"잠만보","HR","UR"],[94,"너울의 부채","HR","UR"]
];
if(JSON.stringify(corrections.map(x=>[x.number,x.name,x.from,x.to]))!==JSON.stringify(expected))
 throw Error("Six Korean S5a rarity corrections are not the approved photo-reviewed list");
for(let n=71;n<=96;n++){
 const c=set.cards[n-1],p=proof.cards[n-71];
 const num=String(n).padStart(3,"0");
 if(!c||!p||String(c.code||"").toLowerCase()!==`s5a_${num}/070`||
 String(p.code||"").toLowerCase()!==String(c.code).toLowerCase()||
 p.name!==c.name||p.canonicalOrder!==n||
 !p.candidateImageInspection||p.candidateImageInspection.status!=="decoded_unverified_region"||
 !p.ownedCandidateUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/")||
 p.ownedImageInspection?.status!=="decoded_owned_archive"||
 p.ownedImageInspection?.http!==200||p.ownedImageInspection?.format!=="WEBP")
 throw Error("Bad S5a Korean rarity card ownership/preflight: "+num);
}
const originalCodes=JSON.stringify(set.cards.map(c=>c.code));
const originalRest=set.cards.map(c=>JSON.stringify(Object.fromEntries(
 Object.entries(c).filter(([k])=>k!=="rarity"))));
const states=corrections.map(({number,code,name,from,to})=>{
 const c=set.cards[number-1];
 if(String(c.code).toLowerCase()!==code||c.name!==name)
  throw Error("Card key/name collision "+number);
 if(c.rarity!==from&&c.rarity!==to)throw Error("Unexpected existing rarity "+number);
 return c.rarity===to?"already":"old";
});
if(states.every(s=>s==="already")){
 console.log("All six Korean rare metadata corrections already applied; no-op");
 process.exit(0);
}
if(states.some(s=>s!=="old"))throw Error("Partially corrected S5a detected; stop to protect user data");
for(const {number,to} of corrections)set.cards[number-1].rarity=to;
const totals=set.cards.slice(70).reduce((a,c)=>(a[c.rarity]=(a[c.rarity]||0)+1,a),{});
if(JSON.stringify(totals)!==JSON.stringify({SR:14,HR:8,UR:4})||
 JSON.stringify(set.cards.map(c=>c.code))!==originalCodes||
 set.cards.some((c,i)=>JSON.stringify(Object.fromEntries(
 Object.entries(c).filter(([k])=>k!=="rarity")))!==originalRest[i]))
 throw Error("Unexpected card change outside six rarities");
await writeFile(DATA,JSON.stringify(modern,null,2)+"\n","utf8");
console.log(JSON.stringify({set:"s5a",corrections:corrections.map(c=>c.number),
 rareCount:26,after:totals,cardIdsUnchanged:true,ownedDataUnchanged:true,
 themeMembershipsUnchanged:true,globalCheckpoint:GLOBAL}));
