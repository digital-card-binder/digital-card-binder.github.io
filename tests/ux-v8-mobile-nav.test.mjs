import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src=fs.readFileSync(new URL("../site-mobile-nav.js",import.meta.url),"utf8");
const style=fs.readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const pages=["index.html","series.html","national.html","ar.html","theme.html",
  "art-themes.html","trainer-pokemon.html","artists.html","fossil.html",
  "world.html","people.html","pokemon-collections.html","eevee.html","packs.html",
  "custom.html","pokemon-search.html","studio.html","collectors.html","collector.html",
  "collector-settings.html","health.html"];

function simulate(filename="custom.html",homeAlreadyExists=false,hash=""){
  const created=[];
  const attrs={};
  const navChildren=[];
  const listeners={};
  const menu={tagName:"DETAILS",open:false};
  const node=(tag)=>({
    tagName:tag.toUpperCase(),children:[],attrs:{},className:"",
    setAttribute(k,v){this.attrs[k]=v;},
    append(...v){this.children.push(...v)},
  });
  const body={classList:{add(x){attrs[x]=true}},append(n){navChildren.push(n)}};
  const document={
    readyState:"complete",body,
    createElement(tag){const n=node(tag);created.push(n);return n;},
    getElementById(id){return id==="home-menu"?menu:null;},
    querySelector(query){
      if(query===".home-mobile-tabbar, .dcb-mobile-nav")
        return homeAlreadyExists?{className:"home-mobile-tabbar"}:null;
      if(query==="main")return {};
      throw Error("Unexpected query "+query);
    },
    addEventListener(){}
  };
  const window={location:{pathname:"/"+filename,hash},addEventListener(k,fn){listeners[k]=fn;}};
  vm.runInNewContext(src,{window,document});
  return {created,navChildren,attrs,menu,listeners,window};
}

test("mobile navigation is present on all 21 principal pages",()=>{
 for(const file of pages){
   const html=fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
   assert.match(html,/<script src="\.\/site-mobile-nav\.js(?:\?v=[^"]+)?" defer><\/script>/,file);
 }
});

test("common tabbar shows 5 destinations without duplicate existing home tabbar",()=>{
 const t=simulate();
 assert.equal(t.navChildren.length,1);
 const anchors=t.navChildren[0].children;
 assert.equal(anchors.length,5);
 assert.deepEqual(anchors.map(x=>x.href),["./","./pokemon-search.html","./series.html","./custom.html","./#home-menu"]);
 assert.equal(anchors[3].attrs["aria-current"],"page");
 assert.equal(anchors[0].attrs["aria-current"],undefined);
 assert.equal(t.attrs["dcb-has-mobile-nav"],true);
 const home=simulate("index.html",true);
 assert.equal(home.navChildren.length,0);
});

test("all destinations have accessible names, active state and menu deep-link works",()=>{
 const t=simulate("series.html",false,"#home-menu");
 assert.equal(t.menu.open,true);
 const anchors=t.navChildren[0].children;
 assert.equal(anchors[2].attrs["aria-current"],"page");
 for(const a of anchors){
   assert.match(a.attrs["aria-label"],/이동$/);
   assert.equal(a.children[0].attrs["aria-hidden"],"true");
   assert.ok(a.children[1].textContent);
 }
});

test("existing dashboard tabbar now matches the first four shared destinations",()=>{
 const index=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.match(index,/class="home-mobile-tabbar"/);
 assert.match(index,/href="\.\/series\.html"[^>]*><span[^>]*>▦<\/span><strong>도감/);
 assert.match(index,/href="\.\/custom\.html"[^>]*><span[^>]*>▤<\/span><strong>내 도감/);
 assert.match(index,/id="home-mobile-menu-trigger"/);
});

test("mobile has safe-area spacing and keyboard-visible focus without desktop overlay",()=>{
 assert.match(style,/\.dcb-mobile-nav\{display:none\}/);
 assert.match(style,/@media\(max-width:760px\)/);
 assert.match(style,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(style,/env\(safe-area-inset-bottom,0px\)/);
 assert.match(style,/min-height:52px/);
 assert.match(style,/\.dcb-mobile-nav a:focus-visible\{outline:3px/);
 assert.match(style,/\.dex-scroll-top\{\s*bottom:calc\(90px/);
});
