import test from "node:test";
import assert from "node:assert/strict";
import {
  parseEmart24OriginalStoreDirectory,
  parseEmart24OriginalProducts,
  parseEmart24OriginalStock,
  validateEmart24OriginalQuery,
  queryEmart24Original
} from "../radar-service/lib/emart24-original.mjs";
import handler from "../radar-service/api/v1/emart24-original.js";

const storeRaw={error:0,count:1,data:[{
  CODE:"27927",TITLE:"양양물치항점",LATITUDE:"38.1550682665749",
  LONGITUDE:"128.608094167829",ADDRESS:"강원특별자치도 양양군 강현면 동해대로 3565"
}]};
const productRaw={totalCnt:1,productList:[{pluCd:"8800286279914",
  goodsNm:"포켓몬)포켓몬카드(메가스타터세트 조로아&조로아크ex)"}]};
const stockRaw={storeGoodsInfo:{pluCd:"8800286279914",
 goodsNm:"포켓몬)포켓몬카드(메가스타터세트 조로아&조로아크ex)"},
 storeGoodsQty:[{BIZNO:"27927",BIZQTY:1}],
 myStoreListInfo:[],storeInfo:{}};
const input={productKeyword:"조로아&조로아크",storeKeyword:"양양물치항",
 lat:38.155,lng:128.608,radiusKm:3,unit:"deck"};

test("official store catalog maps the exact shop code and Korean coordinates",()=>{
 const stores=parseEmart24OriginalStoreDirectory(storeRaw,input);
 assert.equal(stores.length,1);
 assert.equal(stores[0].storeCode,"27927");
 assert.equal(stores[0].name,"양양물치항점");
 assert.ok(stores[0].distanceKm<0.1);
});
test("retailer PLU is the unit-specific starter set and not a related product",()=>{
 const found=parseEmart24OriginalProducts(productRaw,input.productKeyword,"deck");
 assert.equal(found.length,1);
 assert.equal(found[0].pluCd,"8800286279914");
 assert.equal(found[0].unit,"deck");
 assert.deepEqual(parseEmart24OriginalProducts(productRaw,input.productKeyword,"box"),[]);
});
test("v3 responses retain positive / genuine zero and never invent unknown zero",()=>{
 const product=parseEmart24OriginalProducts(productRaw,input.productKeyword,"deck")[0];
 const store=parseEmart24OriginalStoreDirectory(storeRaw,input);
 const now="2026-10-28T05:43:35.278Z";
 let r=parseEmart24OriginalStock(stockRaw,product,store,now);
 assert.equal(r.length,1);assert.equal(r[0].quantity,1);
 assert.equal(r[0].status,"positive");assert.equal(r[0].checkedAt,now);
 r=parseEmart24OriginalStock({...stockRaw,storeGoodsQty:[{BIZNO:"27927",BIZQTY:0}]},
   product,store,now);
 assert.equal(r.length,1);assert.equal(r[0].quantity,0);
 assert.equal(r[0].status,"confirmed_zero");
 for(const value of [null,-1,"",undefined,"N/A","2.5"]){
   const rows=parseEmart24OriginalStock({...stockRaw,
     storeGoodsQty:[{BIZNO:"27927",BIZQTY:value}]},product,store,now);
   assert.equal(rows.length,0,"unknown stock must remain unknown: "+String(value));
 }
 assert.equal(parseEmart24OriginalStock({...stockRaw,
   storeGoodsQty:[{BIZNO:"99999",BIZQTY:5}]},product,store,now).length,0);
 assert.throws(()=>parseEmart24OriginalStock({...stockRaw,
   storeGoodsInfo:{...stockRaw.storeGoodsInfo,pluCd:"8800000000000"}},product,store,now),
   /STOCK_RESPONSE_INVALID/);
 assert.throws(()=>parseEmart24OriginalStock({...stockRaw,storeGoodsQty:"1"},
   product,store,now),/STOCK_RESPONSE_INVALID/);
});
test("original lookup validates all user inputs and disallows broad unbounded crawl",()=>{
 assert.equal(validateEmart24OriginalQuery(input).limit,15);
 for(const invalid of [
  {...input,lat:0},{...input,radiusKm:20},{...input,limit:1000},
  {...input,productKeyword:"<script>alert(1)</script>"},
  {...input,storeKeyword:"x"},{...input,unit:"dozen"}
 ])assert.throws(()=>validateEmart24OriginalQuery(invalid));
});
test("bounded first-party live adapter queries exactly official store/catalog/v3 stock",async()=>{
 const called=[];
 const mock=async (url,options={})=>{
   called.push({url,method:options.method});
   const u=new URL(url);
   const data=u.pathname==="/api1/store"?storeRaw:
     u.pathname==="/stock/stock/search"?productRaw:
     u.pathname==="/api/stock/v3/stock-search/store"?stockRaw:null;
   assert.ok(data,"no unknown upstream endpoint may be called: "+u.pathname);
   if(u.pathname.endsWith("/store")&&u.hostname==="everse.emart24.co.kr"){
     assert.equal(u.searchParams.get("searchPluCode"),"8800286279914");
     assert.equal(u.searchParams.get("bizNoArr"),"27927");
   }
   return {ok:true,status:200,headers:{get:()=>"application/json;charset=UTF-8"},
     json:async()=>data};
 };
 const out=await queryEmart24Original(input,{fetcher:mock,
   now:()=>Date.parse("2026-10-28T05:43:35.278Z")});
 assert.equal(called.length,3);assert.equal(out.status,"observed");
 assert.equal(out.source,"emart24-official-customer-web");
 assert.equal(out.stores.length,1);
 assert.equal(out.stores[0].quantity,1);
 assert.equal(out.stores[0].storeCode,"27927");
 assert.equal(out.unknownStoreCount,0);
});
test("public server endpoint is closed until explicit data use approval",async()=>{
 const original=process.env.RADAR_EMART24_DIRECT_PUBLISH;
 delete process.env.RADAR_EMART24_DIRECT_PUBLISH;
 try{
  const headers={};const response={
   setHeader(k,v){headers[k]=v;return this},
   status(n){this.code=n;return this},
   json(data){this.body=data;return this},
   end(){return this}
  };
  await handler({method:"GET",query:input},response);
  assert.equal(response.code,503);
  assert.equal(response.body.error,"DATA_USE_APPROVAL_REQUIRED");
  assert.equal(headers["Access-Control-Allow-Origin"],
   "https://digital-card-binder.github.io");
 }finally{
  if(original!==undefined)process.env.RADAR_EMART24_DIRECT_PUBLISH=original;
 }
});
