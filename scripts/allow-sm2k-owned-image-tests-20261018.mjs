// Prepare SM series tests for a second exact Korean own-hosted set.
import fs from "node:fs";
const testPath="tests/sm-series-dex.test.mjs";
let s=fs.readFileSync(testPath,"utf8");
const oldHost="digital-card-binder[.]github[.]io\\/assets\\/cards\\/sm1plus-korean";
const newHost="digital-card-binder[.]github[.]io\\/assets\\/cards\\/(?:sm1plus-korean|sm2k-korean)";
if(s.split(oldHost).length!==2)throw Error("SM photo host test assertion changed");
s=s.replace(oldHost,newHost);
const old='      if (card.image.startsWith("https://digital-card-binder.github.io/assets/cards/sm1plus-korean/")) {';
const fresh='      if (card.image.startsWith("https://digital-card-binder.github.io/assets/cards/sm2k-korean/")) {\n        assert.equal(group.code.toLowerCase(), "sm2k");\n        assert.equal(card.code.toLowerCase(), "sm2k_056/050");\n        assert.equal(card.image, "https://digital-card-binder.github.io/assets/cards/sm2k-korean/056.webp");\n        assert.match(card.source, /^https:\\/\\/www[.]dogam[.]app\\/sets\\/.+\\/cards\\//, card.code);\n      } else if (card.image.startsWith("https://digital-card-binder.github.io/assets/cards/sm1plus-korean/")) {';
if(s.split(old).length!==2)throw Error("SM source provenance assertions changed");
fs.writeFileSync(testPath,s.replace(old,fresh));
const registryPath="tests/collector-registry.test.mjs";
let t=fs.readFileSync(registryPath,"utf8");
const needle="digital-card-binder[.]github[.]io\\/assets\\/cards\\/sm1plus-korean";
const replacement="digital-card-binder[.]github[.]io\\/assets\\/cards\\/(?:sm1plus-korean|sm2k-korean)";
if(t.split(needle).length!==2)throw Error("Collector source host contract differs");
fs.writeFileSync(registryPath,t.replace(needle,replacement));
console.log("SM2K_056_LOCAL_KOREAN_PHOTO_TEST_CONTRACT_ADDED");
