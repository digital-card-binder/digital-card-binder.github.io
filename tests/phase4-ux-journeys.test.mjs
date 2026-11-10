import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function node(tag="div") {
  const attributes=new Map();
  const children=[];
  let ownText="";
  return {
    tagName:tag.toUpperCase(),children,hidden:false,
    className:"",value:"",href:"",
    listeners:{},
    set textContent(s){ownText=String(s)},
    get textContent(){return ownText+children.map(x=>x.textContent||"").join(" ")},
    setAttribute(key,value){attributes.set(key,String(value))},
    getAttribute(key){return key==="href"?this.href:attributes.get(key)||null},
    append(...items){children.push(...items)},
    addEventListener(event,callback){this.listeners[event]=callback},
  };
}

test("phase 4: newly verified crying theme becomes searchable without changing membership",async()=>{
  const source=fs.readFileSync(new URL("../theme-discovery.js",import.meta.url),"utf8");
  const old=node("a");
  old.href="./art-themes.html?theme=sleeping";
  old.className="theme-card theme-card--art";
  old.append(Object.assign(node("h3"),{textContent:"잠자는 포켓몬"}));
  const cards=[old];
  const grid={
    querySelectorAll(selector){assert.equal(selector,".theme-card");return cards},
    querySelector(selector){return selector===".theme-card--art"?old:null},
    insertBefore(card,target){const i=cards.indexOf(target);cards.splice(i<0?cards.length:i,0,card)}
  };
  const input=node("input"),controls=node("div"),count=node("p"),empty=node("p");
  const buttons=["all","story","pokemon","special"].map(scope=>{
    const b=node("button");b.dataset={themeScope:scope};
    b.classList={toggle(){}};
    return b;
  });
  controls.querySelectorAll=()=>buttons;
  const refs={
    "theme-discovery-search":input,"theme-discovery-count":count,
    "theme-discovery-empty":empty,
  };
  const document={
    readyState:"complete",
    getElementById:(id)=>refs[id]||null,
    querySelector:(query)=>query===".theme-card-grid"?grid:
      query===".theme-discovery-tabs"?controls:null,
    createElement:node,
  };
  const urls=[];
  async function fetch(url) {
    urls.push(url);
    if (url.includes("art-theme-supplements.json")) {
      return {ok:true,json:async()=>({schemaVersion:1,feeds:[{code:"crying",path:"./data/art-themes-crying.json"}]})};
    }
    if(url.includes("art-themes-crying.json")) {
      return {ok:true,json:async()=>({group:{
        code:"crying",name:"우는 포켓몬 도감",icon:"💧",badge:"SAD & LONELY",
        description:"울고 있는 한국판 카드",cards:Array(115).fill({code:"x"}),
      }})};
    }
    throw Error("unexpected fetch");
  }
  vm.runInNewContext(source,{document,window:{},fetch,console});
  for(let i=0;i<5;i++)await Promise.resolve();
  assert.deepEqual(urls,["./data/art-theme-supplements.json","./data/art-themes-crying.json"]);
  assert.equal(cards.length,2);
  const crying=cards.find(card=>card.href.endsWith("theme=crying"));
  assert.ok(crying);
  assert.match(crying.textContent,/우는 포켓몬 도감/);
  assert.match(crying.textContent,/115장/);
  input.value="우는";
  input.listeners.input();
  assert.equal(crying.hidden,false);
  assert.equal(old.hidden,true);
  assert.match(count.textContent,/1개/);
});

test("phase 4: save feedback displays explicit success/failure without mutating owned cards",()=>{
  const source=fs.readFileSync(new URL("../site-mobile-nav.js",import.meta.url),"utf8");
  const elements=new Map();
  const timers=[];
  const document={
    readyState:"complete",
    body:{append(element){elements.set(element.id,element)},classList:{add(){}}},
    head:{append(){}},
    getElementById:(id)=>elements.get(id)||null,
    querySelector:()=>({}),
    createElement:node,
  };
  const window={
    location:{pathname:"index.html",hash:""},
    addEventListener(){},
    setTimeout(handler){timers.push(handler);return timers.length},
    clearTimeout(){},
  };
  vm.runInNewContext(source,{document,window,console});
  assert.equal(typeof window.DcbSaveFeedback.show,"function");
  window.DcbSaveFeedback.show("saving","저장 중…");
  const chip=elements.get("dcb-save-feedback");
  assert.equal(chip.dataset.state,"saving");
  assert.equal(chip.hidden,false);
  window.DcbSaveFeedback.show("success","저장 완료");
  assert.equal(chip.dataset.state,"success");
  assert.equal(chip.textContent,"저장 완료");
  window.DcbSaveFeedback.show("error","저장 실패");
  assert.equal(chip.dataset.state,"error");
  assert.equal(chip.textContent,"저장 실패");
});
