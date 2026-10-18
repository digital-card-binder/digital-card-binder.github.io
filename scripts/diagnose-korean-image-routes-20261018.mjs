#!/usr/bin/env node
/* Diagnostic only: print short excerpts of public card metadata for exact 8 held slots.
   Does not modify datasets, cached assets, user ownership, or deployment. */
import fs from "node:fs";
const ids=["s6h_088","s6h_089","s6h_091","s6h_092","s6h_093","s6k_089","s6k_090","s6k_092"];
for (const filename of ["data/series.json", "data/pokemon-search-index.json","data/art-themes.json"]) {
  const s=fs.readFileSync(filename,"utf8"), lower=s.toLowerCase();
  console.log("DATA_FILE",filename,"BYTES",s.length);
  for (const id of ids) {
    let pos=0,n=0;
    while((pos=lower.indexOf(id,pos))>=0 && n<3) {
      console.log("ROUTE_SLOT",id,"MATCH",++n,"OFFSET",pos,"EXCERPT",JSON.stringify(s.slice(Math.max(0,pos-300),pos+500)));
      pos+=id.length;
    }
    if(n===0)console.log("ROUTE_SLOT",id,"NOT_FOUND");
  }
}

/* MEGA 14: read-only structural information, no image fetching or card mutations. */
const megaQueue=JSON.parse(fs.readFileSync("data/audits/korean-recovery-active-queue-20261018.json","utf8")).unresolved.filter(x=>x.era==="MEGA");
const series=JSON.parse(fs.readFileSync("data/series.json","utf8"));
const cards=[];
const targetTokens=new Set(["b/rgb","g/rgb","r/rgb","766","016","040","500","501","502","058","059","060","085","086"]);
function walk(value,group="") {
  if(Array.isArray(value)){for(const part of value)walk(part,group);return;}
  if(!value||typeof value!=="object")return;
  const next=value.code&&typeof value.code==="string"?value.code:group;
  if(value.code && typeof value.code==="string" && ("image" in value) && /^((m6a|mc|m-p)[_-])/i.test(value.code)){
    const code=String(value.code),number=code.split("_").slice(1).join("_").split("/")[0].toLowerCase().padStart(3,"0");
    if(targetTokens.has(number)||targetTokens.has(number.replace(/^0+/,""))||/rgb/i.test(code))
      cards.push({code,value});
  }
  for(const part of Object.values(value))if(part&&typeof part==="object")walk(part,next);
}
walk(series);
console.log("MEGA_PENDING",JSON.stringify(megaQueue.map(x=>({id:x.workId,slot:x.slot,cardName:x.cardName}))));
console.log("MEGA_CARD_RECORDS",JSON.stringify(cards));
