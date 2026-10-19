import assert from "node:assert/strict";
import test from "node:test";
import {publicRetailerMappingCandidates} from
  "../radar-service/lib/public-sku-candidates.mjs";
const checked="2026-10-20T02:00:00.000Z";
const location={storeCode:"CU-31",storeName:"CU 금곡점",latitude:37.352,longitude:127.105};
test("GS25 exposes SKU as a review candidate, not an authorized mapping",()=>{
  const x=publicRetailerMappingCandidates("gs25",{success:true,data:{
    itemCode:"GS251234",product:{name:"포켓몬카드 인페르노X 부스터팩"},
    inventory:{stores:[{...location,storeCode:"GS25-31"}]}
  }},{requestedKeyword:"인페르노X",discoveredAt:checked});
  assert.equal(x.retailerSkus.length,1);
  assert.equal(x.retailerSkus[0].retailerItemCode,"GS251234");
  assert.equal(x.retailerSkus[0].suggestedSetId,"m2");
  assert.equal(x.retailerSkus[0].identityStatus,"review_required");
  assert.equal(x.retailerSkus[0].automaticallyImportable,false);
  assert.equal(x.retailerSkus[0].primaryEvidenceUrl,null);
  assert.equal(x.storeAliases.length,1);
  assert.equal(x.storeAliases[0].locationStatus,"unverified");
  assert.equal(x.stockVerified,false);
});
test("Emart24 selected PLU candidate joins business number and nearby coordinates",()=>{
  const data={
    pluCd:"SKU-999",productCandidates:[
      {pluCd:"SKU-999",goodsName:"포켓몬카드 인페르노X 부스터팩"},
      {pluCd:"SKU-999",goodsName:"포켓몬카드 인페르노X 부스터팩"},
      {pluCd:"SKU-111",goodsName:"포켓몬카드 메가브레이브 부스터팩"}
    ],
    nearbyStores:[{storeCode:"BIZ99",storeName:"이마트24 정자점",
      latitude:37.35,longitude:127.1}],
    stores:[{bizNo:"BIZ99",storeName:"이마트24 정자점",bizQty:5}]
  };
  const x=publicRetailerMappingCandidates("emart24",{success:true,data},{
    requestedKeyword:"인페르노X",discoveredAt:checked});
  assert.equal(x.retailerSkus.length,1);
  assert.equal(x.retailerSkus[0].retailerItemCode,"SKU-999");
  assert.equal(x.retailerSkus[0].stockStatus,"not_checked");
  assert.equal(x.storeAliases.length,1);
  assert.equal(x.storeAliases[0].providerStoreId,"BIZ99");
  assert.equal(x.storeAliases[0].lat,37.35);
  assert.equal(x.storeAliases[0].automaticallyImportable,false);
  assert.equal(Object.hasOwn(x.storeAliases[0],"quantity"),false);
});
test("CU/Seven-Eleven missing provider SKUs produce no fabricated mapping",()=>{
  const cu=publicRetailerMappingCandidates("cu",{success:true,data:{
    nearbyStores:{stockItemName:"포켓몬카드 인페르노X 부스터팩",
      stores:[location]}
  }},{requestedKeyword:"인페르노X",discoveredAt:checked});
  assert.equal(cu.retailerSkus.length,0);
  assert.equal(cu.storeAliases.length,1);
  const seven=publicRetailerMappingCandidates("seveneleven",{success:true,data:{
    stockAvailable:false,product:{itemName:"포켓몬카드 인페르노X"},
    inventory:{stores:[location]}
  }},{requestedKeyword:"인페르노X",discoveredAt:checked});
  assert.equal(seven.retailerSkus.length,0);
  assert.equal(seven.stockVerified,false);
});
test("misses, unrelated merchandise and wrong set candidates must not be approved",()=>{
  assert.deepEqual(publicRetailerMappingCandidates("gs25",{success:false,data:{}},
    {requestedKeyword:"인페르노X"}).retailerSkus,[]);
  const x=publicRetailerMappingCandidates("gs25",{success:true,data:{
    itemCode:"CARD-123",product:{name:"포켓몬카드 메가브레이브 부스터팩"},
    inventory:{stores:[location]}
  }},{requestedKeyword:"인페르노X",discoveredAt:checked});
  assert.equal(x.retailerSkus.length,0);
  const merch=publicRetailerMappingCandidates("gs25",{success:true,data:{
    itemCode:"SKU-123",product:{name:"포켓몬 카드지갑"},
    inventory:{stores:[location]}
  }},{requestedKeyword:"인페르노X",discoveredAt:checked});
  assert.equal(merch.retailerSkus.length,0);
  assert.throws(()=>publicRetailerMappingCandidates("unknown",{success:true,data:{}}),
    /UNKNOWN_CANDIDATE_PROVIDER/);
});
