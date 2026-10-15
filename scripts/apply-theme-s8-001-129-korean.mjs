import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const CODE='s8',DATE='2026-10-15',TOTAL=129;
const GROUPS=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const reviewFiles=['001-045','046-090','091-129'];
const [a,b,c,proof,candidates,modern,legacy,art,status,hosting,overrides]=await Promise.all([
 ...reviewFiles.map(r=>read('data/audits/theme-s8-'+r+'-Korean-art-review-20261015.json')),
 read('data/audits/theme-visual-evidence/s8/001-129/visual-index.json'),
 read('data/audits/theme-visual-evidence/s8/korean-candidate-117-124/candidates.json'),
 read('data/series.json'),read('data/series-legacy.json'),read('data/art-themes.json'),
 read('data/audits/theme-series-review-status.json'),read('data/audits/theme-image-selfhost-audit.json'),
 read('data/series-image-overrides.json')
]);
const parts=[a,b,c],items=parts.flatMap(x=>x.items);
const masterSets=[...modern,...legacy].filter(x=>String(x.code||'').toLowerCase()===CODE);
if(masterSets.length!==1||masterSets[0].cards?.length!==TOTAL)throw Error('Expected exactly one s8 Korean 129-card master.');
const set=masterSets[0],prior=status.reviews?.[set.code]||{};
const pending=[117,119,120,123],pendingCodes=pending.map(x=>'s8_'+String(x).padStart(3,'0')+'/100');
if(prior.artworkReviewedCardCount===129&&prior.reviewedCardCount===125&&
 JSON.stringify(prior.heldCards||[])===JSON.stringify(pendingCodes)){
 console.log('s8 all 129 art reviews and 125 print checks already committed; no changes.');process.exit(0);
}
if(status.execution?.nextStart!=='s8 canonical 001'||
 hosting.nextStart!=='s8 canonical 001'||status.execution?.currentSet!=='s8'||
 (prior.reviewedCardCount||0)!==0)throw Error('Unexpected initial s8 audit checkpoint.');
if(proof.set!==CODE||proof.masterSetCardCount!==129||
 proof.canonicalCardsChecked!==129||proof.verifiedOwnedCdnImageCount!==129||
 proof.unavailableOwnedCdnImageCount!==0||proof.printedNumberMatchCount!==129||
 proof.koreanNameNonemptyCount!==129||proof.sourceRequestCount!==0||
 proof.cards?.length!==129||items.length!==129||
 parts.some(x=>x.set!==CODE||!x.all12ThemesInspected||x.originImageRequests!==0)||
 candidates.set!==CODE||candidates.available!==2)
 throw Error('Incomplete Korean artwork, number or host preflight.');
if(JSON.stringify(c.printLanguageReviewExceptions)!==JSON.stringify([117,118,119,120,123,124]))
 throw Error('Foreign-print safety exceptions changed.');
const candidateMap=new Map(candidates.cards.filter(x=>x.status==='candidate_subject_to_manual_korean_print_check').map(x=>[x.number,x]));
if(JSON.stringify([...candidateMap.keys()].sort((x,y)=>x-y))!==JSON.stringify([118,124]))
 throw Error('Korean replacement print candidate set diverged.');
const pinOriginals=new Map(proof.cards.map(x=>[x.canonicalOrder,x.masterCode]));
const groupMap=new Map(art.groups.map(g=>[g.code,g]));
for(const t of GROUPS)if(!Array.isArray(groupMap.get(t)?.cards))throw Error('Missing art theme '+t);
overrides.sets??={};overrides.sets[CODE]??={};
let added=0,externalRehosted=0;
const counts={},codes=set.cards.map(x=>x.code),issues=[];
for(let i=0;i<TOTAL;i++){
 const n=i+1,id=String(n).padStart(3,'0'),key='S8_'+id;
 const master=set.cards[i],p=proof.cards[i],r=items[i],exceptions=c.printLanguageReviewExceptions;
 if(!master||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
   r.cardKey!==key||String(master.code).toLowerCase()!==CODE+'_'+id+'/100'||
   p.masterCode.toLowerCase()!==String(master.code).toLowerCase()||
   pinOriginals.get(n)!==p.masterCode||r.name!==master.name||p.name!==master.name||
   p.expectedPrintedNumber!==id+'/100'||!p.printedNumberMatches||
   p.imageCheck?.status!=='decoded'||p.imageCheck.http!==200||
   p.imageCheck.format!=='WEBP'||(p.imageCheck.dimensions||[]).length!==2||
   p.priorThemes?.length!==0||!r.artObservation?.trim()||
   (master.sourceImage||master.image)!==p.rawSource||
   GROUPS.some(t=>groupMap.get(t).cards.some(x=>String(x.code||'').toUpperCase()===key)))
   throw Error('Unsafe Fusion Arts card or theme proof at '+n);
 if(!p.ownedCdnUrl.startsWith('https://dcb-card-images-')||
    !['cards.image.pokemonkorea.co.kr','static.tcgexchange.kr'].includes(new URL(p.rawSource).hostname))
   throw Error('Card owned archive or source not verified '+n);
 const local=candidateMap.get(n);
 const koreanPending=pending.includes(n);
 if(exceptions.includes(n)&&!local&&!koreanPending)throw Error('Unexpected foreign print '+n);
 if(local){
   if(local.number!==n||!local.source.startsWith('https://tcgbox.co.kr/')||
     local.ownedPath!=='assets/cards/s8-korean-rare/'+n+'.webp'||
     local.width<250||local.height<350||!(/^[a-f0-9]{64}$/.test(local.sha256)))
     throw Error('Bad Korean candidate '+n);
   const bytes=await readFile(local.ownedPath);
   if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')
     throw Error('Owned replacement WebP missing '+n);
 }
 if(koreanPending)issues.push({code:master.code,name:master.name,issue:'Japanese-language artwork placeholder; correct Korean image not sourced yet'});
 const owned=local?'https://digital-card-binder.github.io/'+local.ownedPath:p.ownedCdnUrl;
 const used=new Set();
 for(const t of r.matchedThemes){
  if(!GROUPS.includes(t)||used.has(t)||!r.categories?.[t]?.trim())throw Error('Invalid curated category at '+n+' '+t);
  used.add(t);
  groupMap.get(t).cards.push({
   code:key,name:master.name,series:'S',set:CODE,setName:set.displayName||'퓨전아츠',
   cardNumber:id+'/100',rarity:master.rarity||'',category:r.categories[t],image:owned,
   evidence:'한국판 퓨전아츠 s8 '+id+'/100 실물 아트 검수: '+r.artObservation+
     (koreanPending?' (해외판 임시 이미지: 한국어 인쇄판 이미지 대체 필요)':'')+
     (local?' (한국어판 판매처 사진, 워터마크 포함: 깨끗한 이미지 교체 필요)':'')
  });
  counts[t]=(counts[t]||0)+1;added++;
 }
 const old=String(master.image||'');
 if(local){
  master.previousNonKoreanSourceImage=p.rawSource;
  master.sourceImage=local.source;
  master.koreanImageNeedsCleanReplacement=true;
 }else if(!master.sourceImage){master.sourceImage=p.rawSource;}
 if(koreanPending)master.koreanPrintImagePending=true;
 if(old!==owned){
  if(!old.includes('dcb-card-images-'))externalRehosted++;
  master.image=owned;
 }
 overrides.sets[CODE][String(master.code).toLowerCase()]=owned;
}
if(JSON.stringify(codes)!==JSON.stringify(set.cards.map(x=>x.code)))
 throw Error('Master identifiers mutated');
const actualCounts=Object.fromEntries(GROUPS.filter(x=>counts[x]).map(x=>[x,counts[x]]));
const expectedCounts={};
for(const part of parts){for(const [k,v] of Object.entries(part.newThemeSlotsThisBatch||{}))expectedCounts[k]=(expectedCounts[k]||0)+v;}
if(JSON.stringify(actualCounts)!==JSON.stringify(Object.fromEntries(GROUPS.filter(x=>expectedCounts[x]).map(x=>[x,expectedCounts[x]]))))
 throw Error('New motif membership totals diverged');
if(added<129||counts.color!==129||issues.length!==4)throw Error('Invalid total theme coverage');
const next='s8 Korean print source pending: 117,119,120,123';
status.reviews[set.code]={...prior,status:'in_progress',reviewedAt:DATE,
 artworkReviewedCardCount:129,reviewedCardCount:125,verifiedSelfHostedImageCount:129,
 verifiedKoreanPrintImageCount:125,
 reviewedRanges:[...(prior.reviewedRanges||[]),'001-129 (art complete; print exceptions pending)'],
 reviewedThemes:GROUPS,newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
 partialReviewEvidence:'data/audits/theme-s8-091-129-Korean-art-review-20261015.json',
 archiveVerificationStatus:'129_owned_images_decoded_125_Korean_language_verified_four_Japanese_pending',
 heldCards:pendingCodes,unresolvedImageIssues:issues,nextStart:next,
 note:'퓨전아츠 전체 129장 그림 테마 검수/자체 저장 이미지 확인. 한국어 인쇄 검증 125장, 117·119·120·123 해외판 이미지 미해결. 118·124 한국어판 사진은 워터마크가 남아 추후 깨끗한 판 교체 권장. 아직 완료 시리즈로 계산 금지.'};
status.execution.currentEra='S';status.execution.currentSet='s8';
status.execution.lastSafeCheckpoint='s8 artworks 001-129, Korean images 125/129 (missing 117,119,120,123)';
status.execution.nextStart=next;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({
 task:6,set:CODE,range:'canonical 001-129 Korean Fusion Arts',
 canonicalCardCount:129,artworkVisuallyVerifiedCount:129,artworkPendingCount:0,
 selfHostedReferenceCountAfter:129,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'129_owned_CDN_display_images;_125_Korean_and_4_foreign_print_placeholders',
 verifiedImageCount:129,unverifiedImageCount:0,brokenReferenceCount:0,
 koreanPrintImagesConfirmed:125,koreanPrintImagesPending:4,
 localKoreanWatermarkedImageCount:2,themeAdditions:counts,
 newlyInternalizedReferenceCount:externalRehosted,nextStart:next,
 note:'Entire Fusion Arts themed artwork added safely; high rarity 117/119/120/123 still use Japanese-language photos while Korean print images are researched.'
});
hosting.nextStart=next;hosting.updatedAt=DATE;status.updatedAt=DATE;art.updatedAt=DATE;
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/art-themes.json',art),save('data/series-image-overrides.json',overrides),
 save('data/audits/theme-series-review-status.json',status),
 save('data/audits/theme-image-selfhost-audit.json',hosting),
 save('data/audits/theme-s8-001-129-progress-20261015.json',{
  schemaVersion:1,recordedAt:DATE,set:CODE,status:'in_progress',
  totalMasterCards:129,artworkReviewed:129,verifiedKoreanPrintImages:125,
  pendingKoreanImages:pendingCodes,remainingUnreviewed:4,
  newThemeSlotsThisBatch:counts,added,ownedImagesVerified:129,
  koreanPrintWithWatermark:[118,124],nextStart:next,
  proof:'data/audits/theme-visual-evidence/s8/001-129/visual-index.json'
 })
]);
console.log(JSON.stringify({set:CODE,artworksReviewed:129,ownedImages:129,koreanPrintVerified:125,pending:issues,added,next}));
