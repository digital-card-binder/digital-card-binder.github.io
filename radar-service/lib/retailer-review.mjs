// Product/retailer reconciliation happens OFFLINE before any stock is imported.
// Third-party discovery data is untrusted: every output is REVIEW_REQUIRED.
const CONVENIENCE_RETAILERS = new Set(["cu","gs25","seveneleven","emart24"]);
const GOODS_EXCLUSIONS = /빵|띠부씰|스티커|이즐|EZL|티머니|T.?money|캐시비|교통카드|선불|충전|상품권|기프트카드|금액권|체크카드|신용카드|카드지갑|문구|문구세트|음료|콜라|초코|과자|젤리|사탕|껌|디저트|인형|키링|피규어|굿즈|슬리브|바인더|카드보관|보관함|틴케이스/i;
const BOOSTER_SIGNALS=/포켓몬카드|포켓몬 카드|포켓몬스터카드|Pokémon TCG|Pokemon TCG|트레이딩.?카드.?게임|확장팩|부스터.?팩|부스터.?박스|스타터.?덱|구축덱|카드.?팩/i;
const PACK_TITLE=[
  ["m6a",/30th\s?celebration|30주년/i],["m6",/스톰에메랄다/i],
  ["m5",/어비스아이/i],["m4",/닌자스피너/i],["m3",/니힐제로/i],
  ["m2a",/메가드림ex/i],["m2",/인페르노x/i],["m1s",/메가심포니아/i],
  ["m1l",/메가브레이브/i]
];
function boundedString(value,max=130){
  return typeof value==="string"?value.trim().slice(0,max):"";
}
export function proposeCardProduct(name){
  const text=boundedString(name);
  if(!text || GOODS_EXCLUSIONS.test(text))return {cardCandidate:false,suggestedSetId:null};
  const found=PACK_TITLE.find(([,pattern])=>pattern.test(text));
  const signals=BOOSTER_SIGNALS.test(text);
  // Just "포켓몬 카드" is ambiguous (could be a gift card); require pack/TCG evidence.
  const tcg=/(?:포켓몬|pokemon|pokémon)/i.test(text) &&
    /(?:확장|부스터|스타터|덱|tcg|트레이딩|팩|박스|카드게임|카드 게임)/i.test(text);
  const explicit=!!found && (signals || /팩|박스|덱/i.test(text));
  return {cardCandidate:tcg||explicit,suggestedSetId:found?.[0]??null};
}
export function catalogueCandidates(retailerId,rows,{
  observedAt=new Date().toISOString(),
  sourceUrl="https://github.com/hmmhmmhm/daiso-mcp"
}={}){
  if(!CONVENIENCE_RETAILERS.has(retailerId))throw Error("UNKNOWN_CATALOGUE_SOURCE");
  if(!Array.isArray(rows)||rows.length>500)throw Error("INVALID_RETAILER_CATALOGUE");
  if(!Number.isFinite(Date.parse(observedAt)) ||
    typeof sourceUrl!=="string"||!sourceUrl.startsWith("https://"))
    throw Error("INVALID_CATALOGUE_PROVENANCE");
  const seen=new Set();
  const result=[];
  for(const row of rows){
    if(!row||typeof row!=="object")continue;
    const name=boundedString(row.goodsName||row.goodsNm||row.itemName||row.name||
      row.productName||row.searchItemName);
    const itemCode=boundedString(retailerId==="gs25"?(row.itemCode||row.itemCd):
      retailerId==="seveneleven"?(row.itemCd||row.itemCode):
      retailerId==="emart24"?(row.pluCd||row.itemCode):
      row.itemCode||row.goodsCode||row.itemCd,75);
    if(!name || !itemCode || !/^[A-Za-z0-9._-]{2,75}$/.test(itemCode))continue;
    const evidence=proposeCardProduct(name);
    if(!evidence.cardCandidate)continue;
    const key=retailerId+"|"+itemCode;
    if(seen.has(key))continue;seen.add(key);
    result.push({
      retailerId,retailerItemCode:itemCode,productName:name,
      suggestedSetId:evidence.suggestedSetId,
      identityStatus:"review_required",stockStatus:"not_checked",
      sourceUrl,discoveredAt:observedAt,
      // Never issue a verified SKU / in-stock record from a keyword search.
      automaticallyImportable:false
    });
  }
  return result;
}
export function storeCandidates(retailerId,rows,{
  sourceUrl="https://github.com/hmmhmmhm/daiso-mcp"
}={}){
  if(!CONVENIENCE_RETAILERS.has(retailerId))throw Error("UNKNOWN_STORE_SOURCE");
  if(!Array.isArray(rows)||rows.length>500)throw Error("INVALID_STORES");
  if(typeof sourceUrl!=="string"||!sourceUrl.startsWith("https://"))
    throw Error("INVALID_STORE_PROVENANCE");
  const seen=new Set();
  return rows.flatMap(row=>{
    if(!row||typeof row!=="object")return [];
    const providerStoreId=boundedString(row.storeCode||row.bizNo||row.storeId,80);
    const name=boundedString(row.storeName||row.name);
    const lat=Number(row.latitude??row.lat),lng=Number(row.longitude??row.lng);
    if(!providerStoreId || !name || !Number.isFinite(lat)||!Number.isFinite(lng)||
      lat<33||lat>39.5||lng<124||lng>133||
      seen.has(retailerId+"|"+providerStoreId))return [];
    seen.add(retailerId+"|"+providerStoreId);
    return [{retailerId,providerStoreId,name,lat,lng,
      address:boundedString(row.address,160),
      evidenceUrl:sourceUrl,identityStatus:"review_required",
      locationStatus:"unverified",stockStatus:"not_checked",automaticallyImportable:false}];
  });
}
