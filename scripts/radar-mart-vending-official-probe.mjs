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
    result.status=response.ok?"response":"http_error";
  }catch(e){result.errorType=e.name;result.status=e.name==="AbortError"?"timeout":"network_error"}
  finally{clearTimeout(timer);result.ms=Date.now()-start;console.log("MART_VENDING_PUBLIC_CHECK",JSON.stringify(result))}
}
