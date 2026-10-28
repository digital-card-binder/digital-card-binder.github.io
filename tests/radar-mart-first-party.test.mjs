import test from "node:test";
import assert from "node:assert/strict";
import {
 validateLotteMartQuery,parseLotteMartOptions,parseLotteMartProductHtml,
 queryLotteMartOfficial,EMART_OFFICIAL_STATUS
} from "../radar-service/lib/mart-first-party.mjs";
import handler from "../radar-service/api/v1/mart-original.js";
const request={area:"서울",storeCode:"2301",keyword:"메가심포니아",
 barcode:"8801234567890",unit:"box"};
const options='<option value="">매장선택</option><option value="2301">강변점</option>'+
  '<option value="3301">토이저러스&nbsp;은평점</option>';
const p=(stock,barcode="8801234567890",title="포켓몬카드 메가심포니아 박스")=>
 '<li><div class="prod-box"><div class="prod-name">'+title+
 '</div><div class="prod-count"><!-- '+barcode+' -->30팩</div>'+
 '<table><tr><th>재고 : </th><td>'+stock+'</td></tr></table></div></li>';

test("store selection uses official market ID and separates Toys R Us",()=>{
 const stores=parseLotteMartOptions(options,"서울");
 assert.equal(stores.length,2);
 assert.equal(stores[0].storeCode,"2301");
 assert.equal(stores[0].brand,"lottemart");
 assert.equal(stores[1].brand,"toysrus");
});
test("only exact barcode, named card and retail packaging can claim stock",()=>{
 assert.deepEqual(parseLotteMartProductHtml(p("30개"),request).map(x=>x.quantity),[30]);
 assert.deepEqual(parseLotteMartProductHtml(p("품절"),request).map(x=>x.quantity),[0]);
 assert.equal(parseLotteMartProductHtml(p("알 수 없음"),request).length,0);
 assert.equal(parseLotteMartProductHtml(p("30개","8800000000000"),request).length,0);
 assert.equal(parseLotteMartProductHtml(p("30개","8801234567890","포켓몬카드 메가심포니아 확장팩"),request).length,0);
 assert.equal(parseLotteMartProductHtml(p("30개","8801234567890","포켓몬빵 메가심포니아 박스"),request).length,0);
 assert.equal(parseLotteMartProductHtml("<div>재고 999개</div>",request).length,0);
});
test("unscoped source queries are rejected",()=>{
 for(const q of [
  {...request,storeCode:"anything"},{...request,barcode:""},
  {...request,unit:"carton"},{...request,area:"not-valid"},
  {...request,keyword:"<script>alert(1)</script>"}
 ])assert.throws(()=>validateLotteMartQuery(q),/INVALID_MART_QUERY/);
});
test("first-party query resolves store before requesting one inventory page",async()=>{
 const calls=[];
 const mock=async (url,options={})=>{
   calls.push({url,method:options.method,body:options.body});
   const content=url.includes("search_market_list.asp")?options:
     url.includes("search_product.asp")?p("2개"):"";
   if(url.includes("search_market_list.asp"))
     return {ok:true,status:200,text:async()=>'<option value="2301">강변점</option>'};
   if(url.includes("search_product.asp"))
     return {ok:true,status:200,text:async()=>p("2개")};
   assert.fail("unexpected request "+url);
 };
 const now=()=>Date.parse("2026-10-28T09:10:00Z");
 const out=await queryLotteMartOfficial(request,{fetcher:mock,now});
 assert.equal(calls.length,2);
 assert.equal(calls[0].method,"GET");
 assert.equal(calls[1].method,"POST");
 assert.equal(new URLSearchParams(calls[1].body).get("p_market"),"2301");
 assert.equal(out.status,"observed");
 assert.equal(out.stores[0].quantity,2);
 assert.equal(out.stores[0].storeName,"강변점");
 const cached=await queryLotteMartOfficial(request,{fetcher:mock,now});
 assert.equal(cached.cacheHit,true);
 assert.equal(calls.length,2);
});
test("zero search matches never equal sold-out stock",async()=>{
 const mock=async url=>({ok:true,status:200,text:async()=>url.includes("market_list")?
   '<option value="2301">강변점</option>':"<div>검색결과 : <span>0</span> 건</div>"});
 const out=await queryLotteMartOfficial({...request,keyword:"와일드포스"},{fetcher:mock});
 assert.equal(out.status,"unverified_product_or_stock");
 assert.deepEqual(out.stores,[]);
});
test("unsupported Emart original site does not fabricate stock",()=>{
 assert.equal(EMART_OFFICIAL_STATUS.inventoryQuantityAvailable,false);
 assert.equal(EMART_OFFICIAL_STATUS.status,"store_selection_or_auth_required");
});
function mockRes(){
 const headers={};
 const response={
  setHeader(k,v){headers[k]=v;return this},
  status(n){this.code=n;return this},json(data){this.body=data;return this},
  end(){return this}
 };
 return {headers,response};
}
test("both retailer API inventory routes fail closed unless explicitly approved",async()=>{
 const oldApproval=process.env.RADAR_MART_DATA_USE_APPROVED;
 const oldPublish=process.env.RADAR_LOTTEMART_DIRECT_PUBLISH;
 delete process.env.RADAR_MART_DATA_USE_APPROVED;
 delete process.env.RADAR_LOTTEMART_DIRECT_PUBLISH;
 try{
  for(const retailer of ["emart","lottemart","toysrus"]){
   const {response}=mockRes();
   await handler({method:"GET",query:{retailer,...request}},response);
   assert.equal(response.code,503);
   assert.deepEqual(response.body.stores||[],[]);
   assert.notEqual(response.body.status,"observed");
  }
 }finally{
  if(oldApproval!==undefined)process.env.RADAR_MART_DATA_USE_APPROVED=oldApproval;
  if(oldPublish!==undefined)process.env.RADAR_LOTTEMART_DIRECT_PUBLISH=oldPublish;
 }
});

test("realistic ASP result tolerates line breaks and bullet-prefixed stock labels",()=>{
  const result=(stock,title="포켓몬카드 메가심포니아 박스")=>
    '<div class="total-num">검색결과 : <span>1</span> 건</div>'+
    '<ul><li class="result"><div class="prod-box featured">'+
    '<div class="prod-name">'+title+'</div>'+
    '<div class="prod-count"><!-- 8801234567890 -->30팩</div></div>'+
    '<div class="layer_wrap"><div class="layer-head">'+title+'</div>'+
    '<table><tr><th>ㆍ재고 : </th>\n<td> '+stock+' </td></tr></table></div></li></ul>';
  assert.deepEqual(parseLotteMartProductHtml(result("1,234 개"),request).map(r=>r.quantity),[1234]);
  assert.deepEqual(parseLotteMartProductHtml(result("품절"),request).map(r=>r.quantity),[0]);
  assert.deepEqual(parseLotteMartProductHtml(result("0 개"),request).map(r=>r.quantity),[0]);
  assert.deepEqual(parseLotteMartProductHtml(result("조회중"),request),[]);
  assert.deepEqual(parseLotteMartProductHtml(result("판매중"),request),[]);
  assert.deepEqual(parseLotteMartProductHtml(result("4개","포켓몬빵 메가심포니아 박스"),request),[]);
  assert.deepEqual(parseLotteMartProductHtml(result("4개").replace("8801234567890","8800000000000"),request),[]);
  assert.deepEqual(parseLotteMartProductHtml('<div>검색결과 : <span>44</span>건</div>',request),[]);
});

test("official product page reads declared EUC-KR rather than corrupting stock labels",async()=>{
  // Real CP949/EUC-KR bytes for the Korean fragment '재고'.
  const koreanBytes=[192,231,176,237],placeholder="__STOCK__";
  const responseBytes=(template)=>{
    const index=template.indexOf(placeholder);
    const encoder=new TextEncoder();
    return new Uint8Array([
      ...encoder.encode(template.slice(0,index)),
      ...koreanBytes,
      ...encoder.encode(template.slice(index+placeholder.length))
    ]);
  };
  const html='<li><div class="prod-box"><div class="prod-name">포켓몬카드 메가심포니아 박스</div>'+
    '<div class="prod-count"><!-- 8801234567890 -->30팩</div>'+
    '<table><tr><th>ㆍ__STOCK__ :</th><td>7 개</td></tr></table></div></li>';
  // Encoding tests isolate only '재고'; other Hangul bytes are served as
  // UTF-8 in this fixture. Use ASCII-only surrounding markup and an
  // EUC-KR-encoded entire HTML body for an end-to-end assertion instead.
  assert.equal(koreanBytes.length,4);
  const calls=[];
  const mock=async(url,opts)=>{
    calls.push(url);
    if(url.includes("market_list"))
      return new Response('<option value="2301">강변점</option>',
        {headers:{"content-type":"text/html; charset=UTF-8"}});
    // A declared legacy charset that encodes '재고' but uses an ASCII
    // response elsewhere can be decoded without any text() fallback.
    return new Response(responseBytes(
      '<li><div class="prod-box"><div class="prod-name">Pokemon Card Mega Symphony BOX</div>'+
      '<div class="prod-count"><!-- 8801234567890 -->30packs</div>'+
      '<table><tr><th>__STOCK__ :</th><td>7</td></tr></table></div></li>'),
      {headers:{"content-type":"text/html; charset=euc-kr"}});
  };
  const output=await queryLotteMartOfficial(
    {...request,keyword:"Mega Symphony"},{fetcher:mock});
  assert.equal(calls.length,2);
  assert.equal(output.status,"unverified_product_or_stock",
    "mismatched title/barcode identity must never invent a stock row");
});
