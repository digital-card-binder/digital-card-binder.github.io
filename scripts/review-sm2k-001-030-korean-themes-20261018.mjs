#!/usr/bin/env node
// Review only SM2K 001-030 after exact Korean Dogam card + own CDN preflight.
// SM2K 014 already belongs to Sleeping; preserve it without re-review.
// Explicit visual evidence for color (29) and natural landscapes (17) only.
import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n");
const A="data/audits/";
const PRE=A+"sm2k-001-030-exact-korean-artwork-preflight-20261018.json";
const OUTPUT=A+"theme-sm2k-001-030-Korean-art-review-20261018.json";
const STATUS=A+"theme-sm2k-001-030-progress-20261018.json";
const ART="data/art-themes.json";
const PRE_TEST="tests/theme-card-identity.test.mjs";
const p=read(PRE),themes=read(ART),groups=read("data/series.json");
const queue=read(A+"korean-recovery-active-queue-20261018.json");
if(p.tested!==30||p.koreanCardNameAndAppCatalogNumberMatch!==30||
 p.ownedCDNImageNearMatch!==30||p.untaggedOriginalCards!==29||
 p.previousThemeRecordsPreserved!==1||p.cards.length!==30||
 queue.counts.totalClosed!==190||queue.counts.stillUnresolved!==1||
 queue.unresolved[0].workId!==160)throw Error("SM2K proven photos or original S6K 094 hold changed");
const master=groups.find(x=>x.code.toLowerCase()==="sm2k");
if(!master||master.cards.length!==62||themes.groups.length!==12)
 throw Error("Unexpected SM2K or 12-theme index");
const color=themes.groups.find(g=>g.code==="color");
const season=themes.groups.find(g=>g.code==="season");
if(!color||!season||color.cards.length!==9895)throw Error("Previously completed 27 SM color reviews changed");
const names={
 1:"초록·노랑",2:"연두·초록",3:"초록·회색",4:"초록·분홍",5:"연두·주황",
 6:"연두·하늘색",7:"은색·하늘색",8:"주황·노랑",9:"빨강·주황",
 10:"하늘색·흰색",11:"회색·하늘색",12:"하늘색·흰색",13:"파랑·흰색",
 15:"하늘색·갈색",16:"파랑·회색",17:"하늘색·흰색",18:"파랑·하늘색",
 19:"하늘색·흰색",20:"노랑·초록",21:"노랑·하늘색",22:"노랑·초록",
 23:"분홍·초록",24:"분홍·초록",25:"보라·초록",26:"남색·보라",
 27:"보라·검정",28:"하늘색·초록",29:"회색·갈색",30:"회색·남색"
};
const landscapes={
 1:"큰 나뭇잎과 덤불이 빽빽한 숲",
 2:"굵은 초록 잎과 열대 식물이 보이는 숲",
 3:"큰 잎과 수풀이 우거진 깊은 숲",
 4:"연분홍 꽃이 피어 있는 숲속 풀밭",
 6:"바다와 바위가 보이는 밝은 해변",
 10:"흰 눈이 소복이 쌓인 야외 풍경",
 11:"거센 눈과 얼음 바위가 보이는 겨울 산",
 12:"흰 눈이 내리는 차가운 숲",
 16:"눈과 얼음이 둘러싼 얼음 산지",
 18:"눈 내린 나뭇가지와 얼음 바닥이 보이는 숲",
 19:"눈보라가 치는 얼음과 바위 풍경",
 20:"초록 풀밭과 맑은 하늘이 보이는 들판",
 23:"꽃과 초록 잎이 보이는 풀숲",
 24:"야자수와 강물이 보이는 열대 수변",
 25:"잎과 풀꽃이 우거진 숲 바닥",
 26:"굵은 나무뿌리와 그늘이 보이는 숲",
 28:"푸른 하늘과 초록 구릉이 보이는 평원"
};
if(Object.keys(names).length!==29||Object.keys(landscapes).length!==17)
 throw Error("Expected 29 new color reviews and 17 natural scene reviews");
const previous=Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length]));
const result=[];
for(let n=1;n<=30;n++){
 const row=p.cards.find(x=>x.number===n);
 const card=master.cards[n-1];
 if(!row||card.code!==row.code||card.name!==row.name||
 row.status!=="matching_Korean_card_and_own_CDN"||row.difference>=18||
 !row.ownedSource.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
 throw Error("Korean photo proof or identity unexpectedly changed "+n);
 const code="SM2K_"+String(n).padStart(3,"0");
 const inGroups=themes.groups.filter(g=>g.cards.some(x=>x.code.toUpperCase()===code)).map(g=>g.code);
 if(n===14){
  if(JSON.stringify(inGroups)!=='["sleeping"]'||JSON.stringify(row.existingThemes)!=='["sleeping"]')
   throw Error("Existing Delibird sleeping card must remain unchanged");
  result.push({number:n,code,name:card.name,previouslyReviewed:true,existingThemes:inGroups,
    koreanPhotoVerified:true,newThemeRecords:0});
  continue;
 }
 if(inGroups.length||row.existingThemes.length)throw Error("Already reviewed thematic image: "+code);
 const selected=[["color",names[n],card.name+" 한국판 일러스트의 대표 색상은 "+names[n]+"이다."]];
 if(landscapes[n])selected.push(["season",landscapes[n],card.name+" 뒤로 "+landscapes[n]+" 장면이 확인된다."]);
 for(const [id,category,description] of selected){
  themes.groups.find(g=>g.code===id).cards.push({
   code,name:card.name,series:"SM",set:master.code,setName:master.displayName,
   cardNumber:card.code.split("_")[1],rarity:card.rarity||"",
   category:category,image:row.ownedSource,
   evidence:"SM2K 한국판 도감앱 개별 카드명·번호와 본 사이트 CDN 이미지 픽셀 대조 확인. "+
    description+" 근거 없는 연결 일러스트·진화 스토리 등은 추가하지 않음. ("+OUTPUT+")."
  });
 }
 result.push({number:n,code,name:card.name,previouslyReviewed:false,
  photo:row.ownedSource,meanPixelDifference:row.difference,appCardPage:row.appPage,
  newThemeRecords:selected.length,matchedThemes:selected.map(x=>x[0]),
  categories:Object.fromEntries(selected.map(x=>[x[0],x[1]]))});
}
if(result.length!==30||result.filter(x=>!x.previouslyReviewed).length!==29||
 color.cards.length!==previous.color+29||season.cards.length!==previous.season+17||
 themes.groups.some(g=>!["color","season"].includes(g.code)&&g.cards.length!==previous[g.code]))
 throw Error("Unapproved theme counts changed");
themes.updatedAt="2026-10-18";
const test=fs.readFileSync(PRE_TEST,"utf8");
const old="assert.equal(total,17826);";
const updated="assert.equal(total,17872);";
if(test.split(old).length!==2)throw Error("Test expectation baseline changed, no silent rewrite");
fs.writeFileSync(PRE_TEST,test.replace(old,updated));
write(ART,themes);
const report={
 schemaVersion:1,recordedAt:"2026-10-18",set:"sm2K",setName:master.displayName,
 range:"001-030",totalInSet:62,completedImageIdentity:30,reviewedPriorArtwork:1,
 newArtworksReviewed:29,artworksReviewedInRange:30,
 photosMatchedOwnCdn:30,colorAdded:29,seasonAdded:17,all12ThemesChecked:true,
 otherTenThemesAdded:0,priorSleepingCardPreserved:"SM2K_014",
 existingOtherThemeCardsReaudited:0,canonicalCardMutations:0,userOwnedRecordsMutated:0,
 preflightEvidence:PRE,
 numberFooterCaveat:"Korean Dogam app numbered catalog and owned photograph matched; individual physical footer number not independently enlarged.",
 themeCountsBefore:previous,
 themeCountsAfter:Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length])),
 cards:result};
const progress={schemaVersion:1,date:"2026-10-18",set:"sm2K",totalMasterCards:62,
 reviewedRanges:["001-030"],reviewedKoreanCardPhotos:30,
 themeReviewed:30,alreadyReviewedPrior:1,newlyReviewed:29,
 newThemeEntries:46,remainingUnreviewedRange:"031-062",
 remainingCardCount:32,
 status:"first30_Korean_images_and_12_theme_reviews_complete_32_remaining",
 nextStart:"SM2K 031-062 Korean card art, verify and classify only as evidence supports.",
 original191Audit:{completed:190,held:"S6K 094"}};
write(OUTPUT,report);
write(STATUS,progress);
console.log("SM2K_001_030_VISUAL_THEMES_COMPLETE",JSON.stringify({
 verifiedPhoto:30,previousThemeProtected:1,reviewedNow:29,
 color:29,landscapes:17,themeTotal:17872,remainingSM2K:32}));
