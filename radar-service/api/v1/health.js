import {radarDatabase} from "../../lib/db.mjs";
import {send,allowGet} from "../../lib/http.mjs";
export default async function handler(req,res){
  if(!allowGet(req,res))return;
  try{
    const db=radarDatabase();
    const snap=await db.collection("radarSystem").doc("status").get();
    if(!snap.exists)return send(res,503,{service:"card-radar",dbStatus:"not_seeded",
      stockStatus:"unconnected",note:"DB는 존재할 수 있지만 초기 마스터 등록을 확인하지 못했습니다."});
    return send(res,200,{service:"card-radar",dbStatus:"connected",
      stage:2,stockStatus:"unconnected",seededAt:snap.data()?.seededAt||null});
  }catch(error){
    console.error("radar_health_unavailable",String(error?.message||"unknown").slice(0,80));
    return send(res,503,{service:"card-radar",dbStatus:"unavailable",
      stockStatus:"unconnected"});
  }
}
