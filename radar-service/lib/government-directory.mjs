// Public-data store-location *candidates*. Never represents inventory, live stock, or
// the retailer's own store code. A government business registry is not a TCG inventory feed.
import {distanceKm} from "./radar-query.mjs";

export const GOV_DIRECTORY_SOURCE="https://www.data.go.kr/data/15012005/openapi.do";
export const GOV_DIRECTORY_ENDPOINT="https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius";
const MAX_RADIUS_METERS=2000;
const MAX_ROWS=1000;
const cache=new Map();

const vendors=[
  ["emart24","convenience",/^(?:이마트24|emart\s*24)\b?/i],
  ["seveneleven","convenience",/^(?:세븐일레븐|7\s*eleven|seven\s*eleven)/i],
  ["gs25","convenience",/^gs\s*25/i],
  ["cu","convenience",/^(?:cu(?=[^a-z]|$)|씨유)/i],
  ["traders","mart",/^(?:트레이더스|traders)\b?/i],
  ["lottemart","mart",/^(?:롯데마트|lotte\s*mart)/i],
  ["homeplus","mart",/^(?:홈플러스|home\s*plus)/i],
  ["costco","mart",/^(?:코스트코|costco)/i],
  ["hanaro","mart",/^(?:하나로마트|농협하나로마트|nh\s*hanaro)/i],
  ["emart","mart",/^(?:이마트(?!24)|e[\s-]?mart(?!\s*24))/i]
];
export function recognizedGovernmentStore(raw) {
  if(!raw || typeof raw!=="object")return null;
  const name=String(raw.bizesNm||"").trim().slice(0,100);
  const id=String(raw.bizesId||"").trim().slice(0,50);
  const lat=Number(raw.lat),lng=Number(raw.lon);
  if(!id || !/^[a-zA-Z0-9-]{3,50}$/.test(id) || !name ||
    !Number.isFinite(lat)||!Number.isFinite(lng)||
    lat<33||lat>39.5||lng<124||lng>132)return null;
  const vendor=vendors.find(([, ,pattern])=>pattern.test(name));
  if(!vendor)return null;
  const [retailerId,kind]=vendor;
  return {id:"public:"+id,storeId:null,retailerId,kind,name,lat,lng,
    address:String(raw.rdnmAdr||raw.lnoAdr||"").trim().slice(0,160),
    origin:"government-business-registry",locationStatus:"candidate",
    stockStatus:"unknown",items:[]};
}
export function normalizeGovernmentPayload(payload,{lat,lng,radiusKm,kind="all",retailer="all"}){
  const data=payload?.response;
  const header=data?.header;
  if(!header||String(header.resultCode)!=="00")throw Error("GOV_API_ERROR");
  const body=data.body;
  if(!body||typeof body!=="object")throw Error("GOV_INVALID_BODY");
  let items=body.items?.item ?? body.items ?? [];
  if(items===null)items=[];
  if(!Array.isArray(items))items=[items];
  const claimed=Number(body.totalCount);
  const limited=!Number.isSafeInteger(claimed)||claimed>items.length ||
    radiusKm>MAX_RADIUS_METERS/1000;
  const seen=new Set(),result=[];
  for(const row of items.slice(0,MAX_ROWS)){
    const store=recognizedGovernmentStore(row);
    if(!store||seen.has(store.id)||
      (kind!=="all"&&kind!==store.kind)||
      (retailer!=="all"&&retailer!==store.retailerId)||
      distanceKm({lat,lng},store)>Math.min(radiusKm,2)+.02)continue;
    seen.add(store.id);
    result.push(store);
    if(result.length>=250)break;
  }
  return {status:"ok",source:"government-business-registry",
    license:"Public Data Portal: no use restrictions (confirm applicable terms)",
    sourceUrl:GOV_DIRECTORY_SOURCE,
    sourceYearMonth:String(header.stdrYm||"").slice(0,6),
    observedStock:false,inventoryStatus:"unknown",
    queriedRadiusKm:Math.min(radiusKm,2),requestedRadiusKm:radiusKm,
    coverageLimited:limited||result.length===250,count:result.length,stores:result};
}
export async function queryGovernmentDirectory({lat,lng,radiusKm,kind="all",retailer="all"},
  {serviceKey=process.env.RADAR_GOV_BUSINESS_API_KEY,fetchImpl=fetch,now=Date.now()}={}){
  if(typeof serviceKey!=="string"||!serviceKey.trim()){
    return {status:"not_configured",source:"government-business-registry",
      sourceUrl:GOV_DIRECTORY_SOURCE,stores:[],count:0,coverageLimited:true,
      note:"정부 상가 위치 API 키가 아직 등록되지 않았습니다. 지도 검색은 기존 공급원으로 계속됩니다."};
  }
  if(!Number.isFinite(lat)||lat<33||lat>39.5||!Number.isFinite(lng)||
    lng<124||lng>132||!Number.isFinite(radiusKm)||radiusKm<=0||radiusKm>10)
    throw Error("GOV_SEARCH_INVALID");
  if(!["all","mart","convenience","cardshop"].includes(kind))throw Error("GOV_INVALID_KIND");
  if(!["all",...vendors.map(v=>v[0])].includes(retailer))throw Error("GOV_INVALID_RETAILER");
  if(kind==="cardshop")return {status:"ok",source:"government-business-registry",
    stores:[],count:0,coverageLimited:false,sourceUrl:GOV_DIRECTORY_SOURCE,
    note:"정부 매장 보강 조회는 편의점과 마트에 한정합니다."};
  const cacheId=[lat.toFixed(3),lng.toFixed(3),radiusKm.toFixed(2),kind,retailer].join("|");
  const previous=cache.get(cacheId);
  if(previous&&previous.until>now)return previous.value;
  const params=new URLSearchParams({
    serviceKey:serviceKey.trim(),radius:String(Math.min(MAX_RADIUS_METERS,Math.ceil(radiusKm*1000))),
    cx:lng.toFixed(6),cy:lat.toFixed(6),numOfRows:String(MAX_ROWS),
    pageNo:"1",type:"json"
  });
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),12500);
  try{
    const response=await fetchImpl(GOV_DIRECTORY_ENDPOINT+"?"+params.toString(),{
      method:"GET",headers:{Accept:"application/json"},signal:abort.signal
    });
    if(!response.ok)throw Error("GOV_UPSTREAM_HTTP_"+response.status);
    const data=await response.json();
    const result=normalizeGovernmentPayload(data,{lat,lng,radiusKm,kind,retailer});
    cache.set(cacheId,{until:now+600000,value:result});
    if(cache.size>100)cache.clear();
    return result;
  }finally{clearTimeout(timer);}
}
