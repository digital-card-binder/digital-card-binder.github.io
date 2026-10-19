import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {isSpecificEvidenceUrl,verifyProposedSku,verifyProposedStore} from
  "../radar-service/lib/retailer-evidence.mjs";
import {catalogueCandidates,storeCandidates} from
  "../radar-service/lib/retailer-review.mjs";

const product={productId:"kr-m2-booster-pack",setId:"m2",name:"인페르노X 부스터 팩"};
const store={storeId:"emart-sokcho-1049",lat:38.1910179,lng:128.5957863};
const now=Date.parse("2026-10-19T09:00:00Z");
const sku={
  productId:product.productId,retailerItemCode:"ITEM-777",
  retailerProductName:"인페르노X 부스터 팩",
  evidenceUrl:"https://retailer.example.com/products/ITEM-777",
  reviewedAt:"2026-10-19T08:00:00Z"
};
const alias={
  storeId:store.storeId,providerStoreId:"STORE-7",
  providerStoreName:"이마트 속초점",
  providerLatitude:38.19102,providerLongitude:128.59579,
  evidenceUrl:"https://eapp.emart.com/branch/view.do?id=1049",
  reviewedAt:"2026-10-19T08:00:00Z"
};
test("require exact product-specific proof; GitHub readmes are not retailer SKU evidence",()=>{
  assert.equal(isSpecificEvidenceUrl("https://github.com/hmmhmmhm/daiso-mcp"),false);
  assert.equal(isSpecificEvidenceUrl("https://mcp.aka.page/api/gs25/inventory"),false);
  assert.equal(isSpecificEvidenceUrl("https://retailer.example.com/"),false);
  assert.equal(isSpecificEvidenceUrl("http://retailer.example.com/item/777"),false);
  assert.equal(isSpecificEvidenceUrl("https://retailer.example.com/products/ITEM-777"),true);
  assert.equal(isSpecificEvidenceUrl("https://eapp.emart.com/branch/view.do?id=1049"),true);
});
test("SKU review is strictly set-specific, rejects transit products and future signatures",()=>{
  assert.equal(verifyProposedSku(sku,product,{now}),true);
  assert.throws(()=>verifyProposedSku({...sku,retailerProductName:"이즐 포켓몬 교통카드"},product,{now}),
    /SKU_NOT_MATCHING_POKEMON_TCG/);
  assert.throws(()=>verifyProposedSku({...sku,retailerProductName:"30th CELEBRATION 부스터 박스"},product,{now}),
    /SKU_NOT_MATCHING_POKEMON_TCG/);
  assert.throws(()=>verifyProposedSku({...sku,evidenceUrl:"https://github.com/hmmhmmhm/daiso-mcp"},product,{now}),
    /SKU_PRIMARY_EVIDENCE_MISSING/);
  assert.throws(()=>verifyProposedSku({...sku,reviewedAt:"2099-01-01T00:00:00Z"},product,{now}),
    /SKU_PRIMARY_EVIDENCE_MISSING/);
});
test("store proof must include actual location corresponding to canonical store",()=>{
  assert.equal(verifyProposedStore(alias,store,{now}),true);
  assert.throws(()=>verifyProposedStore({...alias,providerLatitude:37.4},store,{now}),
    /STORE_LOCATION_NOT_CORROBORATED/);
  assert.throws(()=>verifyProposedStore({...alias,providerStoreName:""},store,{now}),
    /STORE_PRIMARY_EVIDENCE_MISSING/);
  assert.throws(()=>verifyProposedStore({...alias,providerLatitude:null},store,{now}),
    /STORE_LOCATION_NOT_CORROBORATED/);
});
test("catalogue candidates never claim generic aggregator link is primary evidence",()=>{
  const cu=catalogueCandidates("cu",[{itemCode:"A-123",itemName:"포켓몬카드 닌자스피너"}]);
  assert.equal(cu.length,1);
  assert.equal(cu[0].primaryEvidenceUrl,null);
  assert.equal(cu[0].automaticallyImportable,false);
  assert.equal(cu[0].sourceUrl,undefined);
  const stores=storeCandidates("cu",[{storeCode:"CU1",storeName:"CU 테스트",
    latitude:37.5,longitude:127.0}]);
  assert.equal(stores.length,1);
  assert.equal(stores[0].primaryEvidenceUrl,null);
});
test("privileged importer now uses the checked evidence validators before Firestore write",async()=>{
  const importer=await readFile(new URL("../radar-service/scripts/import-mappings.mjs",
    import.meta.url),"utf8");
  assert.match(importer,/verifyProposedSku\(s,product\.data\(\)\)/);
  assert.match(importer,/verifyProposedStore\(a,store\.data\(\)\)/);
  assert.match(importer,/RADAR_ALLOW_MAPPING_IMPORT!=="yes"/);
});
