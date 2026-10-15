import { readFile, writeFile } from "node:fs/promises";

// Applies human-reviewed Korean Sky Stream image evidence only after strict checkpoint checks.
// The Korean card IDs and existing owned-card records must remain unchanged.
const read = async file => JSON.parse(await readFile(file, "utf8"));
const save = async (file, value) => writeFile(file, JSON.stringify(value, null, 2) + "\n");
const CODE = "s7R";
const DATE = "2026-10-15";
const TOTAL = 90;
const NEXT = "s7D canonical 001";
const GROUPS = ["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const ranges = ["001-030", "031-060", "061-090"];

const [a,b,c,proof,modern,legacy,themes,status,hosting,overrides] = await Promise.all([
 ...ranges.map(r => read("data/audits/theme-s7r-" + r + "-Korean-art-review-20261015.json")),
 read("data/audits/theme-visual-evidence/s7r/001-090/visual-index.json"),
 read("data/series.json"), read("data/series-legacy.json"),
 read("data/art-themes.json"), read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"), read("data/series-image-overrides.json")
]);
const reviews = [a,b,c], items = reviews.flatMap(r => r.items);
const sets = [...modern,...legacy].filter(s => String(s.code||"").toLowerCase() === CODE.toLowerCase());
if (sets.length!==1 || sets[0].cards?.length !== TOTAL) throw Error("s7R 90-card master identity mismatch");
const set=sets[0];
status.reviews ??= {};
const existingKey=Object.keys(status.reviews).find(k => k.toLowerCase() === CODE.toLowerCase());
const prior=status.reviews[existingKey || set.code] || {};
if (prior.status==="complete" && prior.reviewedCardCount===TOTAL) {
  console.log("s7R already audited 90/90; safe idempotent exit");
  process.exit(0);
}
if (status.execution?.nextStart!=="s7R canonical 001" ||
    hosting.nextStart!=="s7R canonical 001" ||
    (status.execution.currentSet||"").toLowerCase()!=="s7r" ||
    (prior.reviewedCardCount||0)!==0)
  throw Error("Unsafe s7R checkpoint; no earlier work changed");
if (proof.set!=="s7r" || proof.masterSetCardCount!==TOTAL ||
    proof.canonicalCardsChecked!==TOTAL || proof.cards?.length!==TOTAL ||
    proof.verifiedOwnedCdnImageCount!==TOTAL || proof.unavailableOwnedCdnImageCount!==0 ||
    proof.printedNumberMatchCount!==TOTAL || proof.koreanNameNonemptyCount!==TOTAL ||
    proof.sourceRequestCount!==0 || proof.artworkThemeReviewComplete!==false ||
    items.length!==TOTAL || reviews.some(r=>r.set!==CODE || r.all12ThemesInspected!==true ||
       r.originImageRequests!==0 || r.items?.length!==30))
  throw Error("Missing Korean image provenance / 12-theme visual review evidence");
const gmap=new Map(themes.groups.map(g=>[g.code,g]));
if (GROUPS.some(t=>!Array.isArray(gmap.get(t)?.cards))) throw Error("Missing theme group(s)");
const allCodes=set.cards.map(x=>x.code);
const counts={}, preserved={}, resolutions=[];
overrides.sets ??= {};
overrides.sets[set.code] ??= {};
for(let i=0;i<TOTAL;i++){
 const n=i+1, num=String(n).padStart(3,"0"), key="S7R_"+num;
 const p=proof.cards[i], r=items[i], master=set.cards[i];
 const expected="s7r_"+num+"/067";
 if(!p||!r||!master||p.canonicalOrder!==n||r.canonicalOrder!==n||
    r.cardKey!==key || p.masterCode.toLowerCase()!==expected ||
    String(master.code||"").toLowerCase()!==expected ||
    p.expectedPrintedNumber!==num+"/067" || !p.printedNumberMatches ||
    r.name!==master.name || p.name!==master.name || !r.artObservation?.trim() ||
    p.rawSource!==(master.sourceImage||master.image) ||
    p.imageCheck?.status!=="decoded" || p.imageCheck.http!==200 ||
    p.imageCheck.format!=="WEBP" || p.imageCheck.dimensions?.[0]<200 ||
    p.imageCheck.dimensions?.[1]<250 ||
    !p.ownedCdnUrl?.startsWith("https://dcb-card-images-"))
   throw Error("Invalid canonical Korean S7R artwork or source identity at "+n);
 const sourceHost=new URL(p.rawSource).hostname;
 if(!["cards.image.pokemonkorea.co.kr","static.tcgexchange.kr"].includes(sourceHost))
   throw Error("Korean source origin not allowlisted "+n);
 const expectedPrevious=n===74?["sleeping"]:[];
 if(JSON.stringify(p.priorThemes)!==JSON.stringify(expectedPrevious))
   throw Error("Existing theme registry changed at "+n);
 const assigned=new Set(r.matchedThemes);
 if(assigned.size!==r.matchedThemes.length || !assigned.has("color") ||
    [...assigned].some(t=>!GROUPS.includes(t) || !r.categories?.[t]?.trim()) ||
    Object.keys(r.categories||{}).some(t=>!assigned.has(t)))
   throw Error("Unsupported or duplicated thematic observation "+n);
 if(n===74 && !assigned.has("sleeping")) throw Error("Existing sleeping Dragonite removed");
 if(n!==74 && assigned.has("sleeping")) throw Error("Unreviewed sleeping theme "+n);
 for(const t of GROUPS){
  const group=gmap.get(t);
  const records=group.cards.filter(x=>String(x.code||"").toUpperCase()===key);
  const belongs=assigned.has(t), previously=expectedPrevious.includes(t);
  if(records.length!==(previously?1:0))
    throw Error("Prior independent theme memberships changed at "+n+" "+t);
  if(previously){
    if(!belongs || records[0].name!==master.name) throw Error("Unsafe earlier theme "+n);
    records[0].image=p.ownedCdnUrl;
    preserved[t]=(preserved[t]||0)+1;
    continue;
  }
  if(!belongs) continue;
  group.cards.push({
   code:key,name:master.name,series:"S",set:set.code,
   setName:set.displayName||"창공스트림",cardNumber:num+"/067",
   rarity:master.rarity||"",category:r.categories[t],
   image:p.ownedCdnUrl,
   evidence:"한국판 창공스트림 "+num+"/067 실물 이미지 시트 직접 검수: "+r.artObservation
  });
  counts[t]=(counts[t]||0)+1;
 }
 // Preserve the Pokémon Korea image source for provenance and use the existing owned CDN.
 if(!master.sourceImage) master.sourceImage=p.rawSource;
 master.image=p.ownedCdnUrl;
 overrides.sets[set.code][String(master.code).toLowerCase()]=p.ownedCdnUrl;
 resolutions.push({code:master.code,owned:p.ownedCdnUrl});
}
if(JSON.stringify(allCodes)!==JSON.stringify(set.cards.map(x=>x.code)))
  throw Error("Canonical card identifiers unexpectedly changed");
const additions=Object.values(counts).reduce((sum,v)=>sum+v,0);
if(counts.color!==90 || counts.season!==52 || counts.night!==4 ||
    counts.food!==1 || counts.cameo!==1 || additions!==148 ||
    JSON.stringify(preserved)!==JSON.stringify({sleeping:1}))
  throw Error("Theme evidence membership totals not equal to the reviewed artwork");
status.reviews[existingKey||set.code]={
 ...prior,status:"complete",reviewedAt:DATE,completedAt:DATE,
 reviewedCardCount:TOTAL,artworkReviewedCardCount:TOTAL,
 verifiedKoreanPrintImageCount:TOTAL,verifiedSelfHostedImageCount:TOTAL,
 heldCards:[],unresolvedImageIssues:[],reviewedRanges:["001-090"],
 reviewedThemes:GROUPS,newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+additions,
 partialReviewEvidence:"data/audits/theme-s7r-061-090-Korean-art-review-20261015.json",
 archiveVerificationStatus:"s7R_90_owned_CDN_Korean_art_images_visually_reviewed",
 nextStart:NEXT,note:"창공스트림 한국판 전체 90장/12테마 아트 검수 완료. 색상 90건 포함 테마 148건 추가. 기존 74번 잠자는 포켓몬 슬롯 보존. 원본 한국어 카드 이미지 자체 CDN 로드 검증."
};
status.execution.currentEra="S";
status.execution.currentSet="s7D";
status.execution.lastSafeCheckpoint="s7R 001-090 (90/90) Korean artwork, owned image and 12 themes verified";
status.execution.nextStart=NEXT; status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({
 task:7,set:set.code,range:"canonical 001-090 Korean Sky Stream",canonicalCardCount:90,
 artworkVisuallyVerifiedCount:90,artworkPendingCount:0,
 selfHostedReferenceCountAfter:90,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"s7R_90_owned_Korean_card_images_decoded",
 verifiedImageCount:90,unverifiedImageCount:0,brokenReferenceCount:0,
 koreanPrintImagesConfirmed:90,koreanPrintImagesPending:0,
 newlyInternalizedReferenceCount:90,themeAdditions:counts,
 existingThemeSlotsPreserved:preserved,nextStart:NEXT,
 note:"90 Korean-print images visually inspected, 148 new themed slots; retained existing sleeping Dragonite."
});
hosting.nextStart=NEXT;hosting.updatedAt=DATE;themes.updatedAt=DATE;
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/art-themes.json",themes),save("data/series-image-overrides.json",overrides),
 save("data/audits/theme-series-review-status.json",status),
 save("data/audits/theme-image-selfhost-audit.json",hosting),
 save("data/audits/theme-s7r-001-090-progress-20261015.json",{
  schemaVersion:1,recordedAt:DATE,set:set.code,status:"complete",
  totalMasterCards:TOTAL,artworkReviewed:TOTAL,verifiedKoreanPrintImages:TOTAL,
  ownedImagesVerified:TOTAL,pendingKoreanImages:[],remainingUnreviewed:0,
  all12ThemesReviewed:true,newThemeSlotsThisBatch:counts,added:additions,
  priorThemeMembershipsPreserved:preserved,nextStart:NEXT,
  proof:"data/audits/theme-visual-evidence/s7r/001-090/visual-index.json",
  notes:"Art and 90 print scans visually inspected on 6 Korean hosted contact sheets."
 })
]);
console.log(JSON.stringify({set:CODE,complete:true,reviewed:90,ownedImages:90,
  newThemeSlots:counts,additions,existingPreserved:preserved,next:NEXT}));
