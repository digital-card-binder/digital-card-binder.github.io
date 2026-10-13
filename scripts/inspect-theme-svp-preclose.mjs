import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const [state,series,old,themes,images,off]=await Promise.all([
 read("data/audits/theme-series-review-status.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/sv-p-official-detail-audit.json")
]);
const s=[...series,...old].find(x=>String(x.code||"").toUpperCase()==="SV-P");
if(!s||s.cards.length!==248)throw Error("Korean promo catalog changed");
const review=Object.entries(state.reviews||{}).filter(([key])=>key.toUpperCase()==="SV-P");
const map={};
for(const g of themes.groups)for(const x of g.cards||[]){
 if(String(x.set||"").toUpperCase()!=="SV-P"&&!String(x.code||"").toUpperCase().startsWith("SV-P_"))continue;
 const id=String(x.code||"").toUpperCase();map[id]??=[];
 map[id].push({theme:g.code,image:x.image,sourceImage:x.sourceImage});
}
const cards=s.cards.map((c,i)=>{const num=String(c.code||"").match(/^sv-p_([^/ ]+)/i)?.[1];
 const key="SV-P_"+num;return {canonicalOrder:i+1,code:c.code,cardKey:key,
 name:c.name,rarity:c.rarity,existingThemes:map[key]||[]};});
const report={schemaVersion:1,recordedAt:"2026-10-13",set:"SV-P",masterCount:cards.length,
 review,themeExistingCardCount:Object.keys(map).length,
 totalExistingThemeSlots:Object.values(map).reduce((n,x)=>n+x.length,0),
 namesMissing:cards.filter(c=>!c.name).length,
 officialDetailSummary:off.summary,officialPending:Object.entries(off.slots).filter(([_,v])=>!v.verified).map(([k,v])=>({printedNumber:v.printedNumber,expectedName:v.expectedName,evidence:v.evidence})),
 imageCheckpoint:images.nextStart,
 cards};
await writeFile("data/audits/theme-svp-preclose-inventory-20261013.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({review,counts:{master:cards.length,themeExistingCardCount:report.themeExistingCardCount,totalExistingThemeSlots:report.totalExistingThemeSlots,officialPending:report.officialPending.length},imageCheckpoint:images.nextStart,officialPendingSample:report.officialPending.slice(0,4)},null,2));
