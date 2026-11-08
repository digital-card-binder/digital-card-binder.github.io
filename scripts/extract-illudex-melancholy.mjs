import fs from "node:fs";
const base="https://www.illudex.com/feel-data/18b0f2713d/";
const response=await Promise.all([fetch(base+"meta.json",{signal:AbortSignal.timeout(30000)}),fetch(base+"points.bin",{signal:AbortSignal.timeout(30000)})]);
if(response.some(x=>!x.ok)) throw Error("Public data not retrievable: "+response.map(x=>x.status).join("/"));
const [meta,buffer]=await Promise.all([response[0].json(),response[1].arrayBuffer()]);
const bytes=new Uint8Array(buffer);
const words=["peaceful","cozy","playful","funny","adventurous","epic","tense","eerie","mysterious","wondrous","tender","nostalgic","melancholy","fierce"];
const step=words.length+3;
if(bytes.length!==meta.ids.length*step)throw Error("Data length mismatch "+bytes.length+" and "+meta.ids.length+" * "+step);
let records=[];
for(let i=0;i<meta.ids.length;i++){
 const start=i*step;
 const scores=Array.from(bytes.slice(start,start+words.length));
 const mood=scores[12],highest=Math.max(...scores);
 const winner=words[scores.indexOf(highest)];
 const name=meta.names?.[i]||"";
 const setid=meta.sets?.[meta.set?.[i]]||"";
 records.push({idx:i,id:meta.ids[i],name,set:setid,score:mood,highest,winner,metaTail:[bytes[start+14],bytes[start+15],bytes[start+16]]});
}
const thresholdTests=[20,25,30,35,38,39,40,41,42,45,50,55,60,65,70].map(threshold=>{
 const all=records.filter(r=>r.score>=threshold);
 return {threshold,all:all.length,top:all.filter(r=>r.winner==="melancholy").length};
});
const winner=records.filter(r=>r.winner==="melancholy").sort((a,b)=>b.score-a.score);
const above40=records.filter(r=>r.score>=40).sort((a,b)=>b.score-a.score);
const report={
 source:{url:base,revision:"18b0f2713d",count:meta.ids.length,recordWidth:step,moodIndex:12,claimedPublicCount:95,checkedAt:"2026-11-08"},
 metaShape:Object.keys(meta).map(k=>({key:k,type:Array.isArray(meta[k])?"array":typeof meta[k],len:Array.isArray(meta[k])?meta[k].length:null})),
 thresholdTests, topMoodCount:winner.length,
 samples:{topWinners:winner.slice(0,25),highScoreNonWinners:above40.filter(r=>r.winner!=="melancholy").slice(0,20)},
 allMoodWinners:winner, allAbove40:above40
};
fs.mkdirSync("data/audits",{recursive:true});
fs.writeFileSync("data/audits/crying-illudex-full-feel-data-20261108.json",JSON.stringify(report,null,2)+"\n");
console.log("MELANCHOLY_STATIC_DATA",JSON.stringify({source:report.source,meta:report.metaShape,thresholds:thresholdTests,topWinners:winner.slice(0,20),above40:above40.length,topMoodTotal:winner.length},null,2));
