// Independent Emart24 first-party *proof of concept*.
// This is a read-only integration of public customer web responses, NOT a
// license to redistribute vendor inventory. See API's disabled-by-default gate.
const STORE_BASE="https://emart24.co.kr";
const STOCK_BASE="https://everse.emart24.co.kr";
const HEADERS=Object.freeze({"Accept":"application/json, text/plain, */*",
  "X-Requested-With":"XMLHttpRequest"});
const CACHE_MS=30_000;
const cache=new Map();

function fail(code) {
  const error=new Error(code);
  error.code=code;
  throw error;
}
function assertText(value,max=60){
  if(typeof value!=="string" || value.trim().length<2 ||
     value.length>max || /[<>\u0000-\u001f]/.test(value))fail("INVALID_KEYWORD");
  return value.trim();
}
function normalize(text){
  return String(text||"").normalize("NFKC").toLowerCase()
    .replace(/[\s_·\/\-()「」\[\]]+/g,"");
}
function productUnit(name){
  const value=String(name||"").normalize("NFKC");
  if(/박스|\bbox\b|\d+\s*팩\s*입/i.test(value))return "box";
  if(/스타트(?:덱|세트)|스타터(?:덱|세트)|구축덱/i.test(value))return "deck";
  if(/스페셜(?:카드)?세트/i.test(value))return "set";
  if(/확장팩|부스터|하이클래스|강화팩|카드팩/i.test(value))return "pack";
  return "unknown";
}
function cardProduct(name){
  const value=String(name||"");
  return /포켓몬/.test(value)&&
    /카드|스타트|스타터|확장팩|부스터/.test(value)&&
    !/빵|스티커|띠부씰|키링|슬리브|교통카드|봉제|피규어|간식|금액권/.test(value);
}
function geodistance(lat1,lng1,lat2,lng2){
  const rad=x=>x*Math.PI/180;
  const dlat=rad(lat2-lat1),dlng=rad(lng2-lng1);
  const a=Math.sin(dlat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dlng/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
export function parseEmart24OriginalStoreDirectory(data,{lat,lng,radiusKm=10,limit=20}){
  if(!data||data.error!==0||!Array.isArray(data.data))
    fail("STORE_RESPONSE_INVALID");
  return data.data.flatMap(row=>{
    const code=String(row?.CODE??"").trim(),name=String(row?.TITLE??"").trim();
    const latitude=Number(row?.LATITUDE),longitude=Number(row?.LONGITUDE);
    if(!/^\d{3,8}$/.test(code)||!name||
      !Number.isFinite(latitude)||!Number.isFinite(longitude)||
      latitude<33||latitude>39.5||longitude<124||longitude>132)return [];
    const distanceKm=geodistance(lat,lng,latitude,longitude);
    if(distanceKm>radiusKm+.02)return [];
    return [{storeCode:code,name:name.slice(0,90),
      address:String(row?.ADDRESS||"").slice(0,130),
      lat:latitude,lng:longitude,distanceKm:Math.round(distanceKm*100)/100}];
  }).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,limit);
}
export function parseEmart24OriginalProducts(data,keyword,unit=null){
  if(!data||!Array.isArray(data.productList))fail("PRODUCT_RESPONSE_INVALID");
  const q=normalize(keyword);
  const matches=data.productList.flatMap(row=>{
    const pluCd=String(row?.pluCd||"").trim();
    const name=String(row?.goodsNm||"").trim();
    if(!/^\d{8,14}$/.test(pluCd)||!cardProduct(name)||
      !normalize(name).includes(q))return [];
    if(unit&&productUnit(name)!==unit)return [];
    return [{pluCd,name:name.slice(0,110),unit:productUnit(name)}];
  });
  return [...new Map(matches.map(p=>[p.pluCd,p])).values()];
}
export function parseEmart24OriginalStock(data,product,stores,checkedAt){
  if(!data||typeof data!=="object"||
    !data.storeGoodsInfo||typeof data.storeGoodsInfo!=="object"||
    String(data.storeGoodsInfo.pluCd||"")!==product.pluCd||
    String(data.storeGoodsInfo.goodsNm||"").trim()!==product.name||
    !Array.isArray(data.storeGoodsQty))fail("STOCK_RESPONSE_INVALID");
  const allowed=new Map(stores.map(s=>[s.storeCode,s]));
  const results=[];
  const seen=new Set();
  for(const row of data.storeGoodsQty){
    const storeCode=String(row?.BIZNO??"").trim();
    const store=allowed.get(storeCode);
    if(!store||seen.has(storeCode))continue;
    seen.add(storeCode);
    // Missing/null/blank/negative/decimal values are unknown, NOT sold out.
    const raw=row?.BIZQTY;
    if(raw===null||raw===undefined||raw==="")continue;
    const quantity=typeof raw==="number"?raw:
      typeof raw==="string"&&/^\d+$/.test(raw.trim())?Number(raw.trim()):NaN;
    if(!Number.isSafeInteger(quantity)||quantity<0)continue;
    results.push({...store,product:{...product},quantity,checkedAt,
      status:quantity>0?"positive":"confirmed_zero",
      source:"emart24-first-party-customer-web"});
  }
  return results;
}
export function validateEmart24OriginalQuery(params={}){
  const productKeyword=assertText(params.productKeyword,60);
  const storeKeyword=assertText(params.storeKeyword,45);
  const lat=Number(params.lat),lng=Number(params.lng);
  const radiusKm=params.radiusKm===undefined?10:Number(params.radiusKm);
  const limit=params.limit===undefined?15:Number(params.limit);
  const unit=params.unit===undefined||params.unit===""?null:String(params.unit);
  if(!Number.isFinite(lat)||lat<33||lat>39.5||
     !Number.isFinite(lng)||lng<124||lng>132||
     ![1,3,5,10].includes(radiusKm)||!Number.isInteger(limit)||
     limit<1||limit>20||unit&&!["pack","box","deck","set"].includes(unit))
     fail("INVALID_SEARCH_PARAMETERS");
  return {productKeyword,storeKeyword,lat,lng,radiusKm,limit,unit};
}
async function fetchOfficialJson(path,{base=STOCK_BASE,method="GET",body,fetcher=fetch}={}){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),4000);
  try{
    const response=await fetcher(base+path,{method,
      headers:{...HEADERS,...(body?{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}:{})},
      ...(body?{body:body.toString()}:{}),redirect:"follow",signal:ctrl.signal});
    if(!response.ok)fail("UPSTREAM_HTTP_"+response.status);
    const type=response.headers.get("content-type")||"";
    if(!/json/i.test(type))fail("UPSTREAM_CONTENT_TYPE");
    return await response.json();
  }finally{clearTimeout(timer)}
}
export async function queryEmart24Original(input,{fetcher=fetch,now=()=>Date.now()}={}){
  const q=validateEmart24OriginalQuery(input);
  const key=JSON.stringify(q),cached=cache.get(key);
  if(cached && cached.expiresAt>now())return {...cached.data,cacheHit:true};
  const storeParams=new URLSearchParams({page:"1",search:q.storeKeyword});
  const storesRaw=await fetchOfficialJson("/api1/store?"+storeParams,{base:STORE_BASE,fetcher});
  const stores=parseEmart24OriginalStoreDirectory(storesRaw,q);
  const total=Number(storesRaw.count)||0;
  if(!stores.length)return {source:"emart24-official-customer-web",
    checkedAt:new Date(now()).toISOString(),status:"no_nearby_store",
    coverageLimited:total>storesRaw.data.length,stores:[],products:[],
    cacheHit:false};
  const form=new URLSearchParams({currentPage:"1",pageCnt:"20",
    sortType:"SALE",saleProductYn:"N",searchWord:q.productKeyword});
  const productRaw=await fetchOfficialJson("/stock/stock/search",
    {method:"POST",body:form,fetcher});
  const products=parseEmart24OriginalProducts(productRaw,q.productKeyword,q.unit);
  // If a keyword selects multiple distinct retail PLUs, never silently choose
  // an arbitrary item: a client must request a more specific product keyword.
  if(products.length!==1)return {source:"emart24-official-customer-web",
    checkedAt:new Date(now()).toISOString(),status:products.length?"ambiguous_product":"product_not_found",
    stores:[],products,coverageLimited:Number(productRaw.totalCnt)>productRaw.productList.length,
    cacheHit:false};
  const product=products[0];
  const stockParams=new URLSearchParams({searchPluCode:product.pluCd,
    bizNoArr:stores.map(s=>s.storeCode).join(",")});
  const stockRaw=await fetchOfficialJson("/api/stock/v3/stock-search/store?"+stockParams,{fetcher});
  const checkedAt=new Date(now()).toISOString();
  const rows=parseEmart24OriginalStock(stockRaw,product,stores,checkedAt);
  const output={source:"emart24-official-customer-web",checkedAt,
    status:"observed",product,stores:rows,
    // Unreturned stores are unknown. Never synthesize 0.
    unknownStoreCount:stores.length-rows.length,
    coverageLimited:Number(productRaw.totalCnt)>productRaw.productList.length||
      total>storesRaw.data.length,
    cacheHit:false};
  if(cache.size>100)cache.clear();
  cache.set(key,{expiresAt:now()+CACHE_MS,data:output});
  return output;
}
