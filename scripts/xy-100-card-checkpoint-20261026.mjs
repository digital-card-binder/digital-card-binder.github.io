#!/usr/bin/env node
/**
 * Crash-resumable 100-card XY evidence and theme-membership checkpoint.
 *
 * IMPORTANT: "100 processed" is NOT "100 individually screened for all themes".
 * This checks a previously saved image/source artifact and all existing theme
 * memberships against each master card, then commits a traceable batch.
 * Unseen artwork remains visually unreviewed. Human scene proof is required.
 *
 * Run: node scripts/xy-100-card-checkpoint-20261026.mjs --next
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const PROGRESS = 'data/audits/theme-xy-100-card-progress-20261026.json';
const BATCH_DIR = 'data/audits/theme-xy-100-card-batches-20261026';
const EVIDENCE = 'data/audits/theme-xy-scene-review-manifest-20261026.json';
const SIZE = 100;
const SCENE = ['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const write = (p,v) => {
  const full = path.join(ROOT,p);
  fs.mkdirSync(path.dirname(full),{recursive:true});
  fs.writeFileSync(full,JSON.stringify(v,null,2)+'\n');
};
const norm = s => String(s??'').trim().toLowerCase();
const sha = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');

assert(process.argv.includes('--next'), 'Usage: --next (exactly one 100-card batch)');
const sources = [...read('data/series.json'),...read('data/series-legacy.json')].filter(s=>s.era==='XY');
const flat = sources.flatMap(set=>set.cards.map(card=>({set:set.code,card})));
assert.equal(sources.length,37);
assert.equal(flat.length,2313);
const vis = read(EVIDENCE);
assert.equal(vis.cardinality.cards,2313);
assert.equal(vis.cardinality.sets,37);
assert.equal(vis.cardinality.individuallyAllTwelveScreened,5);
assert.equal(vis.cardinality.remainingAllTwelveScreening,2308);
assert.equal(vis.cardinality.archivalImageColorScreened,2117);
assert.equal(vis.cardinality.archivalImageHeld,196);
assert.equal(vis.cardinality.strictCompleteSets,0);
const evidence = new Map();
for(const set of vis.sets){
 for(const card of set.cards){
  const key=norm(set.set)+'|'+norm(card.code);
  assert(!evidence.has(key),'Duplicate evidence '+key);
  evidence.set(key,card);
 }
}
assert.equal(evidence.size,2313);
const membership = new Map();
const art = read('data/art-themes.json');
assert.deepEqual(art.groups.map(g=>g.code).sort(),[...SCENE].sort());
for(const theme of art.groups){
 for(const c of theme.cards){
  const key=norm(c.set)+'|'+norm(c.code);
  if(!membership.has(key))membership.set(key,new Set());
  membership.get(key).add(theme.code);
 }
}
const totalThemes=art.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(totalThemes,24167,'Main theme data changed: reconcile before resuming');
const masterKeys=new Set(flat.map(({set,card})=>norm(set)+'|'+norm(card.code)));
assert.equal(masterKeys.size,2313);

let progress;
if(fs.existsSync(PROGRESS)){
 progress=read(PROGRESS);
 assert.equal(progress.schemaVersion,1);
 assert.equal(progress.totalCards,2313);
 assert.equal(progress.batchSize,100);
 assert.equal(progress.phase,'source-and-existing-theme-evidence');
 assert.equal(progress.fullTwelveThemeApprovedAtStart,5);
 assert.equal(progress.existingThemeSlotsAtStart,24167);
 assert.equal(progress.nextOffset,progress.savedBatches.reduce((n,b)=>n+b.processed,0));
 for(let i=0;i<progress.savedBatches.length;i++){
  const b=progress.savedBatches[i];
  assert.equal(b.number,i+1);
  const filename=path.join(BATCH_DIR,'xy-batch-'+String(b.number).padStart(3,'0')+'.json');
  const saved=read(filename);
  assert.equal(b.sha256,sha(saved));
  assert.equal(saved.previousCheckpointSha256,i?progress.savedBatches[i-1].sha256:null);
  assert.equal(saved.batchNumber,b.number);
  assert.equal(saved.startOffset,i*SIZE);
  assert.equal(saved.endOffset,(i*SIZE)+saved.cards.length);
  assert.equal(saved.cards.length,b.processed);
 }
}else{
 progress={
  schemaVersion:1,recordedAt:'2026-10-26',
  era:'XY',totalSets:37,totalCards:2313,batchSize:SIZE,
  phase:'source-and-existing-theme-evidence',
  description:'Each 100-card batch verifies evidence integrity and existing theme links; does not certify uninspected 12-theme artwork.',
  fullTwelveThemeApprovedAtStart:5,
  existingThemeSlotsAtStart:24167,
  nextOffset:0,
  savedBatches:[],
  completedSourceAndMembershipAudit:false,
  strictAllThemeVisualReviewComplete:false
 };
}
const start=progress.nextOffset;
if(start>=flat.length){
 console.log('XY_ALL_SOURCE_EVIDENCE_BATCHES_ALREADY_SAVED',JSON.stringify({
  cards:progress.nextOffset,batches:progress.savedBatches.length,remaining:0,
  allTwelveThemeScreened:5,remainingVisual:2308
 }));
 process.exit(0);
}
const number=progress.savedBatches.length+1;
const previousHash=number>1?progress.savedBatches.at(-1).sha256:null;
const slice=flat.slice(start,start+SIZE);
let colorVerified=0,held=0,fullyVisual=0,scenePartial=0,sourceAndThemeEvidenceChecked=0;
const cases=[];
for(let i=0;i<slice.length;i++){
 const {set,card}=slice[i];
 const id=norm(set)+'|'+norm(card.code);
 const v=evidence.get(id);
 assert(v,'Missing previously saved card proof '+id);
 assert.equal(v.name,card.name,'Wrong source card '+id);
 assert.equal(v.image,card.image,'Image reference changed '+id);
 assert.equal(v.source,card.source,'Card detail source changed '+id);
 const printed=String(card.code).match(/^[^_]+_([0-9]+)(?:\/([0-9]+))?$/);
 assert(printed,'Missing printed number '+id);
 assert.equal(v.themeReview && Object.keys(v.themeReview).length,12,'Theme review matrix must include 12 categories');
 assert.deepEqual(Object.keys(v.themeReview).sort(),[...SCENE].sort());
 const themeCode=norm(card.code.split('/')[0]);
 const actual = [...(membership.get(norm(set)+'|'+themeCode)||[])].sort();
 assert.deepEqual(v.registeredThemes,actual,'Theme membership out of sync '+id);
 for(const theme of SCENE){
  const value=v.themeReview[theme];
  if(v.allTwelveVisuallyScreened) assert(['screened-in','screened-out'].includes(value),'Bad full-visual evidence '+id+' '+theme);
  else assert(['color-screened-only','scene-evidence-partial','not-screened'].includes(value),'False full-visual completion '+id+' '+theme);
  if(value==='screened-in'||value==='scene-evidence-partial'||value==='color-screened-only')
   assert(actual.includes(theme),'Theme label with no membership '+id+' '+theme);
  if(value==='screened-out')assert(!actual.includes(theme));
 }
 if(v.archiveColorStatus==='official-source-color-reviewed'){
  assert(/^[a-f0-9]{64}$/.test(v.colorImageProofSha256??''),'Missing archived source hash '+id);
  colorVerified++;
 }else{
  assert.equal(v.archiveColorStatus,'held');
  assert(v.imageHoldReason,'No hold reason '+id);
  held++;
 }
 if(v.allTwelveVisuallyScreened)fullyVisual++;
 else if(actual.some(t=>t!=='color'))scenePartial++;
 sourceAndThemeEvidenceChecked++;
 cases.push({
  ordinal:start+i+1,set,code:card.code,name:card.name,
  archivedImageColorStatus:v.archiveColorStatus,
  archivedImageSha256:v.colorImageProofSha256??null,
  holdReason:v.imageHoldReason??null,
  image:card.image,source:card.source,
  registeredThemeCodes:actual,
  allTwelveThemesIndividuallyVisuallyInspected:!!v.allTwelveVisuallyScreened,
  twelveThemeEvidenceMatrix:v.themeReview,
  reviewOutcome:v.allTwelveVisuallyScreened
   ?'existing-full-twelve-theme-evidence-preserved'
   :v.archiveColorStatus==='held'
    ?'held-for-korean-image-verification'
    :actual.some(t=>t!=='color')
     ?'some-scene-themes-approved-other-themes-unreviewed'
     :'image-color-verified-eleven-scene-themes-unreviewed',
 });
}
assert.equal(sourceAndThemeEvidenceChecked,slice.length);
assert.equal(colorVerified+held,slice.length);
const chunk={
 schemaVersion:1,date:'2026-10-26',
 type:'100-card-source-and-theme-evidence-checkpoint',
 batchNumber:number,batchSize:SIZE,
 startOffset:start,endOffset:start+slice.length,
 firstCard:cases[0].set+'|'+cases[0].code,
 lastCard:cases.at(-1).set+'|'+cases.at(-1).code,
 previousCheckpointSha256:previousHash,
 evidenceManifest:EVIDENCE,
 counters:{
  cardsEvidenceCrossChecked:slice.length,
  archivedColorProofPresent:colorVerified,
  imageHeld:held,
  previouslyAllTwelveThemesVisuallyScreened:fullyVisual,
  partialSceneThemeEvidence:scenePartial,
  newlyVisuallyScreenedInThisBatch:0,
  newlyApprovedSceneThemesInThisBatch:0
 },
 warning:'Cards processed in this checkpoint were reconciled against archived evidence; NOT automatically visually reviewed across all 12 themes.',
 cards:cases
};
const savedFile=path.join(BATCH_DIR,'xy-batch-'+String(number).padStart(3,'0')+'.json');
assert(!fs.existsSync(savedFile),'Refuse overwriting previously saved batch '+savedFile);
write(savedFile,chunk);
const chunkHash=sha(chunk);
progress.savedBatches.push({
 number,processed:slice.length,startOffset:start,endOffset:start+slice.length,
 firstCard:chunk.firstCard,lastCard:chunk.lastCard,
 archivedColorProofPresent:colorVerified,imageHeld:held,
 previousFullThemeReviews:fullyVisual,partialSceneEvidence:scenePartial,
 sha256:chunkHash,path:savedFile
});
progress.nextOffset=start+slice.length;
progress.completedSourceAndMembershipAudit=progress.nextOffset>=2313;
progress.strictAllThemeVisualReviewComplete=false;
progress.remainingSourceEvidenceEntries=2313-progress.nextOffset;
progress.sourceAndMembershipEvidenceChecked=progress.nextOffset;
progress.remainingIndividualTwelveThemeInspections=2308;
write(PROGRESS,progress);
console.log('XY_100_CARD_CHECKPOINT',JSON.stringify({
 batch:number,processed:slice.length,totalSaved:progress.nextOffset,
 lastCard:chunk.lastCard,remaining:progress.remainingSourceEvidenceEntries,
 fullTwelveAlreadyApproved:5,fullTwelveRemaining:2308,
 path:savedFile,sha256:chunkHash
}));
