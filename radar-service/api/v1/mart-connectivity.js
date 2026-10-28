// Public read-only service diagnostic: never emits retailer inventory data.
// CDN cache protects the official consumer site from repeat diagnostics.
import {send,allowGet} from "../../lib/http.mjs";
import {readMartConnectivity} from "../../lib/mart-connectivity.mjs";
export default async function handler(req,res){
  if(!allowGet(req,res))return;
  res.setHeader("Cache-Control","public, s-maxage=600, stale-while-revalidate=300");
  try{return send(res,200,await readMartConnectivity());}
  catch(error){
    console.error("mart_connectivity_probe_failed",String(error?.name||"Error"));
    return send(res,503,{schemaVersion:1,status:"diagnostics_unavailable",
      stockQuantityConnected:false});
  }
}
