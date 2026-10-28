// One-off proof of official open-source Photon OSM geocoding, not inventory.
const candidates=["롯데마트","이마트","토이저러스"];
const bbox="126.86,37.47,127.09,37.66";
for(const brand of candidates){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 const p=new URLSearchParams({q:brand,bbox,countrycode:"KR",limit:"20"});
 try{
  const res=await fetch("https://photon.komoot.io/api/?"+p,
   {signal:controller.signal,headers:{Accept:"application/json"}});
  const raw=await res.text();
  let content=null;try{content=JSON.parse(raw)}catch{}
  const points=(content?.features||[]).slice(0,8).map(x=>({
   name:x.properties?.name,city:x.properties?.city,
   osmId:x.properties?.osm_id,osmKey:x.properties?.osm_key,
   lon:x.geometry?.coordinates?.[0],lat:x.geometry?.coordinates?.[1]
  }));
  console.log("MART_PHOTON_DIAGNOSTIC",JSON.stringify({
   brand,status:res.status,errorBody:res.ok?null:raw.slice(0,240),features:content?.features?.length||0,points}));
 }catch(e){console.log("MART_PHOTON_DIAGNOSTIC",JSON.stringify({brand,error:e.name}));}
 finally{clearTimeout(timer)}
 if(brand==="롯데마트")break;
}
