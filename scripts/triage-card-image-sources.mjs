#!/usr/bin/env node
// 5차: non-mutating classification of image URLs excluded from the self-hosted
// archive. A non-routed URL is NOT necessarily a broken card image.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeCardImage } from "./card-image-routing.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const getOption=(key,fallback)=>{
  const input=process.argv.find(arg=>arg.startsWith("--"+key+"="));
  return input ? input.slice(key.length+3) : fallback;
};
const output=path.resolve(getOption("output",path.join(root,"tmp/card-images/image-source-triage.json")));
const files=["data/series.json","data/series-legacy.json"];
const allowedRemote=new Set(["http:","https:"]);
const perCategory=new Map(),perHost=new Map(),perSet=new Map();
const findings=[],critical=[];
let totalCards=0,routedCards=0,exceptions=0;
const add=(map,key,example)=>{
  const entry=map.get(key)||{count:0,examples:[]};
  entry.count++;
  if(entry.examples.length<4)entry.examples.push(example);
  map.set(key,entry);
};
function describeSource(raw){
  const source=String(raw||"").trim();
  if(!source)return {category:"empty",host:"",problem:"blank"};
  if(source.startsWith("data:")||source.startsWith("blob:"))
    return {category:"embedded-or-blob",host:"",problem:"manual-review"};
  function localStatus(publicPath,host){
    let local;
    try {
      const decoded=decodeURIComponent(publicPath.split(/[?#]/)[0]).replace(/^\/+/, "");
      local=path.resolve(root,decoded);
    } catch {return {category:"local-invalid",host,problem:"unsafe-path"};}
    if(!local.startsWith(root+path.sep))
      return {category:"local-invalid",host,problem:"unsafe-path"};
    const exists=fs.existsSync(local)&&fs.statSync(local).isFile();
    const isOwnSite=host!=="local";
    return {category:isOwnSite
        ?(exists?"own-site-published-existing":"own-site-published-missing")
        :(exists?"local-existing":"local-missing"),
      host,problem:exists?"":"missing-file"};
  }
  if(source.startsWith("../"))return {category:"local-invalid",host:"local",problem:"unsafe-path"};
  if(source.startsWith("/")||source.startsWith("./"))
    return localStatus(source.replace(/^\.\//,""),"local");
  try{
    const url=new URL(source);
    if(!allowedRemote.has(url.protocol))return {category:"unsupported-protocol",host:url.protocol,problem:"manual-review"};
    if(/(?:^|\.)pages[.]dev$/i.test(url.hostname)&&url.hostname.startsWith("dcb-card-images-"))
      return {category:"existing-selfhosted-cloudflare",host:url.hostname,problem:""};
    if(url.hostname.toLowerCase()==="digital-card-binder.github.io")
      return localStatus(url.pathname,url.hostname.toLowerCase());
    return {category:"third-party-image-source",host:url.hostname.toLowerCase(),problem:"unverified-live-source"};
  }catch{
    return {category:"unparseable-image-source",host:"",problem:"manual-review"};
  }
}

for(const file of files){
  const groups=JSON.parse(fs.readFileSync(path.join(root,file),"utf8"));
  if(!Array.isArray(groups))throw Error("Invalid series file: "+file);
  for(const group of groups){
    for(const card of group.cards||[]){
      totalCards++;
      const source=String(card.image||"").trim();
      if(routeCardImage(source)){routedCards++;continue;}
      exceptions++;
      const kind=describeSource(source);
      const example={file,set:String(group.code||""),code:String(card.code||""),source};
      add(perCategory,kind.category,example);
      add(perHost,kind.host||"(none)",example);
      add(perSet,String(group.code||""),example);
      if(kind.problem==="missing-file"||kind.problem==="unsafe-path"||kind.problem==="blank")
        critical.push({...example,reason:kind.problem});
      if(findings.length<20)findings.push({...example,category:kind.category,problem:kind.problem});
    }
  }
}
const ordered=(map)=>Object.fromEntries([...map.entries()]
  .sort((a,b)=>b[1].count-a[1].count||a[0].localeCompare(b[0]))
  .map(([k,v])=>[k,v]));
const report={
  schemaVersion:1,
  scope:"original series image URLs not covered by self-hosted archive",
  totalCards,routedCards,exceptions,
  byCategory:ordered(perCategory),
  byHost:ordered(perHost),
  topSets:Object.fromEntries(Object.entries(ordered(perSet)).slice(0,30)),
  criticalCount:critical.length,criticalSample:critical.slice(0,60),
  sample:findings,
  caveats:[
    "A non-routed original URL may be a valid public image, an intentional CDN URL or a verified exception.",
    "HTTP reachability and artwork/print-number matching are not proven by this static triage.",
    "No data, image URLs or ownership records are written by this audit.",
  ],
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({
  totalCards,routedCards,exceptions,criticalCount:critical.length,
  categories:Object.fromEntries([...perCategory].map(([key,item])=>[key,item.count])),
  topHosts:[...perHost].sort((a,b)=>b[1].count-a[1].count).slice(0,8)
    .map(([host,item])=>({host,count:item.count,example:item.examples[0]?.source||""})),
},null,2));
if(critical.length)process.exitCode=1;
