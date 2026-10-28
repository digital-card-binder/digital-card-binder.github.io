// Minimal first-party reachability probe executed in the deployment's own region.
// Never exposes stock values, product names, session cookies or upstream HTML.
// Fixed low-volume official customer-site URLs only; no proxy/access bypass.
const TARGETS=Object.freeze([
  {id:"lottemart_home",url:"https://company.lottemart.com/mobiledowa/",method:"GET"},
  {id:"lottemart_store_directory",url:"https://company.lottemart.com/mobiledowa/inc/asp/search_market_list.asp?p_area=%EC%84%9C%EC%9A%B8&p_type=1",method:"GET"},
  {id:"lottemart_product_search",url:"https://company.lottemart.com/mobiledowa/product/search_product.asp",method:"POST",
    body:"p_area=%EC%84%9C%EC%9A%B8&p_market=2301&p_schWord=%ED%8F%AC%EC%BC%93%EB%AA%AC%EC%B9%B4%EB%93%9C"},
  {id:"emart_app_search",url:"https://eapp.emart.com/webapp/product/search",method:"GET"}
]);
let last=null;
export async function readMartConnectivity({fetcher=fetch,now=()=>Date.now(),
  timeoutMs=4800,cache=true}={}){
  const start=now();
  if(cache&&fetcher===fetch&&last&&last.expiresAt>start)
    return {...last.data,cached:true};
  const checks=await Promise.all(TARGETS.map(async target=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    const entry={source:target.id,status:"unknown",httpStatus:null,
      storeOptions:0,productRows:0,stockLabels:0,elapsedMs:0};
    const at=Date.now();
    try{
      const response=await fetcher(target.url,{
        method:target.method,signal:controller.signal,redirect:"follow",
        headers:{"Accept":"text/html, */*;q=0.1",
          ...(target.method==="POST"?{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}:{})},
        ...(target.body?{body:target.body}:{}),
      });
      entry.httpStatus=response.status;
      if(!response.ok){entry.status="http_error";return entry;}
      const raw=typeof response.arrayBuffer==="function"?
        new Uint8Array(await response.arrayBuffer()):new TextEncoder().encode(await response.text());
      if(raw.byteLength>800000){entry.status="oversized_response";return entry;}
      const type=response.headers?.get?.("content-type")||"";
      const label=/(euc-kr|cp949|ks_c_5601-1987)/i.test(type)?"euc-kr":"utf-8";
      const body=new TextDecoder(label).decode(raw);
      entry.status="reached";
      entry.storeOptions=(body.match(/<option\\b[^>]*value=["']\\d{3,8}["']/gi)||[]).length;
      entry.productRows=(body.match(/<div\\b[^>]*class=["'][^"']*\\bprod-box\\b/gi)||[]).length;
      entry.stockLabels=(body.match(/<th\\b[^>]*>\\s*(?:[ㆍ·•]\\s*)?재고\\s*:/gi)||[]).length;
      // Counts describe the response markup, not actual stock or a card SKU match.
      return entry;
    }catch(error){
      entry.status=controller.signal.aborted||error?.name==="AbortError"?"timeout":"network_error";
      return entry;
    }finally{clearTimeout(timer);entry.elapsedMs=Date.now()-at;}
  }));
  const data={schemaVersion:1,status:"diagnostics_only",region:process.env.VERCEL_REGION||"unknown",
    checkedAt:new Date(start).toISOString(),cached:false,checks,
    stockQuantityConnected:false,
    note:"연결 상태 진단만 수행합니다. 재고 수량을 읽어 공개하거나 0개로 간주하지 않습니다."};
  if(cache&&fetcher===fetch)last={expiresAt:start+10*60*1000,data};
  return data;
}
