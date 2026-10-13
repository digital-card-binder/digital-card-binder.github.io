import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const ePath="data/audits/theme-mp-final-058-068-owned-art-review.json";
const aPath="data/audits/theme-nine-sets-owned-image-20261013/M-P/visual-index.json";
const tPath="data/art-themes.json",sPath="data/audits/theme-series-review-status.json",imPath="data/audits/theme-image-selfhost-audit.json";
const tags=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [e,index,modern,legacy,themes,state,images,pending]=await Promise.all([
 read(ePath),read(aPath),read("data/series.json"),read("data/series-legacy.json"),
 read(tPath),read(sPath),read(imPath),read("data/audits/theme-mp-051-068-evidence-pending.json")
]);
const owner=[...modern,...legacy].filter(s=>String(s.code||"").toUpperCase()==="M-P");
if(owner.length!==1||owner[0].cards?.length!==68)throw Error("M-P master count changed");
const master=owner[0],old=state.reviews?.[master.code];
if(old?.status==="complete"&&old.reviewedCardCount===68){console.log("M-P already complete");process.exit(0);}
if(old?.status==="complete"||index.set!=="M-P"||index.expectedCanonicalCards!==68||
index.ownedCdnBinaryDecoded!==68||index.ownedCdnBinaryUnavailable!==0||
index.cards?.length!==68||index.missingKoreanMasterNames!==0||
e.set!=="M-P"||e.masterCanonicalCount!==68||e.previousArtworkCheckedThroughCanonical!==57||
e.remainingHeldArtworkResolved!==11||e.rows?.length!==11||pending.artworkVerifiedCount!==7)
throw Error("M-P Korean artwork checkpoint or own-CDN proof changed");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of tags)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing theme group "+t);
const prior=new Map();
for(const g of themes.groups)for(const c of g.cards||[]){
 if(String(c.set||"").toUpperCase()!=="M-P"&&!String(c.code||"").toUpperCase().startsWith("M-P_"))continue;
 const key=String(c.code||"").toUpperCase(),oldTags=prior.get(key)||[];
 if(oldTags.includes(g.code))throw Error("Preexisting duplicate "+key);
 oldTags.push(g.code);prior.set(key,oldTags);
}
const existingCount=[...prior.values()].reduce((n,a)=>n+a.length,0);
const held=new Map(e.rows.map(row=>[row.code.toUpperCase(),row]));
if(held.size!==11)throw Error("Held identities duplicated");
let newCount=0,repointed=0;
const themeAdds={},seen=new Set();
for(let i=0;i<68;i++){
 const c=master.cards[i],proof=index.cards[i],id=String(c?.code||"").match(/^m-p_([^/ ]+)/i)?.[1];
 if(!c||!proof||!id||proof.canonicalOrder!==i+1||
  String(proof.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
  c.name!==proof.koreanMasterName||!String(c.name||"").trim()||
  proof.imageCheck?.status!=="decoded"||proof.imageCheck?.http!==200||proof.imageCheck?.format!=="WEBP"||
  proof.imageCheck?.dimensions?.[0]<380||proof.imageCheck?.dimensions?.[1]<530||
  !/^https:\/\/dcb-card-images-(?:modern|legacy)-2026\.pages\.dev\//.test(proof.ownedCdnUrl))
  throw Error("M-P Korean print / owned archive wrong at canonical "+(i+1));
 const key=("M-P_"+id).toUpperCase(),row=held.get(key);
 if(i>=57&&!row)throw Error("Missing held art visual decision "+key);
 if(row){
  const sheet="data/audits/theme-nine-sets-owned-image-20261013/M-P/M-P-"+String(Math.ceil((i+1)/15)).padStart(2,"0")+".webp.b64";
  if(row.canonicalOrder!==i+1||row.koreanName!==c.name||!row.all12ThemesChecked||
   !row.observation||!Array.isArray(row.themesMatched)||row.themesMatched.some(t=>!tags.includes(t))||
   row.visualContactSheet!==sheet)throw Error("M-P held Korean printed image failed proof "+key);
  seen.add(key);
  for(const t of row.themesMatched){
   if((prior.get(key)||[]).includes(t))continue;
   const g=groups.get(t);
   g.cards.push({code:key,name:c.name,series:"M",set:master.code,setName:master.name,
    cardNumber:String(c.code).split("_")[1]||"",rarity:c.rarity||"",
    category:g.cards[0]?.category||g.name,
    evidence:"한국판 자체 CDN 원본 실물 검수: "+row.observation+" ("+sheet+")",
    image:proof.ownedCdnUrl});
   themeAdds[t]=(themeAdds[t]||0)+1;newCount++;
  }
 }
 for(const g of themes.groups){
  const x=g.cards.find(z=>String(z.code||"").toUpperCase()===key);
  if(!x||x.image===proof.ownedCdnUrl)continue;
  if(x.image&&!x.sourceImage)x.sourceImage=x.image;
  x.image=proof.ownedCdnUrl;repointed++;
 }
}
if(seen.size!==11)throw Error("M-P final 11 visual print holds not all reviewed");
state.reviews[master.code]={...old,status:"complete",reviewedAt:"2026-10-13",reviewedCardCount:68,
 reviewedThemes:tags,heldCards:[],verifiedSelfHostedImageCount:68,
 archiveVerificationStatus:"68_owned_CDN_Korean_print_images_decoded",
 fullSetEvidence:ePath,previouslyPreservedThemeSlotCount:existingCount,newlyAddedThemeSlotCount:newCount,
 note:"M-P 한국어판 68장 12테마 전수검수 완료. 기존 57장 기록 보존, 11장 보류 해소, 이미지 자체 호스팅 확인."};
images.batches.push({task:6,set:"M-P",range:"canonical 001-068 final Korean prints and 11 held cards",
 canonicalCardCount:68,artworkVisuallyVerifiedCount:68,artworkPendingCount:0,
 newlyInternalizedReferenceCount:0,selfHostedReferenceCountAfter:68,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_owned_CDN_Korean_print_images_decoded",
 verifiedImageCount:68,unverifiedImageCount:0,brokenReferenceCount:0,
 previousKoreanArtReviewsPreserved:57,heldArtworkResolved:11,
 themeAdditions:themeAdds,existingThemeImagesRepointedToOwnCDN:repointed,
 note:"All 68 Korean visual prints decoded from own CDN; canonical 058-060, 085-086, 500-502, GRA/FIR/WAT independently inspected."});
images.updatedAt="2026-10-13";
const report={schemaVersion:1,recordedAt:"2026-10-13",set:"M-P",status:"complete",
 canonicalCards:68,priorArtworkReviewed:57,newArtworkReviewed:11,
 ownImagesDecoded:68,foreignOriginImageRequests:0,oldThemeSlotsKept:existingCount,
 newThemeSlots:newCount,themeAdditions:themeAdds,existingThemeImagesRepointedToOwnCDN:repointed,
 evidence:[ePath,aPath],ownershipUnchanged:true};
await Promise.all([
 write(tPath,themes),write(sPath,state),write(imPath,images),
 write("data/audits/theme-mp-strict-closure-20261013.json",report)
]);
console.log(JSON.stringify(report,null,2));
