import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const CODE='s8b',DATE='2026-10-15';
const THEMES=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [review,proof,modern,legacy,art,status,hosting,overrides]=await Promise.all([
 read('data/audits/theme-s8b-121-150-Korean-art-review-20261015.json'),
 read('data/audits/theme-visual-evidence/s8b/121-150/visual-index.json'),
 read('data/series.json'),read('data/series-legacy.json'),
 read('data/art-themes.json'),read('data/audits/theme-series-review-status.json'),
 read('data/audits/theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')]);
const targets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()===CODE);
if(targets.length!==1||targets[0].cards?.length!==293)throw Error('s8b master is not unique 293-card Korean set');
const set=targets[0];
const prior=status.reviews?.[set.code]||{};
if(prior.reviewedRanges?.includes('121-150')&&prior.reviewedCardCount>=150){
 console.log('s8b Korean 121-150 already committed; skipping safely');process.exit(0);
}
if(status.execution?.nextStart!=='s8b canonical 121'||status.execution?.currentSet!=='s8b'||
 hosting.nextStart!=='s8b canonical 121'||(prior.reviewedCardCount||0)!==120)
 throw Error('Unsafe s8b checkpoint or competing update; no files changed');
if(review.set!==CODE||review.visuallyReviewedKoreanCards!==30||
 !review.all12ThemesInspected||review.originImageRequests!==0||
 review.items?.length!==30||proof.set!==CODE||proof.range!=='121-150'||
 proof.masterSetCardCount!==293||proof.canonicalCardsChecked!==30||
 proof.verifiedOwnedCdnImageCount!==30||proof.unavailableOwnedCdnImageCount!==0||
 proof.printedNumberMatchCount!==30||proof.koreanNameNonemptyCount!==30||
 proof.cards?.length!==30||proof.sourceRequestCount!==0)
 throw Error('Korean identity/image proof or 12-theme visual review incomplete');
const corrections=review.koreanMasterNameCorrections;
if(JSON.stringify(Object.keys(corrections||{}).sort())!==JSON.stringify(['135']))
 throw Error('Unexpected Korean name corrections');
const groupMap=new Map(art.groups.map(group=>[group.code,group]));
for(const theme of THEMES)if(!Array.isArray(groupMap.get(theme)?.cards))throw Error('Missing theme '+theme);
overrides.sets??={};overrides.sets[CODE]??={};
const batchCodes=set.cards.slice(120,150).map(c=>c.code);
const currentSlotCounts={};
let added=0,internalized=0;
for(let i=0;i<30;i++){
 const num=i+121,id=String(num).padStart(3,'0'),c=set.cards[num-1],p=proof.cards[i],row=review.items[i];
 const key='S8B_'+id;
 if(!c||!p||!row||c.code.toLowerCase()!==CODE+'_'+id+'/184'||
 p.masterCode.toLowerCase()!==c.code.toLowerCase()||p.canonicalOrder!==num||
 row.canonicalOrder!==num||row.cardKey!==key||p.expectedPrintedNumber!==id+'/184'||
 !p.printedNumberMatches||!row.artObservation?.trim()||
 p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
 p.imageCheck.format!=='WEBP'||p.imageCheck.dimensions?.join(',')!=='420,586'||
 !((p.ownedCdnUrl?.startsWith('https://dcb-card-images-modern-2026.pages.dev/')&&
     p.rawSource?.startsWith('https://cards.image.pokemonkorea.co.kr/'))||
     (num===128&&p.rawSource==='https://static.tcgexchange.kr/63423407628da263ea2d2950f7e8ca40.png'&&
       p.ownedCdnUrl==='https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/bb198ab3bbcceaa9.webp'))||
 (c.sourceImage||c.image)!==p.rawSource||p.priorThemes?.length!==0||
 THEMES.some(t=>groupMap.get(t).cards.some(x=>x.code===key)))
 throw Error('Unsafe s8b identity / hosted image / existing theme mismatch at '+num);
 const fix=corrections[id];
 if(fix){
   if(!p.koreanNameNonempty||c.name!==fix.before||p.name!==fix.before||row.name!==fix.after)
     throw Error('Korean printed-name metadata correction mismatch at '+num);
   c.name=fix.after;
 }else if(!p.koreanNameNonempty||c.name!==p.name||row.name!==c.name){
   throw Error('Korean name identity mismatch at '+num);
 }
 const used=new Set();
 for(const t of row.matchedThemes){
  if(!THEMES.includes(t)||used.has(t)||!row.categories?.[t]?.trim())
   throw Error('Unjustified/duplicate theme at '+num+' '+t);
  used.add(t);
  groupMap.get(t).cards.push({
   code:key,name:c.name,series:'S',set:set.code,setName:set.displayName||'VMAX 클라이맥스',
   cardNumber:id+'/184',rarity:c.rarity||'',category:row.categories[t],
   image:p.ownedCdnUrl,
   evidence:'한국판 VMAX 클라이맥스 s8b '+id+'/184 일러스트 직접 검수: '+row.artObservation+
     ' 한국판 카드/자가 저장 이미지 증빙: data/audits/theme-visual-evidence/s8b/121-150/visual-index.json'
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
if(JSON.stringify(batchCodes)!==JSON.stringify(set.cards.slice(120,150).map(x=>x.code)))
 throw Error('Canonical card slot identities changed');
if(JSON.stringify(currentSlotCounts)!==JSON.stringify(review.newThemeSlotsThisBatch))
 throw Error('Actual classified theme counts differ from reviewed evidence');
if(added!==36||currentSlotCounts.color!==30||currentSlotCounts.season!==5||currentSlotCounts.sunset!==1)
 throw Error('Theme slot expectations mismatch');
const next='s8b canonical 151';
status.reviews[set.code]={...prior,status:'in_progress',reviewedAt:DATE,
 reviewedCardCount:150,verifiedSelfHostedImageCount:150,reviewedRanges:[...(prior.reviewedRanges||[]),'121-150'],
 reviewedThemes:THEMES,heldCards:[],newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
 partialReviewEvidence:'data/audits/theme-s8b-121-150-Korean-art-review-20261015.json',
 archiveVerificationStatus:'s8b_121-150_30_Korean_DCB_owned_CDN_images_decoded',
 nextStart:next,
 note:'한국판 VMAX 클라이맥스 001-150 전체 150/293장 시각검수 완료. 이번 구간 자체 CDN 29 modern+1 legacy 디코딩, 135 메아리호른 이름에서 내부 태그 분리. 이전 120장 보존.'};
status.execution.currentEra='S';status.execution.currentSet='s8b';
status.execution.lastSafeCheckpoint='s8b canonical 001-150 (150/293) Korean print/art and DCB owned image proof';
status.execution.nextStart=next;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({
 task:6,set:'s8b',range:'canonical 121-150 Korean VMAX Climax',
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'30_Korean_DCB_owned_CDN_images_decoded',verifiedImageCount:30,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:29,legacyArchiveImages:1,
 newlyInternalizedReferenceCount:internalized,themeAdditions:currentSlotCounts,
 koreanCardNameCorrections:['s8b_135/184'],nextStart:next,
 note:'s8b 121-150 29 modern+1 legacy Korean prints confirmed. Normalized master Korean printed title at 135; image source provenance intact.'
});
hosting.nextStart=next;hosting.updatedAt=DATE;art.updatedAt=DATE;
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
 save('data/audits/theme-series-review-status.json',status),
 save('data/audits/theme-image-selfhost-audit.json',hosting),
 save('data/audits/theme-s8b-121-150-progress-20261015.json',{
  schemaVersion:1,recordedAt:DATE,set:CODE,status:'in_progress',
  totalMasterCards:293,reviewedCanonicalCards:150,remainingUnreviewed:143,
  newThemeSlotsThisBatch:currentSlotCounts,added,ownedCDNImagesVerified:30,
  imagesPointingToOwnedCDN:30,modernArchiveImages:29,legacyArchiveImages:1,newlyInternalizedReferenceCount:internalized,
  correctedKoreanNames:['s8b_135/184'],originRequests:0,
  proof:'data/audits/theme-visual-evidence/s8b/121-150/visual-index.json',nextStart:next
 })]);
console.log(JSON.stringify({set:CODE,reviewed:150,remaining:143,themeSlots:added,
 correctedNames:['135'],newlyInternalizedReferenceCount:internalized,next}));
