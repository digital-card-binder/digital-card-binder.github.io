#!/usr/bin/env node
// Read-only strict-complete Korean set audit. Network requests are made ONLY to DCB-owned Cloudflare hosts.
import fs from "node:fs";
import path from "node:path";
import { routeCardImage } from "./card-image-routing.mjs";
const root=process.cwd();
const read=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const [series,legacy,coverage,artThemes]=[
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/audits/theme-series-coverage.json"),read("data/art-themes.json")
];
const complete=coverage.sets.filter(x=>x.status==="complete");
if(complete.length<48)throw Error("Fewer than 48 strict-complete sets; review the latest baseline before running this audit.");
const allMaster=[...series,...legacy];
const bySet=new Map(allMaster.map(x=>[String(x.code).toUpperCase(),x]));
const completedSetCodes=new Set(complete.map(x=>String(x.code).toUpperCase()));
const cdnBases={modern:"https://dcb-card-images-modern-2026.pages.dev",legacy:"https://dcb-card-images-legacy-2026.pages.dev"};
const OWNED_CDN=new Set(Object.values(cdnBases).map(x=>new URL(x).hostname));
const seenUrls=new Map();
const stats=new Map();
const badPaths=[];
const examples=[];
let inspectedRefs=0,masterCards=0,themeCardReferences=0;
const sample=(bucket,value,limit=40)=>{if(bucket.length<limit)bucket.push(value)};
function classify(raw){
 const value=String(raw||"").trim();
 if(!value)return {kind:"missing",destination:""};
 const route=routeCardImage(value);
 if(route)return {kind:"routed",destination:cdnBases[route.project]+"/"+route.relativePath,sourceHost:new URL(route.canonicalUrl).hostname};
 try{
  const url=new URL(value);
  if(url.protocol==="http:"||url.protocol==="https:"){
    if(OWNED_CDN.has(url.hostname))return {kind:"owned-direct",destination:url.href,sourceHost:url.hostname};
    return {kind:"EXTERNAL_UNROUTABLE",destination:"",sourceHost:url.hostname};
  }
 }catch{}
 if(value.startsWith("data:image/"))return {kind:"embedded",destination:""};
 if(value.startsWith("/")||value.startsWith("./"))return {kind:"local",destination:""};
 return {kind:"UNRECOGNIZED",destination:""};
}
function addImage(setCode,where,raw){
 inspectedRefs++;
 const classification=classify(raw);
 const stat=stats.get(setCode);
 stat.allImageReferences++;
 if(classification.kind==="missing"){stat.missing++;sample(stat.examples,{where,kind:"missing"});return}
 if(classification.kind==="EXTERNAL_UNROUTABLE"||classification.kind==="UNRECOGNIZED"){
  stat.unroutable++;sample(stat.examples,{where,kind:classification.kind,source:raw});badPaths.push({set:setCode,where,kind:classification.kind,source:raw});return
 }
 if(classification.kind==="local"||classification.kind==="embedded"){
  stat.localOrEmbedded++;sample(stat.examples,{where,kind:classification.kind,source:raw});return
 }
 stat.cdnReferences++;
 if(classification.kind==="routed")stat.originalSourceUrlsRouted++;
 else stat.alreadyOwnedUrls++;
 if(!seenUrls.has(classification.destination))seenUrls.set(classification.destination,[]);
 seenUrls.get(classification.destination).push({set:setCode,where});
}
for(const meta of complete){
 const code=String(meta.code).toUpperCase(),master=bySet.get(code);
 if(!master||!Array.isArray(master.cards)||master.cards.length!==meta.cardCount)
  throw Error("Canonical master mismatch: "+code);
 const stat={set:meta.code,name:meta.name,canonicalCount:meta.cardCount,allImageReferences:0,cdnReferences:0,originalSourceUrlsRouted:0,alreadyOwnedUrls:0,missing:0,unroutable:0,localOrEmbedded:0,cdnVerified:0,cdnFailed:0,themeImages:0,variants:0,examples:[],cdnFailures:[]};
 stats.set(code,stat);
 masterCards+=master.cards.length;
 for(let i=0;i<master.cards.length;i++){
  const c=master.cards[i];
  const base="master["+String(i+1).padStart(3,"0")+"]";
  // The live catalog chooses sourceImage or image, but check BOTH references in case another view uses either.
  const fields=["sourceImage","image","imageUrl","image_url","thumbnail","img"].filter(f=>typeof c[f]==="string"&&c[f].trim());
  if(fields.length===0){stat.missing++;sample(stat.examples,{where:base,kind:"no_image_field"});}
  for(const field of fields)addImage(code,base+"."+field,c[field]);
  const variants=c.printVariants;
  if(Array.isArray(variants)){
   variants.forEach((v,k)=>{
    if(!v||typeof v!=="object")return;
    for(const f of ["sourceImage","image","imageUrl","image_url","thumbnail","img"]){
     if(typeof v[f]==="string"&&v[f].trim()){stat.variants++;addImage(code,base+".printVariants["+k+"]."+f,v[f]);}
    }
   });
  }
 }
}
for(const group of artThemes.groups||[]){
 for(const card of group.cards||[]){
  const setCode=String(card.set||"").toUpperCase();
  if(!completedSetCodes.has(setCode))continue;
  const stat=stats.get(setCode); if(!stat)continue;
  themeCardReferences++;
  if(typeof card.image==="string"&&card.image.trim()){
   stat.themeImages++;
   addImage(setCode,"art-themes."+group.code+"."+(card.code||"unknown"),card.image);
  }else{stat.missing++;sample(stat.examples,{where:"art-themes."+group.code+"."+(card.code||"unknown"),kind:"no_image"});}
 }
}
const urls=[...seenUrls.keys()];
let cursor=0;
const checked=new Map();
const ownOnly=(u)=>OWNED_CDN.has(new URL(u).hostname);
async function check(url){
 if(!ownOnly(url))throw Error("Blocked non-owned URL: "+url);
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),13000);
  try{
   const r=await fetch(url,{method:"HEAD",signal:controller.signal,redirect:"manual",headers:{"User-Agent":"DigitalCardBinder-Selfhost-AllComplete-Audit/1.0"}});
   clearTimeout(timer);
   const type=r.headers.get("content-type")||"";
   if(r.status>=200&&r.status<300&&type.toLowerCase().includes("image/"))
    return {ok:true,status:r.status,type};
   if((r.status===429||r.status>=500)&&attempt===0){await new Promise(r=>setTimeout(r,450));continue}
   return {ok:false,status:r.status,type,reason:r.status>=300&&r.status<400?"unexpected_redirect":"unexpected_status_or_content_type"};
  }catch(e){clearTimeout(timer);if(attempt===1)return {ok:false,status:0,reason:String(e).slice(0,120)}}
 }
 return {ok:false,status:0,reason:"unknown"};
}
const WORKERS=12; // avoid bursts even to our own Cloudflare archive
await Promise.all(Array.from({length:WORKERS},async()=>{
 while(true){
  const i=cursor++; if(i>=urls.length)return;
  const url=urls[i],outcome=await check(url);
  checked.set(url,outcome);
 }
}));
// A small number of CDN handshake failures can be transient. Re-check only
// failed owned-host URLs sequentially, never request third-party origins.
const initialFailures=[...checked.entries()].filter(([url,result])=>!result.ok);
for (const [url] of initialFailures) {
  await new Promise(resolve=>setTimeout(resolve,900));
  const retry=await check(url);
  checked.set(url,retry);
}
for(const [url,refs]of seenUrls.entries()){
 const result=checked.get(url);
 for(const ref of refs){
  const stat=stats.get(ref.set);
  if(result.ok)stat.cdnVerified++;
  else{
   stat.cdnFailed++;
   sample(stat.cdnFailures,{where:ref.where,url,result},25);
  }
 }
}
const perSet=complete.map(s=>{
 const st=stats.get(s.code.toUpperCase());
 return {...st,completeSelfHosted:(st.missing===0&&st.unroutable===0&&st.cdnFailed===0)};
});
const failures=[...checked.entries()].filter(([url,r])=>!r.ok).map(([url,result])=>({
 url,result,usedBy:seenUrls.get(url).slice(0,6),referenceCount:seenUrls.get(url).length
}));
const totals={
 completedSets:complete.length,canonicalMasterCards:masterCards,themeCardReferences,
 checkedImageFieldReferences:inspectedRefs,uniqueOwnedCdnAssets:urls.length,
 verifiedUniqueOwnedCdnAssets:urls.length-failures.length,
 failedUniqueOwnedCdnAssets:failures.length,
 missingImageReferences:perSet.reduce((a,s)=>a+s.missing,0),
 unroutableExternalReferences:perSet.reduce((a,s)=>a+s.unroutable,0),
 localOrEmbeddedReferences:perSet.reduce((a,s)=>a+s.localOrEmbedded,0),
 sourceUrlsRoutedToOwnedCDN:perSet.reduce((a,s)=>a+s.originalSourceUrlsRouted,0),
 setsFullyPassed:perSet.filter(s=>s.completeSelfHosted).length
};
const report={
 schemaVersion:1,generatedAt:new Date().toISOString(),
 auditScope:`${complete.length} strict-complete Korean sets + associated art-theme images and card print variant images`,
 method:"Repository source-image classification using real card-image-routing.mjs. HTTP HEAD sent exclusively to the two Digital Card Binder self-hosted Cloudflare Pages image domains. Retry failed owned URLs after bulk scan to distinguish transient errors. No third-party origin requests. HEAD verifies response, not pixel identity.",
 mainSafety:"Read-only: does not modify master data, ownership state, themes, or image files.",
 totals,perSet,failedCdnAssets:failures,unroutablePaths:badPaths.slice(0,150),
 notes:["Original third-party URLs stored as provenance are NOT automatically hotlinks when recognized by active client-side image router.","Unknown domains, missing images and CDN failures are listed explicitly.","Sets still pending or in progress, unscoped promotional products and pack images are outside this completed-set audit."]
};
const out="data/audits/completed-all-sets-image-selfhost-20261013.json";
fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({totals,setsWithIssues:perSet.filter(s=>!s.completeSelfHosted).map(s=>({set:s.set,missing:s.missing,unroutable:s.unroutable,cdnFailed:s.cdnFailed,examples:s.examples.slice(0,3),failures:s.cdnFailures.slice(0,3)}))},null,2));
