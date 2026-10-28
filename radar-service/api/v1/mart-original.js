// Original Lotte Mart/Toys R Us inventory adapter, DISABLED by default.
// Real stock cannot be exposed without approval and exact store/SKU verification.
import {send,allowGet} from "../../lib/http.mjs";
import {queryLotteMartOfficial,EMART_OFFICIAL_STATUS} from "../../lib/mart-first-party.mjs";
export default async function handler(req,res){
  if(!allowGet(req,res))return;
  const retailer=String(req.query?.retailer||"lottemart");
  if(retailer==="emart")
    return send(res,503,{status:"unknown",error:"RETAILER_INVENTORY_UNAVAILABLE",
      ...EMART_OFFICIAL_STATUS});
  if(retailer!=="lottemart"&&retailer!=="toysrus")
    return send(res,400,{error:"INVALID_RETAILER"});
  if(process.env.RADAR_MART_DATA_USE_APPROVED!=="1"||
     process.env.RADAR_LOTTEMART_DIRECT_PUBLISH!=="1")
    return send(res,503,{status:"unknown",
      error:"DATA_USE_APPROVAL_REQUIRED",
      note:"롯데마트 공식 조회 연결 검증 중입니다. 미확인은 재고 0개가 아닙니다."});
  try{
    const data=await queryLotteMartOfficial(req.query||{});
    if(retailer==="toysrus" && data.stores.some(s=>s.brand!=="toysrus"))
      return send(res,503,{status:"unknown",error:"BRAND_MISMATCH"});
    return send(res,200,{schemaVersion:1,...data});
  }catch(error){
    const code=String(error?.code||error?.message||"unknown");
    if(code==="INVALID_MART_QUERY")return send(res,400,{error:code});
    console.error("mart_firstparty_unavailable",code.slice(0,55));
    return send(res,503,{status:"unknown",error:"MART_SOURCE_UNAVAILABLE",
      note:"점포별 재고를 확인하지 못했습니다. 품절로 간주하지 않습니다."});
  }
}
