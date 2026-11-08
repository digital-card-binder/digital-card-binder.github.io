import { readFileSync, writeFileSync } from "node:fs";
const root=new URL("../",import.meta.url);
const read=(p)=>JSON.parse(readFileSync(new URL(p,root),"utf8"));
const entries=read("data/audits/crying-theme-all-candidate-index-20261108.json").illudex;
const artistDb=read("data/artists.json");
const arr=Array.isArray(artistDb)?artistDb:(artistDb.artists||artistDb.groups||artistDb.records||[]);
console.log("ARTIST_DB_SHAPE",JSON.stringify({array:Array.isArray(artistDb),keys:Object.keys(artistDb).slice(0,25),artists:arr.length,sample:arr.slice(0,2).map(a=>({keys:Object.keys(a),name:a.name,cardCount:a.cards?.length,first:a.cards?.[0]}))}).slice(0,3500));
function norm(s){return String(s||"").trim().toUpperCase().replace(/[^A-Z0-9가-힣]/g,"");}
function getId(card){const set=String(card.set||card.setCode||card.series||"").trim();let no=String(card.cardNumber||card.number||"").trim().split("/")[0];if(!no){const code=String(card.code||card.id||"");let match=code.match(/_([0-9]{1,3})(?:[/ _]|$)/);if(match)no=match[1];}return {set,n:Number(no)};}
const fullCandidates=entries.flatMap(e=>e.matches.map(c=>c.key));
const artistIndex=new Map();
for(const person of arr){const personName=String(person.name||person.artist||person.illustrator||"");for(const card of person.cards||person.items||[]){const id=getId(card);const k=norm(id.set)+"_"+id.n; if(!artistIndex.has(k))artistIndex.set(k,[]);artistIndex.get(k).push({artist:personName,cardName:card.name||card.cardName||"",nameFields:Object.keys(card).slice(0,18)});}}
const result=entries.map(e=>{
  let matches=e.matches.map(c=>{
    const people=artistIndex.get(norm(c.set)+"_"+Number(c.no))||[];
    return {...c,availableIllustrators:people.map(x=>x.artist),artistExactMatch:people.some(x=>norm(x.artist)===norm(e.artist))};
  });
  let strict=matches.filter(c=>c.artistExactMatch);
  return {english:e.english,artist:e.artist,koreanName:e.koreanName,
   totalNameCandidates:e.koreanNameMatches,matchedIllustratorCards:strict.length,
   matched:strict,unknownArtistInfo:matches.filter(x=>x.availableIllustrators.length===0).length};
});
const output={schemaVersion:1,date:"2026-11-08",policy:"Illustrator match is candidate discovery, not automatic proof of a unique same artwork. Require exact foreign card number/art before adding.",dbStats:{artists:arr.length,indexRecords:artistIndex.size,queryCandidateRecords:fullCandidates.length},results:result,summary:{withExactArtist:result.filter(x=>x.matchedIllustratorCards>0).length,without:result.filter(x=>!x.matchedIllustratorCards).length}};
writeFileSync(new URL("data/audits/crying-theme-illustrator-candidate-matches-20261108.json",root),JSON.stringify(output,null,2)+"\n");
console.log("ILLUDEX_ARTIST_MATCHES",JSON.stringify(result.map(r=>({name:r.english,artist:r.artist,count:r.matchedIllustratorCards,keys:r.matched.map(m=>m.key)})),null,2));
