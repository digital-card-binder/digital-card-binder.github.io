"use strict";
(async()=>{
  const BASE=location.origin;
  if(!/pokemoncard\.co\.kr$/i.test(location.hostname)){alert("포켓몬코리아 카드 검색 페이지에서 실행해주세요.");return;}
  const form=new FormData();
  form.append("action","search_text_cards");
  form.append("search_text","Mitsuhiro Arita");
  form.append("search_params","all");
  form.append("limit","0");
  const res=await fetch(`${BASE}/v2/ajax2_dev2`,{method:"POST",credentials:"include",headers:{"X-Requested-With":"XMLHttpRequest"},body:form});
  const raw=await res.text();
  const start=raw.indexOf("{");
  if(start<0)throw new Error("No JSON response");
  const obj=JSON.parse(raw.slice(start));
  const rows=Array.isArray(obj.result)?obj.result:Object.values(obj.result||{});
  const out={count:obj.count,limit:obj.limit,topLevelKeys:Object.keys(obj),rowCount:rows.length,rowKeys:rows[0]?Object.keys(rows[0]):[],sampleRows:rows.slice(0,5)};
  console.log("artist search response sample",out);
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="artist-search-sample.json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
})();
