// One-off low-volume public geocoding verification for curated local fallback.
// Verifies actual listed business address; do not guess lat/lng. Max 1 req/s.
const shops=[
 ["롯데마트 제타플렉스 서울역점","405 Hangang-daero, Jung-gu, Seoul, South Korea"],
 ["이마트 왕십리점","17 Wangsimnigwangjang-ro, Seongdong-gu, Seoul, South Korea"],
 ["롯데마트 청량리점","214 Wangsan-ro, Dongdaemun-gu, Seoul, South Korea"],
 ["이마트 은평점","111 Eunpyeong-ro, Eunpyeong-gu, Seoul, South Korea"],
 ["이마트 자양점","272 Achasan-ro, Gwangjin-gu, Seoul, South Korea"],
 ["이마트 신도림점","97 Saemal-ro, Guro-gu, Seoul, South Korea"],
 ["이마트 종암점","167 Jongam-ro, Seongbuk-gu, Seoul, South Korea"],
 ["이마트 청계천점","2198 Hwanghak-dong, Jung-gu, Seoul, South Korea"],
 ["이마트 구로점","43 Digital-ro 32-gil, Guro-gu, Seoul, South Korea"],
 ["토이저러스 청량리점","214 Wangsan-ro, Dongdaemun-gu, Seoul, South Korea"]
];
const rad=x=>x*Math.PI/180;
const km=(a,b,c,d)=>{const x=rad(c-a),y=rad(d-b);const h=Math.sin(x/2)**2+
 Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return 6371*2*Math.asin(Math.sqrt(h))};
for(const [name,address] of shops){
 const url="https://nominatim.openstreetmap.org/search?"+new URLSearchParams({q:address,
   format:"jsonv2",limit:"2",addressdetails:"1"});
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
 const result={name,address,verified:false};
 try{
   const r=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json",
     "User-Agent":"DigitalCardBinder-MapValidation/1.0 (https://digital-card-binder.github.io)"}});
   const rows=await r.json();
   result.http=r.status;
   result.matches=Array.isArray(rows)?rows.length:0;
   result.candidates=Array.isArray(rows)?rows.slice(0,2).map(x=>({
     lat:x.lat,lon:x.lon,type:x.type,category:x.category,
     label:String(x.display_name||"").slice(0,100),
     distanceFromSeoulCityHallKm:Math.round(km(37.5665,126.978,Number(x.lat),Number(x.lon))*100)/100})):null;
 }catch(e){result.error=e.name||"unknown"}finally{clearTimeout(timeout);
  console.log("RADAR_MART_GEOCODE "+JSON.stringify(result));}
 await new Promise(resolve=>setTimeout(resolve,1200));
}
