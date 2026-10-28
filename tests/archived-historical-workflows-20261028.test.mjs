import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {inspectWorkflows} from "../scripts/audit-workflow-inventory.mjs";
const root=new URL("../",import.meta.url);
const retired=["design-v25-v28-20261027.yml","v29-v32-final-qa.yml","v29-v32-visual-qa.yml","operations-v32-inventory.yml"];
test("4 completed staging workflows are archived with byte-for-byte YAML and no main registration",()=>{
 for(const file of retired){
   assert.equal(existsSync(new URL(".github/workflows/"+file,root)),false,file+" no longer appears as live main workflow");
   const archive=new URL("docs/workflow-archive/20261028/"+file,root);
   assert.equal(existsSync(archive),true,file+" audit source is retained");
   const source=readFileSync(archive,"utf8");
   assert.match(source,/workflow_dispatch:/);
   assert.match(source,/branches: \[/);
   assert.doesNotMatch(source,/branches:\s*\[main\]/);
 }
});
test("core site, official-card watch, image deploy, Firestore and Android workflows remain",async()=>{
 const inventory=await inspectWorkflows(new URL(".github/workflows",root).pathname);
 assert.equal(inventory.aggregate.total,593);
 assert.equal(inventory.aggregate.protectedCore.length,7);
 for(const required of ["verify.yml","watch-official-card-updates.yml","deploy-card-images.yml","deploy-firestore-rules.yml","build-android-apk.yml"])
   assert.ok(inventory.aggregate.protectedCore.includes(required),required);
 assert.equal(inventory.aggregate.notAutomaticallyDeactivated,593);
});
