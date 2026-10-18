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
