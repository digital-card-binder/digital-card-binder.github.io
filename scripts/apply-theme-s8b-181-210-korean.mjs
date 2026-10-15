import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const CODE='s8b',DATE='2026-10-15';
const THEMES=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [review,proof,modern,legacy,art,status,hosting,overrides]=await Promise.all([
 read('data/audits/theme-s8b-181-210-Korean-art-review-20261015.json'),
 read('data/audits/theme-visual-evidence/s8b/181-210/visual-index.json'),
 read('data/series.json'),read('data/series-legacy.json'),
 read('data/art-themes.json'),read('data/audits/theme-series-review-status.json'),
 read('data/audits/theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')]);
const targets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()===CODE);
if(targets.length!==1||targets[0].cards?.length!==293)throw Error('s8b master is not unique 293-card Korean set');
const set=targets[0];
const prior=status.reviews?.[set.code]||{};
if(prior.reviewedRanges?.includes('181-210')&&prior.reviewedCardCount>=210){
 console.log('s8b Korean 181-210 already committed; skipping safely');process.exit(0);
}
if(status.execution?.nextStart!=='s8b canonical 181'||status.execution?.currentSet!=='s8b'||
 hosting.nextStart!=='s8b canonical 181'||(prior.reviewedCardCount||0)!==180)
 throw Error('Unsafe s8b checkpoint or competing update; no files changed');
if(review.set!==CODE||review.visuallyReviewedKoreanCards!==30||
 !review.all12ThemesInspected||review.originImageRequests!==0||
 review.items?.length!==30||proof.set!==CODE||proof.range!=='181-210'||
 proof.masterSetCardCount!==293||proof.canonicalCardsChecked!==30||
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
const batchCodes=set.cards.slice(180,210).map(c=>c.code);
const currentSlotCounts={};
let added=0,internalized=0;
for(let i=0;i<30;i++){
 const num=i+181,id=String(num).padStart(3,'0'),c=set.cards[num-1],p=proof.cards[i],row=review.items[i];
 const key='S8B_'+id;
 if([202,209].includes(num)){
   console.log('Preexisting card proof',JSON.stringify({
     num, code:c?.code, raw:p?.rawSource, masterSource:c?.sourceImage||c?.image,
     priorThemes:p?.priorThemes,
     groupCodes:THEMES.filter(t=>groupMap.get(t).cards.some(x=>String(x.code||'').toUpperCase()===key)),
     owned:p?.ownedCdnUrl, imageStatus:p?.imageCheck?.status
   }));
 }
 if(!c||!p||!row||c.code.toLowerCase()!==CODE+'_'+id+'/184'||
 p.masterCode.toLowerCase()!==c.code.toLowerCase()||p.canonicalOrder!==num||
 row.canonicalOrder!==num||row.cardKey!==key||p.expectedPrintedNumber!==id+'/184'||
 !p.printedNumberMatches||!row.artObservation?.trim()||
 p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
 p.imageCheck.format!=='WEBP'||p.imageCheck.dimensions?.join(',')!=='420,586'||
 !(p.ownedCdnUrl?.startsWith('https://dcb-card-images-modern-2026.pages.dev/')&&
     p.rawSource?.startsWith('https://cards.image.pokemonkorea.co.kr/'))||
 (c.sourceImage||c.image)!==p.rawSource||
 JSON.stringify(p.priorThemes||[])!==JSON.stringify([202,209].includes(num)?['sleeping']:[])||
 JSON.stringify(THEMES.filter(t=>groupMap.get(t).cards.some(x=>String(x.code||'').toUpperCase()===key)))!==
 JSON.stringify([202,209].includes(num)?['sleeping']:[]))
 throw Error('Unsafe s8b identity / hosted image / existing theme mismatch at '+num);
 if(!p.koreanNameNonempty||c.name!==p.name||row.name!==c.name){
   throw Error('Korean name identity mismatch at '+num);
 }
 if([202,209].includes(num)){
   const existingSleeping=groupMap.get('sleeping').cards.filter(x=>String(x.code||'').toUpperCase()===key);
   if(existingSleeping.length!==1||existingSleeping[0].name!==c.name||
     row.matchedThemes.includes('sleeping')||!existingSleeping[0].category)
       throw Error('Preexisting sleeping-theme card inconsistent at '+num);
   existingSleeping[0].image=p.ownedCdnUrl;
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
     ' 한국판 카드/자가 저장 이미지 증빙: data/audits/theme-visual-evidence/s8b/181-210/visual-index.json'
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
if(JSON.stringify(batchCodes)!==JSON.stringify(set.cards.slice(180,210).map(x=>x.code)))
 throw Error('Canonical card slot identities changed');
if(JSON.stringify(currentSlotCounts)!==JSON.stringify(review.newThemeSlotsThisBatch))
 throw Error('Actual classified theme counts differ from reviewed evidence');
if(added!==44||currentSlotCounts.color!==30||currentSlotCounts.season!==11||
 currentSlotCounts.street!==1||currentSlotCounts.food!==1||currentSlotCounts.work!==1)
 throw Error('Theme slot expectations mismatch');
const next='s8b canonical 211';
status.reviews[set.code]={...prior,status:'in_progress',reviewedAt:DATE,
 reviewedCardCount:210,verifiedSelfHostedImageCount:210,reviewedRanges:[...(prior.reviewedRanges||[]),'181-210'],
 reviewedThemes:THEMES,heldCards:[],newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
 partialReviewEvidence:'data/audits/theme-s8b-181-210-Korean-art-review-20261015.json',
 archiveVerificationStatus:'s8b_181-210_30_Korean_DCB_owned_CDN_images_decoded',
 nextStart:next,
 note:'한국판 VMAX 클라이맥스 누적 210/293장 직접 검수. 181-210 30장 Modern 자체 CDN 정상, 기존 잠자는 도감 202·209를 보존하면서 44건 추가. 남은 83장.'};
status.execution.currentEra='S';status.execution.currentSet='s8b';
status.execution.lastSafeCheckpoint='s8b canonical 001-210 (210/293) Korean print/art and DCB owned image proof';
status.execution.nextStart=next;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({
 task:6,set:'s8b',range:'canonical 181-210 Korean VMAX Climax',
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'30_Korean_DCB_owned_CDN_images_decoded',verifiedImageCount:30,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:30,legacyArchiveImages:0,
 newlyInternalizedReferenceCount:internalized,themeAdditions:currentSlotCounts,
 koreanCardNameCorrections:[],nextStart:next,
 note:'Verified s8b 181-210 30 modern Korean card images; retained existing S8B_202 and S8B_209 sleeping-theme records without duplicate additions.'
});
hosting.nextStart=next;hosting.updatedAt=DATE;art.updatedAt=DATE;
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
 save('data/audits/theme-series-review-status.json',status),
 save('data/audits/theme-image-selfhost-audit.json',hosting),
 save('data/audits/theme-s8b-181-210-progress-20261015.json',{
  schemaVersion:1,recordedAt:DATE,set:CODE,status:'in_progress',
  totalMasterCards:293,reviewedCanonicalCards:210,remainingUnreviewed:83,
  newThemeSlotsThisBatch:currentSlotCounts,added,ownedCDNImagesVerified:30,
  imagesPointingToOwnedCDN:30,modernArchiveImages:30,legacyArchiveImages:0,newlyInternalizedReferenceCount:internalized,
  correctedKoreanNames:[],originRequests:0,
  proof:'data/audits/theme-visual-evidence/s8b/181-210/visual-index.json',nextStart:next
 })]);
console.log(JSON.stringify({set:CODE,reviewed:210,remaining:83,themeSlots:added,
 correctedNames:[],newlyInternalizedReferenceCount:internalized,next}));
