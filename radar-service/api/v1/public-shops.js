// Read-only, optional public government business-directory lookup.
// Credential stays server-side. Never changes Firestore or claims inventory.
import {parseSearchQuery} from "../../lib/radar-query.mjs";
import {queryGovernmentDirectory} from "../../lib/government-directory.mjs";
import {allowGet,send} from "../../lib/http.mjs";

export default async function handler(req,res){
  if(!allowGet(req,res))return;
  let query;
  try{query=parseSearchQuery(req.query||{});}
  catch{ return send(res,400,{error:"INVALID_SEARCH_PARAMETERS"}); }
  try{
    const result=await queryGovernmentDirectory(query);
    return send(res,200,{schemaVersion:1,...result});
  }catch(error){
    // Never log upstream URLs: they contain the protected public-data API key.
    console.error("radar_government_directory_unavailable",
      String(error?.message||"unavailable").replace(/servicekey\s*=\s*\S+/gi,"[redacted]").slice(0,110));
    return send(res,503,{schemaVersion:1,status:"unavailable",
      source:"government-business-registry",coverageLimited:true,stores:[],
      note:"공공 상가 정보 요청에 실패했습니다. 미조회 매장은 재고 없음이 아닙니다."});
  }
}
