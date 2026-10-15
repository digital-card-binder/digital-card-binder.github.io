import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const CODE='s9',DATE='2026-10-15';
const THEMES=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [review,proof,modern,legacy,art,status,hosting,overrides]=await Promise.all([
 read('data/audits/theme-s9-091-120-Korean-art-review-20261015.json'),
 read('data/audits/theme-visual-evidence/s9/091-120/visual-index.json'),
 read('data/series.json'),read('data/series-legacy.json'),
 read('data/art-themes.json'),read('data/audits/theme-series-review-status.json'),
 read('data/audits/theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')]);
const targets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()===CODE);
if(targets.length!==1||targets[0].cards?.length!==127)throw Error('s9 master is not unique 127-card Korean set');
const set=targets[0];
const prior=status.reviews?.[set.code]||{};
if(prior.reviewedRanges?.includes('091-120')&&prior.reviewedCardCount>=120){
 console.log('s9 Korean 091-120 already committed; skipping safely');process.exit(0);
}
if(status.execution?.nextStart!=='s9 canonical 091'||status.execution?.currentSet!=='s9'||
 hosting.nextStart!=='s9 canonical 091'||(prior.reviewedCardCount||0)!==90)
 throw Error('Unsafe s9 checkpoint or competing update; no files changed');
if(review.set!==CODE||review.visuallyReviewedKoreanCards!==30||
 !review.all12ThemesInspected||review.originImageRequests!==0||
 review.items?.length!==30||proof.set!==CODE||proof.range!=='091-120'||
 proof.masterSetCardCount!==127||proof.canonicalCardsChecked!==30||
 proof.verifiedOwnedCdnImageCount!==30||proof.unavailableOwnedCdnImageCount!==0||
 proof.printedNumberMatchCount!==30||proof.koreanNameNonemptyCount!==30||
 proof.cards?.length!==30||proof.sourceRequestCount!==0)
 throw Error('Korean identity/image proof or 12-theme visual review incomplete');
const corrections=review.koreanMasterNameCorrections;
if(JSON.stringify(Object.keys(corrections||{}).sort())!==JSON.stringify([]))
 throw Error('Unexpected Korean name corrections');
const groupMap=new Map(art.groups.map(group=>[group.code,group]));
for(const theme of THEMES)if(!Array.isArray(groupMap.get(theme)?.cards))throw Error('Missing theme '+theme);
overrides.sets??={};overrides.sets[CODE]??={};
const currentKeys=set.cards.slice(90,120).map(c=>c.code);
const currentSlotCounts={};

let added=0,internalized=0;
for(let i=0;i<30;i++){
 const num=i+91,id=String(num).padStart(3,'0'),c=set.cards[num-1],p=proof.cards[i],row=review.items[i];
 const key='S9_'+id;
 if(!c||!p||!row||c.code.toLowerCase()!==CODE+'_'+id+'/100'||
 p.masterCode.toLowerCase()!==c.code.toLowerCase()||p.canonicalOrder!==num||
 row.canonicalOrder!==num||row.cardKey!==key||p.expectedPrintedNumber!==id+'/100'||
 !p.printedNumberMatches||!row.artObservation?.trim()||
 p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
 p.imageCheck.format!=='WEBP'||p.imageCheck.dimensions?.join(',')!=='420,586'||
 !(p.ownedCdnUrl?.startsWith('https://dcb-card-images-modern-2026.pages.dev/')&&
      p.rawSource?.startsWith('https://cards.image.pokemonkorea.co.kr/'))||
 (c.sourceImage||c.image)!==p.rawSource||p.priorThemes?.length!==0||
 THEMES.some(t=>groupMap.get(t).cards.some(x=>x.code===key)))
 throw Error('Unsafe s9 identity / hosted image / existing theme mismatch at '+num);
 const correction=corrections[id];
 if(correction){
  if(!p.koreanNameNonempty||c.name!==correction.before||row.name!==correction.after||p.name!==correction.before)throw Error('Incorrect Korean VSTAR print name correction at '+num);
  c.name=correction.after;
 }else if(!p.koreanNameNonempty||c.name!==p.name||row.name!==c.name){
  throw Error('Korean name identity mismatch at '+num);
 }
 const used=new Set();
 for(const t of row.matchedThemes){
  if(!THEMES.includes(t)||used.has(t)||!row.categories?.[t]?.trim())
   throw Error('Unjustified/duplicate theme at '+num+' '+t);
  used.add(t);
  groupMap.get(t).cards.push({
   code:key,name:c.name,series:'S',set:set.code,setName:set.displayName||'스타버스',
   cardNumber:id+'/100',rarity:c.rarity||'',category:row.categories[t],
   image:p.ownedCdnUrl,
   evidence:'한국판 스타버스 s9 '+id+'/100 일러스트 직접 검수: '+row.artObservation+
     ' 한국판 카드/자가 저장 이미지 증빙: data/audits/theme-visual-evidence/s9/091-120/visual-index.json'
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
if(JSON.stringify(currentKeys)!==JSON.stringify(set.cards.slice(90,120).map(x=>x.code)))
 throw Error('Canonical card slot identities changed');
if(JSON.stringify(currentSlotCounts)!==JSON.stringify(review.newThemeSlotsThisBatch))
 throw Error('Actual classified theme counts differ from reviewed evidence');
if(added!==43||currentSlotCounts.color!==30||currentSlotCounts.season!==9||
 currentSlotCounts.street!==3||currentSlotCounts.night!==1)
 throw Error('Theme slot expectations mismatch');
const next='s9 canonical 121';
status.reviews[set.code]={...prior,status:'in_progress',reviewedAt:DATE,
 reviewedCardCount:120,verifiedSelfHostedImageCount:120,reviewedRanges:[...(prior.reviewedRanges||[]),'091-120'],
 reviewedThemes:THEMES,heldCards:[],newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
 partialReviewEvidence:'data/audits/theme-s9-091-120-Korean-art-review-20261015.json',
 archiveVerificationStatus:'s9_091-120_30_Korean_DCB_owned_CDN_images_decoded',
 nextStart:next,
 note:'스타버스 001-120 한국판 120장 시각검수 완료. 091-120 modern CDN 30장 정상 디코딩. 남은 7장.'};
status.execution.currentEra='S';status.execution.currentSet='s9';
status.execution.lastSafeCheckpoint='s9 canonical 001-120 (120/127) Korean print/art and DCB owned image proof';
status.execution.nextStart=next;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({
 task:6,set:'s9',range:'canonical 091-120 Korean Battle Region',
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'30_Korean_DCB_owned_CDN_images_decoded',verifiedImageCount:30,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:30,legacyArchiveImages:0,
 newlyInternalizedReferenceCount:internalized,themeAdditions:currentSlotCounts,
 koreanCardNameCorrections:[],nextStart:next,
 note:'Reviewed Korean s9 091-120, modern owned CDN 30/30 decoded; kept completed 001-090 themes and print corrections intact.'
});
hosting.nextStart=next;hosting.updatedAt=DATE;art.updatedAt=DATE;
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
 save('data/audits/theme-series-review-status.json',status),
 save('data/audits/theme-image-selfhost-audit.json',hosting),
 save('data/audits/theme-s9-091-120-progress-20261015.json',{
  schemaVersion:1,recordedAt:DATE,set:CODE,status:'in_progress',
  totalMasterCards:127,reviewedCanonicalCards:120,remainingUnreviewed:7,
  newThemeSlotsThisBatch:currentSlotCounts,added,ownedCDNImagesVerified:30,
  imagesPointingToOwnedCDN:30,modernArchiveImages:30,legacyArchiveImages:0,newlyInternalizedReferenceCount:internalized,
  correctedKoreanNames:[],originRequests:0,
  proof:'data/audits/theme-visual-evidence/s9/091-120/visual-index.json',nextStart:next
 })]);
console.log(JSON.stringify({set:CODE,reviewed:120,remaining:7,themeSlots:added,
 correctedNames:[],newlyInternalizedReferenceCount:internalized,next}));
