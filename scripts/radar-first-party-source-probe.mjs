// Low-volume read-only diagnostic of FIRST-PARTY customer web sources.
// No Dogam access; no third-party inventory aggregator; no logins, cookies,
// private credentials, browser-fingerprint spoofing or anti-bot bypass.
// Tests source reachability and response shape, not redistribution rights.
const probes=[
  {name:"emart24_product_catalog",url:"https://everse.emart24.co.kr/stock/stock/search",
   method:"POST",form:{currentPage:"1",pageCnt:"10",sortType:"SALE",
    saleProductYn:"N",searchWord:"조로아"}},
  {name:"emart24_stock_by_plu_store",url:"https://everse.emart24.co.kr/api/stock/v2/stock-search/store?"+
    new URLSearchParams({searchPluCode:"8800286279914",bizNoArr:"27927"})},
  {name:"cu_official_stores",url:"https://cu.bgfretail.com/store/list.do?category=store"},
  {name:"lotte_mart_store_options",url:"https://company.lottemart.com/mobiledowa/inc/asp/search_market_list.asp?"+
    new URLSearchParams({p_area:"서울",p_type:"1"})},
  {name:"emart_official_product_page",url:"https://eapp.emart.com/webapp/product/search"}
];
for(const p of probes){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8500);
 const r={name:p.name,status:"unknown",http:null,elapsedMs:null};
 const start=Date.now();
 try{
  const response=await fetch(p.url,{method:p.method||"GET",
   body:p.form?new URLSearchParams(p.form):undefined,
   headers:{Accept:"application/json, text/html;q=0.9",
     ...(p.form?{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8"}:{})},
   signal:abort.signal,redirect:"follow"});
  r.http=response.status;
  const contentType=response.headers.get("content-type")||"";
  r.contentType=contentType.slice(0,80);
  const body=(await response.text()).slice(0,100000);
  r.length=body.length;
  r.status=response.ok?"HTTP_OK":"HTTP_ERROR";
  if(/json/i.test(contentType)||/^[\[{]/.test(body.trim())){
   try{
    const payload=JSON.parse(body);
    r.jsonShape=Array.isArray(payload)?"array":Object.keys(payload).slice(0,12);
    if(p.name==="emart24_product_catalog"){
      r.catalogRows=Array.isArray(payload.productList)?payload.productList.length:null;
      r.validPluRows=Array.isArray(payload.productList)?
        payload.productList.filter(x=>x.pluCd&&x.goodsNm).length:0;
      r.exactProductRows=Array.isArray(payload.productList)?
        payload.productList.filter(x=>/조로아/.test(String(x.goodsNm))).length:0;
    }
    if(p.name==="emart24_stock_by_plu_store"){
      r.stockQtyShape=Array.isArray(payload.storeGoodsQty)?"array":
        payload.storeGoodsQty===null?"null":typeof payload.storeGoodsQty;
      r.stockQtyKeys=payload.storeGoodsQty && !Array.isArray(payload.storeGoodsQty)
        ? Object.keys(payload.storeGoodsQty).slice(0,12):[];
      r.stockRowCount=Array.isArray(payload.storeGoodsQty)?payload.storeGoodsQty.length:null;
      r.validQtyRows=Array.isArray(payload.storeGoodsQty)?
        payload.storeGoodsQty.filter(x=>Number.isFinite(Number(x.BIZQTY))&&x.BIZNO).length:0;
      // No source quantities in logs: expose only shape and presence.
    }
   }catch{r.jsonError=true}
  }else{
   r.loginSeen=/로그인|login/i.test(body);
   r.containsStockTerms=/재고|상품/.test(body);
   r.htmlTitle=(body.match(/<title[^>]*>([^<]*)/i)||[])[1]?.trim().slice(0,70)||"";
  }
 }catch(e){r.status=e.name==="AbortError"?"TIMEOUT":"NETWORK_ERROR";r.errorClass=e.name;}
 finally{clearTimeout(timer);r.elapsedMs=Date.now()-start;console.log("FIRST_PARTY_RADAR_SOURCE",JSON.stringify(r));}
}
