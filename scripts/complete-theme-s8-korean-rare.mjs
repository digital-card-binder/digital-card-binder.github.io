import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const CODE='s8',DATE='2026-10-15',TOTAL=129,NEXT='s7R canonical 001';
const REQUIRED=[117,119,120,123],CODES=REQUIRED.map(x=>'s8_'+x+'/100');
const [source,modern,legacy,themes,status,hosting,overrides,progress,proof]=await Promise.all([
read('data/audits/theme-visual-evidence/s8/korean-rescued-sources/approved-crops.json'),
read('data/series.json'),read('data/series-legacy.json'),read('data/art-themes.json'),
read('data/audits/theme-series-review-status.json'),
read('data/audits/theme-image-selfhost-audit.json'),
read('data/series-image-overrides.json'),
read('data/audits/theme-s8-001-129-progress-20261015.json'),
read('data/audits/theme-visual-evidence/s8/001-129/visual-index.json')
]);
const set=[...modern,...legacy].filter(x=>String(x.code).toLowerCase()===CODE);
if(set.length!==1||set[0].cards?.length!==129)throw Error('s8 master must have 129 cards');
const prior=status.reviews?.[set[0].code]||{};
if(prior.status==='complete'&&prior.reviewedCardCount===TOTAL){
console.log('s8 Korean 129/129 already complete, skipping safely.');process.exit(0);
}
if(status.execution?.nextStart!=='s8 Korean print source pending: 117,119,120,123'||
hosting.nextStart!==status.execution.nextStart||status.execution.currentSet!=='s8'||
prior.status!=='in_progress'||prior.artworkReviewedCardCount!==129||
prior.reviewedCardCount!==125||prior.verifiedSelfHostedImageCount!==129||
JSON.stringify(prior.heldCards)!==JSON.stringify(CODES)||
progress.status!=='in_progress'||progress.artworkReviewed!==129||
progress.verifiedKoreanPrintImages!==125||
JSON.stringify(progress.pendingKoreanImages)!==JSON.stringify(CODES)||
source.set!=='s8'||source.total!==4||source.cards?.length!==4||
proof.canonicalCardsChecked!==129||proof.verifiedOwnedCdnImageCount!==129)
throw Error('Unsafe s8 completion checkpoint (prior work preserved)');
const originals=set[0].cards.map(x=>x.code);
const expectedNames={117:'펄스멍 VMAX',119:'뮤 VMAX',120:'요씽리스 VMAX',123:'팟과 덴트와 콘'};
const changes=[];
const allCards=themes.groups.flatMap(g=>g.cards);
for(let i=0;i<4;i++){
 const n=REQUIRED[i],row=source.cards[i],id=String(n).padStart(3,'0'),key='S8_'+id;
 if(row.number!==n||!row.verifiedKoreanPrint||row.confirmedKoreanCardName!==expectedNames[n]||
    row.ownedPath!=='assets/cards/s8-korean-rare/'+n+'-korean.webp'||
    row.width!==420||row.height!==586||!row.source?.startsWith('https://')||
    JSON.stringify(row.cropBox)?.length<8)throw Error('Korean image visual confirmation mismatch '+n);
 const bytes=await readFile(row.ownedPath);
 if(bytes.length<3000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')
    throw Error('Missing actual self-owned Korean picture '+n);
 const master=set[0].cards[n-1],p=proof.cards[n-1];
 if(!master||!p||master.code.toLowerCase()!=='s8_'+id+'/100'||
    p.name!==expectedNames[n]||master.name!==expectedNames[n]||
    !master.koreanPrintImagePending||master.sourceImage!==p.rawSource||
    p.canonicalOrder!==n||p.masterCode.toLowerCase()!==master.code.toLowerCase())
    throw Error('Master s8 Korean source identity mismatch '+n);
 const hosted='https://digital-card-binder.github.io/'+row.ownedPath;
 if(!master.image?.startsWith('https://dcb-card-images-legacy-2026.pages.dev/'))
    throw Error('Prior non-Korean legacy archive unexpectedly changed '+n);
 const matched=allCards.filter(c=>String(c.code||'').toUpperCase()===key);
 if(matched.length!==1||matched[0].name!==expectedNames[n]||
    matched[0].image!==master.image)throw Error('Expected exactly one prior thematic membership '+n);
 master.previousNonKoreanSourceImage=p.rawSource;
 master.sourceImage=row.source;master.image=hosted;
 delete master.koreanPrintImagePending;
 master.koreanPrintImageVerified=true;
 matched[0].image=hosted;
 matched[0].evidence=String(matched[0].evidence||'').replace(
  ' (해외판 임시 이미지: 한국어 인쇄판 이미지 대체 필요)','')+
  ' 한국판 실물 이미지 교체 증빙: data/audits/theme-visual-evidence/s8/korean-rescued-sources/approved-crops.json';
 overrides.sets??={};overrides.sets[CODE]??={};overrides.sets[CODE][master.code.toLowerCase()]=hosted;
 changes.push({code:master.code,source:row.source,owned:hosted});
}
if(JSON.stringify(originals)!==JSON.stringify(set[0].cards.map(x=>x.code)))throw Error('Master card codes altered');
const next=NEXT;
status.reviews[set[0].code]={...prior,status:'complete',reviewedAt:DATE,completedAt:DATE,
 reviewedCardCount:129,artworkReviewedCardCount:129,
 verifiedKoreanPrintImageCount:129,verifiedSelfHostedImageCount:129,
 heldCards:[],unresolvedImageIssues:[],
 reviewedRanges:['001-129'],reviewedThemes:['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'],
 archiveVerificationStatus:'s8_all_129_Korean_print_images_verified_owned_by_DCB',
 nextStart:next,
 partialReviewEvidence:'data/audits/theme-visual-evidence/s8/korean-rescued-sources/approved-crops.json',
 note:'퓨전아츠 한국판 129/129 카드와 12테마 직접 검수 완료. 117·119·120·123 일본판 임시 이미지를 소스 검증된 한국판 실물 사진으로 자체 호스팅 교체. 118·124 한국어판 실물 워터마크 이미지와 기타 정상 소유 CDN 자료 보존.'};
status.execution.currentEra='S';status.execution.currentSet='s7R';
status.execution.lastSafeCheckpoint='s8 001-129 (129/129) Korean print, card art and self-hosted image verified';
status.execution.nextStart=next;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({task:6,set:CODE,range:'Korean Fusion Arts 117/119/120/123 print-image recovery',
 canonicalCardCount:4,artworkVisuallyVerifiedCount:4,artworkPendingCount:0,
 selfHostedReferenceCountAfter:4,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'4_Korean_source_images_self_hosted',verifiedImageCount:4,
 unverifiedImageCount:0,brokenReferenceCount:0,newlyInternalizedReferenceCount:4,
 koreanPrintImagesConfirmed:129,koreanPrintImagesPending:0,nextStart:next,
 note:'Replaced four foreign-language placeholders with Korean print photographs; all 129 Korean artworks verified.'});
hosting.nextStart=next;hosting.updatedAt=DATE;themes.updatedAt=DATE;status.updatedAt=DATE;
progress.status='complete';progress.verifiedKoreanPrintImages=129;
progress.pendingKoreanImages=[];progress.remainingUnreviewed=0;progress.complete=true;
progress.recoveredKoreanImages=changes;progress.nextStart=next;
progress.koreanImageProof='data/audits/theme-visual-evidence/s8/korean-rescued-sources/approved-crops.json';
progress.note='S8 129/129 complete, 234 theme additions preserved, 4 rare Korean print photos hosted. 118/124 remain real Korean prints with source watermark.';
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/art-themes.json',themes),save('data/series-image-overrides.json',overrides),
 save('data/audits/theme-series-review-status.json',status),
 save('data/audits/theme-image-selfhost-audit.json',hosting),
 save('data/audits/theme-s8-001-129-progress-20261015.json',progress)
]);
console.log(JSON.stringify({complete:true,set:CODE,reviewed:129,korean:129,owned:129,
 themeAddedPreviously:234,repaired:changes.length,next}));
