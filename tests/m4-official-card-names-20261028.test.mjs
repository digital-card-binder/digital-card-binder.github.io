import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {officialCardUrl,parseOfficialM4,officialNameConsistent,decodeEntities} from "../scripts/enrich-m4-korean-card-names-20261028.mjs";
const repo=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const sample=(number,title)=>'<html><span class="p_num">'+number+'/083<span id="no_wrap_by_admin">RR</span></span><span class="card-hp title">'+title+'</span> MEGA 확장팩 「닌자스피너」</html>';
test("M4 official parser validates set, exact printed card number and Korean title",()=>{
 assert.deepEqual(parseOfficialM4(sample("003","독침붕 ex"),3),{number:"003/083",title:"독침붕 ex"});
 assert.equal(parseOfficialM4(sample("004","독침붕 ex"),3),null);
 assert.equal(parseOfficialM4(sample("003","독침붕 ex").replace("닌자스피너","어비스아이"),3),null);
 assert.equal(parseOfficialM4('<html><span class="card-hp title">독침붕 ex</span>닌자스피너</html>',3),null);
});
test("official title uses exact ex/Mega and never blindly promotes base species",()=>{
 assert.ok(officialNameConsistent("독침붕 ex","독침붕"));
 assert.ok(officialNameConsistent("메가개굴닌자 ex","개굴닌자"));
 assert.equal(officialNameConsistent("메가개굴닌자 ex","독침붕"),false);
 assert.equal(officialNameConsistent("", "뿔충이"),false);
 assert.equal(decodeEntities("AZ&#39;s &amp; I"),"AZ's & I");
 assert.equal(officialCardUrl(120),"https://pokemoncard.co.kr/cards/detail/BS2026003120");
 assert.throws(()=>officialCardUrl(121));
});
test("M4 source and official evidence both preserve 120 distinct existing card IDs and ownership",()=>{
 const audit=JSON.parse(repo("data/series-inventory-audit.json"));
 const set=audit.sets.find(x=>x.code.toLowerCase()==="m4");
 assert.equal(set.cardCount,120);
 assert.equal(set.firstCardCode,"m4_001/083");
 assert.equal(set.lastCardCode,"m4_120/083");
 assert.equal(audit.summary.duplicateCardIdentityCount,0);
 // The update script must only assign a verified name to card, never ownership or image.
 const source=repo("scripts/enrich-m4-korean-card-names-20261028.mjs");
 assert.match(source,/card\.name = official\.title/);
 assert.doesNotMatch(source,/card\.owned\s*=|card\.image\s*=|card\.code\s*=/);
});
