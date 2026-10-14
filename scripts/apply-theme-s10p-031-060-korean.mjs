import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,d)=>writeFile(p,JSON.stringify(d,null,2)+'\n');
const T=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
read('data/audits/theme-s10p-031-060-Korean-art-review-20261015.json'),read('data/audits/theme-visual-evidence/s10p/031-060/visual-index.json'),read('data/series.json'),read('data/series-legacy.json'),
read('data/art-themes.json'),read('data/audits/theme-series-review-status.json'),
read('data/audits/theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')]);
const sets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()==='s10p');
if(sets.length!==1||sets[0].cards?.length!==88||proof.cardCount!==30||
proof.set!=='s10p'||proof.canonicalRange!=='031-060'||
proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
proof.masterMissingKoreanNames!==0||proof.cards?.length!==30||ev.items?.length!==30||
ev.visuallyReviewedKoreanCards!==30||ev.verifiedOwnedCDNImages!==30||!ev.all12ThemesInspected||
ev.originImageRequests!==0||ev.priorThemeSlotsPreserved!==1)throw Error('s10P 031-060 Korean proof mismatch');
const set=sets[0],prior=status.reviews?.[set.code]||{};
if((prior.reviewedCardCount||0)>=60&&prior.reviewedRanges?.includes('031-060')){console.log('s10P 031-060 already reviewed');process.exit(0);}
if(prior.reviewedCardCount!==30||prior.verifiedSelfHostedImageCount!==30||
!prior.reviewedRanges?.includes('001-030')||
status.execution?.currentSet!=='s10P'||status.execution.nextStart!=='s10P canonical 031'||
images.nextStart!=='s10P canonical 031')throw Error('Unsafe s10P second batch checkpoint');
const groups=new Map(art.groups.map(x=>[x.code,x]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error('Unknown theme '+t);
overrides.sets??={};overrides.sets.s10p??={};
let added=0,preserved=0;const additions={};const sequence=set.cards.map(c=>c.code);
for(let i=0;i<30;i++){
 const n=i+31,id=String(n).padStart(3,'0'),p=proof.cards[i],evCard=ev.items[i],card=set.cards[n-1];
 const expectedExisting=n===59?['sleeping']:[];
 const actualExisting=T.filter(t=>groups.get(t).cards.some(c=>c.code==='S10P_'+id));
 if(!card||!p||!evCard||card.code.toLowerCase()!=='s10p_'+id+'/067'||
 p.masterCode.toLowerCase()!==card.code.toLowerCase()||evCard.cardKey!=='S10P_'+id||
 p.canonicalOrder!==n||evCard.canonicalOrder!==n||p.name!==card.name||evCard.name!==card.name||
 !evCard.artObservation?.trim()||p.existingThemes?.slice().sort().join(',')!==expectedExisting.join(',')||
 actualExisting.slice().sort().join(',')!==expectedExisting.join(',')||
 evCard.preExistingThemes?.slice().sort().join(',')!==expectedExisting.join(',')||
 p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||p.imageCheck.format!=='WEBP'||
 p.imageCheck.dimensions?.join(',')!=='420,586'||
 !((p.cdnUrl.startsWith('https://dcb-card-images-modern-2026.pages.dev/') &&
 p.rawSource==='https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S10/S10P_'+id+'.png')||
 (n===44&&p.cdnUrl==='https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/9f63be115947151e.webp'&&
 p.rawSource==='https://static.tcgexchange.kr/9eb58e69ce26d6af85a1c794b4ca8688.png'&&
 card.source==='https://www.dogam.app/cards/01KW1C60V1PJJ2H5B6FYN7HHPS'))||
 (card.image!==p.cdnUrl&&card.image!==p.rawSource))
 throw Error('s10P Korean image/identity/existing-theme mismatch '+id);
 preserved+=expectedExisting.length;
 const selected=new Set();
 for(const t of evCard.matchedThemes){
  if(!T.includes(t)||selected.has(t)||expectedExisting.includes(t)||
  groups.get(t).cards.some(c=>c.code===evCard.cardKey)||!evCard.categories[t]?.trim())
  throw Error('Duplicate/unsubstantiated theme '+t+'/'+id);
  selected.add(t);
  groups.get(t).cards.push({code:evCard.cardKey,name:card.name,series:'S',set:set.code,
  setName:set.displayName,cardNumber:id+'/067',rarity:card.rarity||'',category:evCard.categories[t],
  image:p.cdnUrl,evidence:'한국판 스페이스 저글러 s10P '+id+'/067 실제 카드 그림 검수: '+evCard.artObservation+
  ' 보존 카드번호/한국어 이름 증빙: data/audits/theme-visual-evidence/s10p/031-060/visual-index.json'});
  additions[t]=(additions[t]||0)+1;added++;
 }
 if(card.image!==p.cdnUrl){if(!card.sourceImage)card.sourceImage=p.rawSource;card.image=p.cdnUrl;}
 overrides.sets.s10p[card.code.toLowerCase()]=p.cdnUrl;
}
if(JSON.stringify(sequence)!==JSON.stringify(set.cards.map(c=>c.code))||preserved!==1)
throw Error('Canonical sequence or sleeping preservation error');
for(const [t,c] of Object.entries(ev.newThemeSlotsThisBatch))if(additions[t]!==c)throw Error('Expected art category count error '+t);
if(Object.values(additions).reduce((a,b)=>a+b,0)!==added)throw Error('Theme count error');
const today='2026-10-15',next='s10P canonical 061';
status.reviews[set.code]={...prior,status:'in_progress',reviewedAt:today,
reviewedCardCount:60,verifiedSelfHostedImageCount:60,reviewedRanges:[...prior.reviewedRanges,'031-060'],
reviewedThemes:T,heldCards:[],newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
priorThemeSlotsPreserved:(prior.priorThemeSlotsPreserved||0)+preserved,
partialReviewEvidence:'data/audits/theme-s10p-031-060-Korean-art-review-20261015.json',archiveVerificationStatus:'s10P_031-060_30_Korean_DCB_owned_CDN_images_decoded',
nextStart:next,note:'스페이스 저글러 001-060 60장 한국판 원본 그림 12테마 검수. 059 자말라 sleeping 기존 항목 보존; 자체 CDN 확인, 061부터 계속.'};
status.execution.currentEra='S';status.execution.currentSet='s10P';
status.execution.lastSafeCheckpoint='s10P canonical 001-060 (60/88) Korean art and DCB-owned CDN images verified';
status.execution.nextStart=next;status.execution.updatedAt=today;status.updatedAt=today;
images.batches.push({task:6,set:'s10P',range:'canonical 031-060 Korean Space Juggler',
canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,selfHostedReferenceCountAfter:30,
externalImageReferenceCountAfter:0,archiveVerificationStatus:'30_Korean_DCB_owned_CDN_images_decoded',
verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:30,legacyArchiveImages:0,
priorThemeSlotsPreserved:preserved,themeAdditions:additions,nextStart:next,
note:'Korean 031-060 reviewed across all 12 themes; #059 previously sleeping kept unchanged; owned WEBP confirmed 30/30.'});
images.nextStart=next;images.updatedAt=today;art.updatedAt=today;
await Promise.all([save('data/series.json',modern),save('data/series-legacy.json',legacy),
save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
save('data/audits/theme-series-review-status.json',status),
save('data/audits/theme-image-selfhost-audit.json',images),
save('data/audits/theme-s10p-031-060-progress-20261015.json',{schemaVersion:1,recordedAt:today,set:'s10P',status:'in_progress',
totalMasterCards:88,reviewedCanonicalCards:60,remainingUnreviewed:28,added,byTheme:additions,
verifiedOwnedCDNImages:30,originalSourceRequests:0,existingSleepingPreserved:1,
proof:'data/audits/theme-visual-evidence/s10p/031-060/visual-index.json',nextStart:next})]);
console.log(JSON.stringify({set:'s10P',reviewed:60,total:88,added,byTheme:additions,next}));
