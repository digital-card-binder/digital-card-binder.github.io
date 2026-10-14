import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const A='data/audits/';
const THEMES=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const EXPECTED={color:30,street:1,season:20,sunset:3,night:2};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+'theme-s10d-001-030-Korean-art-review-20261014.json'),
 read(A+'theme-visual-evidence/s10d/001-030/visual-index.json'),
 read('data/series.json'),read('data/series-legacy.json'),read('data/art-themes.json'),
 read(A+'theme-series-review-status.json'),read(A+'theme-image-selfhost-audit.json'),
 read('data/series-image-overrides.json')
]);
const sets=[...modern,...legacy].filter(x=>String(x.code||'').toLowerCase()==='s10d');
if(sets.length!==1||sets[0].cards?.length!==88)throw Error('Korean Time Gazer 88-slot master missing');
const master=sets[0],prior=status.reviews?.[master.code],snapshot=master.cards.map(x=>x.code);
if(prior?.reviewedRanges?.includes('001-030')&&(prior.reviewedCardCount||0)>=30){console.log('s10D 001-030 already applied');process.exit(0);}
if((prior?.reviewedCardCount||0)!==0||
 status.execution?.nextStart!=='s10D canonical 001'||
 images.nextStart!=='s10D canonical 001'||
 ev.set!=='s10D'||ev.range!=='canonical-order 001-030'||
 ev.expectedCanonicalCards!==88||ev.visuallyReviewedKoreanCards!==30||
 ev.verifiedOwnedCDNImages!==30||ev.originImageRequests!==0||
 !ev.all12ThemesInspected||ev.items?.length!==30||
 JSON.stringify(ev.newThemeSlotsThisBatch)!==JSON.stringify(EXPECTED)||
 proof.set?.toLowerCase()!=='s10d'||proof.cardCount!==30||
 proof.masterSetCardCount!==88||proof.canonicalRange!=='001-030'||
 proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.cards?.length!==30||
 proof.sheets?.length!==2||proof.sheets[0].file!=='s10d-001-030-01.webp.b64'||
 proof.sheets[1].file!=='s10d-001-030-02.webp.b64')
 throw Error('Time Gazer first batch evidence or prior checkpoint mismatch');
const groups=new Map(art.groups.map(x=>[x.code,x]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error('Unknown theme '+t);
const oldByOrder=new Map();let oldTotal=0;
for(const g of art.groups)for(const c of g.cards||[]){
 const m=/^S10D_(\d{3})$/i.exec(String(c.code||''));
 if(!m)continue;
 oldTotal++;const n=Number(m[1]);
 if(n<=30)oldByOrder.set(n,[...(oldByOrder.get(n)||[]),g.code]);
}
if(oldByOrder.size!==0||ev.existingThemeSlotsPreserved!==0)throw Error('Existing Time Gazer 001-030 themes must be preserved, not double-added');
overrides.sets??={};overrides.sets.s10d??={};
const additions={};let added=0,modernCount=0,legacyCount=0;
for(let i=0;i<30;i++){
 const n=i+1,id=String(n).padStart(3,'0');
 const card=master.cards[i],p=proof.cards[i],row=ev.items[i];
 const additionsForCard=row?.newlyMatchedThemes||[];
 const original=(p?.existingThemes||[]).slice().sort();
 const merged=[...new Set([...original,...additionsForCard])].sort();
 const host=p?.cdnUrl?.split('/')[2];
 if(!card||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  card.code?.toLowerCase()!=='s10d_'+id+'/067'||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=='S10D_'+id||row.printedNumber!==id+'/067'||
  row.koreanName!==card.name||p.name!==card.name||!card.name?.trim()||
  row.illustrationType!=='pokemon'||row.imageInKorean!==true||
  row.all12ThemesInspected!==true||!row.artObservation?.trim()||
  row.preExistingThemes?.slice().sort().join(',')!==original.join(',')||
  original.length!==0||
  row.matchedThemes?.slice().sort().join(',')!==merged.join(',')||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+'theme-visual-evidence/s10d/001-030/s10d-001-030-'+String(Math.ceil(n/15)).padStart(2,'0')+'.webp.b64'||
  row.decodedProof?.status!=='decoded'||p.imageCheck?.status!=='decoded'||
  p.imageCheck?.http!==200||p.imageCheck?.format!=='WEBP'||
  p.imageCheck?.dimensions?.join(',')!=='420,586'||
  !['dcb-card-images-modern-2026.pages.dev','dcb-card-images-legacy-2026.pages.dev'].includes(host))
 throw Error('Korean s10D card identity/owned image/12-theme evidence mismatch at '+n);
 if(host==='dcb-card-images-modern-2026.pages.dev')modernCount++;else legacyCount++;
 if(card.image!==p.cdnUrl){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=p.cdnUrl;}
 overrides.sets.s10d[card.code.toLowerCase()]=p.cdnUrl;
 for(const theme of additionsForCard){
  if(!THEMES.includes(theme)||original.includes(theme)||groups.get(theme).cards.some(x=>x.code===row.cardKey))
   throw Error('Unexpected duplicate theme '+n+'/'+theme);
  const category=theme==='color'?row.colorCategory:
   theme==='season'?row.seasonCategory:theme==='street'?row.streetCategory:
   theme==='night'?row.nightCategory:theme==='sunset'?row.sunsetCategory:null;
  if(!category)throw Error('Missing scene classification '+n+'/'+theme);
  groups.get(theme).cards.push({
   code:row.cardKey,name:card.name,series:'S',set:master.code,
   setName:master.displayName||master.name,cardNumber:id+'/067',
   rarity:card.rarity||'',category,image:p.cdnUrl,
   evidence:'한국판 타임게이저 s10D '+id+'/067 카드 원본 그림 12테마 검수: '+row.artObservation+
    ' 기존 소유/카드 키 보존. 증빙 '+row.proofImage+'; DCB 이미지 직접 디코딩.'
  });
  additions[theme]=(additions[theme]||0)+1;added++;
 }
}
for(const k of Object.keys(EXPECTED))if(additions[k]!==EXPECTED[k])throw Error('Theme count mismatch '+k);
if(JSON.stringify(snapshot)!==JSON.stringify(master.cards.map(x=>x.code))||
 modernCount!==28||legacyCount!==2||added!==56)
 throw Error('Korean Time Gazer 001-030 integrity mismatch');
const today='2026-10-14',next='s10D canonical 031';
status.reviews[master.code]={...(prior||{}),status:'in_progress',reviewedAt:today,
 reviewedCardCount:30,verifiedSelfHostedImageCount:30,reviewedRanges:['001-030'],
 reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prior?.newlyAddedThemeSlotCount||0)+added,
 priorThemeSlotsPreserved:oldTotal,
 partialReviewEvidence:A+'theme-s10d-001-030-Korean-art-review-20261014.json',
 archiveVerificationStatus:'s10D_001-030_30_Korean_DCB_owned_CDN_images_decoded',
 nextStart:next,note:'타임게이저 한국판 001-030 그림 30장 12테마 검수; 셀프호스팅 28 modern + 2 legacy. 001·002는 사진 워터마크 품질 교체 대기(한국어 카드 신원 확인 완료).'};
status.execution.currentEra='S';status.execution.currentSet='s10D';
status.execution.lastSafeCheckpoint='s10D canonical 001-030 (30/88) Korean artwork and 30 DCB-owned CDN images decoded';
status.execution.nextStart=next;status.execution.updatedAt=today;
images.batches.push({task:6,set:'s10D',range:'canonical 001-030 Korean Time Gazer',
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'30_Korean_DCB_owned_CDN_images_decoded',
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 modernArchiveImages:28,legacyArchiveImages:2,priorThemeSlotsPreserved:0,
 themeAdditions:additions,nextStart:next,
 note:'All 30 Korean prints directly decoded from user-owned CDN, but two legacy archive images have a source watermark and remain image-quality repair candidates. No third-party origin requests.'});
images.nextStart=next;images.updatedAt=today;art.updatedAt=today;
const progress={schemaVersion:1,recordedAt:today,set:'s10D',status:'in_progress',
 totalMasterCards:88,reviewedCanonicalCards:30,remainingUnreviewed:58,
 KoreanArtVerified:30,ownedCDNImagesVerified:30,
 newlyAddedThisBatch:added,byTheme:additions,
 existingThemeSlotsPreserved:oldTotal,modernArchiveImages:modernCount,legacyArchiveImages:legacyCount,
 knownImageQualityHolds:[{orders:[1,2],reason:'watermark in original legacy image'}],
 proof:A+'theme-visual-evidence/s10d/001-030/visual-index.json',
 visualReviewEvidence:A+'theme-s10d-001-030-Korean-art-review-20261014.json',
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:next};
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/series-image-overrides.json',overrides),save('data/art-themes.json',art),
 save(A+'theme-series-review-status.json',status),
 save(A+'theme-image-selfhost-audit.json',images),
 save(A+'theme-s10d-001-030-progress-20261014.json',progress)
]);
console.log(JSON.stringify({set:'s10D',reviewed:30,total:88,added,byTheme:additions,next:images.nextStart}));
