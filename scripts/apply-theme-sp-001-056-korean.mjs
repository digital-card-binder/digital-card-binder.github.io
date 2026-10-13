import{readFile,writeFile}from"node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const a="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [e,ix,gate,modern,legacy,art,st,im,ov]=await Promise.all([
 read(a+"theme-sp-001-060-Korean-art-review-20261013.json"),
 read(a+"theme-visual-evidence/S-P/visual-index.json"),
 read(a+"theme-sp-204-image-region-gate-20261013.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(a+"theme-series-review-status.json"),read(a+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")]);
const found=[...modern,...legacy].filter(s=>String(s.code||"").toUpperCase()==="S-P");
if(found.length!==1||found[0].cards?.length!==204)throw Error("S-P Korean 204 card master unexpectedly changed");
const master=found[0],prior=st.reviews?.[master.code];
if(prior?.status==="complete"||prior?.reviewedCardCount>0)throw Error("S-P already reviewed; do not replay prior work");
if(im.nextStart!=="S-P canonical 001"||ix.cardCount!==204||
 ix.verificationCounts?.verified!==204||ix.verificationCounts?.missing!==0||
 e.items?.length!==56||e.canonicalCardsReviewed!==56||e.KoreanCardArtReviewed!==55||
 e.heldForeignPrintCount!==1||gate.exceptions?.length!==2||
 gate.exceptions[0].cardKey!=="S-P_022"||gate.exceptions[1].cardKey!=="S-P_115")
 throw Error("Korean S-P checkpoint moved");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const tag of T)if(!Array.isArray(groups.get(tag)?.cards))throw Error("Missing theme "+tag);
const previous=new Map();
for(const g of art.groups)for(const c of g.cards||[]){
 const id=String(c.code||"").toUpperCase();
 if(String(c.set||"").toUpperCase()!=="S-P"&&!/^S-P_\d{3}$/.test(id))continue;
 previous.set(id,(previous.get(id)||[]).concat(g.code));
}
if([...previous.values()].reduce((n,x)=>n+x.length,0)!==0)throw Error("Prior independent S-P theme entries unexpectedly present");
ov.sets??={};ov.sets["s-p"]??={};
const forbidden=new Set(["S-P_022","S-P_115"]);
const pending="/assets/card-image-unavailable.svg";
let hosted=0,pendingCount=0,preserved=0;
const identities=[];
for(let i=0;i<204;i++){
 const c=master.cards[i],p=ix.cards[i],id=String(c?.code||"").match(/^s-p_([^/ ]+)/i)?.[1];
 if(!c||!p||!id||p.canonicalOrder!==i+1||
    String(c.code).toLowerCase()!==String(p.masterCode).toLowerCase()||
    c.name!==p.name||p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
    p.imageCheck?.format!=="WEBP"||
    p.imageCheck?.dimensions?.[0]<280||p.imageCheck?.dimensions?.[1]<390||
    Math.abs(p.imageCheck.dimensions[1]/p.imageCheck.dimensions[0]-1.396)>0.05||
    !/^https:\/\/dcb-card-images-legacy-2026\.pages\.dev\//.test(p.cdnUrl))
   throw Error("Own archive / Korean master mismatch at canonical order "+(i+1));
 const key="S-P_"+id,asset=forbidden.has(key)?pending:p.cdnUrl;
 if(c.image!==asset){
   if(c.image&&!c.sourceImage){c.sourceImage=c.image;preserved++;}
   c.image=asset;
 }
 ov.sets["s-p"][c.code.toLowerCase()]=asset;
 if(forbidden.has(key))pendingCount++;else hosted++;
 identities.push({key,asset});
}
let added=0,accepted=0,held=0;const additions={};
for(let i=0;i<56;i++){
 const r=e.items[i],p=ix.cards[i],c=master.cards[i],entry=identities[i];
 const sheet="data/audits/theme-visual-evidence/S-P/S-P-"+String(Math.ceil((i+1)/15)).padStart(2,"0")+".webp.b64";
 if(!r||r.canonicalOrder!==i+1||r.cardKey!==entry.key||
    String(r.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
    r.koreanName!==c.name||r.sourceOwnedCDN!==p.cdnUrl||
    r.evidenceContactSheet!==sheet||
    !String(r.artworkObservation||"").trim()||
    !Array.isArray(r.matchedThemes)||
    new Set(r.matchedThemes).size!==r.matchedThemes.length||
    r.matchedThemes.some(t=>!T.includes(t)))
  throw Error("Manually reviewed artwork proof mismatch "+entry.key);
 if(!r.confirmedKoreanPrintedImage){
  if(r.cardKey!=="S-P_022"||r.status!=="hold_japanese_language_source_image"||
    r.all12ThemesChecked!==false||r.matchedThemes.length)
     throw Error("Unacceptable region mismatch "+entry.key);
  held++;continue;
 }
 if(!r.all12ThemesChecked||r.status!=="verified_Korean_print_scene")
  throw Error("Korean visual review incomplete "+entry.key);
 accepted++;
 for(const t of r.matchedThemes){
  const g=groups.get(t);
  g.cards.push({code:entry.key,name:c.name,series:"S",set:master.code,
    setName:master.name,cardNumber:c.code.split("_")[1],rarity:c.rarity||"",
    category:g.cards[0]?.category||g.name,image:entry.asset,
    evidence:"한국판 카드의 12테마 시각 검수: "+r.artworkObservation+
      ". 자체 CDN 증거: "+sheet+"; 원본 서버 직접 요청 없음."});
  additions[t]=(additions[t]||0)+1;added++;
 }
}
if(accepted!==55||held!==1||hosted!==202||pendingCount!==2)
 throw Error("S-P reviewed 55+1, own CDN 202 + 2 placeholder invariants failed");
st.reviews??={};
st.reviews[master.code]={...prior,status:"in_progress",reviewedAt:"2026-10-13",
 reviewedCardCount:55,lastReviewedCanonicalOrder:56,reviewedThemes:T,
 heldCards:["S-P_022"],otherRegionExceptionsPending:["S-P_115"],
 verifiedSelfHostedImageCount:202,newlyAddedThemeSlotCount:added,
 fullSetSelfhostAudit:"data/audits/theme-visual-evidence/S-P/visual-index.json",
 partialEvidence:"data/audits/theme-sp-001-060-Korean-art-review-20261013.json",
 note:"S-P 56 canonical slots examined: 55 Korean visuals reviewed across 12 themes, Japanese S-P_022 held. All 204 display image references routed to owned Cloudflare 202 or local placeholder 2. No ownership edits."};
im.batches.push({task:6,set:"S-P",range:"canonical 001-056, 55 approved Korean and 1 Japanese hold",
 canonicalCardCount:204,artworkVisuallyVerifiedCount:55,artworkPendingCount:149,
 selfHostedReferenceCountAfter:202,externalImageReferenceCountAfter:0,
 localPendingImageCount:2,archiveVerificationStatus:"204_decoded_owned_images_2_held_for_original_print",
 verifiedImageCount:204,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:additions,nextStart:"S-P canonical 057",
 note:"S-P display image pointers all use DCB-owned CDN or local placeholder; source URLs stored only for provenance."});
im.nextStart="S-P canonical 057";im.updatedAt="2026-10-13";
const progress={schemaVersion:1,recordedAt:"2026-10-13",set:"S-P",status:"in_progress",
 canonicalCardSlots:204,canonicalCheckedThrough:56,KoreanArtworkReviewed:55,
 approvedKoreanArtCount:55,heldCardKeys:["S-P_022"],otherKnownIssue:["S-P_115"],
 ownedCdnImagesDisplayed:202,localPendingImagesDisplayed:2,thirdPartyImageHotlinksRemaining:0,
 newThemeSlotsAdded:added,themeAdditions:additions,priorCompletedSetsUntouched:true,
 noOwnershipChanges:true,originImageRequests:0,
 evidence:"data/audits/theme-sp-001-060-Korean-art-review-20261013.json",
 nextSafeStart:"S-P canonical 057 (printed S-P_061)"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",ov),save("data/art-themes.json",art),
 save(a+"theme-series-review-status.json",st),save(a+"theme-image-selfhost-audit.json",im),
 save(a+"theme-sp-series-progress-20261013.json",progress)
]);
console.log(JSON.stringify({accepted,held,ownCDN:hosted,localPending:pendingCount,themeSlots:added,byTheme:additions,next:progress.nextSafeStart},null,2));
