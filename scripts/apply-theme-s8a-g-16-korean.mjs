import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-s8a-g-001-016-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/S8a-G/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const matches=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="S8A-G");
if(matches.length!==1||matches[0].cards?.length!==16)throw Error("S8a-G master size/identity mismatch");
const master=matches[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===16){console.log("S8a-G already complete");process.exit(0);}
if(prior?.status==="complete"||prior?.reviewedCardCount>0||images.nextStart!=="S8a-G canonical 001"||
 ev.set!=="S8a-G"||ev.expectedCanonicalCards!==16||ev.officiallyNumberedCards!==16||
 ev.unnumberedBasicEnergyCards!==0||ev.items?.length!==16||ev.approvedKoreanPrintedImages!==16||
 ev.archiveDecoded!==16||!ev.all12ThemesInspected||ev.originImageRequests!==0||
 index.cardCount!==16||index.cards?.length!==16||index.verificationCounts?.verified!==16||
 index.verificationCounts?.missing!==0||index.masterMissingKoreanNames!==0)
 throw Error("S8a-G Korean artwork/image checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing 12 independent theme "+t);
for(const g of art.groups)for(const card of g.cards||[])if(String(card.set||"").toUpperCase()==="S8A-G"||
 /^S8A-G_\d{3}$/.test(String(card.code||"").toUpperCase()))throw Error("Preexisting S8a-G theme must not be overwritten");
overrides.sets??={};overrides.sets["s8a-g"]??={};
let verified=0,added=0,priorImageProvenancePreserved=0;
const addedThemes={};
for(let i=0;i<16;i++){
 const n=i+1,c=master.cards[i],p=index.cards[i],row=ev.items[i],num=String(n).padStart(3,"0");
 const key="S8a-G_"+num,printed=num+"/015",proof="data/audits/theme-visual-evidence/S8a-G/S8a-G-"+(n===16?"02":"01")+".webp.b64";
 if(!c||!p||!row||row.canonicalOrder!==n||p.canonicalOrder!==n||
 row.cardKey!==key||String(c.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
 String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
 row.koreanName!==c.name||p.name!==c.name||row.ownedCDNUrl!==p.cdnUrl||
 row.physicalPrintedNumber!==printed||row.syntheticIdentifierOnly||row.proofImage!==proof||
 !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
 row.matchedThemes?.join(",")!==(row.seasonCategory?"season,color":"color")||
 !row.colorCategory||p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
 !p.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/")||
 c.code.toLowerCase()!=="s8a-g_"+num+"/015")
  throw Error("Korean S8a-G printed card / archive mismatch at "+n);
 if(c.image!==p.cdnUrl){if(c.image&&!c.sourceImage){c.sourceImage=c.image;priorImageProvenancePreserved++;}c.image=p.cdnUrl;}
 overrides.sets["s8a-g"][c.code.toLowerCase()]=p.cdnUrl;
 verified++;
 for(const t of row.matchedThemes){
  const g=groups.get(t);
  g.cards.push({code:key,name:c.name,series:"S",set:master.code,setName:master.name||master.displayName,
    cardNumber:printed,rarity:c.rarity||"",category:t==="color"?row.colorCategory:row.seasonCategory,
    image:p.cdnUrl,evidence:"한국판 S8a-G 일러스트 실물 12테마 검수: "+row.artObservation+
      ". 확인 시트 "+row.proofImage+" 자체 CDN, 외부 원본 핫링크 없음."});
  addedThemes[t]=(addedThemes[t]||0)+1;added++;
 }
}
if(verified!==16||added!==21||addedThemes.color!==16||addedThemes.season!==5)
 throw Error("Expected S8a-G 16 cards, 21 independent theme assignments");
state.reviews??={};
state.reviews[master.code]={...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:16,
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:16,newlyAddedThemeSlotCount:21,
 priorThemeSlotsPreserved:0,fullSetEvidence:A+"theme-s8a-g-001-016-Korean-art-review-20261014.json",
 archiveVerificationStatus:"16_Korean_owned_CDN_webp_decoded_and_artworks_reviewed",
 note:"한국판 골든 박스 001/015-016/015, 전 16장 자체 CDN 디코딩 및 12테마 시각검수. 016/015 기본 번개 에너지 번호 보존. 기존 소유 기록 불변."};
state.execution.currentEra="S";state.execution.currentSet="SN";
state.execution.lastSafeCheckpoint="S8a-G 16/16 Korean prints and 12 themes verified, own CDN decoded 16/16";
state.execution.nextStart="SN canonical 001";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:master.code,range:"canonical 001-016 full Korean 25th ANNIVERSARY GOLDEN BOX",
 canonicalCardCount:16,artworkVisuallyVerifiedCount:16,artworkPendingCount:0,
 selfHostedReferenceCountAfter:16,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"16_Korean_own_CDN_original_images_decoded",
 verifiedImageCount:16,unverifiedImageCount:0,brokenReferenceCount:0,
 numberedBasicLightningEnergyPreserved:1,themeAdditions:addedThemes,nextStart:"SN canonical 001",
 note:"16 physically numbered Korean cards, including 016/015 basic lightning energy; existing self-host archive used exclusively."});
images.nextStart="SN canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const report={schemaVersion:1,recordedAt:"2026-10-14",set:"S8a-G",status:"complete",
 KoreanMasterCards:16,actualPrintedNumberCards:16,unnumberedBasicEnergiesWithInternalKeys:0,
 KoreanArtVerified:16,ownedCdnImages:16,newThemeSlots:added,themesAdded:addedThemes,
 initialArtworkAudit:A+"theme-visual-evidence/S8a-G/visual-index.json",
 fullReviewEvidence:A+"theme-s8a-g-001-016-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SN canonical 001"};
await Promise.all([save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s8a-g-set-progress-20261014.json",report)]);
console.log(JSON.stringify({set:"S8a-G",reviewed:verified,themeSlots:added,byTheme:addedThemes,originRequests:0,next:images.nextStart}));
