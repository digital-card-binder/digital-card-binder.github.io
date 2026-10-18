#!/usr/bin/env node
// SM2K 031-062: review ONLY 25 Korean-photo-verified untagged cards.
// Preserve existing SM2K 046 sleeping membership and hold 056-058, 060-062.
// The "한글판" catalog badge alone does not prove Japanese-script app art is Korean.
import fs from "node:fs";
const load=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n");
const A="data/audits/";
const pre=load(A+"sm2k-031-062-korean-photo-language-hold-preflight-20261018.json");
const early=load(A+"theme-sm2k-001-030-progress-20261018.json");
const queue=load(A+"korean-recovery-active-queue-20261018.json");
const art=load("data/art-themes.json");
const groups=load("data/series.json");
const group=groups.find(g=>g.code.toLowerCase()==="sm2k");
if(!group||group.cards.length!==62||pre.cards.length!==32||
pre.physicallyCorrectVisibleKoreanCardPhotoValidated!==26||
pre.nextThemeCandidates.length!==25||early.themeReviewed!==30||
queue.counts.totalClosed!==190||queue.unresolved[0].workId!==160)
throw Error("Korean SM2K next partial batch or prior complete checkpoint changed");
const color=art.groups.find(x=>x.code==="color");
const season=art.groups.find(x=>x.code==="season");
if(art.groups.length!==12||color.cards.length!==9924||season.cards.length!==5160)
 throw Error("Previous first30 theme counts unexpectedly differ");
const chosen={
31:"청록·주황",32:"하늘색·회색",33:"하늘색·초록",34:"회색·갈색",
35:"분홍·연두",36:"분홍·초록",37:"분홍·하늘색",38:"남색·은색",
39:"노랑·초록",40:"회색·초록",41:"금색·검정",42:"분홍·초록",
43:"분홍·노랑",44:"하늘색·초록",45:"초록·남색",
47:"금색·남색",48:"초록·은색",49:"초록·노랑",50:"연두·흰색",
51:"빨강·청록",52:"하늘색·파랑",53:"노랑·남색",54:"연두·갈색",
55:"주황·빨강",59:"연두·청록"
};
const landscape={
31:"초록 식물이 무성한 바위 숲",
32:"푸른 물결과 수초가 보이는 얕은 물가",
33:"푸른 강물과 수풀이 어우러진 풍경",
34:"큰 암벽과 바위가 보이는 산지",
35:"큰 나무와 풀이 우거진 숲속",
36:"푸른 풀이 펼쳐진 밝은 들판",
37:"알록달록한 꽃이 핀 꽃밭",
39:"붉은 바위와 나무가 보이는 산골짜기",
40:"바위산과 푸른 수목이 보이는 산비탈",
42:"화초와 짙은 초록 식물이 있는 정원",
44:"푸른 바다와 하늘을 나는 장면",
45:"푸른 잎과 덤불이 우거진 숲",
49:"구릉지의 나무와 하늘이 보이는 야외",
50:"초록 식물 사이로 보이는 커다란 정원형 시설"
};
if(Object.keys(chosen).length!==25||Object.keys(landscape).length!==14)
 throw Error("Only 25 color and 14 landscape visual observations approved");
const old=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length]));
const results=[];
for(let n=31;n<=62;n++){
 const entry=pre.cards.find(x=>x.number===n);
 const card=group.cards[n-1];
 const code="SM2K_"+String(n).padStart(3,"0");
 if(!entry||entry.code!==card.code||entry.name!==card.name||String(entry.appName).replace(/\s+/g,"").toLowerCase()!==String(card.name).replace(/\s+/g,"").toLowerCase())
  throw Error("Master Korean named identity inconsistent "+code);
 if(n===46){
  if(JSON.stringify(entry.existingThemes)!=='["sleeping"]'||
   !art.groups.find(g=>g.code==="sleeping").cards.some(x=>x.code===code))
   throw Error("Pre-existing Korean Komala sleeping must remain unchanged");
  results.push({number:n,name:card.name,code,previouslyReviewed:true,
    oldThemes:["sleeping"],status:"preserved",newThemes:[]});
  continue;
 }
 if(!chosen[n]){
  if(![56,57,58,60,61,62].includes(n)||n===59)
   throw Error("Unexpected unreviewed slot "+n);
  results.push({number:n,name:card.name,code,status:"held_language_or_photo",
   priorStatus:entry.status,visualIssue:[60,61].includes(n)?
    "Japanese text visible in card photo despite Korean catalog title":
    "Korean image missing or CDN artwork does not match",
   noThemeDecision:true});
  continue;
 }
 if(entry.status!=="matching_Korean_card_and_own_CDN"||
 entry.difference>=18||entry.existingThemes.length||
 pre.nextThemeCandidates.indexOf(n)<0)
 throw Error("Unverified or already reviewed Korean artwork "+code);
 if(art.groups.some(g=>g.cards.some(x=>x.code.toUpperCase()===code)))
  throw Error("Do not duplicate card already in any theme "+code);
 const matches=[["color",chosen[n],card.name+" 한국판 일러스트의 대표 색감은 "+chosen[n]+"이다."]];
 if(landscape[n])matches.push(["season",landscape[n],card.name+" 카드 배경의 "+landscape[n]+" 장면을 확인했다."]);
 for(const [theme,category,description] of matches){
  art.groups.find(g=>g.code===theme).cards.push({
   code,name:card.name,series:"SM",set:group.code,setName:group.displayName,
   cardNumber:card.code.split("_")[1],rarity:card.rarity||"",
   category,image:entry.ownedSource,
   evidence:"한국판 앱 개별 카드명과 SM2K 번호, 본 사이트 자체 CDN의 한국어 실물 이미지를 직접 대조했다. "+
    description+" 관련 없는 스토리/진화/연결 테마에 임의 추가하지 않았다. ("+A+"theme-sm2k-031-062-Korean-art-review-20261018.json)."
  });
 }
 results.push({number:n,code,name:card.name,previouslyReviewed:false,
   status:"reviewed_exact_Korean_image_and_visual_theme",
   sourceApp:entry.appPage,ownedImage:entry.ownedSource,meanPixelDiff:entry.difference,
   newlyAddedThemes:matches.map(x=>x[0]),
   categories:Object.fromEntries(matches.map(x=>[x[0],x[1]]))});
}
if(results.length!==32||results.filter(x=>x.newlyAddedThemes).length!==25||
 results.filter(x=>x.status==="held_language_or_photo").length!==6||
 color.cards.length!==old.color+25||season.cards.length!==old.season+14||
 art.groups.some(g=>!["color","season"].includes(g.code)&&g.cards.length!==old[g.code]))
 throw Error("Unapproved theme additions");
const path="tests/theme-card-identity.test.mjs";
const fixture=fs.readFileSync(path,"utf8");
if(fixture.split("assert.equal(total,17872);").length!==2)
 throw Error("Historical theme total test baseline changed unexpectedly");
fs.writeFileSync(path,fixture.replace("assert.equal(total,17872);","assert.equal(total,17911);"));
art.updatedAt="2026-10-18";
save("data/art-themes.json",art);
const report={schemaVersion:1,date:"2026-10-18",set:"sm2K",range:"031-062",
 totalSlots:32,previouslyReviewedButPreserved:1,newArtworksReviewed:25,
 previouslyReviewedCode:"SM2K_046",colorThemeAdditions:25,
 seasonThemeAdditions:14,otherThemeAdditions:0,
 cardsStillHeld:[56,57,58,60,61,62],
 sourceAudit:A+"sm2k-031-062-korean-photo-language-hold-preflight-20261018.json",
 officialKoreanPrintedNumbersOnHeldAssumed:false,
 finishedThisSet:false,original191ImageAuditUnchanged:true,
 allMasterCardIdsImagesAndUserOwnershipUnchanged:true,
 records:results,
 countsBefore:old,
 countsAfter:Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length]))};
const progress={schemaVersion:1,date:"2026-10-18",set:"sm2K",totalMasterCards:62,
 reviewedRanges:["001-030","031-055","059"],
 themeReviewed:56,imagesKoreanVerified:56,
 previouslyReviewedThemeCardsNotRepeated:2,
 newlyReviewedInLastRange:25,remainingImageHoldCount:6,
 heldCardNumbers:[56,57,58,60,61,62],
 heldReason:"Gold cards 060/061 shown with Japanese card names despite Korean app metadata; other four failed Korean own-CDN image proof",
 status:"56_of_62_Korean_photo_and_theme_records_approved_six_image_holds",
 nextStart:"Resolve Korean SM2K 056 057 058 060 061 062 images individually; don't treat Japanese 060 or 061 as Korean.",
 original191Recovery:"190 complete, S6K 094 held independently."};
save(A+"theme-sm2k-031-062-Korean-art-review-20261018.json",report);
save(A+"theme-sm2k-031-062-progress-20261018.json",progress);
console.log("SM2K_KOREAN_THEME_31_62",JSON.stringify({reviewedNew:25,preservedOne:1,
 totalReviewed:56,remains:6,color:25,season:14,newTotalThemeCount:17911}));
