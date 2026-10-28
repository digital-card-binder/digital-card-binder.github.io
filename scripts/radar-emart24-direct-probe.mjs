// Read-only official Emart24 customer interface verification.
// One known public product/branch pair, plus official product catalogue.
// No login, session replay, proxy/bypass, data export or periodic polling.
const base="https://everse.emart24.co.kr";
const productKeyword="조로아&조로아크";
const expectedPlu="8800286279914";
const bizNo="27927";
const now=new Date().toISOString();
const headers={"Accept":"application/json, text/plain, */*",
  "X-Requested-With":"XMLHttpRequest"};
async function inspect(name,path,opts={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),9000);
  try{
    const r=await fetch(base+path,{...opts,headers:{...headers,...opts.headers},signal:controller.signal});
    const body=(await r.text()).slice(0,200000);
    let data=null;try{data=JSON.parse(body)}catch{}
    const summary={name,status:r.status,ok:r.ok,contentType:r.headers.get("content-type"),
      keys:data&&typeof data==="object"?Object.keys(data).slice(0,14):[],
      bodyType:typeof data};
    if(name==="catalog"){
      const products=Array.isArray(data?.productList)?data.productList:[];
      summary.matched=products.filter(x=>/조로아/.test(x.goodsNm||"")).map(x=>({
        pluCd:x.pluCd,productName:x.goodsNm})).slice(0,3);
      summary.count=products.length;
    }else{
      const goods=data?.storeGoodsInfo;
      const rows=Array.isArray(data?.storeGoodsQty)?data.storeGoodsQty:null;
      summary.goodsInfoType=typeof goods;
      summary.goodsPlu=goods?.pluCd??null;
      summary.goodsName=goods?.goodsNm??null;
      summary.stockShape=rows?"array":data?.storeGoodsQty===null?"null":typeof data?.storeGoodsQty;
      summary.qtyRows=rows?.length??null;
      const matched=rows?.find(x=>String(x?.BIZNO)===bizNo);
      summary.matchedStore=Boolean(matched);
      summary.matchedStoreQty=matched?.BIZQTY??null;
      summary.productMatched=String(goods?.pluCd||"")===expectedPlu;
    }
    console.log("EMART24_DIRECT_V3_CHECK",JSON.stringify({...summary,checkedAt:now}));
  }catch(e){console.log("EMART24_DIRECT_V3_CHECK",JSON.stringify({name,error:e?.name||"unknown",checkedAt:now}));}
  finally{clearTimeout(timer)}
}
await inspect("catalog","/stock/stock/search",{method:"POST",
  headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
  body:new URLSearchParams({currentPage:"1",pageCnt:"20",sortType:"SALE",
    saleProductYn:"N",searchWord:productKeyword})});
for(const version of ["v3"]){
 const q=new URLSearchParams({searchPluCode:expectedPlu,bizNoArr:bizNo});
 await inspect("stock_"+version,"/api/stock/"+version+"/stock-search/store?"+q);
}
