import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,d)=>writeFile(p,JSON.stringify(d,null,2)+'\n');
const A='data/audits/';
const THEMES=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
read('data/audits/theme-s10d-061-088-Korean-art-review-20261015.json'),read('data/audits/theme-visual-evidence/s10d/061-088/visual-index.json'),read('data/series.json'),read('data/series-legacy.json'),
read('data/art-themes.json'),read(A+'theme-series-review-status.json'),read(A+'theme-image-selfhost-audit.json'),
read('data/series-image-overrides.json')]);
const sets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()==='s10d');
if(sets.length!==1||sets[0].cards?.length!==88||proof.cards?.length!==28||
proof.verificationCounts?.verified!==28||proof.verificationCounts?.missing!==0||
proof.canonicalRange!=='061-088'||ev.items?.length!==28||ev.visuallyReviewedKoreanCards!==28||
!ev.all12ThemesInspected||ev.verifiedOwnedCDNImages!==28||ev.originImageRequests!==0)
throw Error('Incomplete Korean s10D owned archive proof');
const set=sets[0],prior=status.reviews?.[set.code];
if(prior?.status==='complete'&&prior.reviewedCardCount===88){console.log('s10D already complete');process.exit(0);}
if(prior?.reviewedCardCount!==60||prior.verifiedSelfHostedImageCount!==60||
!prior.reviewedRanges?.includes('031-060')||
status.execution.nextStart!=='s10D canonical 061'||images.nextStart!=='s10D canonical 061')
throw Error('Unsafe Time Gazer 061 start state');
const groups=new Map(art.groups.map(x=>[x.code,x]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error('Missing theme '+t);
overrides.sets??={};overrides.sets.s10d??={};
const sequence=set.cards.map(c=>c.code);let added=0;const additionCounts={};
for(let i=0;i<28;i++){
const n=61+i,id=String(n).padStart(3,'0'),p=proof.cards[i],e=ev.items[i],card=set.cards[n-1];
if(!p||!e||!card||p.canonicalOrder!==n||e.canonicalOrder!==n||
card.code.toLowerCase()!=='s10d_'+id+'/067'||
p.masterCode.toLowerCase()!==card.code.toLowerCase()||e.cardKey!=='S10D_'+id||
p.name!==card.name||e.name!==card.name||!e.artObservation||
p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
p.imageCheck.format!=='WEBP'||p.imageCheck.dimensions?.join(',')!=='420,586'||
!p.cdnUrl.startsWith('https://dcb-card-images-modern-2026.pages.dev/')||
p.rawSource!=='https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S10/S10D_'+id+'.png'||
(card.image!==p.rawSource&&card.image!==p.cdnUrl)||
(p.existingThemes||[]).length!==0)
throw Error('Card/owned image visual proof mismatch '+n);
const rerunTheme=new Set();
for(const theme of e.matchedThemes){
 if(!THEMES.includes(theme)||rerunTheme.has(theme)||groups.get(theme).cards.some(x=>x.code===e.cardKey))throw Error('Invalid theme duplicate '+theme+'/'+n);
 const category=e.categories[theme];if(!category?.trim())throw Error('Missing visible category '+theme+'/'+n);
 rerunTheme.add(theme);
 groups.get(theme).cards.push({code:e.cardKey,name:card.name,series:'S',set:set.code,
 setName:set.displayName,cardNumber:id+'/067',rarity:card.rarity||'',category,
 image:p.cdnUrl,evidence:'한국판 타임게이저 s10D '+id+'/067 본인 보관 CDN 이미지 12테마 그림 검수: '+e.artObservation+
 ' 한국판 카드 번호/그림 증빙: data/audits/theme-visual-evidence/s10d/061-088/visual-index.json; 정상이미지 디코딩.'});
 additionCounts[theme]=(additionCounts[theme]||0)+1;added++;
}
if(card.image!==p.cdnUrl){if(!card.sourceImage)card.sourceImage=p.rawSource;card.image=p.cdnUrl;}
overrides.sets.s10d[card.code.toLowerCase()]=p.cdnUrl;
}
if(JSON.stringify(set.cards.map(c=>c.code))!==JSON.stringify(sequence))throw Error('Canonical cards mutated');
for(const [t,count] of Object.entries(ev.newThemeSlotsThisBatch))if(additionCounts[t]!==count)throw Error('Theme evidence count mismatch '+t);
if(Object.values(additionCounts).reduce((a,b)=>a+b,0)!==added)throw Error('Added slots accounting failure');
const next='s10P canonical 001',today='2026-10-15';
status.reviews[set.code]={...prior,status:'complete',reviewedAt:today,
reviewedCardCount:88,verifiedSelfHostedImageCount:88,
reviewedRanges:[...prior.reviewedRanges,'061-088'],reviewedThemes:THEMES,
heldCards:[],newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
partialReviewEvidence:'data/audits/theme-s10d-061-088-Korean-art-review-20261015.json',
archiveVerificationStatus:'s10D_061-088_28_Korean_DCB_owned_CDN_images_decoded',
nextStart:next,
note:'타임게이저 한국판 canonical 001-088 전수 12테마 검수 완료. 061-088 자체 CDN 28장 디코딩/번호·이름 대조, 테마 '+added+'슬롯 추가. 001-002 워터마크 화질 교체 후보는 별도 남김.'};
status.execution.currentEra='S';status.execution.currentSet='s10P';
status.execution.lastSafeCheckpoint='s10D canonical 001-088 (88/88) Korean artwork and owned CDN confirmed';
status.execution.nextStart=next;status.execution.updatedAt=today;status.updatedAt=today;
images.batches.push({task:6,set:'s10D',range:'canonical 061-088 Korean Time Gazer',
 canonicalCardCount:28,artworkVisuallyVerifiedCount:28,artworkPendingCount:0,selfHostedReferenceCountAfter:28,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'28_Korean_DCB_owned_CDN_images_decoded',verifiedImageCount:28,unverifiedImageCount:0,brokenReferenceCount:0,
 modernArchiveImages:28,legacyArchiveImages:0,priorThemeSlotsPreserved:0,themeAdditions:additionCounts,nextStart:next,
 note:'28 Korean Time Gazer artworks individually reviewed across 12 themes and matched to decoded DCB-owned CDN files, Korean names and official card numbers. No external origin download.'});
images.nextStart=next;images.updatedAt=today;art.updatedAt=today;
await Promise.all([save('data/series.json',modern),save('data/series-legacy.json',legacy),
save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
save(A+'theme-series-review-status.json',status),save(A+'theme-image-selfhost-audit.json',images),
save('data/audits/theme-s10d-061-088-progress-20261015.json',{schemaVersion:1,recordedAt:today,set:'s10D',reviewed:88,total:88,
newThemeSlotsThisBatch:additionCounts,added,ownedCDNDecoded:28,externalImageReferencesAfter:0,
originalSourceRequests:0,priorKoreanRange:'001-060',proof:'data/audits/theme-visual-evidence/s10d/061-088/visual-index.json',nextStart:next})]);
console.log(JSON.stringify({set:'s10D',strictComplete:true,reviewed:88,added,byTheme:additionCounts,ownedCDNImages:28,next}));
