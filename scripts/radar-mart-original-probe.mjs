// One-off read-only official consumer endpoints, no sessions, proxies, or bypass.
const probes=[
  {name:"lottemart_mobile_home",url:"https://company.lottemart.com/mobiledowa/"},
  {name:"lottemart_store_codes",url:"https://company.lottemart.com/mobiledowa/inc/asp/search_market_list.asp?p_area=%EC%84%9C%EC%9A%B8&p_type=1"},
  {name:"lottemart_product_in_store",url:"https://company.lottemart.com/mobiledowa/product/search_product.asp",
    body:new URLSearchParams({p_area:"서울",p_market:"2301",p_schWord:"포켓몬카드"})},
  {name:"emart_official_product_search",url:"https://eapp.emart.com/webapp/product/search"}
];
for(const p of probes){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),7000);
 const start=Date.now(),result={name:p.name,status:"unknown",http:null,bytes:null};
 try{
  const response=await fetch(p.url,{signal:abort.signal,
    ...(p.body?{method:"POST",body:p.body.toString(),
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}}:{}),
    redirect:"follow"});
  result.http=response.status;
  const html=(await response.text()).slice(0,240000);
  result.bytes=html.length;
  result.status=response.ok?"ok":"http_error";
  result.storeCodes=(html.match(/<option\b[^>]*value=["']\d{3,8}["']/gi)||[]).length;
  result.productBlocks=(html.match(/<div\s+class=["']prod-box["']/gi)||[]).length;
  result.stockLabels=(html.match(/재고\s*:/g)||[]).length;
  result.loginOrStoreSelection=/로그인|단골점포|매장선택/i.test(html);
 }catch(e){result.status=e.name==="AbortError"?"timeout":"network_error";result.errorType=e.name}
 finally{clearTimeout(timer);result.ms=Date.now()-start;
  console.log("RADAR_MART_DIRECT_PROBE "+JSON.stringify(result))}
}
