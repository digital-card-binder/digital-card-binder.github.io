import fs from "node:fs";
import path from "node:path";
const base="https://www.illudex.com";
const output={checkedAt:new Date().toISOString(),host:base,pages:[],scripts:[],clues:[],errors:[]};
const parseScripts=(html)=>[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(x=>x[1]).filter(x=>x.startsWith("/_next/"));
const headers={"User-Agent":"Mozilla/5.0 (compatible; PersonalCollectionAudit/1.0; research)"};
async function get(route,limit=5000000){try{const url=new URL(route,base);const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});const t=await response.text();return {status:response.status,text:t.slice(0,limit),length:t.length,url:url.toString(),type:response.headers.get("content-type")}}catch(error){return {error:String(error),url:route,text:"",length:0,status:0}}}
const pages=["/feelings?f=melancholy","/feelings","/art/melancholy-pokemon-card-art","/sitemap.xml","/robots.txt"];
for(const route of pages){
  const r=await get(route);
  const snippets=[];
  for(const term of ["melancholy","95 cards","94 cards","94 cards feel","most melancholy","Cubone","Melancholy","__NEXT_DATA__","cards feel","api/","_next/static"]){
    let idx=-1,c=0;
    while((idx=r.text.toLowerCase().indexOf(term.toLowerCase(),idx+1))>=0&&c<5){snippets.push({term,index:idx,text:r.text.slice(Math.max(0,idx-130),idx+220).replace(/\s+/g," ")});c++;}
  }
  const src=parseScripts(r.text);output.pages.push({url:r.url,status:r.status,bytes:r.length,contentType:r.type,scripts:src.length,title:r.text.match(/<title>([^<]*)<\/title>/)?.[1]||null,snippets:snippets.slice(0,45)});
  if(route.startsWith("/feelings"))output.scripts.push(...src);
}
output.scripts=[...new Set(output.scripts)];
const selected=output.scripts.slice(0,75);
for(const [idx,route] of selected.entries()){
 const r=await get(route,12000000);
 const terms=["melancholy","feelings","emotion","mood","/api/","data/","visual","coordinates","/card/","card_id","theme"]; 
 let cues=[];
 for(const term of terms){let i=r.text.toLowerCase().indexOf(term.toLowerCase());if(i>=0)cues.push({term,index:i,snippet:r.text.slice(Math.max(0,i-115),i+160)});}
 if(cues.length)output.clues.push({url:route,status:r.status,bytes:r.length,clues:cues.slice(0,12)});
 if(idx%20===0)console.log("scripts scanned",idx+1,"/",selected.length);
}
fs.mkdirSync("data/audits",{recursive:true});
fs.writeFileSync("data/audits/crying-illudex-public-site-probe-20261108.json",JSON.stringify(output,null,2)+"\n");
console.log("PROBE_REPORT",JSON.stringify({pages:output.pages.map(p=>({url:p.url,status:p.status,bytes:p.bytes,scripts:p.scripts,snippets:p.snippets.filter(s=>["95 cards","94 cards","Cubone","most melancholy"].includes(s.term)).slice(0,6)})),scriptsFound:output.scripts.length,clues:output.clues.slice(0,22).map(c=>({url:c.url,bytes:c.bytes,terms:c.clues.map(t=>t.term),top:c.clues.slice(0,3)}))},null,2));
