#!/usr/bin/env node
/** Restore 12 independently reviewed Korean physical card photographs, never JP substitutions. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const load = p => JSON.parse(fs.readFileSync(p,'utf8'));
const proofPath='data/audits/theme-sm14-twelve-genuine-korean-prints-verified-20261022.json';
const proof=load(proofPath);
assert.equal(proof.approvedKoreanCards,12);
assert.equal(proof.rejectedJapaneseForKoreanCards,2);
const source='data/series.json';
let text=fs.readFileSync(source,'utf8');
const sets=JSON.parse(text);
const codes=new Set();
const changed=[];
const destDir='assets/cards/korean-sm-restored';
fs.mkdirSync(destDir,{recursive:true});
for(const r of proof.approved) {
 const id=r.code.toLowerCase();
 assert.ok(!codes.has(id),'duplicate proof');
 codes.add(id);
 const matches=sets.flatMap(s=>(s.cards||[]).map(c=>({set:s,card:c})))
  .filter(x=>String(x.card.code).toLowerCase()===id);
 assert.equal(matches.length,1,'one canonical card '+id);
 const {set,card}=matches[0];
 assert.equal(set.code.toLowerCase(),r.set.toLowerCase(),'series code');
 assert.equal(card.name.replace(/[\s&-]/g,''),r.koreanName.replace(/[\s&-]/g,''),'Korean name');
 assert.ok(r.sourcePage.startsWith('https://www.dogam.app/sets/'),'Korean source page');
 assert.ok(/^https:\/\/static\.tcgexchange\.kr\/[a-f0-9]{32}\.w960\.webp$/.test(r.imageUrl));
 assert.ok(/^[0-9a-f]{64}$/.test(r.sha256));
 const oldImage=card.image;
 assert.ok(oldImage!==r.imageUrl,'Only repairs missing external photos');
 const fileName=id.replace('/','-')+'.webp';
 const filePath=destDir+'/'+fileName;
 const imageUrl='https://digital-card-binder.github.io/'+filePath;
 const reply=await fetch(r.imageUrl,{headers:{'User-Agent':'Mozilla/5.0 (Korean Print Card Archive)'}});
 assert.ok(reply.ok,'Source image '+id+' HTTP '+reply.status);
 const buf=Buffer.from(await reply.arrayBuffer());
 assert.ok(buf.length>10000&&buf.length<8000000,'image length');
 assert.equal(buf.toString('ascii',0,4),'RIFF','WEBP header');
 assert.equal(buf.toString('ascii',8,12),'WEBP','WEBP magic');
 assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),r.sha256,'verified original photo bytes SHA');
 assert.ok(!fs.existsSync(filePath),'Never overwrite existing archived Korean art');
 fs.writeFileSync(filePath,buf);
 // Replacing JSON scalar string literals preserves the entire massive master layout
 // and all other cards' ownership keys, codes, counts and theme memberships.
 for(const [from,to,key] of [[oldImage,imageUrl,'image'],[card.source,r.sourcePage,'source']]){
  const before=JSON.stringify(from),after=JSON.stringify(to);
  const n=text.split(before).length-1;
  assert.equal(n,1,'Original '+key+' scalar must occur once '+id);
  text=text.replace(before,after);
 }
 changed.push({code:id,KoreanName:r.koreanName,printedNumber:r.printedFooter,
  originalSourceImage:r.imageUrl,originalSourceSha256:r.sha256,
  archivedImageUrl:imageUrl,archivedPath:filePath,
  oldImageUrl:oldImage,verifiedSourcePage:r.sourcePage});
 console.log('KOREAN_ARCHIVED',id,buf.length);
}
assert.equal(changed.length,12);
fs.writeFileSync(source,text);
const setNow=JSON.parse(text);
assert.equal(setNow.length,sets.length);
for(let i=0;i<setNow.length;i++)assert.equal(setNow[i].cards.length,sets[i].cards.length);
const legacy=load('data/series-legacy.json');
assert.equal(setNow.length+legacy.length,273);
assert.equal([...setNow,...legacy].reduce((n,s)=>n+s.cards.length,0),20243);
assert.equal(load('data/audits/theme-series-coverage.json').summary.themeCardSlots,22032);
const finalPath='data/audits/theme-sm14-twelve-korean-images-repaired-and-archived-20261022.json';
assert.ok(!fs.existsSync(finalPath));
fs.writeFileSync(finalPath,JSON.stringify({
 schemaVersion:1,at:'2026-10-22',fullyVerifiedKoreanPhotoRestorations:12,
 rejectedJpSources:2,remainingUnverifiedKoreanPhysicalArtwork:2,
 masterSetCount:273,masterCardCount:20243,themeMemberships:22032,
 imageLanguage:'KR',
 proof:proofPath,
 allPhotoBytesSha256Verified:true,
 noFirestoreWrites:true,noRadarWrites:true,standaloneDexMembershipsUnchanged:true,
 repairedCards:changed
},null,2)+'\n');
console.log('SM14_TWELVE_KOREAN_ARCHIVE_OK',JSON.stringify({archived:12,stillHeld:2,sets:273,cards:20243,themes:22032}));
