import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const worker=read("sw.js");

function workerFixture(){
  const listeners={};
  const opened=[];
  const focused=[];
  let lastNotification;
  const self={
    location:{origin:"https://digital-card-binder.github.io"},
    addEventListener(type,fn){listeners[type]=fn;},
    registration:{showNotification:async (title,details)=>{lastNotification={title,details};}},
    clients:{matchAll:async()=>[],openWindow:async url=>{opened.push(url);}}
  };
  vm.runInNewContext(worker,{self,URL,Set});
  async function push(url){
    let promise;
    listeners.push({data:{json:()=>({url,title:"새소식"})},waitUntil:p=>{promise=p;}});
    await promise;
    return lastNotification;
  }
  async function click(url){
    let promise;
    listeners.notificationclick({notification:{data:{url},close(){}},
      waitUntil:p=>{promise=p;}});
    await promise;
    return opened.at(-1);
  }
  return {push,click,opened,focused};
}

test("16차: push notifications reject external origins and unsafe schemes",async()=>{
  const f=workerFixture();
  const expected="https://digital-card-binder.github.io/news.html";
  const external=await f.push("https://untrusted.example/redirect?key=secret");
  assert.equal(external.details.data.url,expected);
  assert.equal(await f.click("//untrusted.example/card"),expected);
  assert.equal(await f.click("javascript:alert(1)"),expected);
  assert.equal(await f.click("http://["),expected);
  assert.ok(f.opened.every(url=>url.startsWith("https://digital-card-binder.github.io/")));
});

test("16차: legitimate internal news links retain their path and fragment",async()=>{
  const f=workerFixture();
  const url="https://digital-card-binder.github.io/news.html#recent";
  assert.equal((await f.push("/news.html#recent")).details.data.url,url);
  assert.equal(await f.click("/news.html#recent"),url);
});

test("16차: user, master-card and theme audit stores are outside this release",()=>{
  const pkg=JSON.parse(read("package.json"));
  assert.match(pkg.scripts["test:ui"],/stabilization-14-mobile-history/);
  assert.match(pkg.scripts["test:ui"],/stabilization-15-search-cache/);
  assert.match(pkg.scripts["test:ui"],/stabilization-16-push-qa/);
  const qa=read(".github/workflows/stabilization-v14-v16-20261027.yml");
  assert.match(qa,/npm run site:prepare/);
  assert.match(qa,/npm test/);
  assert.match(qa,/firestore/);
  assert.match(qa,/data\//);
  assert.match(qa,/android-app\//);
});
