import { readFile, writeFile } from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,o)=>writeFile(p,JSON.stringify(o,null,2)+'\n');
const A='data/audits/';
const T=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const [ev,modern,legacy,art,status,images,overrides]=await Promise.all([
  read(A+'theme-s10a-091-099-Korean-art-review-20261014.json'),
  read('data/series.json'),read('data/series-legacy.json'),
  read('data/art-themes.json'),read(A+'theme-series-review-status.json'),
  read(A+'theme-image-selfhost-audit.json'),read('data/series-image-overrides.json')
]);
const sets=[...modern,...legacy].filter(x=>String(x.code).toLowerCase()==='s10a');
if(sets.length!==1||sets[0].cards.length!==99)throw Error('Korean s10a 99-card master missing');
const master=sets[0],prior=status.reviews?.[master.code],oldCodes=master.cards.map(x=>x.code).join('|');
if(prior?.status==='complete'&&prior?.reviewedCardCount===99){console.log('s10a 091-099 already complete');process.exit(0);}
if(prior?.reviewedCardCount!==90||!prior.reviewedRanges?.includes('061-090')||
 status.execution?.nextStart!=='s10a canonical 091'||
 images.nextStart!=='s10a canonical 091'||
 ev.range!=='canonical-order 091-099'||ev.set!=='s10a'||
 ev.cards?.length!==9||!ev.koreanPrintOnly||
 JSON.stringify(ev.expectedNewThemes)!==JSON.stringify({color:3}))
 throw Error('Previous checkpoint or 9-card evidence changed');
const groups=new Map(art.groups.map(x=>[x.code,x]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error('Missing theme '+t);
const expected=['히스이 미끄래곤 VSTAR','히스이 조로아크 VSTAR','성화','야적 세 자매','억새','월로','히스이 조로아크 VSTAR','다크패치','재앙의 상자'];
const rarities=['HR','HR','HR','HR','HR','HR','UR','UR','UR'];
const priorKeys=new Map();
for(const g of art.groups)for(const c of g.cards||[]){
 const match=/^S10A_(\d{3})$/i.exec(String(c.code||''));
 if(match){const n=Number(match[1]);priorKeys.set(n,[...(priorKeys.get(n)||[]),g.code]);}
}
let kept=0,newSlots=0,modernUsed=0,legacyUsed=0;
const proof=[];
const fetchOwned=async url=>{
 for(let attempt=0;attempt<3;attempt++){
  try{
   const res=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'DigitalCardBinder-KoreanThemeVerifier/1.0'}});
   if(!res.ok)continue;
   const buf=Buffer.from(await res.arrayBuffer());
   if(buf.length>3000&&buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP')
    return {url,bytes:buf.length,contentType:res.headers.get('content-type')};
  }catch(e){if(attempt===2)console.warn(url,e.message);}
 }
 return null;
};
const hosts=['dcb-card-images-modern-2026.pages.dev','dcb-card-images-legacy-2026.pages.dev'];
for(let i=0;i<9;i++){
 const n=91+i,id=String(n).padStart(3,'0'),row=ev.cards[i],card=master.cards[n-1];
 if(!row||!card||row.canonicalOrder!==n||row.cardKey!=='S10A_'+id||
 row.masterCode!=='s10a_'+id+'/071'||row.printedNumber!==id+'/071'||
 card.code?.toLowerCase()!==row.masterCode||card.name!==expected[i]||
 row.koreanName!==expected[i]||row.rarity!==rarities[i]||
 (card.rarity&&card.rarity!==rarities[i])||
 row.officialKoreanImage!=='https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S10a/S10a_'+id+'.png'||
 row.matchedThemes?.join(',')!==(i===0||i===1||i===6?'color':'')||
 !row.artObservation||ev.all12ThemesConsidered!==true)
  throw Error('Korean print/rarity/thematic proof mismatch at '+n+' master='+JSON.stringify({code:card?.code,name:card?.name,rarity:card?.rarity})+' evidence='+JSON.stringify({code:row?.masterCode,name:row?.koreanName,rarity:row?.rarity,officialKoreanImage:row?.officialKoreanImage,matched:row?.matchedThemes}));
 if(!card.rarity)card.rarity=rarities[i];
 const existing=(priorKeys.get(n)||[]).slice().sort();
 const matched=row.matchedThemes;
 for(const t of existing)if(!T.includes(t))throw Error('Unexpected existing theme '+t);
 if(existing.some(t=>!matched.includes(t)))throw Error('Do not discard existing theme '+n);
 kept+=existing.length;
 const suffix='/data/wmimages/S/S10a/S10a_'+id+'.webp';
 let checked=null,archive=null;
 for(const h of hosts){
  checked=await fetchOwned('https://'+h+suffix);
  if(checked){archive=h.includes('modern')?'modern':'legacy';break;}
 }
 if(!checked)throw Error('Owned CDN WebP missing or invalid for Korean S10a '+id);
 if(archive==='modern')modernUsed++;else legacyUsed++;
 if(card.image!==checked.url){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=checked.url;}
 overrides.sets??={};overrides.sets.s10a??={};
 overrides.sets.s10a[card.code.toLowerCase()]=checked.url;
 for(const theme of matched)if(!existing.includes(theme)){
  if(theme!=='color'||!row.colorCategory)throw Error('Unsupported theme mapping '+n);
  groups.get('color').cards.push({
   code:row.cardKey,name:card.name,series:'S',set:master.code,
   setName:master.displayName||master.name,cardNumber:id+'/071',
   rarity:card.rarity||'',category:row.colorCategory,image:checked.url,
   evidence:'한국판 다크판타스마 '+id+'/071 공식 한국어 이미지 및 인쇄번호 대조: '+row.artObservation+
     ' 증빙 '+A+'theme-s10a-091-099-Korean-art-review-20261014.json; DCB 보관 WebP 검증.'
  });newSlots++;
 }
 proof.push({canonicalOrder:n,code:card.code,koreanName:card.name,rarity:card.rarity,
  ownedCDNUrl:checked.url,archive,verification:'owned_CDN_WebP_magic_verified',bytes:checked.bytes,
  matchedThemes:row.matchedThemes,priorThemes:existing,koreanOfficialImage:row.officialKoreanImage});
}
if(newSlots!==3||master.cards.map(x=>x.code).join('|')!==oldCodes)
 throw Error('Theme count or card identity drift');
const now='2026-10-14',next='s10D canonical 001';
status.reviews[master.code]={...(prior||{}),status:'complete',reviewedAt:now,
 reviewedCardCount:99,verifiedSelfHostedImageCount:99,
 reviewedRanges:[...prior.reviewedRanges,'091-099'],reviewedThemes:T,heldCards:[],
 newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+newSlots,
 priorThemeSlotsPreserved:[...priorKeys.values()].reduce((a,x)=>a+x.length,0),
 partialReviewEvidence:A+'theme-s10a-091-099-Korean-art-review-20261014.json',
 archiveVerificationStatus:'s10a_091-099_9_Korean_DCB_owned_CDN_WEBP_verified',
 nextStart:next,note:'한국 다크판타스마 001-099 전체 99장 12테마 검수 완료. HR·UR 9장 검수 및 color 3건 추가. 기존 컬렉션 키와 출처 보존.'};
status.execution.currentEra='S';status.execution.currentSet='s10D';
status.execution.lastSafeCheckpoint='s10a 001-099 (99/99) Korean printed cards, themes and DCB-owned WebP verified';
status.execution.nextStart=next;status.execution.updatedAt=now;
images.batches.push({task:6,set:'s10a',range:'canonical 091-099 Korean Dark Phantasma HR/UR',
 canonicalCardCount:9,artworkVisuallyVerifiedCount:6,artworkMetadataCrosscheckedCount:3,
 artworkPendingCount:0,selfHostedReferenceCountAfter:9,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:'9_Korean_DCB_owned_CDN_WEBP_verified',
 verifiedImageCount:9,unverifiedImageCount:0,brokenReferenceCount:0,
 modernArchiveImages:modernUsed,legacyArchiveImages:legacyUsed,
 priorThemeSlotsPreserved:kept,themeAdditions:{color:newSlots},nextStart:next,
 note:'Korean names verified against official KR set and Korean retail evidence; 6 official images visually examined, 3 Korean print entries metadata-verified. All nine owned archive WebP bytes validated; no assertion of decoded pixel verification.'});
images.nextStart=next;images.updatedAt=now;art.updatedAt=now;
const progress={schemaVersion:1,recordedAt:now,set:'s10a',status:'complete',
 totalMasterCards:99,reviewedCanonicalCards:99,remainingUnreviewed:0,
 KoreanArtReviewed:99,ownedCDNWebPBinaryVerified:9,previousOwnedCDNVerified:90,
 newlyAddedThisBatch:newSlots,byTheme:{color:newSlots},
 officialKoreanVisualInspections:6,koreanPrintMetadataInspections:3,
 modernArchiveImages:modernUsed,legacyArchiveImages:legacyUsed,
 proof,originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:next};
await Promise.all([
 save('data/series.json',modern),save('data/series-legacy.json',legacy),
 save('data/series-image-overrides.json',overrides),save('data/art-themes.json',art),
 save(A+'theme-series-review-status.json',status),save(A+'theme-image-selfhost-audit.json',images),
 save(A+'theme-s10a-091-099-progress-20261014.json',progress)
]);
console.log(JSON.stringify({set:'s10a',complete:99,added:newSlots,archives:{modernUsed,legacyUsed},next}));
