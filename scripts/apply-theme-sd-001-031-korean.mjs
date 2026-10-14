import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async (p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,idx,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-sd-001-031-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/sD/001-031/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(A+"theme-series-review-status.json"),
 read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const found=[...modern,...legacy].filter(s=>String(s.code||"").toUpperCase()==="SD");
if(found.length!==1||found[0].cards?.length!==31)throw Error("sD master must have exactly 31 original card slots");
const master=found[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===31){
 console.log("sD already complete, no overwrites");process.exit(0);
}
if(prior?.status==="complete"||(prior?.reviewedCardCount||0)>0||
 images.nextStart!=="sD canonical 001"||state.execution?.nextStart!=="sD canonical 001"||
 ev.set!=="sD"||ev.expectedCanonicalCards!==31||ev.physicalPrintedNumberCards!==31||
 ev.approvedKoreanImages!==31||ev.ownedCDNImagesDecoded!==31||
 ev.masterKoreanNamesMissingBeforeReview!==31||
 !ev.masterOrderDiffersFromPrintedNumberOrder||!ev.masterOrderChangeForbidden||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==31||
 idx.set!=="sD"||idx.cardCount!==31||idx.masterSetCardCount!==31||
 idx.cards?.length!==31||idx.verificationCounts?.verified!==31||
 idx.verificationCounts?.missing!==0||idx.masterMissingKoreanNames!==31||
 idx.sheets?.length!==3)
 throw Error("sD name-restoration and original Korean photo audit safety gate not met");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("missing theme "+t);
for(const g of art.groups)for(const c of g.cards||[]){
 if(String(c.set||"").toUpperCase()==="SD"||/^SD_\d{3}$/.test(String(c.code||"").toUpperCase()))
 throw Error("Preexisting sD theme must not be duplicated: "+c.code+"/"+g.code);
}
const priorCodes=master.cards.map(c=>String(c.code||""));
const printIds=new Set(priorCodes);
if(printIds.size!==31||[...printIds].some(x=>!/^sd_\d{3}\/031$/i.test(x)))
 throw Error("sD original internal card keys are not 31 distinct Korean numbered prints");
const expectedSeason=new Set([2,3,5,7,8,9,10,11,12,13,16,17,18,19,20,21,23,24,26,27,29,30,31]);
const expectedStreet=new Set([26]);
overrides.sets??={};overrides.sets.sd??={};
let checked=0,namesRestored=0,slots=0;const byTheme={};
for(let i=0;i<31;i++){
 const n=i+1,c=master.cards[i],p=idx.cards[i],row=ev.items[i];
 const keyPart=String(c?.code||"").match(/^sd_(\d{3})\/031$/i);
 const key=keyPart?"SD_"+keyPart[1]:"";
 const expectedThemes=[...(expectedSeason.has(n)?["season"]:[]),...(expectedStreet.has(n)?["street"]:[]),"color"];
 if(!c||!p||!row||!keyPart||p.canonicalOrder!==n||row.canonicalOrder!==n||
  String(c.code||"").toLowerCase()!==String(p.masterCode||"").toLowerCase()||
  String(c.code||"").toLowerCase()!==String(row.masterCode||"").toLowerCase()||
  row.cardKey!==key||row.physicalPrintedNumber!==keyPart[1]+"/031"||
  p.name!==""||c.name!==""||row.masterKoreanNameAtPreflight!==""||
  !row.nameRestorationRequired||!row.koreanName?.trim()||
  row.illustrationType!=="pokemon"||!row.artObservation?.trim()||
  !row.all12ThemesInspected||!row.imageInKorean||row.originalSourceRequests!==0||
  row.matchedThemes?.join(",")!==expectedThemes.join(",")||!row.colorCategory||
  row.existingThemes?.length!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/sD/001-031/sD-001-031-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
  p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !p.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
  throw Error("sD 31 Korean art/printed identity/name evidence mismatch at canonical "+n);
 c.name=row.koreanName;namesRestored++;
 if(c.image!==p.cdnUrl){if(c.image&&!c.sourceImage)c.sourceImage=c.image;c.image=p.cdnUrl;}
 overrides.sets.sd[c.code.toLowerCase()]=p.cdnUrl;
 for(const theme of row.matchedThemes){
  const g=groups.get(theme);
  if(!g)throw Error("unknown theme "+theme);
  g.cards.push({
   code:row.cardKey,name:c.name,series:"S",set:master.code,
   setName:master.displayName||master.name,
   cardNumber:row.physicalPrintedNumber,rarity:c.rarity||"",
   category:theme==="color"?row.colorCategory:theme==="street"?"거리·도시":"계절·풍경",
   image:p.cdnUrl,
   evidence:"한국판 sD "+row.physicalPrintedNumber+" 실제 카드 그림 12테마 검수 및 마스터 이름 복원: "+
     row.artObservation+". 시트 "+row.proofImage+". 사용자 소유 CDN 확인; 기존 마스터 슬롯 순서 보존."
  });
  byTheme[theme]=(byTheme[theme]||0)+1;slots++;
 }
 checked++;
}
if(master.cards.map(c=>String(c.code)).join(",")!==priorCodes.join(",")||
 checked!==31||namesRestored!==31||slots!==55||
 byTheme.color!==31||byTheme.season!==23||byTheme.street!==1||
 Object.keys(byTheme).length!==3||
 ev.themeCounts?.color!==31||ev.themeCounts?.season!==23||ev.themeCounts?.street!==1)
 throw Error("sD 31 restored names / 55 theme slots / original card order invariant failed");
state.reviews??={};
state.reviews[master.code]={...prior,status:"complete",reviewedAt:"2026-10-14",
 reviewedCardCount:31,reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:31,
 newlyAddedThemeSlotCount:55,previousMissingKoreanNamesRestored:31,
 preservedMasterCanonicalOrder:true,priorThemeSlotsPreserved:0,
 fullSetEvidence:A+"theme-sd-001-031-Korean-art-review-20261014.json",
 archiveVerificationStatus:"31_Korean_owned_CDN_images_decoded_and_artwork_reviewed",
 note:"sD 한국판 31장 시각검수. 마스터에 빈 한국어 카드명 31건 실제 사진에서 복원. 인쇄번호 순서와 원래 저장 순서가 다른 위치도 수집 키·원본 배열 순서 보존. 총 55개 테마 분류, 원본 소스 요청 0."};
state.execution.currentEra="S";state.execution.currentSet="s12a";
state.execution.lastSafeCheckpoint="sD canonical order 001-031 (31/31), 31 Korean names restored; all original print keys and order preserved";
state.execution.nextStart="s12a canonical 001";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"sD",range:"canonical 001-031 Korean 31-card set; physically printed card key order preserved",
 canonicalCardCount:31,artworkVisuallyVerifiedCount:31,artworkPendingCount:0,
 selfHostedReferenceCountAfter:31,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"31_Korean_owned_CDN_images_decoded",
 verifiedImageCount:31,unverifiedImageCount:0,brokenReferenceCount:0,
 missingKoreanNamesRestored:31,masterSlotOrderChanges:0,
 themeAdditions:byTheme,nextStart:"s12a canonical 001",
 note:"Exact Korean artwork restored all originally missing master names, preserving printed card IDs, 31 original slots and collected card keys."});
images.nextStart="s12a canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"sD",status:"complete",
 KoreanMasterCards:31,actualPrintedNumberCards:31,KoreanArtVerified:31,ownedCDNImagesVerified:31,
 masterMissingKoreanNamesRestored:31,masterCanonicalOrderChanged:false,
 themeSlotsAdded:55,byTheme,
 proof:A+"theme-visual-evidence/sD/001-031/visual-index.json",
 fullSetEvidence:A+"theme-sd-001-031-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"s12a canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-sd-set-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"sD",reviewed:checked,restoredNames:namesRestored,themeSlots:slots,
 byTheme,masterOrderUnchanged:true,originDownloads:0,next:images.nextStart}));
