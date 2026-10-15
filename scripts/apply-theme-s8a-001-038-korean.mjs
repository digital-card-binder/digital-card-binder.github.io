import {readFile,writeFile} from 'node:fs/promises';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const save=async(path,val)=>writeFile(path,JSON.stringify(val,null,2)+'\n');
const CODE='s8a',DATE='2026-10-15',TOTAL=38;
const THEMES=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [review,proof,modern,legacy,art,status,hosting,overrides]=await Promise.all([
 read('data/audits/theme-s8a-001-038-Korean-art-review-20261015.json'),
 read('data/audits/theme-visual-evidence/s8a/001-038/visual-index.json'),
 read('data/series.json'),read('data/series-legacy.json'),
 read('data/art-themes.json'),read('data/audits/theme-series-review-status.json'),
 read('data/audits/theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()===CODE);
if(sets.length!==1||sets[0].cards?.length!==TOTAL)throw Error('Exactly 38 s8a Korean master cards required');
const set=sets[0],prior=status.reviews?.[set.code]||{};
if(prior.status==='complete'&&prior.reviewedCardCount===TOTAL){
 console.log('s8a 38/38 already complete. No mutation.');process.exit(0);
}
if(status.execution?.nextStart!=='s8a canonical 001'||hosting.nextStart!=='s8a canonical 001'||
 !['s8a','S8A'].includes(String(status.execution?.currentSet))||
 (prior.reviewedCardCount||0)!==0)
 throw Error('Unsafe s8a starting checkpoint; nothing modified.');
if(review.set!==CODE||review.expectedMasterCards!==TOTAL||review.items?.length!==TOTAL||
 review.visuallyReviewedKoreanCards!==TOTAL||review.verifiedOwnedCDNImages!==TOTAL||
 !review.all12ThemesInspected||review.originImageRequests!==0||
 proof.set!==CODE||proof.range!=='001-038'||proof.masterSetCardCount!==TOTAL||
 proof.canonicalCardsChecked!==TOTAL||proof.verifiedOwnedCdnImageCount!==TOTAL||
 proof.unavailableOwnedCdnImageCount!==0||proof.printedNumberMatchCount!==TOTAL||
 proof.koreanNameNonemptyCount!==TOTAL||proof.sourceRequestCount!==0||proof.cards?.length!==TOTAL)
 throw Error('Korean s8a image/card/visual proof missing.');
const fixes=review.koreanMasterNameCorrections||{};
if(JSON.stringify(Object.keys(fixes).sort())!==JSON.stringify(['024','029']))
 throw Error('Unexpected s8a Korean card-name corrections');
const priorThemesByCode=new Map(proof.cards.map(p=>[p.canonicalOrder,p.priorThemes]));
const expectedExisting={4:['connected'],5:['connected'],10:['connected'],11:['connected'],
 15:['sleeping'],18:['connected'],19:['connected']};
const groupMap=new Map(art.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groupMap.get(t)?.cards))throw Error('Missing theme '+t);
overrides.sets??={};overrides.sets[CODE]??={};
const masterCodes=set.cards.map(c=>c.code);
const expectedLegacy=new Map((review.legacyImageChecks||[]).map(x=>[x.number,x]));
if(expectedLegacy.size!==7||proof.cards.filter(p=>p.rawSource.includes('static.tcgexchange.kr')).length!==7)
 throw Error('s8a legacy artwork pin count mismatch');
let added=0,internalized=0;const themeCounts={}, corrected=[];
for(let i=0;i<TOTAL;i++){
 const n=i+1,id=String(n).padStart(3,'0'),key='S8A_'+id;
 const c=set.cards[i],p=proof.cards[i],row=review.items[i], priorThemes=priorThemesByCode.get(n)||[];
 if(!c||!p||!row||c.code.toLowerCase()!==CODE+'_'+id+'/028'||
    p.masterCode.toLowerCase()!==c.code.toLowerCase()||p.canonicalOrder!==n||
    row.canonicalOrder!==n||row.cardKey!==key||p.expectedPrintedNumber!==id+'/028'||
    !p.printedNumberMatches||!row.artObservation?.trim()||!p.koreanNameNonempty||
    p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
    p.imageCheck.format!=='WEBP'||(p.imageCheck.dimensions||[]).length!==2||
    (c.sourceImage||c.image)!==p.rawSource)
  throw Error('Korean s8a master/proof mismatch at '+n);
 const inGroups=THEMES.filter(t=>groupMap.get(t).cards.some(x=>String(x.code||'').toUpperCase()===key)).sort();
 const expectation=(expectedExisting[n]||[]).slice().sort();
 if(JSON.stringify(priorThemes.slice().sort())!==JSON.stringify(expectation)||
    JSON.stringify(inGroups)!==JSON.stringify(expectation)||
    JSON.stringify(row.priorThemesToPreserve.slice().sort())!==JSON.stringify(expectation))
  throw Error('Preexisting connected/sleeping theme mismatch at '+n);
 const pin=expectedLegacy.get(n);
 if(pin){
  if(pin.source!==p.rawSource||pin.owned!==p.ownedCdnUrl||
    JSON.stringify(pin.dimensions)!==JSON.stringify(p.imageCheck.dimensions)||
    !p.rawSource.startsWith('https://static.tcgexchange.kr/')||
    !p.ownedCdnUrl.startsWith('https://dcb-card-images-legacy-2026.pages.dev/'))
    throw Error('Legacy Korean s8a source mismatch at '+n);
 }else if(!p.rawSource.startsWith('https://cards.image.pokemonkorea.co.kr/')||
   !p.ownedCdnUrl.startsWith('https://dcb-card-images-modern-2026.pages.dev/')||
   p.imageCheck.dimensions.join(',')!==(n===25?'420,584':'420,586'))
    throw Error('Modern Korean s8a image proof mismatch at '+n);
 const fix=fixes[id];
 if(fix){
  if(c.name!==fix.before||p.name!==fix.before||row.name!==fix.after)throw Error('Printed Korean title correction mismatch '+n);
  c.name=fix.after;corrected.push(c.code.toLowerCase());
 }else if(c.name!==p.name||row.name!==c.name)throw Error('Korean name identity mismatch '+n);
 for(const t of expectation){
  const old=groupMap.get(t).cards.filter(x=>String(x.code||'').toUpperCase()===key);
  if(old.length!==1||!old[0].category||row.matchedThemes.includes(t))
   throw Error('Old theme record must be preserved without duplication '+n+' '+t);
  old[0].image=p.ownedCdnUrl;
 }
 const used=new Set();
 for(const t of row.matchedThemes){
  if(!THEMES.includes(t)||used.has(t)||!row.categories?.[t]?.trim()||expectation.includes(t))
   throw Error('Duplicate or unreviewed s8a theme '+n+' '+t);
  used.add(t);
  groupMap.get(t).cards.push({
   code:key,name:c.name,series:'S',set:set.code,
   setName:set.displayName||'25th ANNIVERSARY COLLECTION',cardNumber:id+'/028',
   rarity:c.rarity||'',category:row.categories[t],image:p.ownedCdnUrl,
   evidence:'한국판 25th ANNIVERSARY COLLECTION s8a '+id+'/028 일러스트 검수: '+
    row.artObservation+' 이미지: data/audits/theme-visual-evidence/s8a/001-038/visual-index.json'
  });
  themeCounts[t]=(themeCounts[t]||0)+1;added++;
 }
 const oldImage=String(c.image||'');
 if(!c.sourceImage)c.sourceImage=p.rawSource;
 if(oldImage!==p.ownedCdnUrl){
  if(!oldImage.includes('dcb-card-images-'))internalized++;
  c.image=p.ownedCdnUrl;
 }
 overrides.sets[CODE][c.code.toLowerCase()]=p.ownedCdnUrl;
}
if(JSON.stringify(masterCodes)!==JSON.stringify(set.cards.map(c=>c.code)))
 throw Error('Canonical s8a identities were altered');
if(JSON.stringify(themeCounts)!==JSON.stringify(review.newThemeSlotsThisBatch)||
 themeCounts.color!==38||themeCounts.season!==14||themeCounts.work!==2||
 themeCounts.night!==1||themeCounts.connected!==4||added!==59)
 throw Error('Review theme slot counts diverged');
const next='s8 canonical 001';
status.reviews[set.code]={...prior,status:'complete',reviewedAt:DATE,completedAt:DATE,
 reviewedCardCount:TOTAL,verifiedSelfHostedImageCount:TOTAL,
 reviewedRanges:[...(prior.reviewedRanges||[]),'001-038'],reviewedThemes:THEMES,
 heldCards:[],newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
 partialReviewEvidence:'data/audits/theme-s8a-001-038-Korean-art-review-20261015.json',
 archiveVerificationStatus:'s8a_001-038_38_Korean_owned_images_verified',nextStart:next,
 note:'25th ANNIVERSARY COLLECTION 한국판 38/38 카드 그림과 번호 12테마 전수검수 완료. 024 파도타기 피카츄 VMAX/029 박사의 연구(오박사) 명칭 정정, 기존 연결6+잠자는1 분류 보존. 새로운 피카츄 V-UNION 연결4장 포함.'};
status.execution.currentEra='S';status.execution.currentSet='s8';
status.execution.lastSafeCheckpoint='s8a canonical 001-038 (38/38) Korean artwork and owned images verified';
status.execution.nextStart=next;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({
 task:6,set:'s8a',range:'canonical 001-038 Korean 25th ANNIVERSARY COLLECTION',
 canonicalCardCount:TOTAL,artworkVisuallyVerifiedCount:TOTAL,artworkPendingCount:0,
 selfHostedReferenceCountAfter:TOTAL,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'38_Korean_owned_images_decoded',verifiedImageCount:TOTAL,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:31,legacyArchiveImages:7,
 newlyInternalizedReferenceCount:internalized,themeAdditions:themeCounts,
 koreanCardNameCorrections:corrected,nextStart:next,
 note:'Full Korean anniversary set 38/38 audited; preserved linked and sleeping cards, fixed 024/029 identities.'
});
hosting.nextStart=next;hosting.updatedAt=DATE;art.updatedAt=DATE;
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
 save('data/audits/theme-series-review-status.json',status),
 save('data/audits/theme-image-selfhost-audit.json',hosting),
 save('data/audits/theme-s8a-001-038-progress-20261015.json',{
  schemaVersion:1,recordedAt:DATE,set:CODE,status:'complete',
  totalMasterCards:38,reviewedCanonicalCards:38,remainingUnreviewed:0,
  newThemeSlotsThisBatch:themeCounts,added,ownedCDNImagesVerified:38,
  imagesPointingToOwnedCDN:38,modernArchiveImages:31,legacyArchiveImages:7,
  newlyInternalizedReferenceCount:internalized,correctedKoreanNames:corrected,
  originRequests:0,proof:'data/audits/theme-visual-evidence/s8a/001-038/visual-index.json',
  nextStart:next,complete:true
 })
]);
console.log(JSON.stringify({set:CODE,complete:true,reviewed:TOTAL,remaining:0,slots:added,
 preservedThemeEntries:7,correctedNames:corrected,next}));
