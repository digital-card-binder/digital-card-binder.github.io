import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const load=p=>JSON.parse(fs.readFileSync(path.join(import.meta.dirname,"..",p),"utf8"));
const themes=load("data/art-themes.json");
const originalMaster=[...load("data/series.json"),...load("data/series-legacy.json")];
const review=load("data/art-theme-story-review.json");
const audit=load("data/audits/theme-identity-batch-20261017.json");
const master=new Map();
for(const group of originalMaster)for(const card of group.cards||[]){
  const found=String(card.code||"").match(/^([^_]+)_(\d{3})\//i);
  if(found&&card.name)master.set(found[1].toLowerCase()+"_"+found[2],card.name);
}
const trim=s=>String(s||"").replace(/\s+/g,"");

test("all parsable theme images match their printed numbers and Korean card names",()=>{
  let matching=0;
  for(const group of themes.groups||[])for(const card of group.cards||[]){
    const photo=String(card.image||"").match(/\/([A-Za-z0-9-]+)_(\d{3})\.(?:png|jpe?g|webp)(?:\?|$)/i);
    if(!photo)continue;
    matching++;
    const key=photo[1].toLowerCase()+"_"+photo[2];
    const print=String(card.cardNumber||"").match(/^(\d{1,3})/);
    if(print&&card.set?.toLowerCase()===photo[1].toLowerCase()){
      assert.equal(print[1].padStart(3,"0"),photo[2],group.code+" "+card.code+" print");
      const code=String(card.code||"").match(/^([^_]+)_(\d{3})$/i);
      if(code&&code[1].toLowerCase()===photo[1].toLowerCase())
        assert.equal(code[2],photo[2],group.code+" "+card.code+" image");
    }
    const official=master.get(key);
    if(official)assert.equal(trim(card.name),trim(official),group.code+" "+card.code+" name");
  }
  assert.ok(matching>=12000,"Image filename coverage unexpectedly decreased");
});

test("Deerling and Sawsbuck are both Korean SV5M prints in connected/evolution",()=>{
  for(const themeCode of ["connected","evolution"]){
    const group=themes.groups.find(group=>group.code===themeCode);
    for(const [suffix,name] of [["073","사철록"],["074","바라철록"]]){
      const card=group.cards.find(card=>card.code==="SV5M_"+suffix&&card.name===name);
      assert.ok(card,themeCode+" "+name);
      assert.equal(card.set.toLowerCase(),"sv5m");
      assert.match(card.image,new RegExp("/SV5M/SV5M_"+suffix+"\\.png"));
      assert.equal(card.legacyIdentityCode,"SV5K_"+suffix);
      assert.ok(review.groups[themeCode].cards["SV5M_"+suffix]);
      assert.equal(review.groups[themeCode].cards["SV5K_"+suffix],undefined);
    }
  }
});

test("legacy ownership identifiers survive visible code repairs",()=>{
  let corrected=0, total=0;
  for(const group of themes.groups||[])for(const [index,card] of (group.cards||[]).entries()){
    total++;
    if(card.legacyIdentityCode){
      corrected++;
      assert.notEqual(card.legacyIdentityCode,card.code,group.code+" "+index);
    }
  }
  assert.equal(total,20570); // SM8b/SM9/SM9a visual art review; uncertain Korean print holds
  assert.equal(corrected,786);
  assert.deepEqual(audit.corrected,{masterNames:6,themeVisibleCodes:782,themeNames:27,connectedEvolutionSetImages:4});
});
