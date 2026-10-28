const ids=[1,3,98,114];
for(const id of ids){
 const num=String(id).padStart(3,"0");
 const url="https://pokemoncard.co.kr/cards/detail/BS2026003"+num;
 try{
  const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; DCB-Korean-Card-Verification/1.0)","Accept":"text/html"},signal:AbortSignal.timeout(16000)});
  const html=await response.text();
  const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
  const keyword=id===1?"뿔충이":id===3?"독침붕":id===98?"메가개굴닌자":"메가개굴닌자";
  const i=html.indexOf(keyword),j=text.indexOf(keyword);
  console.log(JSON.stringify({num,status:response.status,length:html.length,htmlBefore:html.slice(Math.max(0,i-650),i+270),textBefore:text.slice(Math.max(0,j-260),j+170),hasSet:text.includes("닌자스피너"),hasNumber:text.includes(num+"/083")}));
 }catch(e){console.log(JSON.stringify({num,error:String(e)}))}
 await new Promise(r=>setTimeout(r,500));
}
