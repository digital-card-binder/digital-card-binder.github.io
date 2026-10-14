import {readFile,writeFile} from 'node:fs/promises';
const get=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const audit=await get('data/audits/theme-s10d-061-088-korean-metadata-20261015.json');
const db=await get('data/series.json');
const status=await get('data/audits/theme-series-review-status.json');
const sets=db.filter(x=>String(x.code).toLowerCase()==='s10d');
if(sets.length!==1||sets[0].cards?.length!==88)throw Error('Expected exactly 88 canonical Korean s10D cards');
const s=sets[0];
if(audit.cards.length!==28||audit.cards[0].number!=='061'||audit.cards.at(-1).number!=='088')throw Error('Metadata evidence malformed');
const current=status.reviews?.s10D;
if(!current||(current.reviewedCardCount||0)<60||status.execution?.currentSet!=='s10D')throw Error('s10D progress unexpectedly missing');
let adjusted=0;
for(let i=0;i<28;i++){
 const n=i+61,e=audit.cards[i],c=s.cards[n-1],id=String(n).padStart(3,'0');
 if(e.number!==id||!c||c.code.toLowerCase()!=='s10d_'+id+'/067'||c.name!==e.name||
 c.source!=='https://pokemoncard.co.kr/cards/detail/BS2022007'+id||
 !c.image?.endsWith('/S10D_'+id+'.png')||
 (c.rarity&&c.rarity!==e.rarity))throw Error('Korean print/card mismatch at '+id);
 if(!c.rarity){c.rarity=e.rarity;adjusted++;}
}
const tally={};for(const c of s.cards.slice(60))tally[c.rarity]=(tally[c.rarity]||0)+1;
if(JSON.stringify(tally)!==JSON.stringify(audit.rarityDistribution))throw Error('Rarity distribution mismatch');
const original=status.execution.nextStart;
if((current.reviewedCardCount||0)===60&&original!=='s10D canonical 061')throw Error('Unexpected strict checkpoint, refusing to advance');
current.metadataRarityVerifiedThrough=88;
current.metadataRarityVerifiedCount=28;
current.metadataRarityEvidence='data/audits/theme-s10d-061-088-korean-metadata-20261015.json';
status.execution.lastMetadataAudit={set:'s10D',range:'canonical 061-088',checkedAt:'2026-10-15',evidence:'data/audits/theme-s10d-061-088-korean-metadata-20261015.json',artworkAndCDNPending:true};
status.updatedAt='2026-10-15';
if((current.reviewedCardCount||0)!==60)throw Error('Keep strict artwork checkpoint unchanged');
if(status.execution.nextStart!==original)throw Error('Strict checkpoint must not change');
if(adjusted||!current.metadataAuditCommittedAt){current.metadataAuditCommittedAt='2026-10-15';await save('data/series.json',db);await save('data/audits/theme-series-review-status.json',status);}
console.log(JSON.stringify({set:'s10D',correctedRarity:adjusted,koreanMetadataVerified:28,strictArtReviewed:current.reviewedCardCount,nextArt:status.execution.nextStart}));
