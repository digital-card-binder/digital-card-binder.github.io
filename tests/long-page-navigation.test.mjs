import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync("collector-nav.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const searchCss = fs.readFileSync("pokemon-search.css", "utf8");
const start = src.indexOf("  function installLongPageNavigation() {");
const end = src.indexOf("  activateCollectionUiShell();", start);
assert.ok(start > 0 && end > start, "Global UX navigation must be installed in common shell");
const isolated = src.slice(start, end) + "\ninstallLongPageNavigation();";

function createHarness({scrollY=0,pageHeight=2500,viewportHeight=800,reducedMotion=false}={}) {
  const callbacks = {};
  let control = null;
  let click = null;
  let lastScroll = null;
  const body = { appendChild(node){control=node;} };
  const createElement = () => ({
    hidden:false,
    type:"",
    textContent:"",
    setAttribute(){},
    append(){},
    addEventListener(name,handler){if(name==="click")click=handler;}
  });
  const document = {
    body, documentElement:{scrollHeight:pageHeight, scrollTop:0},
    getElementById:()=>control,
    createElement
  };
  const window = {
    scrollY,innerHeight:viewportHeight,
    addEventListener(name,handler){callbacks[name]=handler;},
    requestAnimationFrame(handler){handler();},
    matchMedia(){return {matches:reducedMotion};},
    scrollTo(arg){lastScroll=arg;}
  };
  vm.runInNewContext(isolated, { document, window });
  return {
    window,document,button:()=>control,
    trigger:(name)=>callbacks[name]?.(),
    click:()=>click?.(),
    lastScroll:()=>lastScroll
  };
}

test("floating jump stays out of the way on short pages or near the top",()=>{
  const short = createHarness({scrollY:800,pageHeight:1200,viewportHeight:800});
  assert.equal(short.button().hidden,true);
  const initial = createHarness();
  assert.equal(initial.button().hidden,true);
  initial.window.scrollY=720;
  initial.trigger("scroll");
  assert.equal(initial.button().hidden,false);
  initial.window.scrollY=100;
  initial.trigger("pageshow");
  assert.equal(initial.button().hidden,true);
});

test("jump scrolls to top and honors reduced motion",()=>{
  const page=createHarness({scrollY:1000,reducedMotion:false});
  assert.equal(page.button().hidden,false);
  page.click();
  assert.deepEqual({ ...page.lastScroll() },{top:0,behavior:"smooth"});
  const reduced=createHarness({scrollY:1000,reducedMotion:true});
  reduced.click();
  assert.deepEqual({ ...reduced.lastScroll() },{top:0,behavior:"instant"});
});

test("mobile and dialog presentation avoid floating-button interference",()=>{
  assert.match(css,/\.dex-scroll-top\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(css,/body:has\(dialog\[open\]\)\s+\.dex-scroll-top/);
  assert.match(css,/env\(safe-area-inset-bottom/);
  assert.match(css,/@media\s*\(max-width:\s*760px\)/);
  assert.match(searchCss,/@media\(max-width:690px\)[\s\S]*\.pokemon-search-field input\{font-size:16px\}/);
  assert.match(searchCss,/\.pokemon-search-filters \.catalog-select select\{font-size:16px\}/);
});
