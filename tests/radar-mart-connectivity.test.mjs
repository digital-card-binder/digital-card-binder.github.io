import test from "node:test";
import assert from "node:assert/strict";
import {readMartConnectivity} from "../radar-service/lib/mart-connectivity.mjs";
const fake=async(url,options)=>{
  if(url.includes("market_list"))return new Response(
    '<option value="2301">강변점</option><option value="5501">토이저러스 테스트점</option>',
    {headers:{"Content-Type":"text/html; charset=utf-8"}});
  if(url.includes("search_product"))return new Response(
    '<li><div class="prod-box"><div class="prod-name">포켓몬 카드팩</div>'+
    '<table><tr><th>ㆍ재고 : </th><td>999개</td></tr></table></li>',
    {headers:{"Content-Type":"text/html; charset=utf-8"}});
  return new Response("<html>official product search</html>",{status:200});
};
test("connectivity checks fixed first-party paths, never copies actual product or stock numbers",async()=>{
  const calls=[];
  const checked=await readMartConnectivity({fetcher:async(u,o)=>{
    calls.push({url:u,method:o.method,body:o.body||""});
    return fake(u,o);
  },cache:false});
  assert.equal(calls.length,4);
  assert.ok(calls.every(c=>new URL(c.url).host==="company.lottemart.com"||
    new URL(c.url).host==="eapp.emart.com"));
  assert.equal(checked.stockQuantityConnected,false);
  assert.equal(checked.checks.find(x=>x.source==="lottemart_store_directory").storeOptions,2);
  assert.equal(checked.checks.find(x=>x.source==="lottemart_product_search").productRows,1);
  assert.equal(checked.checks.find(x=>x.source==="lottemart_product_search").stockLabels,1);
  assert.doesNotMatch(JSON.stringify(checked),/999개|강변점|토이저러스 테스트점|포켓몬 카드팩/);
  assert.equal(calls.find(x=>x.method==="POST").body.includes("p_market=2301"),true);
});
test("upstream access errors are unknown, not zero inventory",async()=>{
  const checked=await readMartConnectivity({fetcher:async(u)=>{
    if(u.includes("search_product"))throw new DOMException("abort","AbortError");
    return new Response("denied",{status:403});
  },cache:false});
  assert.equal(checked.checks.find(x=>x.source==="lottemart_product_search").status,"timeout");
  assert.equal(checked.checks.filter(x=>x.status==="http_error").length,3);
  assert.ok(checked.checks.every(x=>x.productRows===0&&x.storeOptions===0&&x.stockLabels===0));
  assert.equal(checked.stockQuantityConnected,false);
});
