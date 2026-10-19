import assert from "node:assert/strict";
import {test} from "node:test";
import {readFile} from "node:fs/promises";
import {catalogueCandidates,storeCandidates,proposeCardProduct} from
  "../radar-service/lib/retailer-review.mjs";

test("catalogue only flags genuine Pokemon booster TCG, never transit/card merch",()=>{
  for(const name of ["이즐포켓몬교통카드_30주년","포켓몬 캐시비 카드",
    "포켓몬카드 빵 띠부씰","포켓몬 T머니 카드","포켓몬 카드 슬리브",
    "포켓몬카드 기프트카드"])assert.equal(proposeCardProduct(name).cardCandidate,false,name);
  for(const name of ["인페르노X 부스터 팩","포켓몬카드 닌자스피너",
    "포켓몬스터 트레이딩 카드 게임 확장팩","30th CELEBRATION 부스터 박스"])
    assert.equal(proposeCardProduct(name).cardCandidate,true,name);
  assert.equal(proposeCardProduct("포켓몬 카드").cardCandidate,false);
});
test("four convenience stores retain distinct original SKU fields and unverified state",()=>{
  const examples={
    cu:{itemCode:"ITEM-12",itemName:"포켓몬카드 닌자스피너",expected:"ITEM-12"},
    gs25:{itemCode:"GS-345",itemName:"인페르노X 부스터 팩",expected:"GS-345"},
    seveneleven:{itemCd:"SE-111",itemName:"포켓몬카드 닌자스피너",expected:"SE-111"},
    emart24:{pluCd:"8801234567890",goodsName:"30th CELEBRATION 부스터 박스",expected:"8801234567890"}
  };
  for(const [retailerId,record] of Object.entries(examples)){
    const rows=catalogueCandidates(retailerId,[record]);
    assert.equal(rows.length,1,retailerId);
    assert.equal(rows[0].retailerItemCode,record.expected);
    assert.equal(rows[0].automaticallyImportable,false);
    assert.equal(rows[0].identityStatus,"review_required");
    assert.equal(rows[0].stockStatus,"not_checked");
  }
  assert.equal(catalogueCandidates("cu",[{itemCode:"T-1",itemName:"이즐포켓몬교통카드"}]).length,0);
  assert.throws(()=>catalogueCandidates("lottemart",[]),/UNKNOWN_CATALOGUE_SOURCE/);
});
test("vendor store codes and coordinates are candidates, not proven stores or stock",()=>{
  const a=storeCandidates("cu",[
    {storeCode:"cu001",storeName:"CU 팽성남산로점",latitude:36.98,longitude:127.04,stock:40},
    {storeCode:"cu001",storeName:"동일 매장",latitude:36.9801,longitude:127.0401},
    {storeCode:"bad",storeName:"좌표 오류",latitude:0,longitude:0}
  ]);
  assert.equal(a.length,1);
  assert.equal(a[0].providerStoreId,"cu001");
  assert.equal(a[0].locationStatus,"unverified");
  assert.equal(a[0].automaticallyImportable,false);
  assert.equal(Object.hasOwn(a[0],"quantity"),false);
  assert.equal(a[0].stockStatus,"not_checked");
});
test("no source code write path exists in review utility and coverage API is read-only",async()=>{
  const script=await readFile(new URL("../radar-service/scripts/review-retailer-candidates.mjs",
    import.meta.url),"utf8");
  const api=await readFile(new URL("../radar-service/api/v1/coverage.js",
    import.meta.url),"utf8");
  assert.doesNotMatch(script,/radarDatabase|firebase-admin/);
  assert.doesNotMatch(api,/\.set\(|\.create\(|\.update\(|\.delete\(/);
  assert.match(api,/registeredStoreCount/);
  assert.match(api,/verifiedRetailerSkuCount/);
  assert.match(api,/historicalObservationCount/);
});
