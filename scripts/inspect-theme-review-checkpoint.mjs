import { readFile } from "node:fs/promises";
const json=async f=>JSON.parse(await readFile(f,"utf8"));
const [s,legacy,rev,cov,img,theme]=await Promise.all([
 json("data/series.json"),json("data/series-legacy.json"),
 json("data/audits/theme-series-review-status.json"),
 json("data/audits/theme-series-coverage.json"),
 json("data/audits/theme-image-selfhost-audit.json"),json("data/art-themes.json")
]);
for(const code of ["sv11W","sv11B"]){
 const source=[...s,...legacy].find(x=>String(x.code).toLowerCase()===code.toLowerCase());
 const matched=Object.entries(rev.reviews||{}).filter(([k])=>k.toLowerCase()===code.toLowerCase());
 const statuses=matched.map(([k,v])=>({key:k,status:v.status,reviewedCardCount:v.reviewedCardCount,
   reviewedAt:v.reviewedAt,heldCards:v.heldCards?.length,
   newlyAddedCards:v.newlyAddedCards?.length,newlyAddedThemeSlotCount:v.newlyAddedThemeSlotCount,
   fullSetEvidence:v.fullSetEvidence,note:String(v.note||"").slice(0,400),fields:Object.keys(v)}));
 const themeRecords=theme.groups.flatMap(g=>g.cards.filter(x=>String(x.set).toLowerCase()===code.toLowerCase()).map(x=>({theme:g.code,code:x.code})));
 console.log(JSON.stringify({code,masterSetName:source?.name,masterCount:source?.cards?.length,
  namedCount:source?.cards?.filter(x=>x.name).length,
  reviewStatuses:statuses,coverage:cov.sets.find(x=>String(x.code).toLowerCase()===code.toLowerCase()),
  currentImageNext:img.nextStart,
  themeCount:themeRecords.length,themeSamples:themeRecords.slice(0,15)},null,2));
}
