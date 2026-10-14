import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const A='data/audits/';
const THEMES=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const EXPECTED={color:29,season:20,street:4,night:1,sunset:1};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+'theme-s10d-031-060-Korean-art-review-20261014.json'),
 read(A+'theme-visual-evidence/s10d/031-060/visual-index.json'),
 read('data/series.json'),read('data/series-legacy.json'),read('data/art-themes.json'),
 read(A+'theme-series-review-status.json'),read(A+'theme-image-selfhost-audit.json'),
 read('data/series-image-overrides.json')
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||'').toLowerCase()==='s10d');
if(sets.length!==1||sets[0].cards?.length!==88)throw Error('Korean Time Gazer 88-slot master missing');
const master=sets[0],prior=status.reviews?.[master.code],oldSequence=master.cards.map(x=>x.code);
if(prior?.reviewedRanges?.includes('031-060')&&(prior.reviewedCardCount||0)>=60){console.log('s10D 031-060 already applied');process.exit(0);}
if((prior?.reviewedCardCount||0)!==30||
 !prior?.reviewedRanges?.includes('001-030')||
 status.execution?.nextStart!=='s10D canonical 031'||
 images.nextStart!=='s10D canonical 031'||
 ev.set!=='s10D'||ev.range!=='canonical-order 031-060'||
 ev.expectedCanonicalCards!==88||ev.visuallyReviewedKoreanCards!==30||
 ev.verifiedOwnedCDNImages!==30||ev.originImageRequests!==0||
 !ev.all12ThemesInspected||ev.items?.length!==30||
 proof.set?.toLowerCase()!=='s10d'||proof.cardCount!==30||
 proof.masterSetCardCount!==88||proof.canonicalRange!=='031-060'||
 proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.cards?.length!==30||
 proof.sheets?.length!==2||proof.sheets[0].file!=='s10d-031-060-01.webp.b64'||
 proof.sheets[1].file!=='s10d-031-060-02.webp.b64'||
 ev.existingThemeSlotsPreserved!==1)
 throw Error('Time Gazer second batch evidence or prior checkpoint mismatch');
for(const t of Object.keys(EXPECTED))if(ev.newThemeSlotsThisBatch?.[t]!==EXPECTED[t])throw Error('Expected Korean theme evidence count differs: '+t);
const groups=new Map(art.groups.map(x=>[x.code,x]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error('Unknown theme '+t);
const current=new Map();let previousSlots=0;
for(const g of art.groups)for(const c of g.cards||[]){
 const m=/^S10D_(\d{3})$/i.exec(String(c.code||''));
 if(!m)continue;
 previousSlots++;const n=Number(m[1]);
 if(n>=31&&n<=60)current.set(n,[...(current.get(n)||[]),g.code]);
}
if(current.size!==1||!current.has(58)||current.get(58).join(',')!=='sleeping')
 throw Error('Existing Korean Time Gazer 058 sleeping slot must be preserved');
overrides.sets??={};overrides.sets.s10d??={};
const additions={};let added=0,preserved=0,modernCount=0,legacyCount=0;
for(let i=0;i<30;i++){
 const n=i+31,id=String(n).padStart(3,'0');
 const card=master.cards[n-1],p=proof.cards[i],row=ev.items[i];
 const original=(p?.existingThemes||[]).slice().sort();
 const existing=(current.get(n)||[]).slice().sort();
 const extra=row?.newlyMatchedThemes||[];
 const combined=[...new Set([...original,...extra])].sort();
 const host=p?.cdnUrl?.split('/')[2];
 if(!card||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  card.code?.toLowerCase()!=='s10d_'+id+'/067'||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=='S10D_'+id||row.printedNumber!==id+'/067'||
  row.koreanName!==card.name||p.name!==card.name||!card.name?.trim()||
  row.illustrationType!==(n===60?'item':'pokemon')||
  row.imageInKorean!==true||row.all12ThemesInspected!==true||!row.artObservation?.trim()||
  row.preExistingThemes?.slice().sort().join(',')!==original.join(',')||
  existing.join(',')!==original.join(',')||
  row.matchedThemes?.slice().sort().join(',')!==combined.join(',')||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+'theme-visual-evidence/s10d/031-060/s10d-031-060-'+String(Math.ceil((n-30)/15)).padStart(2,'0')+'.webp.b64'||
  row.decodedProof?.status!=='decoded'||p.imageCheck?.status!=='decoded'||
  p.imageCheck?.http!==200||p.imageCheck?.format!=='WEBP'||
  p.imageCheck?.dimensions?.join(',')!=='420,586'||
  !['dcb-card-images-modern-2026.pages.dev','dcb-card-images-legacy-2026.pages.dev'].includes(host))
 throw Error('Korean s10D 031-060 card identity/owned image/theme evidence mismatch at '+n);
 preserved+=original.length;
 if(host==='dcb-card-images-modern-2026.pages.dev')modernCount++;else legacyCount++;
 if(card.image!==p.cdnUrl){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=p.cdnUrl;}
 overrides.sets.s10d[card.code.toLowerCase()]=p.cdnUrl;
 for(const theme of extra){
  if(!THEMES.includes(theme)||original.includes(theme)||groups.get(theme).cards.some(c=>c.code===row.cardKey))
   throw Error('Unexpected duplicate theme '+n+'/'+theme);
  const category=theme==='color'?row.colorCategory:
   theme==='season'?row.seasonCategory:theme==='street'?row.streetCategory:
   theme==='night'?row.nightCategory:theme==='sunset'?row.sunsetCategory:null;
  if(!category)throw Error('Missing artwork scene category '+n+'/'+theme);
  groups.get(theme).cards.push({
   code:row.cardKey,name:card.name,series:'S',set:master.code,
   setName:master.displayName||master.name,cardNumber:id+'/067',rarity:card.rarity||'',
   category,image:p.cdnUrl,evidence:'한국판 타임게이저 s10D '+id+'/067 원본 그림 검수: '+row.artObservation+
    ' 기존 도감/수집 키 보존; 증빙 '+row.proofImage+'; DCB 이미지 디코딩.'
  });
  additions[theme]=(additions[theme]||0)+1;added++;
 }
}
for(const t of Object.keys(EXPECTED))if(additions[t]!==EXPECTED[t])throw Error('Incorrect 12-theme classification count '+t);
if(JSON.stringify(oldSequence)!==JSON.stringify(master.cards.map(x=>x.code))||
 preserved!==1||modernCount!==30||legacyCount!==0||added!==55)
 throw Error('Korean s10D 031-060 audit integrity mismatch');
const today='2026-10-14',next='s10D canonical 061';
status.reviews[master.code]={...(prior||{}),status:'in_progress',reviewedAt:today,
 reviewedCardCount:60,verifiedSelfHostedImageCount:60,
 reviewedRanges:[...(prior.reviewedRanges||[]),'031-060'],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+'theme-s10d-031-060-Korean-art-review-20261014.json',
 archiveVerificationStatus:'s10D_031-060_30_Korean_DCB_owned_CDN_images_decoded',
 nextStart:next,note:'타임게이저 001-060 실제 한국판 일러스트 12테마 검수 완료(60/88). #058 요씽리스 수면 분류 유지; #001~002 기존 이미지 워터마크 품질 개선은 별도 보류.'};
status.execution.currentEra='S';status.execution.currentSet='s10D';
status.execution.lastSafeCheckpoint='s10D canonical 001-060 (60/88) Korean art and DCB-owned CDN images verified';
status.execution.nextStart=next;status.execution.updatedAt=today;
images.batches.push({task:6,set:'s10D',range:'canonical 031-060 Korean Time Gazer',
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'30_Korean_DCB_owned_CDN_images_decoded',
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 modernArchiveImages:30,legacyArchiveImages:0,
 priorThemeSlotsPreserved:preserved,themeAdditions:additions,nextStart:next,
 note:'All 30 Korean artworks decoded from owned CDN and reviewed for 12 themes; existing S10D_058 sleeping preserved, and previous batch watermark holds retained.'});
images.nextStart=next;images.updatedAt=today;art.updatedAt=today;
const progress={schemaVersion:1,recordedAt:today,set:'s10D',status:'in_progress',
 totalMasterCards:88,reviewedCanonicalCards:60,remainingUnreviewed:28,
 KoreanArtVerified:60,ownedCDNImagesVerified:60,newlyAddedThisBatch:added,
 byTheme:additions,existingThemeSlotsPreserved:preserved,
 modernArchiveImages:modernCount,legacyArchiveImages:legacyCount,
 priorBatchKnownWatermarkedPrints:[1,2],
 proof:A+'theme-visual-evidence/s10d/031-060/visual-index.json',
 visualReviewEvidence:A+'theme-s10d-031-060-Korean-art-review-20261014.json',
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:next};
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/series-image-overrides.json',overrides),save('data/art-themes.json',art),
 save(A+'theme-series-review-status.json',status),
 save(A+'theme-image-selfhost-audit.json',images),
 save(A+'theme-s10d-031-060-progress-20261014.json',progress)
]);
console.log(JSON.stringify({set:'s10D',reviewed:60,total:88,added,byTheme:additions,next:images.nextStart}));
