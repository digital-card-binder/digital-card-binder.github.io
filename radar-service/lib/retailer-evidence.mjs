// Offline human-review evidence gate. Never auto-promote public search results.
import {distanceKm} from "./radar-query.mjs";
import {proposeCardProduct} from "./retailer-review.mjs";
const unsafeHosts=new Set(["mcp.aka.page","localhost","127.0.0.1","0.0.0.0"]);
export function isSpecificEvidenceUrl(raw){
  if(typeof raw!=="string" || raw.length<22 || raw.length>700)return false;
  let url;
  try{url=new URL(raw);}catch{return false;}
  if(url.protocol!=="https:" || url.username || url.password ||
    unsafeHosts.has(url.hostname.toLowerCase()) || url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".local") || url.hostname.endsWith(".internal"))return false;
  // The software repository, documentation landing pages and aggregator root
  // do not substantiate an individual point-of-sale SKU or shop identity.
  if(url.hostname==="github.com" &&
    /^\/[^/]+\/[^/]+\/?$/.test(url.pathname))return false;
  if(/^\/?(?:index\.(?:html?|php))?\/?$/i.test(url.pathname))return false;
  if(/^\/(?:docs?|documentation|README|api|search)\/?$/i.test(url.pathname))return false;
  if(url.hostname.endsWith(".github.io") && url.pathname==="/")return false;
  return true;
}
function validatedReviewDate(value,now=Date.now()){
  const t=typeof value==="string"?Date.parse(value):NaN;
  return Number.isFinite(t) && t<=now+60000 && t>0;
}
function present(value){return typeof value==="string"&&value.trim().length>0;}
export function verifyProposedSku(record,product,{now=Date.now()}={}){
  if(!record||!product||!present(record.retailerItemCode) ||
    !present(record.retailerProductName) ||!present(record.productId) ||
    record.productId!==product.productId ||
    !isSpecificEvidenceUrl(record.evidenceUrl) ||
    !validatedReviewDate(record.reviewedAt,now))throw Error("SKU_PRIMARY_EVIDENCE_MISSING");
  const p=proposeCardProduct(record.retailerProductName);
  if(!p.cardCandidate ||(p.suggestedSetId&&p.suggestedSetId!==product.setId))
    throw Error("SKU_NOT_MATCHING_POKEMON_TCG");
  return true;
}
export function verifyProposedStore(record,store,{now=Date.now()}={}){
  if(!record||!store||!present(record.providerStoreId)||
    !present(record.storeId) ||!present(record.providerStoreName) ||
    !isSpecificEvidenceUrl(record.evidenceUrl) ||
    !validatedReviewDate(record.reviewedAt,now))throw Error("STORE_PRIMARY_EVIDENCE_MISSING");
  const lat=record.providerLatitude,lng=record.providerLongitude;
  if(typeof lat!=="number"||typeof lng!=="number"||
    !Number.isFinite(lat)||!Number.isFinite(lng)||
    !Number.isFinite(store.lat)||!Number.isFinite(store.lng) ||
    distanceKm({lat,lng},{lat:store.lat,lng:store.lng})>.16)
    throw Error("STORE_LOCATION_NOT_CORROBORATED");
  return true;
}
