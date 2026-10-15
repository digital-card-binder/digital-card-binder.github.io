import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const CODE='s9a',DATE='2026-10-15';
const THEMES=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [review,proof,modern,legacy,art,status,hosting,overrides]=await Promise.all([
 read('data/audits/theme-s9a-031-060-Korean-art-review-20261015.json'),
 read('data/audits/theme-visual-evidence/s9a/031-060/visual-index.json'),
 read('data/series.json'),read('data/series-legacy.json'),
 read('data/art-themes.json'),read('data/audits/theme-series-review-status.json'),
 read('data/audits/theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')]);
const targets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()===CODE);
if(targets.length!==1||targets[0].cards?.length!==93)throw Error('s9a master is not unique 93-card Korean set');
const set=targets[0];
const prior=status.reviews?.[set.code]||{};
if(prior.reviewedRanges?.includes('031-060')&&prior.reviewedCardCount>=60){
 console.log('s9a Korean 031-060 already committed; skipping safely');process.exit(0);
}
if(status.execution?.nextStart!=='s9a canonical 031'||status.execution?.currentSet!=='s9a'||
 hosting.nextStart!=='s9a canonical 031'||(prior.reviewedCardCount||0)!==30)
 throw Error('Unsafe s9a checkpoint or competing update; no files changed');
if(review.set!==CODE||review.visuallyReviewedKoreanCards!==30||
 !review.all12ThemesInspected||review.originImageRequests!==0||
 review.items?.length!==30||proof.set!==CODE||proof.range!=='031-060'||
 proof.masterSetCardCount!==93||proof.canonicalCardsChecked!==30||
 proof.verifiedOwnedCdnImageCount!==30||proof.unavailableOwnedCdnImageCount!==0||
 proof.printedNumberMatchCount!==30||proof.koreanNameMatchCount!==29||
 proof.cards?.length!==30||proof.sourceRequestCount!==0)
 throw Error('Korean identity/image proof or 12-theme visual review incomplete');
const corrections=review.koreanMasterNameCorrections;
if(JSON.stringify(Object.keys(corrections||{}).sort())!==JSON.stringify(['045']))
 throw Error('Unexpected Korean name corrections');
const groupMap=new Map(art.groups.map(group=>[group.code,group]));
for(const theme of THEMES)if(!Array.isArray(groupMap.get(theme)?.cards))throw Error('Missing theme '+theme);
overrides.sets??={};overrides.sets[CODE]??={};
const currentKeys=set.cards.slice(30,60).map(c=>c.code);
const currentSlotCounts={};
const knownLegacy054={
 raw:'https://static.tcgexchange.kr/49a993b151db029b2c3e0513df27d87f.png',
 cdn:'https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/f3e42ea1dbdb9b89.webp'
};
let added=0,internalized=0;
for(let i=0;i<30;i++){
 const num=i+31,id=String(num).padStart(3,'0'),c=set.cards[num-1],p=proof.cards[i],row=review.items[i];
 const key='S9A_'+id;
 if(!c||!p||!row||c.code.toLowerCase()!==CODE+'_'+id+'/067'||
 p.masterCode.toLowerCase()!==c.code.toLowerCase()||p.canonicalOrder!==num||
 row.canonicalOrder!==num||row.cardKey!==key||p.expectedPrintedNumber!==id+'/067'||
 !p.printedNumberMatches||!row.artObservation?.trim()||
 p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
 p.imageCheck.format!=='WEBP'||p.imageCheck.dimensions?.join(',')!=='420,586'||
 !((p.ownedCdnUrl?.startsWith('https://dcb-card-images-modern-2026.pages.dev/')&&
      p.rawSource?.startsWith('https://cards.image.pokemonkorea.co.kr/'))||
     (num===54&&p.rawSource===knownLegacy054.raw&&p.ownedCdnUrl===knownLegacy054.cdn))||
 (c.sourceImage||c.image)!==p.rawSource||p.priorThemes?.length!==0||
 THEMES.some(t=>groupMap.get(t).cards.some(x=>x.code===key)))
 throw Error('Unsafe s9a identity / hosted image / existing theme mismatch at '+num);
 const correction=corrections[id];
 if(correction){
  if(p.koreanNameMatches||c.name!==correction.before||row.name!==correction.after||
   p.expectedKoreanName!==correction.after)throw Error('Incorrect Korean name fix at '+num);
  c.name=correction.after;
 } else if(!p.koreanNameMatches||c.name!==p.name||row.name!==c.name){
  throw Error('Korean name inconsistency at '+num);
 }
 const used=new Set();
 for(const t of row.matchedThemes){
  if(!THEMES.includes(t)||used.has(t)||!row.categories?.[t]?.trim())
   throw Error('Unjustified/duplicate theme at '+num+' '+t);
  used.add(t);
  groupMap.get(t).cards.push({
   code:key,name:c.name,series:'S',set:set.code,setName:set.displayName||'배틀리전',
   cardNumber:id+'/067',rarity:c.rarity||'',category:row.categories[t],
   image:p.ownedCdnUrl,
   evidence:'한국판 배틀리전 s9a '+id+'/067 일러스트 직접 검수: '+row.artObservation+
     ' 한국판 카드/자가 저장 이미지 증빙: data/audits/theme-visual-evidence/s9a/031-060/visual-index.json'
  });
  currentSlotCounts[t]=(currentSlotCounts[t]||0)+1;added++;
 }
 const oldImage=String(c.image||'');
 if(!c.sourceImage)c.sourceImage=p.rawSource;
 if(oldImage!==p.ownedCdnUrl){
  if(!oldImage.includes('dcb-card-images-'))internalized++;
  c.image=p.ownedCdnUrl;
 }
 overrides.sets[CODE][c.code.toLowerCase()]=p.ownedCdnUrl;
}
if(JSON.stringify(currentKeys)!==JSON.stringify(set.cards.slice(30,60).map(x=>x.code)))
 throw Error('Canonical card slot identities changed');
if(JSON.stringify(currentSlotCounts)!==JSON.stringify(review.newThemeSlotsThisBatch))
 throw Error('Actual classified theme counts differ from reviewed evidence');
if(added!==50||currentSlotCounts.color!==30||currentSlotCounts.season!==17||
 currentSlotCounts.night!==2||currentSlotCounts.sunset!==1)
 throw Error('Theme slot expectations mismatch');
const next='s9a canonical 061';
status.reviews[set.code]={...prior,status:'in_progress',reviewedAt:DATE,
 reviewedCardCount:60,verifiedSelfHostedImageCount:60,reviewedRanges:[...(prior.reviewedRanges||[]),'031-060'],
 reviewedThemes:THEMES,heldCards:[],newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
 partialReviewEvidence:'data/audits/theme-s9a-031-060-Korean-art-review-20261015.json',
 archiveVerificationStatus:'s9a_031-060_30_Korean_DCB_owned_CDN_images_decoded',
 nextStart:next,
 note:'배틀리전 001-060 60장 한국판 일러스트 12테마 검수 완료. 045 한국판 카드의 VSTAR 표기로 정정. 031-060 자체 저장 이미지 30장 디코딩 확인(현대 29/legacy 1). 세트 93장 중 60장 완료.'};
status.execution.currentEra='S';status.execution.currentSet='s9a';
status.execution.lastSafeCheckpoint='s9a canonical 001-060 (60/93) Korean print/art and DCB owned image proof';
status.execution.nextStart=next;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({
 task:6,set:'s9a',range:'canonical 031-060 Korean Battle Region',
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'30_Korean_DCB_owned_CDN_images_decoded',verifiedImageCount:30,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:29,legacyArchiveImages:1,
 newlyInternalizedReferenceCount:internalized,themeAdditions:currentSlotCounts,
 koreanCardNameCorrections:['s9a_045/067'],nextStart:next,
 note:'Reviewed real Korean cards 031-060 on owned CDN. Corrected 045 VMAX to Korean VSTAR, preserved original source and verified legacy card 054. Origin requests 0.'
});
hosting.nextStart=next;hosting.updatedAt=DATE;art.updatedAt=DATE;
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
 save('data/audits/theme-series-review-status.json',status),
 save('data/audits/theme-image-selfhost-audit.json',hosting),
 save('data/audits/theme-s9a-031-060-progress-20261015.json',{
  schemaVersion:1,recordedAt:DATE,set:CODE,status:'in_progress',
  totalMasterCards:93,reviewedCanonicalCards:60,remainingUnreviewed:33,
  newThemeSlotsThisBatch:currentSlotCounts,added,ownedCDNImagesVerified:30,
  imagesPointingToOwnedCDN:30,modernArchiveImages:29,legacyArchiveImages:1,newlyInternalizedReferenceCount:internalized,
  correctedKoreanNames:['s9a_045/067'],originRequests:0,
  proof:'data/audits/theme-visual-evidence/s9a/031-060/visual-index.json',nextStart:next
 })]);
console.log(JSON.stringify({set:CODE,reviewed:60,remaining:33,themeSlots:added,
 correctedNames:['045'],newlyInternalizedReferenceCount:internalized,next}));
