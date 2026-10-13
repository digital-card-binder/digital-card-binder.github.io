import {readFile,writeFile} from "node:fs/promises";
const root="data/audits/";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async (p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const [state,images,hold,sgi,sgg]=await Promise.all([
 read(root+"theme-series-review-status.json"),
 read(root+"theme-image-selfhost-audit.json"),
 read(root+"theme-sgi-sgg-print-variant-holds-20261014.json"),
 read(root+"theme-visual-evidence/SGI/visual-index.json"),
 read(root+"theme-visual-evidence/SGG/visual-index.json")
]);
if(images.nextStart==="SP4 canonical 001"&&
 state.reviews?.SGI?.status==="in_progress"&&state.reviews?.SGG?.status==="in_progress"){
 console.log("SGI and SGG are already safely held; continue at SP4");process.exit(0);
}
if(images.nextStart!=="SGI canonical 001"||hold.datasets?.length!==2||
    state.reviews?.SGI?.status==="complete"||state.reviews?.SGG?.status==="complete"||
    (state.reviews?.SGI?.reviewedCardCount||0)>0||
    (state.reviews?.SGG?.reviewedCardCount||0)>0)
 throw Error("Unexpected checkpoint or existing completed Korean themes; refuse to skip");
const checks=[
 {set:"SGI",index:sgi,n:24,base:6,variant:23,energy:24,label:"인텔리레온 VMAX",energyName:"기본 물 에너지"},
 {set:"SGG",index:sgg,n:21,base:2,variant:20,energy:21,label:"팬텀 VMAX",energyName:"기본 악 에너지"}
];
state.reviews??={};
for(const q of checks){
 const x=q.index, a=x.cards?.[q.base-1],b=x.cards?.[q.variant-1],c=x.cards?.[q.energy-1];
 if(x.cardCount!==q.n||x.cards?.length!==q.n||x.verificationCounts?.verified!==q.n||
    x.verificationCounts?.missing!==0||x.masterMissingKoreanNames!==0||
    Object.keys(x.existingThemeRecords||{}).length!==0||
    !a||!b||!c||a.name!==q.label||b.name!==q.label||c.name!==q.energyName||
    !String(a.masterCode).startsWith(q.set.toLowerCase()+"_"+String(q.base).padStart(3,"0"))||
    !String(b.masterCode).startsWith(q.set.toLowerCase()+"_"+String(q.variant).padStart(3,"0")))
  throw Error("Unsafe print variant hold: "+q.set);
 for(const card of x.cards)if(card.imageCheck?.status!=="decoded"||card.imageCheck?.http!==200||
  !/^https:\/\/dcb-card-images-(modern|legacy)-2026\.pages\.dev\//.test(card.cdnUrl))
   throw Error("Own CDN original missing; refuse to skip "+q.set);
 const prior=state.reviews[q.set]||{};
 state.reviews[q.set]={
  ...prior,status:"in_progress",reviewedCardCount:0,reviewedThemes:[],
  verifiedSelfHostedImageCount:q.n,heldCards:[q.set+"_"+String(q.variant).padStart(3,"0")],
  fullSetEvidence:"data/audits/theme-sgi-sgg-print-variant-holds-20261014.json",
  archiveVerificationStatus:"all_Korean_images_decoded_variant_identity_hold_not_theme_complete",
  note:"한국판 자체 CDN 원본 "+q.n+"장 이미지 검증. "+q.label+
   " 별도 관리번호가 기존 카드 인쇄번호의 다른 프린트일 가능성 있어 신규 기본 카드/테마 중복을 방지하기 위해 보류. 이 세트는 전수 테마검수 완료로 표시하지 않음. 수집 상태 불변."
 };
 images.batches.push({
  task:6,set:q.set,status:"in_progress_print_variant_hold",canonicalCardCount:q.n,
  verifiedImageCount:q.n,unverifiedImageCount:0,artworkVisuallyVerifiedCount:0,
  artworkPendingCount:q.n,confirmedOriginImageRequests:0,
  heldCards:[q.set+"_"+String(q.variant).padStart(3,"0")],
  nextStart:q.set==="SGI"?"SGG canonical 001":"SP4 canonical 001",
  externalImageReferenceCountAfter:null,
  note:"Only own-CDN image decoding and safe checkpoint; master images, theme slots, user ownership untouched. Full Korean print variant audit required."
 });
}
images.nextStart="SP4 canonical 001";images.updatedAt="2026-10-14";
await Promise.all([
 save(root+"theme-series-review-status.json",state),
 save(root+"theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({status:"print_variant_identity_held",sets:checks.map(q=>q.set),addedThemeSlots:0,ownershipChanges:0,nextStart:images.nextStart},null,2));
