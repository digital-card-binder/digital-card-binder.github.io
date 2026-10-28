// Lotte Mart / Toys R Us first-party customer-site inventory: fail-closed POC.
// No competing collector data, retailer access bypass, or quantity inference.
// Publishing stock requires verified rights and official-store comparisons.
const OFFICIAL_HOST="https://company.lottemart.com";
const AREAS=new Set(["서울","경기","인천","강원","충북","충남","대전",
  "경북","경남","대구","부산","울산","전북","전남","광주","기타"]);
const TTL_MS=30_000,cache=new Map();
const STORE_OPTIONS_TTL_MS=10*60_000,storeOptionsCache=new Map();
const safe=s=>String(s??"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ")
  .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
  .replace(/\s+/g," ").trim();
const compact=s=>safe(s).normalize("NFKC").toLowerCase()
  .replace(/[\s·_()\-\/「」]/g,"");
function invalid(code){const e=new Error(code);e.code=code;throw e;}
function retailUnit(name){
  const s=safe(name);
  if(/박스|\bbox\b|\d+\s*팩\s*입/i.test(s))return "box";
  if(/스타터|스타트\s*덱|구축덱/i.test(s))return "deck";
  if(/스페셜\s*(?:카드\s*)?세트/i.test(s))return "set";
  if(/확장팩|하이클래스팩|부스터팩|카드팩/i.test(s))return "pack";
  return "unknown";
}
export function validateLotteMartQuery(raw={}){
  const area=String(raw.area||"").trim(),storeCode=String(raw.storeCode||"").trim();
  const keyword=String(raw.keyword||"").trim(),barcode=String(raw.barcode||"").trim();
  const unit=String(raw.unit||"").trim();
  if(!AREAS.has(area)||!/^\d{3,8}$/.test(storeCode)||
     keyword.length<2||keyword.length>60||/[<>{}\x00-\x1f]/.test(keyword)||
     !/^\d{8,14}$/.test(barcode)||!["box","pack","deck","set"].includes(unit))
    invalid("INVALID_MART_QUERY");
  return {area,storeCode,keyword,barcode,unit};
}
export function parseLotteMartOptions(html,area){
  if(!AREAS.has(area)||typeof html!=="string"||html.length>350_000)
    invalid("INVALID_MART_STORE_RESPONSE");
  const result=[],seen=new Set();
  for(const match of html.matchAll(/<option\b[^>]*\bvalue=["'](\d{3,8})["'][^>]*>([\s\S]*?)<\/option>/gi)){
    const storeCode=match[1],name=safe(match[2]);
    if(!name||seen.has(storeCode))continue;
    seen.add(storeCode);
    result.push({storeCode,name,area,brand:/토이저러스/.test(name)?"toysrus":"lottemart"});
  }
  return result;
}
export function parseLotteMartProductHtml(html,{barcode,keyword,unit,storeCode}={}){
  if(typeof html!=="string"||html.length>350_000)invalid("INVALID_MART_PRODUCT_RESPONSE");
  const results=[];
  // The original ASP response uses multi-line <li> wrappers and sometimes
  // extra attributes/classes. Only split on product-list item boundaries.
  const itemStart=/<li\b[^>]*>\s*<div\b[^>]*\bclass=["'][^"']*\bprod-box\b[^"']*["'][^>]*>/i;
  const blocks=html.replace(/\r/g,"").split(new RegExp("(?="+itemStart.source+")","i"));
  for(const block of blocks){
    if(!itemStart.test(block.trim()))continue;
    const title=safe(block.match(/<div\s+class=["']prod-name["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||
      block.match(/<div\s+class=["']layer-head["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||"");
    if(!title||!compact(title).includes(compact(keyword))||
      !/포켓몬|pokemon/i.test(title)||
      /빵|띠부씰|스티커|키링|슬리브|문구|교통카드|피규어|금액권|인형|스낵|젤리/.test(title)||
      retailUnit(title)!==unit)continue;
    const countHtml=block.match(/<div\s+class=["']prod-count["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||"";
    const foundCode=countHtml.match(/<!--\s*(\d{8,14})\s*-->/)?.[1]||"";
    if(!foundCode||foundCode!==barcode)continue;
    // Original ASP labels can prefix '재고' with a bullet (ㆍ/·/•).
    // A search result count is never a stock quantity.
    const stockLabel=safe(block.match(/<th\b[^>]*>\s*(?:[ㆍ·•]\s*)?재고\s*:?\s*<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1]||"");
    let quantity=null;
    if(/^\d[\d,]*\s*(?:개|EA)?$/i.test(stockLabel)){
      const value=Number(stockLabel.replace(/[^\d]/g,""));
      if(Number.isSafeInteger(value))quantity=value;
    }else if(/^(?:품절|재고없음)$/i.test(stockLabel))quantity=0;
    if(quantity===null)continue;
    results.push({barcode:foundCode,storeCode,productName:title,unit,
      quantity,status:quantity>0?"positive":"confirmed_zero"});
  }
  return results;
}
async function officialText(path,{method="GET",body,fetcher=fetch,timeoutMs=7000}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetcher(OFFICIAL_HOST+path,{
      method,signal:controller.signal,redirect:"follow",
      headers:{"Accept":"text/html, */*;q=0.1",
        ...(body?{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}:{})},
      ...(body?{body:body.toString()}:{}),
    });
    if(!res.ok)invalid("MART_UPSTREAM_HTTP_"+res.status);
    // Classic ASP may send CP949/EUC-KR HTML. Response.text() always reads
    // UTF-8, corrupting Korean product names/barcodes in those responses.
    // Decode from the declared charset or fall back only on invalid UTF-8.
    let text;
    if(typeof res.arrayBuffer==="function"){
      const bytes=new Uint8Array(await res.arrayBuffer());
      if(bytes.length>1_400_000)invalid("MART_UPSTREAM_INVALID");
      const declared=String(res.headers?.get?.("content-type")||"");
      const legacy=/(?:charset\s*=\s*["']?)(?:euc-kr|ks_c_5601-1987|cp949)/i.test(declared);
      const utf8=new TextDecoder("utf-8").decode(bytes);
      text=legacy||utf8.includes("\uFFFD")?
        new TextDecoder("euc-kr").decode(bytes):utf8;
    }else text=await res.text(); // Readable lightweight test doubles.
    if(typeof text!=="string"||text.length>350_000)invalid("MART_UPSTREAM_INVALID");
    return text;
  }finally{clearTimeout(timer)}
}
export async function queryLotteMartOfficial(raw,{fetcher=fetch,now=()=>Date.now()}={}){
  const query=validateLotteMartQuery(raw),key=JSON.stringify(query),c=cache.get(key);
  if(c&&c.expiresAt>now())return {...c.data,cacheHit:true};
  let stores=fetcher===fetch && storeOptionsCache.get(query.area)?.expiresAt>now()?
    storeOptionsCache.get(query.area).stores:null;
  if(!stores){
    const params=new URLSearchParams({p_area:query.area,p_type:"1"});
    const options=await officialText("/mobiledowa/inc/asp/search_market_list.asp?"+params,{fetcher});
    stores=parseLotteMartOptions(options,query.area);
    // Never cache an empty or malformed directory, or leak mocked data to live requests.
    if(fetcher===fetch && stores.length){
      if(storeOptionsCache.size>20)storeOptionsCache.clear();
      storeOptionsCache.set(query.area,{stores,expiresAt:now()+STORE_OPTIONS_TTL_MS});
    }
  }
  const selected=stores.find(s=>s.storeCode===query.storeCode);
  if(!selected)return {status:"unknown_store",source:"lottemart-official-mobile",
    checkedAt:new Date(now()).toISOString(),stores:[],cacheHit:false};
  const body=new URLSearchParams({p_area:query.area,p_market:query.storeCode,
    p_schWord:query.keyword});
  const html=await officialText("/mobiledowa/product/search_product.asp",
    {method:"POST",body,fetcher});
  const rows=parseLotteMartProductHtml(html,query).map(p=>({
    ...p,storeName:selected.name,brand:selected.brand,
    checkedAt:new Date(now()).toISOString(),source:"lottemart-official-mobile"}));
  const data={status:rows.length===1?"observed":"unverified_product_or_stock",
    source:"lottemart-official-mobile",checkedAt:new Date(now()).toISOString(),
    stores:rows.length===1?rows:[],cacheHit:false};
  if(cache.size>100)cache.clear();
  if(rows.length===1)cache.set(key,{expiresAt:now()+TTL_MS,data});
  return data;
}
export const EMART_OFFICIAL_STATUS=Object.freeze({
  status:"store_selection_or_auth_required",
  source:"emart-official-app",
  lookupUrl:"https://eapp.emart.com/webapp/product/search",
  inventoryQuantityAvailable:false,
  reason:"공식 앱은 점포별 재고를 제공하지만 독립 자동 수량 조회 경로는 아직 검증되지 않았습니다."
});
