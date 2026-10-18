#!/usr/bin/env node
/* Read-only, source-locator for incomplete Korean card images; no downloads/mutations. */
import fs from "node:fs";
const data=JSON.parse(fs.readFileSync("data/series.json","utf8"));
const queue=JSON.parse(fs.readFileSync("data/audits/korean-recovery-active-queue-20261018.json","utf8"));
const all=[];
function walk(value){if(Array.isArray(value)){value.forEach(walk);return;}if(!value||typeof value!=="object")return;
 if(typeof value.code==="string"&&typeof value.image==="string")all.push({code:value.code,name:value.name,image:value.image,source:value.source,rarity:value.rarity});
 for(const x of Object.values(value))if(x&&typeof x==="object")walk(x);
}
walk(data);
const nonMega=queue.unresolved.filter(x=>x.era!=="MEGA");
const results=nonMega.map(x=>{
 let matches=all.filter(v=>{
 const slot=x.slot.toLowerCase(),card=v.code.toLowerCase();
 return card===slot||card.startsWith(slot+"/");
 });
 const strong=matches.filter(x=>typeof x.source==="string"&&x.source.includes("dogam.app/cards/"));
 return {workId:x.workId,era:x.era,series:x.series,slot:x.slot,issue:x.issue,catalogMatches:matches.length,appMatches:strong.length,
 matches:matches.slice(0,3)};
});
const byEra={},bySource={},none=[];
for(const x of results){const s=byEra[x.era]??={total:0,mapped:0,app:0};s.total++;if(x.catalogMatches)s.mapped++;if(x.appMatches)s.app++;else none.push(x.slot);
 for(const y of x.matches){let host="none";try{host=new URL(y.image).hostname}catch{}bySource[host]=(bySource[host]||0)+1;}
}
console.log("PENDING149_SUMMARY",JSON.stringify({total:results.length,byEra,bySource,unmapped:results.filter(x=>!x.catalogMatches).map(x=>x.slot)}));
for(const x of results)console.log("PENDING149_SLOT",JSON.stringify(x));
