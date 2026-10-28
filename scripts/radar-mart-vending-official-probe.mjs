// One-shot public web route verification; no retailer authentication or IP bypass.
const endpoints=[
  {label:"lotte_store_options",url:"https://company.lottemart.com/mobiledowa/inc/asp/search_market_list.asp?p_area=%EC%84%9C%EC%9A%B8&p_type=2"},
  {label:"lotte_product_search",url:"https://company.lottemart.com/mobiledowa/product/search_product.asp",
    method:"POST",body:new URLSearchParams({p_area:"서울",p_market:"2301",p_schWord:"포켓몬"})},
  {label:"emart_lookup",url:"https://eapp.emart.com/webapp/product/search"},
  {label:"pokemon_official_vending",url:"https://pokemonkorea.co.kr/card_vending_machine"}
];
for(const endpoint of endpoints){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),9500);
  const start=Date.now();
  const result={label:endpoint.label,status:"error",httpStatus:null,bytes:0};
  try{
    const response=await fetch(endpoint.url,{method:endpoint.method||"GET",
      body:endpoint.body,headers:{"Accept":"text/html",
      ...(endpoint.body?{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}:{})},
      signal:controller.signal,redirect:"follow"});
    const body=(await response.text()).slice(0,100000);
    result.httpStatus=response.status;
    result.bytes=body.length;
    result.contentType=response.headers.get("content-type");
    result.containsSearchProduct=/포켓몬|재고|상품|입고/.test(body);
    result.optionsCount=(body.match(/<option\b/gi)||[]).length;
    result.listCount=(body.match(/<li\b/gi)||[]).length;
    result.vendingMachineCount=/178개|자판기/.test(body);
    if(endpoint.label==="pokemon_official_vending"||endpoint.label==="emart_lookup"){
      result.scripts=[...body.matchAll(/<script[^>]+src=["']([^"']+)/g)]
        .map(x=>x[1]).filter(x=>!x.startsWith("https://www.google")).slice(0,25);
      result.apiHints=[...body.matchAll(/.{0,40}(?:vending|machine|store|api|marker|findMap|searchProduct).{0,65}/gi)]
        .map(x=>x[0].replace(/<[^>]*>/g," ").trim()).slice(0,30);
      result.hasInlineStoreData=/롯데마트.*김포공항|위도|longitude|latitude|storeList/.test(body);
    }
    result.status=response.ok?"response":"http_error";
  }catch(e){result.errorType=e.name;result.status=e.name==="AbortError"?"timeout":"network_error"}
  finally{clearTimeout(timer);result.ms=Date.now()-start;console.log("MART_VENDING_PUBLIC_CHECK",JSON.stringify(result))}
}

const jsonUrl="https://calendar-1ut.pages.dev/scripts/venderlist.json";
const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),11000);
try{
 const response=await fetch(jsonUrl,{signal:abort.signal});
 const text=await response.text();
 const data=JSON.parse(text);
 const arr=Array.isArray(data)?data:Array.isArray(data.stores)?data.stores:
   Array.isArray(data.locations)?data.locations:Array.isArray(data.data)?data.data:[];
 console.log("OFFICIAL_VENDING_JSON",JSON.stringify({
  status:response.status,contentType:response.headers.get("content-type"),
  cors:response.headers.get("access-control-allow-origin"),
  bytes:text.length,topKeys:Object.keys(data).slice(0,15),count:arr.length,
  example:arr.slice(0,2),
  latitudeCount:arr.filter(x=>
    Number.isFinite(Number(x.latitude??x.lat??x.y??x.coordinate?.lat))).length
 }));
}catch(e){console.log("OFFICIAL_VENDING_JSON",JSON.stringify({
 status:"error",errorType:e.name,message:String(e.message||"").slice(0,90)
}))}finally{clearTimeout(timer)}
