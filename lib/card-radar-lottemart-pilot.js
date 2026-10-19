// Separate, reviewable pilot for LOTTE MART's consumer-facing stock search.
// This parser never treats missing/ambiguous quantities as "0 in stock".
const AREA_CODES = ["서울","경기","인천","강원","충북","충남","대전","경북","경남","대구","부산","울산","전북","전남","광주","기타"];
const CARD_KEYWORDS = ["포켓몬카드","포켓몬 카드","인페르노X","닌자스피너","30주년","메가심포니아","스톰에메랄다","어비스아이","포켓몬스터"];
const EXCLUDE = /이즐|EZL|티머니|T.?money|캐시비|교통카드|충전카드|상품권|금액권|키링|케이스|슬리브|빵|띠부씰|젤리|쿠키|초콜릿|스낵|장난감|인형|피규어|아이스크림|음료|스티커|틴케이스/i;

export function parsePilotArea(value) {
  const area=String(value||"").trim();
  return AREA_CODES.includes(area) ? area : null;
}
export function parsePilotKeyword(value) {
  const raw=String(value||"").trim();
  return CARD_KEYWORDS.includes(raw) ? raw : null;
}
export function parsePilotStoreCode(value) {
  const raw=String(value||"").trim();
  return /^\d{3,8}$/.test(raw) ? raw : null;
}
function strip(value) {
  return String(value||"").replace(/<!--[\s\S]*?-->/g,"")
    .replace(/<br\s*\/?>/gi," ").replace(/<[^>]*>/g," ")
    .replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&")
    .replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
    .replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/\s+/g," ").trim();
}
export function isPokemonCardStockName(value) {
  const name=strip(value);
  if(!name || EXCLUDE.test(name))return false;
  const known=/인페르노X|닌자스피너|메가심포니아|스톰에메랄다|어비스아이|30주년|30th CELEBRATION|나이트원더러|블랙볼트|화이트플레어/i.test(name);
  const tcg=/TCG|카드게임|확장팩|부스터(?:팩|박스)?|구축덱|스타터덱|카드팩|카드박스/i.test(name);
  return ((/포켓몬|pokemon/i.test(name) && tcg) ||
      (/포켓몬\s*카드/i.test(name) && /팩|박스|세트|덱|확장/i.test(name)) ||
      (known && /팩|박스|덱|확장|TCG/i.test(name)));
}
export function parsePilotStores(html) {
  if(typeof html!=="string" || html.length>300000)throw Error("BAD_HTML");
  const found=[],seen=new Set();
  for(const m of html.matchAll(/<option\b[^>]*\bvalue\s*=\s*["'](\d{3,8})["'][^>]*>([\s\S]*?)<\/option>/gi)) {
    const code=m[1],name=strip(m[2]).slice(0,75);
    if(!name ||seen.has(code))continue;
    seen.add(code);
    found.push({storeCode:code,storeName:name});
  }
  return found.slice(0,120);
}
function valueAfter(label,block) {
  // The legacy HTML labels stock inside a table: <th>재고 :</th><td>3개</td>
  const rx=new RegExp(label+"\\s*:?\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>","i");
  return strip(block.match(rx)?.[1]||"");
}
function strictStock(value) {
  const matched=String(value||"").trim().match(/^(\d[\d,]*)\s*(?:개|EA|박스|팩)?$/i);
  if(!matched)return null;
  const number=Number(matched[1].replace(/,/g,""));
  return Number.isSafeInteger(number) && number>=0 ? number : null;
}
export function parsePilotProducts(html,observedAt) {
  if(typeof html!=="string" ||html.length>500000)throw Error("BAD_HTML");
  const matches=[...html.replace(/\r/g,"").matchAll(/<li(?:\s[^>]*)?>\s*<div\s+class=["']prod-box["']/gi)];
  const records=[];
  for(let i=0;i<matches.length && i<250;i++){
    const chunk=html.slice(matches[i].index,matches[i+1]?.index??html.length);
    const name=strip(chunk.match(/<div\s+class=["']prod-name["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||
      chunk.match(/<div\s+class=["']layer-head["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]).slice(0,110);
    if(!isPokemonCardStockName(name))continue;
    const rawQuantity=valueAfter("재고",chunk);
    const quantity=strictStock(rawQuantity);
    if(quantity===null)continue;
    records.push({name,quantity,checkedAt:observedAt});
  }
  return [...new Map(records.map(x=>[x.name,x])).values()];
}
export const PILOT_ENDPOINTS=Object.freeze({
  options:"https://company.lottemart.com/mobiledowa/inc/asp/search_market_list.asp",
  products:"https://company.lottemart.com/mobiledowa/product/search_product.asp"
});
