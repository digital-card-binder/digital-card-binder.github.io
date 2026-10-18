#!/usr/bin/env node
// Add 27 visually reviewed Korean SM cards to COLOR only; do not invent story
// links, evolution scenes or unverified physical serials.
import fs from "node:fs";
import crypto from "node:crypto";
const load=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const A="data/audits/";
const artPath="data/art-themes.json";
const plusPath=A+"sm1plus-complete-77-image-identity-next-theme-checkpoint-20261018.json";
const newPath=A+"sm-final-27-korean-color-theme-art-review-20261018.json";
const P={
 sm1plus:{g:"sm1+",n:[59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77],color:[
 "연두·민트","주황·연두","파랑·분홍","노랑·하늘색","남색·청록",
 "연두·분홍","분홍·하늘색","금색·하늘색","금색·검정","초록·금색",
 "주황·빨강","보라·분홍","은색·회색","분홍·자주","초록·노랑",
 "파랑·하늘색","노랑·금색","주황·갈색","남색·검정"]},
 sm1m:{g:"sm1M",n:[67,69,71,73],color:["연두·분홍","연두·하늘색","초록·금색","보라·남색"]},
 sm1s:{g:"sm1S",n:[70,71,72,73],color:["연두·주황","금색·빨강","금색·검정","은색·하늘색"]}
};
const master=load("data/series.json");
const themes=load(artPath);
const plus=load(plusPath);
const recovery=load(A+"sm1plus-059-077-Korean-source-image-recovery-20261018.json");
const published=load(A+"sm1plus-059-077-live-site-image-validation-20261018.json");
const pixels8=load(A+"final-nine-korean-cdn-closure-20261018.json");
const queue=load(A+"korean-recovery-active-queue-20261018.json");
const manual={sm1m:load(A+"theme-sm1m-061-073-Korean-art-review-20261017.json"),
 sm1s:load(A+"theme-sm1s-061-073-Korean-art-review-20261017.json")};
const progress={sm1m:load(A+"theme-sm1m-061-073-approved9-held4-progress-20261017.json"),
 sm1s:load(A+"theme-sm1s-061-073-approved9-held4-progress-20261017.json")};
if(queue.counts.totalClosed!==190||queue.counts.stillUnresolved!==1||
queue.unresolved[0].workId!==160)throw Error("Must preserve outstanding S6K 094");
if(themes.groups.length!==12||plus.themeAudit.sm1plus.remainingToReview!==19||
plus.themeAudit.sm1plus.previouslyReviewedWith12Themes!==58||
published.repairedLiveAndSHA256Validated!==19||recovery.cardSources.length!==19)
 throw Error("The previous Korean 27-card checkpoint changed");
const color=themes.groups.find(x=>x.code==="color");
const template=color?.cards.find(x=>x.code==="SM1M_068");
if(!template||template.cardNumber!=="068/060"||color.cards.length<9000)
 throw Error("Current theme schema differs");
const oldCounts=Object.fromEntries(themes.groups.map(x=>[x.code,x.cards.length]));
const review=[];
for(const [set, plan] of Object.entries(P)){
 const group=master.find(g=>g.code.toLowerCase()===plan.g.toLowerCase());
 if(!group||plan.n.length!==plan.color.length)throw Error("Unknown master group "+set);
 for(let i=0;i<plan.n.length;i++){
  const n=plan.n[i], category=plan.color[i];
  const key=set.toUpperCase()+"_"+String(n).padStart(3,"0");
  const card=group.cards.find(c=>c.code.split("/")[0].toUpperCase()===key);
  if(!card||card.order!==n||!card.image||!card.name||!category)
   throw Error("Identity mismatch "+key);
  if(themes.groups.some(g=>g.cards.some(x=>x.code.toUpperCase()===key)))
   throw Error("Theme card previously reviewed, do not audit twice "+key);
  let src, archive;
  if(set==="sm1plus"){
   src=recovery.cardSources.find(x=>x.number===n&&x.code===card.code);
   const live=published.images.find(x=>x.number===n&&x.code===card.code);
   if(!src||!live||card.image!==src.ownedUrl||live.sha256!==src.ownedSHA256)
    throw Error("Published Korean image proof missing "+key);
   const bytes=fs.readFileSync(src.ownedPath);
   if(sha(bytes)!==src.ownedSHA256)throw Error("Korean source photo hash changed "+key);
   archive=src.ownedUrl;
  }else{
   src=pixels8.images.find(x=>x.slot.toUpperCase()===key);
   const held=manual[set].held.find(x=>x.cardKey===key);
   if(!src||!src.verified||src.pixelDifference>=18||!held||
     held.ownedUrl!==src.ownedCdn||held.artworkThemesReviewed!==false||
     held.koreanPrintImageVerified!==true||card.source!==src.sourcePage)
    throw Error("Previously unreviewed Korean photo hold changed "+key);
   archive=src.ownedCdn;
  }
  const observation=card.name+" 카드의 한국어 일러스트에서 "+category+" 색감이 우세하다. 한국판 실제 카드 이미지를 직접 시각 검토했다.";
  color.cards.push({
   code:key,name:card.name,series:"SM",set:group.code,setName:group.displayName,
   cardNumber:card.code.split("_")[1],rarity:card.rarity||"",
   category:category,image:archive,
   evidence:observation+" 다른 11개 테마는 장면 연속성, 시간대, 풍경, 숨은 포켓몬 등 근거가 없어 제외했다. (data/audits/sm-final-27-korean-color-theme-art-review-20261018.json)."
  });
  review.push({set:set,number:n,key:key,name:card.name,category:category,
   artObservation:observation,ownedImage:archive,koreanSource:card.source,
   theme:["color"],otherThemesExcluded:themes.groups.filter(g=>g.code!=="color").map(g=>g.code),
   evidence: set==="sm1plus"?"Live published WebP SHA-256 Korean card proof":"Original Korean card and exact Cloudflare CDN pixel proof",
   physicalPrintedNumberAssumed:!(set==="sm1plus"&&n>=69)});
 }
}
if(review.length!==27||color.cards.length!==oldCounts.color+27||
 themes.groups.some(g=>g.code!=="color"&&g.cards.length!==oldCounts[g.code]))
 throw Error("Unexpected theme mutation");
for(const set of ["sm1m","sm1s"]){
 const m=manual[set],p=progress[set],nset=P[set].n;
 if(m.artworksReviewed!==9||m.held.length!==4||m.themeCounts.color!==9||
 m.verifiedKoreanPrintImagesInRange!==13||p.KoreanPrintArtworksReviewed!==69||
 p.remainingImageAndArtworkCount!==4||p.complete!==false||
 p.verifiedKoreanPrintImagesCumulative!==73)throw Error("Prior 9+4 progress changed "+set);
 for(const n of nset){
  const old=m.held.find(x=>x.canonicalOrder===n);
  const r=review.find(x=>x.set===set&&x.number===n);
  if(!old||!r||r.name!==old.name||r.ownedImage!==old.ownedUrl)
   throw Error("Held name or art does not match "+set+" "+n);
  m.items.push({canonicalOrder:n,cardKey:r.key,artObservation:r.artObservation,
   matchedThemes:["color"],categories:{color:r.category},koreanPrintImageVerified:true,
   sourceEvidence:"Verified Korean app + DCB-owned Korean WebP; 12-theme manual visual check",
   ownedImage:r.ownedImage,preExistingThemeRecordsPreserved:[]});
 }
 m.items.sort((a,b)=>a.canonicalOrder-b.canonicalOrder);
 if(m.items.length!==13||new Set(m.items.map(x=>x.canonicalOrder)).size!==13)
  throw Error("13-slot review incomplete "+set);
 m.held=[];m.heldCanonicalOrders=[];m.artworksReviewed=13;
 m.heldArchiveMissingCount=0;m.ownedCDNImagesDecoded=13;
 m.themeCounts.color=13;m.themeAdditions=13;
 m.status="complete_Korean_13_of_13_last_range_artwork_themes_reviewed";
 m.setComplete=true;m.all12ThemesInspectedForApproved=true;
 m.artworkReviewCompletion=A+"sm-final-27-korean-color-theme-art-review-20261018.json";
 p.KoreanPrintArtworksReviewed=73;p.remainingImageAndArtworkCount=0;
 p.newlyAddedThemeSlotsThisBatch=13;p.newlyAddedThemeSlotsCumulative+=4;
 p.reviewedRanges.push(set==="sm1m"?"067,069,071,073":"070-073");
 p.complete=true;p.heldRange="";
 p.status="complete_73_Korean_images_and_73_twelve_theme_artwork_reviews";
 p.nextStart="Advance to next historically unfinished SM set; do not re-review these 73 cards.";
 p.artworkReviewCompletion=A+"sm-final-27-korean-color-theme-art-review-20261018.json";
}
plus.themeAudit.sm1plus.previouslyReviewedWith12Themes=77;
plus.themeAudit.sm1plus.remainingToReview=0;
plus.themeAudit.sm1plus.remainingRange="";
plus.themeAudit.sm1plus.setThemeReviewComplete=true;
plus.themeAudit.sm1plus.all12ThemesReviewed=true;
plus.themeAudit.sm1plus.newReview=A+"sm-final-27-korean-color-theme-art-review-20261018.json";
for(const set of ["sm1m","sm1s"]){
 plus.imageAudit[set].artThemeReviewed=73;
 plus.imageAudit[set].artThemePending=0;
}
plus.nextSafeStarts=["SM1+ 77/77 verified Korean artwork identities and theme reviews",
 "SM1M 73/73 Korean artwork and 12-theme reviews complete",
 "SM1S 73/73 Korean artwork and 12-theme reviews complete",
 "Continue next historically incomplete SM set using original per-set audits",
 "Hold S6K 094 until exact Korean name/printed number reconciliation"];
themes.updatedAt="2026-10-18";
const report={schemaVersion:1,date:"2026-10-18",scope:"SM1+ 059-077, SM1M 067 069 071 073, SM1S 070-073",
 previousArtworkReviewsProtected:58+69+69,onlyNewArtworkReviews:27,
 completedSets:[{code:"sm1+",images:77,themes:77},{code:"sm1M",images:73,themes:73},{code:"sm1S",images:73,themes:73}],
 reviewedAll12ThemeTypes:themes.groups.map(x=>x.code),
 colorThemeAdditions:27,nonColorThemeAdditions:0,artworkCheckEvidence:"Full Korean card contact sheets 2026-10-18; high-rarity GX and unnumbered Energy colors visibly dominant",
 proof:["data/audits/sm1plus-059-077-live-site-image-validation-20261018.json","data/audits/final-nine-korean-cdn-closure-20261018.json"],
 original191AuditQueueUnchanged:true,s6K094PrintHoldUnchanged:true,
 masterCardsChanged:0,ownerRecordsChanged:0,
 colorCountBefore:oldCounts.color,colorCountAfter:color.cards.length,
 cards:review};
save(artPath,themes);
save(plusPath,plus);
save(A+"theme-sm1m-061-073-Korean-art-review-20261017.json",manual.sm1m);
save(A+"theme-sm1s-061-073-Korean-art-review-20261017.json",manual.sm1s);
save(A+"theme-sm1m-061-073-approved9-held4-progress-20261017.json",progress.sm1m);
save(A+"theme-sm1s-061-073-approved9-held4-progress-20261017.json",progress.sm1s);
save(newPath,report);
console.log("KOREAN_SM_27_THEMES_COMPLETE",JSON.stringify({newlyReviewed:27,SM1Plus:77,SM1M:73,SM1S:73,colorAdditions:27,otherThemeAdditions:0}));
