import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,d)=>writeFile(p,JSON.stringify(d,null,2)+'\n');
const T=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
read('data/audits/theme-s10p-001-030-Korean-art-review-20261015.json'),read('data/audits/theme-visual-evidence/s10p/001-030/visual-index.json'),read('data/series.json'),read('data/series-legacy.json'),
read('data/art-themes.json'),read('data/audits/theme-series-review-status.json'),
read('data/audits/theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')]);
const sets=[...modern,...legacy].filter(x=>String(x.code||'').toLowerCase()==='s10p');
if(sets.length!==1||sets[0].cards?.length!==88||
proof.set!=='s10p'||proof.canonicalRange!=='001-030'||proof.cardCount!==30||
proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
proof.masterMissingKoreanNames!==0||proof.cards?.length!==30||
ev.items?.length!==30||ev.visuallyReviewedKoreanCards!==30||ev.verifiedOwnedCDNImages!==30||
!ev.all12ThemesInspected||ev.originImageRequests!==0)throw Error('Korean s10P proof incomplete');
const set=sets[0],prior=status.reviews?.[set.code]||{};
if((prior.reviewedCardCount||0)>=30 && prior.reviewedRanges?.includes('001-030')){console.log('s10P first batch already reviewed');process.exit(0);}
if((prior.reviewedCardCount||0)!==0||status.execution.currentSet!=='s10P'||
status.execution.nextStart!=='s10P canonical 001'||images.nextStart!=='s10P canonical 001')throw Error('s10P initial checkpoint mismatch');
const g=new Map(art.groups.map(x=>[x.code,x]));for(const t of T)if(!Array.isArray(g.get(t)?.cards))throw Error('Missing theme '+t);
let setThemeSlots=0;for(const t of T){setThemeSlots+=g.get(t).cards.filter(c=>/^S10P_/i.test(c.code)).length;}
overrides.sets??={};overrides.sets.s10p??={};
const seq=set.cards.map(c=>c.code);let added=0;const counts={};
for(let i=0;i<30;i++){
 const n=i+1,id=String(n).padStart(3,'0'),c=set.cards[i],p=proof.cards[i],e=ev.items[i];
 if(!c||!p||!e||c.code.toLowerCase()!=='s10p_'+id+'/067'||
 p.canonicalOrder!==n||e.canonicalOrder!==n||p.masterCode.toLowerCase()!==c.code.toLowerCase()||
 e.cardKey!=='S10P_'+id||e.name!==c.name||p.name!==c.name||!e.artObservation?.trim()||
 p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
 p.imageCheck.format!=='WEBP'||p.imageCheck.dimensions?.join(',')!=='420,586'||
 !p.cdnUrl.startsWith('https://dcb-card-images-modern-2026.pages.dev/')||
 p.rawSource!=='https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S10/S10P_'+id+'.png'||
 (c.image!==p.rawSource && c.image!==p.cdnUrl)||p.existingThemes?.length)
 throw Error('Korean s10P image card crosscheck failed '+id);
 let seen=new Set();
 for(const t of e.matchedThemes){
  if(!T.includes(t)||seen.has(t)||g.get(t).cards.some(x=>x.code===e.cardKey)||
  !e.categories[t]?.trim())throw Error('Invalid theme '+t+' '+id);
  seen.add(t);
  g.get(t).cards.push({code:e.cardKey,name:c.name,series:'S',set:set.code,
  setName:set.displayName,cardNumber:id+'/067',rarity:c.rarity||'',category:e.categories[t],
  image:p.cdnUrl,evidence:'한국판 스페이스 저글러 s10P '+id+'/067 소장 CDN 그림 검수: '+e.artObservation+
  ' 검증 근거: data/audits/theme-visual-evidence/s10p/001-030/visual-index.json; 420x586 WEBP 실제 디코딩.'});
  counts[t]=(counts[t]||0)+1;added++;
 }
 if(c.image!==p.cdnUrl){if(!c.sourceImage)c.sourceImage=p.rawSource;c.image=p.cdnUrl;}
 overrides.sets.s10p[c.code.toLowerCase()]=p.cdnUrl;
}
if(JSON.stringify(seq)!==JSON.stringify(set.cards.map(c=>c.code)))throw Error('Canonical sequence changed');
for(const [t,n] of Object.entries(ev.newThemeSlotsThisBatch))if(counts[t]!==n)throw Error('Theme count differs '+t);
if(Object.values(counts).reduce((a,b)=>a+b,0)!==added)throw Error('Added count mismatch');
const next='s10P canonical 031',today='2026-10-15';
status.reviews[set.code]={...prior,status:'in_progress',reviewedAt:today,
reviewedCardCount:30,verifiedSelfHostedImageCount:30,reviewedRanges:['001-030'],
reviewedThemes:T,heldCards:[],newlyAddedThemeSlotCount:added,priorThemeSlotsPreserved:setThemeSlots,
partialReviewEvidence:'data/audits/theme-s10p-001-030-Korean-art-review-20261015.json',archiveVerificationStatus:'s10P_001-030_30_Korean_DCB_owned_CDN_images_decoded',
nextStart:next,note:'스페이스 저글러 001-030 한국판 이미지 30장 12테마 검수 완료. 기존 자체 CDN 30개 대조 및 원본 출처 보존.'};
status.execution.currentEra='S';status.execution.currentSet='s10P';
status.execution.lastSafeCheckpoint='s10P canonical 001-030 (30/88) Korean art and DCB-owned CDN images verified';
status.execution.nextStart=next;status.execution.updatedAt=today;status.updatedAt=today;
images.batches.push({task:6,set:'s10P',range:'canonical 001-030 Korean Space Juggler',
canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
archiveVerificationStatus:'30_Korean_DCB_owned_CDN_images_decoded',verifiedImageCount:30,
unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:30,legacyArchiveImages:0,
priorThemeSlotsPreserved:0,themeAdditions:counts,nextStart:next,
note:'30 Korean Space Juggler illustrations inspected for all 12 themes; verified owned CDN WEBP / Korean identity / original source retained.'});
images.nextStart=next;images.updatedAt=today;art.updatedAt=today;
await Promise.all([save('data/series.json',modern),save('data/series-legacy.json',legacy),
save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
save('data/audits/theme-series-review-status.json',status),
save('data/audits/theme-image-selfhost-audit.json',images),
save('data/audits/theme-s10p-001-030-progress-20261015.json',{schemaVersion:1,recordedAt:today,set:'s10P',status:'in_progress',
 totalMasterCards:88,reviewedCanonicalCards:30,remainingUnreviewed:58,
 newlyAddedThisBatch:added,byTheme:counts,verifiedOwnedCDNImages:30,
 externalImageReferencesAfter:0,artProof:'data/audits/theme-visual-evidence/s10p/001-030/visual-index.json',nextStart:next})]);
console.log(JSON.stringify({set:'s10P',reviewed:30,total:88,added,byTheme:counts,next}));
