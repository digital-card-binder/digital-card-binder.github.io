import {readFileSync,writeFileSync} from "node:fs";
const read=p=>JSON.parse(readFileSync(p,"utf8"));
const master=[...read("data/series.json"),...read("data/series-legacy.json")].find(s=>String(s.code).toLowerCase()==="sv2a");
const themes=read("data/art-themes.json");
if(!master||master.cards.length!==210)throw Error("Expected 210 Korean 151 cards");
const cards=master.cards;
const byPrinted=new Map(cards.map((c,i)=>[String(c.code).split("_")[1].split("/")[0],{card:c,order:i+1}]));
const entries=[],grouped={};
for(const g of themes.groups||[])for(const item of g.cards||[]){
  if(String(item.set||"").toLowerCase()!=="sv2a"&&!/^SV2A_\d{3}$/i.test(String(item.code||"")))continue;
  const num=String(item.code||"").match(/_(\d{3})$/)?.[1];
  const byOrder=cards[Number(num)-1],byNumber=byPrinted.get(num);
  const sourceCardNumber=String(item.image||"").match(/SV2a_(\d{3})/i)?.[1]||"";
  const evidence=String(item.evidence||"");
  const newBatch=/한국판|자체 보관|자가 저장/i.test(evidence);
  const d={group:g.code,key:item.code,name:item.name||"",sourceCardNumber,
    keyMatchesSourceCardNumber:num===sourceCardNumber,
    keyMatchesOrdinalImage:String(byOrder?.code||"").match(/_(\d{3})\//)?.[1]===sourceCardNumber,
    masterByPrintedName:byNumber?.card?.name||"",masterByPrintedOrder:byNumber?.order??null,
    masterAtOrdinalName:byOrder?.name||"",masterAtOrdinalPrinted:String(byOrder?.code||"").split("_")[1]?.split("/")[0]||"",
    sourceImage:item.image||"",origin:newBatch?"new_batch":"preexisting",evidence:evidence.slice(0,165)};
  entries.push(d);grouped[d.origin]=(grouped[d.origin]||0)+1;
}
const prev=entries.filter(x=>x.origin==="preexisting"),batch=entries.filter(x=>x.origin==="new_batch");
const mismatched=entries.filter(x=>x.sourceCardNumber&& !x.keyMatchesSourceCardNumber);
const report={schemaVersion:1,generatedAt:new Date().toISOString(),set:"sv2a",masterCardCount:210,
 summary:{totalThemeEntries:entries.length,preexisting:prev.length,newBatches:batch.length,
 keyMatchesImageNumber:entries.filter(x=>x.keyMatchesSourceCardNumber).length,
 mismatchedKeyVsImage:mismatched.length,
 oldMatchesImageNumber:prev.filter(x=>x.keyMatchesSourceCardNumber).length,
 batchMismatch:batch.filter(x=>!x.keyMatchesSourceCardNumber).length,
 originCounts:grouped},
 preexistingRecords:prev,
 mismatchedEntries:mismatched,
 sampleLatest:batch.slice(0,15)};
writeFileSync("data/audits/theme-sv2a-print-identity-audit-20261013.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report.summary));
