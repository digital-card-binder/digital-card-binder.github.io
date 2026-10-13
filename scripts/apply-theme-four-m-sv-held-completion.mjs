import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const evidencePath="data/audits/theme-four-m-sv-held-reviews-20261013.json";
const ownRoot="data/audits/theme-nine-sets-owned-image-20261013/";
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const four=["SVAM","SVEL","SVEM","SVG"];
const [e,modern,legacy,themes,state,images]=await Promise.all([
 read(evidencePath),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json")
]);
if(e.schemaVersion!==1||e.recordedAt!=="2026-10-13")throw Error("Unsupported 4-set manual evidence");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of themes12)if(!Array.isArray(groups.get(t)?.cards))throw Error("Theme group missing "+t);
const report={schemaVersion:1,completedAt:"2026-10-13",title:"Four small incomplete Korean starter/special decks completed using self-hosted original Korean artwork",sets:{},notTouchedSets:["M-P","CLL","CLK","CLF","SV-P"],userOwnershipEdited:false};
const audited=await read(ownRoot+"summary.json");
if(audited.totalExpectedCards!==540||audited.totalDecoded!==540)throw Error("Self-hosted 9-set proof changed");
let changed=0;
for(const code of four){
 const specs=e.sets[code],size=specs.expected;
 const owners=[...modern,...legacy].filter(s=>String(s.code||"").toUpperCase()===code);
 if(owners.length!==1||owners[0].cards?.length!==size)throw Error("Korean canonical set count mismatch "+code);
 const master=owners[0],previous=state.reviews?.[master.code];
 if(previous?.status==="complete"&&previous.reviewedCardCount===size){
  report.sets[code]={alreadyComplete:true,cardCount:size};
  continue;
 }
 if(previous?.status==="complete")throw Error("Unexpected prior complete checkpoint "+code);
 const audit=await read(ownRoot+code+"/visual-index.json");
 if(audit.expectedCanonicalCards!==size||audit.ownedCdnBinaryDecoded!==size||
    audit.ownedCdnBinaryUnavailable!==0||audit.cards?.length!==size||
    audit.missingKoreanMasterNames!==0||specs.heldRows.length!==size-specs.previouslyVerified)
  throw Error("Owned Korean image archive evidence not satisfied "+code);
 const heldLookup=new Map(specs.heldRows.map(x=>[x.canonicalKey.toUpperCase(),x]));
 if(heldLookup.size!==specs.heldRows.length)throw Error("Duplicate Korean artwork held proof "+code);
 const prior=new Map();
 for(const group of themes.groups)for(const c of group.cards||[]){
  if(String(c.set||"").toUpperCase()!==code&&!String(c.code||"").toUpperCase().startsWith(code+"_"))continue;
  const key=String(c.code||"").toUpperCase();
  const list=prior.get(key)||[];
  if(list.includes(group.code))throw Error("Already duplicate placement "+key+" "+group.code);
  list.push(group.code);prior.set(key,list);
 }
 const oldCount=[...prior.values()].reduce((n,x)=>n+x.length,0);
 const addedByTheme={};let newCount=0,rehosted=0;
 const matchedHeld=new Set();
 for(let i=0;i<size;i++){
  const c=master.cards[i],proof=audit.cards[i],number=String(c.code||"").match(/_([^\/ ]+)/)?.[1];
  if(!c||!proof||!number||String(c.code).toLowerCase()!==String(proof.masterCode).toLowerCase()||
     !String(c.name||"").trim()||c.name!==proof.koreanMasterName||
     proof.canonicalOrder!==i+1||proof.imageCheck?.status!=="decoded"||
     proof.imageCheck?.http!==200||proof.imageCheck?.format!=="WEBP"||
     !["420,586","400,558"].includes(proof.imageCheck?.dimensions?.join(","))||
     !/^https:\/\/dcb-card-images-(?:modern|legacy)-2026\.pages\.dev\//.test(proof.ownedCdnUrl))
    throw Error("Invalid decoded own-CDN/Korean master identity "+code+" canonical "+(i+1));
  const key=(code+"_"+number).toUpperCase();
  const held=heldLookup.get(key);
  if(held){
   if(held.canonicalPrintedNumber!==number||
      held.koreanName!==c.name||!held.all12ThemesChecked||
      !held.visualObservation?.trim()||
      held.visualContactSheet!==ownRoot+code+"/"+code+"-"+String(Math.ceil((i+1)/15)).padStart(2,"0")+".webp.b64"||
      held.themesMatched.some(t=>!themes12.includes(t)))
    throw Error("Unverified held Korean print observations "+key);
   matchedHeld.add(key);
   for(const tag of held.themesMatched){
    if((prior.get(key)||[]).includes(tag))continue;
    const group=groups.get(tag);
    group.cards.push({
     code:key,name:c.name,series:"SV",set:master.code,setName:master.name,
     cardNumber:String(c.code).match(/_([^ ]+)/)?.[1]||number,
     rarity:c.rarity||"",category:group.cards[0]?.category||group.name,
     evidence:"한국판 자가 CDN 실물 카드 검수: "+held.visualObservation+
       ". 증거 "+held.visualContactSheet+" (원본 이미지 외부 요청 없음).",
     image:proof.ownedCdnUrl
    });
    addedByTheme[tag]=(addedByTheme[tag]||0)+1;newCount++;
   }
  }
  // All existing incomplete-set theme records must point to owned assets, never hotlink to foreign image hosts.
  for(const group of themes.groups){
   const row=group.cards.find(x=>String(x.code||"").toUpperCase()===key);
   if(!row)continue;
   if(String(row.image||"")!==proof.ownedCdnUrl){
    if(row.image&&!row.sourceImage)row.sourceImage=row.image;
    row.image=proof.ownedCdnUrl;rehosted++;
   }
  }
 }
 if(matchedHeld.size!==heldLookup.size)throw Error("Unmatched held print cards "+code);
 // All earlier non-held cards were already artwork reviewed in explicit Korean evidence files,
 // and are preserved rather than reclassified or reinserted.
 state.reviews[master.code]={
  ...previous,status:"complete",reviewedAt:"2026-10-13",
  reviewedCardCount:size,reviewedThemes:themes12,heldCards:[],
  previouslyReviewedKoreanArtworkCount:specs.previouslyVerified,
  newlyReviewedKoreanArtworkCount:specs.heldRows.length,
  previouslyPreservedThemeSlotCount:oldCount,newlyAddedThemeSlotCount:newCount,
  verifiedSelfHostedImageCount:size,archiveVerificationStatus:"owned_CDN_Korean_print_images_visually_checked_and_decoded",
  selfHostedFullSetEvidence:ownRoot+code+"/visual-index.json",
  heldArtEvidence:evidencePath,
  note:"한국판 인쇄 카드 "+size+"장 12테마 전수검수 완료. 기존 검수 결과 보존, 보류 카드 한국판 이미지 자체 CDN으로 해소. 원본 서버 추가 트래픽 없음."
 };
 images.batches.push({
  task:6,set:master.code,range:"complete Korean original artwork + archive 001-"+String(size).padStart(3,"0"),
  canonicalCardCount:size,artworkVisuallyVerifiedCount:size,artworkPendingCount:0,
  newlyInternalizedReferenceCount:0,selfHostedReferenceCountAfter:size,
  externalImageReferenceCountAfter:0,archiveVerificationStatus:"verified_owned_CDN_Korean_print_images_decoded",
  verifiedImageCount:size,unverifiedImageCount:0,brokenReferenceCount:0,
  previousKoreanArtworkReviewsPreserved:specs.previouslyVerified,
  formerHeldKoreanArtResolved:specs.heldRows.length,
  themeAdditions:addedByTheme,previousThemeSlotsPreserved:oldCount,
  existingThemeImagesRepointedToOwnCDN:rehosted,
  note:"Self-host-only full Korean art review: previously verified cards preserved, exact Korean held slots visually inspected in owned CDN contact sheets. No image source requests."
 });
 report.sets[code]={complete:true,cardCount:size,previouslyReviewed:specs.previouslyVerified,
  newlyReviewed:specs.heldRows.length,oldThemeSlotsPreserved:oldCount,newThemeSlots:newCount,
  themeAdditions:addedByTheme,existingThemeImagesRepointedToOwnCDN:rehosted};
 changed++;
}
if(changed<1){console.log("Four Korean sets already complete; no changes");process.exit(0);}
images.updatedAt="2026-10-13";
await Promise.all([
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write("data/audits/theme-image-selfhost-audit.json",images),
 write("data/audits/theme-four-m-sv-completion-20261013.json",report)
]);
console.log(JSON.stringify(report,null,2));
