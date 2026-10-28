// First-party Emart24 inventory adapter. Off until retailer data-use terms
// permit third-party display and operator approves production enablement.
import {allowGet,send} from "../../lib/http.mjs";
import {queryEmart24Original} from "../../lib/emart24-original.mjs";
export default async function handler(req,res){
  if(!allowGet(req,res))return;
  if(process.env.RADAR_EMART24_DIRECT_PUBLISH!=="1")
    return send(res,503,{status:"unavailable",
      error:"DATA_USE_APPROVAL_REQUIRED",
      note:"원본 조회 연동은 검증 중이며 현재 수량을 재게시하지 않습니다."});
  try{
    const data=await queryEmart24Original(req.query||{});
    return send(res,200,{schemaVersion:1,...data});
  }catch(error){
    const code=String(error?.code||error?.message||"UNKNOWN");
    if(["INVALID_SEARCH_PARAMETERS","INVALID_KEYWORD"].includes(code))
      return send(res,400,{error:code});
    console.error("emart24_original_error",code.slice(0,70));
    return send(res,503,{error:"UPSTREAM_UNAVAILABLE",
      note:"매장 또는 재고가 확인되지 않았습니다. 미확인은 품절이 아닙니다."});
  }
}
