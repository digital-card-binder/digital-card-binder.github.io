import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const CODE='s8b',DATE='2026-10-15';
const THEMES=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [review,proof,ur,modern,legacy,art,status,hosting,overrides]=await Promise.all([
 read('data/audits/theme-s8b-271-293-Korean-art-review-20261015.json'),
 read('data/audits/theme-visual-evidence/s8b/271-293/visual-index.json'),
 read('data/audits/theme-visual-evidence/s8b/ur-278-285/rehost-source-index.json'),
 read('data/series.json'),read('data/series-legacy.json'),
 read('data/art-themes.json'),read('data/audits/theme-series-review-status.json'),
 read('data/audits/theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')
]);
const targets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()===CODE);
if(targets.length!==1||targets[0].cards?.length!==293)throw Error('Nonunique s8b 293 card Korean master');
const set=targets[0], prior=status.reviews?.[set.code]||{};
if(prior.reviewedRanges?.includes('271-293')&&prior.reviewedCardCount===293&&prior.status==='complete'){
 console.log('s8b 293/293 Korean card proof complete; skipped safely');process.exit(0);
}
if(status.execution?.nextStart!=='s8b canonical 271'||status.execution?.currentSet!=='s8b'||
 hosting.nextStart!=='s8b canonical 271'||prior.reviewedCardCount!==270)
 throw Error('Unsafe s8b checkpoint: existing 270 cards must remain untouched');
if(review.set!==CODE||review.visuallyReviewedKoreanCards!==23||review.items?.length!==23||
 !review.all12ThemesInspected||review.originImageRequests!==0||
 proof.set!==CODE||proof.range!=='271-293'||proof.masterSetCardCount!==293||
 proof.canonicalCardsChecked!==23||proof.verifiedOwnedCdnImageCount!==23||
 proof.printedNumberMatchCount!==23||proof.koreanNameNonemptyCount!==23||
 proof.unavailableOwnedCdnImageCount!==0||proof.sourceRequestCount!==0||
 proof.cards?.length!==23||review.preflightImageMismatchRange!=='278-285'||
 review.selfHostedKoreanUrImages!==8)
 throw Error('Final 23-card proof/review validation failed');
const fixes=review.koreanMasterNameCorrections||{};
if(JSON.stringify(Object.keys(fixes).sort())!==JSON.stringify(['278','281','282','283']))
 throw Error('Unexpected last-batch Korean UR name corrections');
if(ur.set!==CODE||ur.range!=='278-285'||ur.fetched!==8||
 ur.failed?.length!==0||ur.items?.length!==8)throw Error('Incomplete independently sourced Korean UR card photos');
const UR_NAMES=['백마 버드렉스 VMAX','피카츄 VMAX','뮤 VMAX','흑마 버드렉스 VMAX',
 '일격 우라오스 VMAX','연격 우라오스 VMAX','레쿠쟈 VMAX','두랄루돈 VMAX'];
const urByNum=new Map();
for(let i=0;i<8;i++){
 const n=278+i, x=ur.items[i], intendedPath='assets/cards/s8b-ur-korean/'+n+'.webp';
 if(x.number!==n||x.name!==UR_NAMES[i]||x.ownedPath!==intendedPath||
  x.width!==420||x.height!==586||!x.source?.startsWith('https://')||
  !/^[a-f0-9]{64}$/.test(x.sha256)||urByNum.has(n))throw Error('UR picture not independently verified '+n);
 const raw=await readFile(intendedPath);
 if(raw.length<4000||raw.toString('ascii',0,4)!=='RIFF'||
  raw.toString('ascii',8,12)!=='WEBP')throw Error('Missing self-hosted Korean UR WebP '+n);
 urByNum.set(n,x);
}
const groupMap=new Map(art.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groupMap.get(t)?.cards))throw Error('Missing theme '+t);
const originalCodes=set.cards.slice(270,293).map(c=>c.code);
overrides.sets??={};overrides.sets[CODE]??={};
let added=0,internalized=0;
const counts={},changedNames=[];
for(let i=0;i<23;i++){
 const num=271+i,id=String(num).padStart(3,'0'),key='S8B_'+id;
 const c=set.cards[num-1],p=proof.cards[i],row=review.items[i];
 if(!c||!p||!row||c.code.toLowerCase()!==CODE+'_'+id+'/184'||
    p.masterCode.toLowerCase()!==c.code.toLowerCase()||p.canonicalOrder!==num||
    row.canonicalOrder!==num||row.cardKey!==key||p.expectedPrintedNumber!==id+'/184'||
    !p.printedNumberMatches||!row.artObservation?.trim()||
    p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
    p.imageCheck.format!=='WEBP'||!p.koreanNameNonempty||
    (c.sourceImage||c.image)!==p.rawSource||
    p.priorThemes?.length!==0||THEMES.some(t=>groupMap.get(t).cards.some(x=>String(x.code||'').toUpperCase()===key)))
     throw Error('Unsafe Korean s8b final slot identity '+num);
 if(num>=286){
  if(p.imageCheck.dimensions?.join(',')!=='400,558'||
   !p.rawSource.startsWith('https://static.tcgexchange.kr/')||
   !p.ownedCdnUrl.startsWith('https://dcb-card-images-legacy-2026.pages.dev/'))
    throw Error('Expected verified unnumbered legacy energy art '+num);
 }else if(p.imageCheck.dimensions?.join(',')!=='420,586'||
    !p.rawSource.startsWith('https://cards.image.pokemonkorea.co.kr/')||
    !p.ownedCdnUrl.startsWith('https://dcb-card-images-modern-2026.pages.dev/'))
    throw Error('Expected Korean modern source image '+num);
 const fix=fixes[id];
 if(fix){
  if(num<278||num>285||c.name!==fix.before||p.name!==fix.before||row.name!==fix.after)
    throw Error('Master UR name fix mismatch '+num);
  c.name=fix.after;changedNames.push(id);
 }else if(c.name!==p.name||row.name!==p.name){
  throw Error('Korean name mismatch '+num);
 }
 if(num>=278&&num<=285){
  if(c.name!==UR_NAMES[num-278])throw Error('Incorrect UR name '+num);
  c.rarity='UR';
 }
 const u=urByNum.get(num);
 const owned=u?'https://digital-card-binder.github.io/'+u.ownedPath:p.ownedCdnUrl;
 const used=new Set();
 for(const t of row.matchedThemes){
  if(!THEMES.includes(t)||used.has(t)||!row.categories?.[t]?.trim())
    throw Error('Invalid themed art category '+num+' '+t);
  used.add(t);
  groupMap.get(t).cards.push({
   code:key,name:c.name,series:'S',set:set.code,setName:set.displayName||'VMAX 클라이맥스',
   cardNumber:id+'/184',rarity:c.rarity||'',category:row.categories[t],
   image:owned,
   evidence:'한국판 VMAX 클라이맥스 s8b '+id+'/184 일러스트 직접 검수: '+row.artObservation+
    (u?' 한국 UR 실물 소스/저장 증빙: data/audits/theme-visual-evidence/s8b/ur-278-285/rehost-source-index.json':
       ' 카드 증빙: data/audits/theme-visual-evidence/s8b/271-293/visual-index.json')+
    (num>=286?' (번호 없는 에너지, 내부 관리번호로만 식별).':'')
  });
  counts[t]=(counts[t]||0)+1;added++;
 }
 const oldImage=String(c.image||'');
 if(u){
  // The prior Korean card-search URL served a basic Energy image even when its code was an UR.
  // Correct provenance to the independently verified Korean card photograph, not the wrong Energy.
  c.previousMismatchedSourceImage=p.rawSource;
  c.sourceImage=u.source;
 }else if(!c.sourceImage){c.sourceImage=p.rawSource;}
 if(oldImage!==owned){
  if(!oldImage.includes('dcb-card-images-'))internalized++;
  c.image=owned;
 }
 overrides.sets[CODE][c.code.toLowerCase()]=owned;
}
if(JSON.stringify(originalCodes)!==JSON.stringify(set.cards.slice(270,293).map(c=>c.code)))
 throw Error('Canonical IDs changed');
if(JSON.stringify(counts)!==JSON.stringify(review.newThemeSlotsThisBatch)||
 added!==25||counts.color!==23||counts.food!==1||counts.work!==1)
 throw Error('Final theme slot classification totals differ from visual audit');
const next='s8a canonical 001';
status.reviews[set.code]={...prior,status:'complete',reviewedAt:DATE,
 reviewedCardCount:293,verifiedSelfHostedImageCount:293,
 reviewedRanges:[...(prior.reviewedRanges||[]),'271-293'],
 reviewedThemes:THEMES,heldCards:[],newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
 partialReviewEvidence:'data/audits/theme-s8b-271-293-Korean-art-review-20261015.json',
 archiveVerificationStatus:'s8b_001-293_all_293_Korean_DCB_owned_images_verified',
 nextStart:next,completedAt:DATE,
 note:'VMAX 클라이맥스 한국판 293/293장 12테마 실물 전수검수 완료. 278-285 UR 8장 기본 에너지 잘못 연결된 이미지 전량 한국판 UR 실물 자체 저장사진으로 수정. 278, 281-283 이름 복구. 마지막 8장 번호 없는 기본 에너지는 내부 슬롯번호만 사용.'};
status.execution.currentEra='S';status.execution.currentSet='s8a';
status.execution.lastSafeCheckpoint='s8b canonical 001-293 (293/293) Korean artwork and owned images verified, UR mislinks repaired';
status.execution.nextStart=next;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({
 task:6,set:'s8b',range:'canonical 271-293 Korean VMAX Climax final',
 canonicalCardCount:23,artworkVisuallyVerifiedCount:23,artworkPendingCount:0,
 selfHostedReferenceCountAfter:23,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'23_Korean_verified_7modern_8local_8legacy',verifiedImageCount:23,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:7,legacyArchiveImages:8,localKoreanUrImages:8,
 newlyInternalizedReferenceCount:internalized,themeAdditions:counts,
 koreanCardNameCorrections:changedNames.map(id=>'s8b_'+id+'/184'),nextStart:next,
 note:'VMAX 클라이맥스 293/293 완료; 8x UR 오염 이미지 자가 저장 한국판 UR로 교체, 4x 잘못된 UR 카드명 정정, 마지막 8x 번호 없는 에너지 보존.'
});
hosting.nextStart=next;hosting.updatedAt=DATE;art.updatedAt=DATE;
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
 save('data/audits/theme-series-review-status.json',status),
 save('data/audits/theme-image-selfhost-audit.json',hosting),
 save('data/audits/theme-s8b-271-293-progress-20261015.json',{
  schemaVersion:1,recordedAt:DATE,set:CODE,status:'complete',
  totalMasterCards:293,reviewedCanonicalCards:293,remainingUnreviewed:0,
  newThemeSlotsThisBatch:counts,added,ownedCDNImagesVerified:23,
  imagesPointingToOwnedCDN:23,modernArchiveImages:7,legacyArchiveImages:8,
  localKoreanUrImages:8,newlyInternalizedReferenceCount:internalized,
  correctedKoreanNames:changedNames.map(id=>'s8b_'+id+'/184'),originRequests:0,
  proof:'data/audits/theme-visual-evidence/s8b/271-293/visual-index.json',
  urnewProof:'data/audits/theme-visual-evidence/s8b/ur-278-285/rehost-source-index.json',
  complete:true,nextStart:next
 })
]);
console.log(JSON.stringify({set:CODE,complete:true,reviewed:293,remaining:0,
 themeSlots:added,correctedNames:changedNames,localKoreanUrImages:8,next}));
