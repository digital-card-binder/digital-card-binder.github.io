import {radarDatabase,fetchNearbyStores} from "../../lib/db.mjs";
import {parseSearchQuery,buildSearchResponse} from "../../lib/radar-query.mjs";
import {send,allowGet} from "../../lib/http.mjs";
export default async function handler(req,res){
  if(!allowGet(req,res))return;
  let query;
  try{query=parseSearchQuery(req.query||{});}
  catch(_){return send(res,400,{error:"INVALID_SEARCH_PARAMETERS"});}
  try {
    const db=radarDatabase();
    const result=await fetchNearbyStores(db,query.lat,query.lng,query.radiusKm);
    return send(res,200,buildSearchResponse(result.stores,query,
      {sourceTruncated:result.coverageLimited}));
  } catch(error){
    console.error("radar_store_search_unavailable",String(error?.message||"unknown").slice(0,80));
    return send(res,503,{error:"RADAR_DB_UNAVAILABLE",dbStatus:"unavailable",
      message:"독립 재고 DB가 아직 개설되지 않았거나 일시적으로 이용할 수 없습니다."});
  }
}
