import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const CODE='s9a',DATE='2026-10-15';
const THEMES=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [review,proof,modern,legacy,art,status,hosting,overrides]=await Promise.all([
 read('data/audits/theme-s9a-061-093-Korean-art-review-20261015.json'),
 read('data/audits/theme-visual-evidence/s9a/061-093/visual-index.json'),
 read('data/series.json'),read('data/series-legacy.json'),
 read('data/art-themes.json'),read('data/audits/theme-series-review-status.json'),
 read('data/audits/theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')]);
const targets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()===CODE);
if(targets.length!==1||targets[0].cards?.length!==93)throw Error('s9a master is not unique 93-card Korean set');
const set=targets[0];
const prior=status.reviews?.[set.code]||{};
if(prior.reviewedRanges?.includes('061-093')&&prior.reviewedCardCount>=93){
 console.log('s9a Korean 061-093 already committed; skipping safely');process.exit(0);
}
if(status.execution?.nextStart!=='s9a canonical 061'||status.execution?.currentSet!=='s9a'||
 hosting.nextStart!=='s9a canonical 061'||(prior.reviewedCardCount||0)!==60)
 throw Error('Unsafe s9a checkpoint or competing update; no files changed');
if(review.set!==CODE||review.visuallyReviewedKoreanCards!==33||
 !review.all12ThemesInspected||review.originImageRequests!==0||
 review.items?.length!==33||proof.set!==CODE||proof.range!=='061-093'||
 proof.masterSetCardCount!==93||proof.canonicalCardsChecked!==33||
 proof.verifiedOwnedCdnImageCount!==33||proof.unavailableOwnedCdnImageCount!==0||
 proof.printedNumberMatchCount!==33||proof.koreanNameMatchCount!==33||
 proof.cards?.length!==33||proof.sourceRequestCount!==0)
 throw Error('Korean identity/image proof or 12-theme visual review incomplete');
const corrections=review.koreanMasterNameCorrections;
if(JSON.stringify(Object.keys(corrections||{}).sort())!==JSON.stringify([]))
 throw Error('Unexpected Korean name corrections');
const groupMap=new Map(art.groups.map(group=>[group.code,group]));
for(const theme of THEMES)if(!Array.isArray(groupMap.get(theme)?.cards))throw Error('Missing theme '+theme);
overrides.sets??={};overrides.sets[CODE]??={};
const currentKeys=set.cards.slice(60,93).map(c=>c.code);
const currentSlotCounts={};
const allowedLegacy={
 75:{raw:'https://static.tcgexchange.kr/6e12d9a5a57b053013122dc57aebc487.png',cdn:'https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/bf4d3c688e8df0ec.webp'},
 79:{raw:'https://static.tcgexchange.kr/8fb7a9a5e2ab892735ecb1ff3c13b1db.png',cdn:'https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/7d9dd32abe2dc369.webp'},
 83:{raw:'https://static.tcgexchange.kr/ea3dccdce647ba66f7e5133e405bb3bd.png',cdn:'https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/f46c08184a9cd4e6.webp'},
 84:{raw:'https://static.tcgexchange.kr/451161dbafc88a2b6bc24f95ae0352c9.png',cdn:'https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/b039a63a85fec6b8.webp'}
};
let added=0,internalized=0;
for(let i=0;i<33;i++){
 const num=i+61,id=String(num).padStart(3,'0'),c=set.cards[num-1],p=proof.cards[i],row=review.items[i];
 const key='S9A_'+id;
 if(!c||!p||!row||c.code.toLowerCase()!==CODE+'_'+id+'/067'||
 p.masterCode.toLowerCase()!==c.code.toLowerCase()||p.canonicalOrder!==num||
 row.canonicalOrder!==num||row.cardKey!==key||p.expectedPrintedNumber!==id+'/067'||
 !p.printedNumberMatches||!row.artObservation?.trim()||
 p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
 p.imageCheck.format!=='WEBP'||p.imageCheck.dimensions?.join(',')!=='420,586'||
 !((p.ownedCdnUrl?.startsWith('https://dcb-card-images-modern-2026.pages.dev/')&&
      p.rawSource?.startsWith('https://cards.image.pokemonkorea.co.kr/'))||
     (allowedLegacy[num]&&p.rawSource===allowedLegacy[num].raw&&p.ownedCdnUrl===allowedLegacy[num].cdn))||
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
     ' 한국판 카드/자가 저장 이미지 증빙: data/audits/theme-visual-evidence/s9a/061-093/visual-index.json'
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
if(JSON.stringify(currentKeys)!==JSON.stringify(set.cards.slice(60,93).map(x=>x.code)))
 throw Error('Canonical card slot identities changed');
if(JSON.stringify(currentSlotCounts)!==JSON.stringify(review.newThemeSlotsThisBatch))
 throw Error('Actual classified theme counts differ from reviewed evidence');
if(added!==46||currentSlotCounts.color!==33||currentSlotCounts.season!==7||
 currentSlotCounts.night!==2||currentSlotCounts.street!==4)
 throw Error('Theme slot expectations mismatch');
const next='s9 canonical 001';
status.reviews[set.code]={...prior,status:'complete',reviewedAt:DATE,
 reviewedCardCount:93,verifiedSelfHostedImageCount:93,reviewedRanges:[...(prior.reviewedRanges||[]),'061-093'],
 reviewedThemes:THEMES,heldCards:[],newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
 partialReviewEvidence:'data/audits/theme-s9a-061-093-Korean-art-review-20261015.json',
 archiveVerificationStatus:'s9a_061-093_33_Korean_DCB_owned_CDN_images_decoded',
 nextStart:next,
 note:'배틀리전 한국판 전체 93장, 12개 테마 시각검수 및 자체 저장 이미지 93장 확인 완료. 마지막 061-093은 modern 29장, legacy 4장. 미검수 0장.'};
status.execution.currentEra='S';status.execution.currentSet='s9';
status.execution.lastSafeCheckpoint='s9a canonical 001-093 (93/93) Korean prints and owned CDN artworks verified';
status.execution.nextStart=next;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({
 task:6,set:'s9a',range:'canonical 061-093 Korean Battle Region',
 canonicalCardCount:33,artworkVisuallyVerifiedCount:33,artworkPendingCount:0,
 selfHostedReferenceCountAfter:33,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'33_Korean_DCB_owned_CDN_images_decoded',verifiedImageCount:33,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:29,legacyArchiveImages:4,
 newlyInternalizedReferenceCount:internalized,themeAdditions:currentSlotCounts,
 koreanCardNameCorrections:[],nextStart:next,
 note:'Verified final 33 Korean artworks; 29 modern and 4 legacy owned images. All 93 Battle Region cards complete, original source provenance preserved, third-party requests 0.'
});
hosting.nextStart=next;hosting.updatedAt=DATE;art.updatedAt=DATE;
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
 save('data/audits/theme-series-review-status.json',status),
 save('data/audits/theme-image-selfhost-audit.json',hosting),
 save('data/audits/theme-s9a-061-093-progress-20261015.json',{
  schemaVersion:1,recordedAt:DATE,set:CODE,status:'complete',
  totalMasterCards:93,reviewedCanonicalCards:93,remainingUnreviewed:0,
  newThemeSlotsThisBatch:currentSlotCounts,added,ownedCDNImagesVerified:33,
  imagesPointingToOwnedCDN:33,modernArchiveImages:29,legacyArchiveImages:4,newlyInternalizedReferenceCount:internalized,
  correctedKoreanNames:[],originRequests:0,
  proof:'data/audits/theme-visual-evidence/s9a/061-093/visual-index.json',nextStart:next
 })]);
console.log(JSON.stringify({set:CODE,complete:true,reviewed:93,remaining:0,themeSlots:added,
 correctedNames:[],newlyInternalizedReferenceCount:internalized,next}));
