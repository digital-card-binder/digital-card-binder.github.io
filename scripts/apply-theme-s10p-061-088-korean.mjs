import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const T=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
read('data/audits/theme-s10p-061-088-Korean-art-review-20261015.json'),read('data/audits/theme-visual-evidence/s10p/061-088/visual-index.json'),read('data/series.json'),read('data/series-legacy.json'),
read('data/art-themes.json'),read('data/audits/theme-series-review-status.json'),
read('data/audits/theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')]);
const sets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()==='s10p');
if(sets.length!==1||sets[0].cards?.length!==88||
proof.set!=='s10p'||proof.canonicalRange!=='061-088'||proof.cardCount!==28||
proof.verificationCounts?.verified!==28||proof.verificationCounts?.missing!==0||
proof.masterMissingKoreanNames!==0||proof.cards?.length!==28||ev.items?.length!==28||
ev.visuallyReviewedKoreanCards!==28||ev.verifiedOwnedCDNImages!==28||
!ev.all12ThemesInspected||ev.originImageRequests!==0)
throw Error('Final 28 Korean image proofs missing');
const set=sets[0],prior=status.reviews?.[set.code]||{};
if(prior.status==='complete'&&prior.reviewedCardCount===88){console.log('s10P completed previously');process.exit(0);}
if(prior.reviewedCardCount!==60||prior.verifiedSelfHostedImageCount!==60||
!prior.reviewedRanges?.includes('031-060')||status.execution?.currentSet!=='s10P'||
status.execution.nextStart!=='s10P canonical 061'||images.nextStart!=='s10P canonical 061')
throw Error('Unsafe final Space Juggler checkpoint');
const groups=new Map(art.groups.map(x=>[x.code,x]));for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error('Missing theme '+t);
overrides.sets??={};overrides.sets.s10p??={};
let modernCount=0,legacyCount=0,added=0;const counts={};const seq=set.cards.map(c=>c.code);
const allowedLegacy={
 74:{raw:'https://static.tcgexchange.kr/f1a55bfabc00cf4de5f237a30cdced2d.png',
     cdn:'https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/212c59295ae93ed0.webp',
     master:'https://www.dogam.app/cards/01KW1C60V1S29FSD2GYBR6HH9Y'},
 75:{raw:'https://static.tcgexchange.kr/a85a10ac056873404d83175ff7388b12.png',
     cdn:'https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/0498e8ad297c355a.webp',
     master:'https://www.dogam.app/cards/01KW1C60V1F0Q9ABY52TD02WF7'}
};
for(let i=0;i<28;i++){
 const n=i+61,id=String(n).padStart(3,'0'),c=set.cards[n-1],p=proof.cards[i],row=ev.items[i];
 const official=p?.rawSource==='https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S10/S10P_'+id+'.png'&&
 p?.cdnUrl==='https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S10/S10P_'+id+'.webp';
 const legacyEvidence=allowedLegacy[n]&&p?.rawSource===allowedLegacy[n].raw&&
 p?.cdnUrl===allowedLegacy[n].cdn&&c?.source===allowedLegacy[n].master;
 if(!c||!p||!row||c.code.toLowerCase()!=='s10p_'+id+'/067'||
 p.masterCode.toLowerCase()!==c.code.toLowerCase()||p.canonicalOrder!==n||row.canonicalOrder!==n||
 row.cardKey!=='S10P_'+id||row.name!==c.name||p.name!==c.name||!row.artObservation?.trim()||
 p.existingThemes?.length!==0||T.some(t=>groups.get(t).cards.some(x=>x.code===row.cardKey))||
 p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
 p.imageCheck.format!=='WEBP'||p.imageCheck.dimensions?.join(',')!=='420,586'||
 !(official||legacyEvidence)||(c.image!==p.rawSource&&c.image!==p.cdnUrl))
 throw Error('s10P 061-088 Korean image/identity/host mismatch at '+n);
 if(official)modernCount++;else legacyCount++;
 const themes=new Set();
 for(const t of row.matchedThemes){
  if(!T.includes(t)||themes.has(t)||!row.categories[t]?.trim())throw Error('Duplicate/unjustified theme '+id+'/'+t);
  themes.add(t);
  groups.get(t).cards.push({code:row.cardKey,name:c.name,series:'S',set:set.code,
   setName:set.displayName,cardNumber:id+'/067',rarity:c.rarity||'',category:row.categories[t],
   image:p.cdnUrl,evidence:'한국판 스페이스 저글러 s10P '+id+'/067 실제 그림 검수: '+row.artObservation+
    ' 그림/한글 번호/기존 아카이브 증빙: data/audits/theme-visual-evidence/s10p/061-088/visual-index.json'});
  counts[t]=(counts[t]||0)+1;added++;
 }
 if(c.image!==p.cdnUrl){if(!c.sourceImage)c.sourceImage=p.rawSource;c.image=p.cdnUrl;}
 overrides.sets.s10p[c.code.toLowerCase()]=p.cdnUrl;
}
if(JSON.stringify(seq)!==JSON.stringify(set.cards.map(x=>x.code))||modernCount!==26||legacyCount!==2)
throw Error('Canonical identity or owned archive count mismatch');
for(const [t,n] of Object.entries(ev.newThemeSlotsThisBatch))if(counts[t]!==n)throw Error('Theme evidence mismatch '+t);
if(Object.values(counts).reduce((a,b)=>a+b,0)!==added)throw Error('Added slots wrong');
const today='2026-10-15',next='s9a canonical 001';
status.reviews[set.code]={...prior,status:'complete',reviewedAt:today,reviewedCardCount:88,
verifiedSelfHostedImageCount:88,reviewedRanges:[...prior.reviewedRanges,'061-088'],
reviewedThemes:T,heldCards:[],newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
partialReviewEvidence:'data/audits/theme-s10p-061-088-Korean-art-review-20261015.json',
archiveVerificationStatus:'s10P_061-088_28_Korean_DCB_owned_CDN_images_decoded',nextStart:next,
note:'스페이스 저글러 88개 한국판 카드 전체 12테마 그림 검수 완료. 061-088 28장 중 공식원본->modern 26장, 기존 legacy 2장 검증·자가호스팅, 원본 출처 보존. 044/074/075 legacy 워터마크 화질 개선 후보 별도.'};
status.execution.currentEra='S';status.execution.currentSet='s9a';
status.execution.lastSafeCheckpoint='s10P canonical 001-088 (88/88) Korean artwork and owned CDN images verified';
status.execution.nextStart=next;status.execution.updatedAt=today;status.updatedAt=today;
images.batches.push({task:6,set:'s10P',range:'canonical 061-088 Korean Space Juggler',
canonicalCardCount:28,artworkVisuallyVerifiedCount:28,artworkPendingCount:0,selfHostedReferenceCountAfter:28,
externalImageReferenceCountAfter:0,archiveVerificationStatus:'28_Korean_DCB_owned_CDN_images_decoded',
verifiedImageCount:28,unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:modernCount,
legacyArchiveImages:legacyCount,priorThemeSlotsPreserved:0,themeAdditions:counts,nextStart:next,
note:'28 Korean printed artworks inspected for 12 themes, 26 modern and 2 legacy owned archives verified; original Korean source provenance retained. Legacy quality repair independent.'});
images.nextStart=next;images.updatedAt=today;art.updatedAt=today;
await Promise.all([save('data/series.json',modern),save('data/series-legacy.json',legacy),
save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
save('data/audits/theme-series-review-status.json',status),
save('data/audits/theme-image-selfhost-audit.json',images),
save('data/audits/theme-s10p-061-088-progress-20261015.json',{schemaVersion:1,recordedAt:today,set:'s10P',status:'complete',
totalMasterCards:88,reviewedCanonicalCards:88,remainingUnreviewed:0,
newThemeSlotsThisBatch:counts,added,ownedCDNImagesVerified:28,
modernArchiveImages:modernCount,legacyArchiveImages:legacyCount,
originRequests:0,proof:'data/audits/theme-visual-evidence/s10p/061-088/visual-index.json',nextStart:next})]);
console.log(JSON.stringify({set:'s10P',complete:true,reviewed:88,added,byTheme:counts,modernCount,legacyCount,next}));
