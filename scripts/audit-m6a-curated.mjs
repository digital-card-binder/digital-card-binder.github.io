import fs from "node:fs";
const read=(p)=>JSON.parse(fs.readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const artistsPayload=read("data/artists.json");
const artists=Array.isArray(artistsPayload)
  ? artistsPayload
  : Array.isArray(artistsPayload.artists)
    ? artistsPayload.artists
    : Array.isArray(artistsPayload.groups)
      ? artistsPayload.groups
      : Object.entries(artistsPayload).flatMap(([key,value]) => {
          if (value && typeof value === "object" && Array.isArray(value.cards)) {
            return [{ ...value, name: value.name || key }];
          }
          return [];
        });
const trainer=read("data/trainer-pokemon.json");
const fossil=read("data/fossil.json");
const hasM6a=(card)=>/\bM6a\b/i.test(String(card?.meta||"")) || /\/MEGA\/M6a\//i.test(String(card?.image||""));
const artistSummary=artists.map((g)=>({
  artist:g.name,
  total:(g.cards||[]).length,
  m6a:(g.cards||[]).filter(hasM6a).map(c=>({name:c.name,meta:c.meta,image:c.image}))
}));
const trainerCards=(trainer.groups||[]).flatMap(g=>(g.cards||[]).filter(hasM6a).map(c=>({group:g.name,name:c.name,code:c.code,image:c.image})));
const fossilCards=(fossil.groups||[]).flatMap(g=>(g.cards||[]).filter(hasM6a).map(c=>({group:g.name,name:c.name,code:c.code,image:c.image,category:c.category})));
console.log("M6A_CURATED_AUDIT="+JSON.stringify({
 artistNames:artistSummary.map(x=>x.artist),
 artistM6a:artistSummary.filter(x=>x.m6a.length),
 trainerM6a:trainerCards,
 fossilM6a:fossilCards
}));
