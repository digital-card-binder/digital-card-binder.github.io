// Data-only utilities reused by the API and its contract tests.
export const STOCK_TTL_MS = 15 * 60 * 1000;
export const VALID_RETAILERS = Object.freeze(["cu","gs25","seveneleven","emart24","emart","traders","lottemart","homeplus","costco","hanaro"]);
export const MAX_RADIUS_KM = 10;
export const GRID_SCALE = 10; // 0.1 degree buckets (coordinates rounded down; not geohash).
export function gridCell(lat,lng) {
  if(!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180)
    throw new Error("INVALID_COORDINATE");
  return Math.floor(lat*GRID_SCALE)+":"+Math.floor(lng*GRID_SCALE);
}
export function nearbyCells(lat,lng,radiusKm) {
  if(!Number.isFinite(radiusKm)||radiusKm<=0||radiusKm>MAX_RADIUS_KM)
    throw new Error("INVALID_RADIUS");
  const latDelta=radiusKm/110.574;
  const cosine=Math.max(.15,Math.cos(lat*Math.PI/180));
  const lngDelta=radiusKm/(111.32*cosine);
  const cells=[];
  const south=Math.floor((lat-latDelta)*GRID_SCALE),north=Math.floor((lat+latDelta)*GRID_SCALE);
  const west=Math.floor((lng-lngDelta)*GRID_SCALE),east=Math.floor((lng+lngDelta)*GRID_SCALE);
  if((north-south+1)*(east-west+1)>36)throw new Error("RADIUS_TOO_BROAD");
  for(let i=south;i<=north;i++)for(let j=west;j<=east;j++)cells.push(i+":"+j);
  return cells;
}
export function distanceKm(a,b) {
  const toRad=x=>x*Math.PI/180;
  const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lng-a.lng);
  const h=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function parseSearchQuery(query={}) {
  const lat=Number(query.lat),lng=Number(query.lng);
  const radiusKm=query.radiusKm === undefined ? 3 : Number(query.radiusKm);
  const rawLimit=query.limit===undefined ? 100 : Number(query.limit);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)
    throw new Error("INVALID_COORDINATE");
  if(!Number.isFinite(radiusKm)||radiusKm<=0||radiusKm>10)throw new Error("INVALID_RADIUS");
  if(!Number.isInteger(rawLimit)||rawLimit<1||rawLimit>250)throw new Error("INVALID_LIMIT");
  const kind=query.kind||"all";
  if(!["all","mart","convenience","cardshop"].includes(kind))throw new Error("INVALID_KIND");
  const retailer=query.retailer||"all";
  if(retailer!=="all"&&!VALID_RETAILERS.includes(retailer))throw new Error("INVALID_RETAILER");
  const onlyInStock=query.onlyInStock==="1" || query.onlyInStock===true;
  const setId=query.setId===undefined?"":String(query.setId);
  if(setId && !/^[a-z0-9+_-]{1,35}$/i.test(setId))throw new Error("INVALID_SET");
  return {lat,lng,radiusKm,limit:rawLimit,kind,retailer,onlyInStock,setId:setId.toLowerCase()};
}
export function currentItems(items,now=Date.now(),setId=""){
  if(!Array.isArray(items))return [];
  const seen=new Set();
  return items.filter(p=>{
    if(!p || typeof p!=="object" ||
      !Number.isSafeInteger(p.quantity)||p.quantity<0 ||
      typeof p.observedAt!=="string"||typeof p.expiresAt!=="string"||
      typeof p.setId!=="string"||typeof p.productId!=="string"||
      p.sourcePermission!=="approved" ||
      typeof p.licenseReference!=="string"||p.licenseReference.trim().length<8)return false;
    const observed=Date.parse(p.observedAt), expires=Date.parse(p.expiresAt);
    if(!Number.isFinite(observed)||!Number.isFinite(expires)||observed>now+60000||
      now-observed>STOCK_TTL_MS||expires<=now||expires<=observed)return false;
    if(setId && p.setId.toLowerCase()!==setId)return false;
    const unique=p.productId;
    if(seen.has(unique))return false;
    seen.add(unique);
    return true;
  }).map(p=>({productId:p.productId,setId:p.setId,name:String(p.name||"").slice(0,100),
    quantity:p.quantity,observedAt:p.observedAt,sourceId:String(p.sourceId||"").slice(0,60)}));
}
export function selectNearbyStores(rawStores,query,now=Date.now()) {
  const rows=[];
  let truncated=false;
  for(const store of rawStores){
    if(!store || !["mart","convenience","cardshop"].includes(store.kind) ||
      !Number.isFinite(store.lat)||!Number.isFinite(store.lng))continue;
    const dist=distanceKm(query,store);
    if(dist>query.radiusKm+.01||query.kind!=="all"&&store.kind!==query.kind ||
      query.retailer!=="all"&&store.retailerId!==query.retailer)continue;
    const items=currentItems(store.latestStock,now,query.setId);
    if(query.onlyInStock && !items.some(p=>p.quantity>0))continue;
    rows.push({
      storeId:String(store.storeId||"").slice(0,100),
      retailerId:store.retailerId,
      name:String(store.name||"").slice(0,100),
      kind:store.kind,lat:store.lat,lng:store.lng,
      address:String(store.address||"").slice(0,150),
      distanceKm:Math.round(dist*100)/100,
      stockStatus:items.length>0?"observed":"unknown",
      items
    });
  }
  rows.sort((a,b)=>a.distanceKm-b.distanceKm||a.storeId.localeCompare(b.storeId));
  if(rows.length>query.limit)truncated=true;
  return {stores:rows.slice(0,query.limit),filteredCount:rows.length,truncated};
}
export function buildSearchResponse(rawStores,query,{now=Date.now(),dbStatus="connected",sourceTruncated=false}={}) {
  const data=selectNearbyStores(rawStores,query,now);
  return {schemaVersion:2,dbStatus,inventoryCompleteness:"partial",retailerCoverage:"approved_sources_only",
    coverageLimited:Boolean(sourceTruncated||data.truncated),searchRadiusKm:query.radiusKm,
    count:data.stores.length,stores:data.stores,
    note:"매장 후보 수는 전국 점포 수가 아닙니다. 조회 실패·미연동 매장의 수량은 0이 아닌 미확인입니다."};
}
