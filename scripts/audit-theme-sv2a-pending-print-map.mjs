import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const themes=read("data/art-themes.json"),data=new Map();
for(const g of themes.groups){
 for(const c of g.cards||[]){
  if(String(c.set||"").toLowerCase()!=="sv2a"&&!/^sv2a_\d{3}$/i.test(c.code||""))continue;
  const printed=String(c.image||"").match(/SV2a_(\d{3})/i)?.[1];
  if(!printed||Number(printed)<151)continue;
  if(!data.has(printed))data.set(printed,[]);
  data.get(printed).push({group:g.code,key:c.code,name:c.name,sourceImage:c.image,evidence:String(c.evidence||"").slice(0,140)});
 }
}
const rows=[...data.entries()].sort(([a],[b])=>Number(a)-Number(b)).map(([printed,items])=>({printed,items}));
const out={schemaVersion:1,at:new Date().toISOString(),set:"sv2a",rows};
fs.writeFileSync("data/audits/theme-sv2a-pending-printed-theme-map-20261013.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({rows:rows.length,prints:rows.map(x=>({n:x.printed,groups:x.items.map(y=>y.group)}))}));
