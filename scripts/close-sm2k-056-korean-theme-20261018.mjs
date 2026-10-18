// One-time, idempotent Korean SM2K_056 photo+theme closure.
// Existing art-theme database and every other canonical/ownership record remain untouched.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const paths={
 art:'data/art-themes.json',
 review:'data/audits/theme-sm2k-031-062-Korean-art-review-20261018.json',
 progress:'data/audits/theme-sm2k-031-062-progress-20261018.json',
 imageAudit:'data/audits/sm2k-056-exact-Korean-image-recovery-20261018.json',
 closure:'data/audits/sm2k-056-Korean-print-12theme-closure-20261018.json',
 image:'assets/cards/sm2k-korean/056.webp'
};
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=load(paths.art),review=load(paths.review),progress=load(paths.progress),img=load(paths.imageAudit);
const photo=readFileSync(paths.image);
assert.equal(createHash('sha256').update(photo).digest('hex'),img.ownedWebpSHA256,'SM2K 056 owned photo hash differs');
assert.equal(img.status,'approved_exact_Korean_source_and_repository_image');
const color=art.groups.find(g=>g.code==='color');
assert.ok(color);
if(color.cards.some(c=>c.code==='SM2K_056')){
 console.log('SM2K_056 theme already applied; no duplicate changes');
 process.exit(0);
}
assert.equal(color.cards.length,9949);
assert.equal(progress.imagesKoreanVerified,57);
assert.equal(progress.themeReviewed,56);
assert.deepEqual(progress.heldCardNumbers,[57,58,60,61,62]);
assert.deepEqual(review.cardsStillHeld,[56,57,58,60,61,62]);
const held=review.records.find(x=>x.number===56);
assert.ok(held?.noThemeDecision,'056 expected as pending theme only');
const anchor=color.cards.findIndex(c=>c.code==='SM2K_059');
assert.ok(anchor>0);
const entry={
 code:'SM2K_056',name:'폭거북스 GX',series:'SM',set:'sm2K',setName:'알로라의 햇빛',
 cardNumber:'056/050',rarity:'HR',category:'무지개·파스텔',
 image:img.newOwnedImage,
 evidence:'한국판 자체 저장 사진에서 카드명 폭거북스 GX, 한국어 공격 설명, 실제 하단 SM2K A 056/050 HR 인쇄를 직접 확대 확인했다. 무지갯빛 파스텔 일러스트로 색감 테마에 수록하고 나머지 11개 테마는 불포함한다. (data/audits/sm2k-056-Korean-print-12theme-closure-20261018.json).'
};
color.cards.splice(anchor,0,entry);
Object.assign(held,{
 status:'reviewed_exact_Korean_selfhosted_print_and_12themes',
 sourceApp:img.sourcePage,ownedImage:img.newOwnedImage,
 readableKoreanPrintedFooter:'SM2K A 056/050 HR',printedLanguage:'Korean',
 matchedThemes:['color'],newlyAddedThemes:['color'],
 categories:{color:'무지개·파스텔'},noThemeDecision:false,
 evidenceAudit:paths.closure
});
delete held.visualIssue;delete held.priorStatus;
review.newArtworksReviewed+=1;
review.colorThemeAdditions+=1;
review.cardsStillHeld=review.cardsStillHeld.filter(x=>x!==56);
review.countsAfter.color+=1;
review.sourceAuditSupplement=paths.closure;
review.all12ThemesCheckedFor56=true;
progress.themeReviewed=57;
progress.themeReviewPendingCardNumbers=[57,58,60,61,62];
progress.status='57_of_62_exact_Korean_images_verified_and_57_of_62_12themes_reviewed_five_cards_pending';
progress.nextStart='SM2K_057 actual Korean-language 057/050 HR image, then 058,060,061,062';
progress.mostRecentThemeClosure=paths.closure;
const proof={
 schemaVersion:1,checkedAt:'2026-10-18',series:'sm2K',code:'SM2K_056',cardName:'폭거북스 GX',
 physicalPrintedCardId:'SM2K A 056/050 HR',
 visualEvidence:{actualPhoto:paths.image,ownedFileSHA256:img.ownedWebpSHA256,sourcePage:img.sourcePage,
 koreanNamePrinted:true,korAttackTextPrinted:true,printedCardNumberVisible:true,
 number:'056/050',rarity:'HR',fullCardPhotoManuallyInspected:true,photographDisplaysRainbowHolo:true},
 imageApproval:{alreadyDeployedAt:img.newOwnedImage,commit:'051a5c02c177d56e00e6a894550e98d2db516920',changedThisBatch:false},
 twelveThemeReview:{checked:['sleeping','connected','evolution','night','season','color','sunset','reflections','food','work','street','cameo'],matched:['color'],category:'무지개·파스텔',reason:'Rainbow holo-gradient without artwork evidence for other themes.',siteThemeEntryAdded:true},
 protect:{priorApprovedCardsRechecked:0,masterIdsChanged:0,existingImagesModified:0,ownershipModified:0,otherElevenThemeGroupsModified:0},
 priorSM2KFiveImageHolds:[57,58,60,61,62],remainingThemeHolds:[57,58,60,61,62],
 original191:{completed:190,remaining:'S6K_094',unchanged:true}
};
assert.equal(color.cards.length,9950);
assert.deepEqual(review.cardsStillHeld,[57,58,60,61,62]);
assert.deepEqual(progress.themeReviewPendingCardNumbers,[57,58,60,61,62]);
assert.ok(!existsSync(paths.closure),'closure report already exists unexpectedly');
save(paths.art,art);save(paths.review,review);save(paths.progress,progress);save(paths.closure,proof);
console.log('SM2K_056_KOREAN_FOOTER_AND_COLOR_THEME_COMPLETE; next SM2K_057');
