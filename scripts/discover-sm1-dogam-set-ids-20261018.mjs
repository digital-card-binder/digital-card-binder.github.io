#!/usr/bin/env node
/* Inspect public Korean Dogam set references for the final 11 image holds, read only. */
const home=await (await fetch("https://www.dogam.app/sets",{signal:AbortSignal.timeout(30000)})).text();
for(const code of ["SM1M","SM1S","S6K","S4a","S-P"]) {
 const at=home.indexOf(code);
 console.log("SET_DISCOVERY",JSON.stringify({code,found:at>=0,nearby:at>=0?home.slice(Math.max(0,at-650),at+230):""}));
}

const wanted=[["SM1M","SM1M · 73장",["067/060","069/060","071/060","073/060"]],["SM1S","SM1S · 73장",["070/060","071/060","072/060","073/060"]],["S4a","S4a · 330장",["138/190"]],["S6K","S6K · 95장",["094/070"]]];
for(const [set,phrase,nums] of wanted){
 const i=home.indexOf(phrase);
 if(i<0){console.log("SET_ID",JSON.stringify({set,error:"No set phrase"}));continue;}
 const pre=home.slice(0,i),pos=pre.lastIndexOf('href="/sets/'),part=home.slice(pos,pos+65);
 const m=part.match(/href="(\/sets\/[A-Z0-9]+)"/);
 if(!m){console.log("SET_ID",JSON.stringify({set,error:"No href",part}));continue;}
 const url="https://www.dogam.app"+m[1];
 const h=await (await fetch(url,{signal:AbortSignal.timeout(25000)})).text();
 console.log("SET_ID",JSON.stringify({set,url,htmlLength:h.length}));
 for(const num of nums){
  const pos=h.indexOf(num);
  const pre=pos>=0?h.slice(0,pos):"";
  const last=pre.lastIndexOf('href="/sets/');
  const near=pos>=0?h.slice(Math.max(0,pos-250),pos+210):"";
  const a=last>=0?pre.slice(last,last+100):"";
  console.log("SET_CARD",JSON.stringify({set,num,found:pos>=0,priorHref:a,nearby:near}));
 }
}
