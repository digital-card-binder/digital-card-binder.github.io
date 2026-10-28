// One-shot read-only public OSM geographic diagnostics for Card Radar.
const q='[out:json][timeout:18];('+[
 'nwr["name"~"이마트|E[ -]?Mart|롯데마트|Lotte ?Mart|토이저러스|Toys ?[Rr] ?[Uu]s|트레이더스|Traders|홈플러스|Homeplus",i](around:10000,37.56650,126.97800);',
 'nwr["brand"~"이마트|E[ -]?Mart|롯데마트|Lotte ?Mart|토이저러스|Toys ?[Rr] ?[Uu]s|트레이더스|Traders|홈플러스|Homeplus",i](around:10000,37.56650,126.97800);'
].join('')+');out center 500;';
for(const url of ["https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter"]){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),14500);
 let status={provider:url,code:0,shops:0,relevant:0,first:[],state:"unknown"};
 try{
  const res=await fetch(url,{method:"POST",headers:{
    "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
    body:"data="+encodeURIComponent(q),signal:abort.signal});
  status.code=res.status;
  if(!res.ok){status.state="http_error";continue;}
  const parsed=await res.json();
  const rows=Array.isArray(parsed.elements)?parsed.elements:[];
  status.shops=rows.length;
  const named=rows.filter(x=>/이마트|롯데마트|토이저러스|트레이더스|홈플러스/i.test(
    String(x.tags?.name||"")+" "+String(x.tags?.brand||"")));
  status.relevant=named.length;
  status.first=named.slice(0,8).map(x=>({name:x.tags?.name,brand:x.tags?.brand,
    lat:x.lat??x.center?.lat,lng:x.lon??x.center?.lon}));
  status.state="ok";
 }catch(e){status.state=e.name==="AbortError"?"timeout":e.name;}
 finally{clearTimeout(timer);console.log("MART_MAP_GEO_PROBE "+JSON.stringify(status));}
 if(status.relevant>0)break;
}
