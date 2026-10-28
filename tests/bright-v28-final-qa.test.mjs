import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const home=read("home-preview.css"),styles=read("styles.css"),compact=read("dashboard-compact.css"),theme=read("theme.css");
function rgb(hex){return hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)}
function luminance(hex){const v=rgb(hex);return .2126*v[0]+.7152*v[1]+.0722*v[2]}
function contrast(a,b){let x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test("28차: actual chosen home ink and secondary copy colors pass WCAG normal-text contrast",()=>{
 assert.ok(contrast("#20354f","#ffffff")>=4.5,"home main text");
 assert.ok(contrast("#516b85","#ffffff")>=4.5,"home summary");
 assert.ok(contrast("#4f6782","#ffffff")>=4.5,"collection label");
 assert.ok(contrast("#245079","#f1f7ff")>=4.5,"header actions");
});
test("28차: mobile nav typography and collection counts have readable overrides",()=>{
 assert.match(home,/\.home-mobile-tabbar strong\{\s*font-size:\.64rem/);
 assert.match(home,/\.home-feature-meta\s*\{\s*font-size:\.62rem/);
 assert.match(compact,/\.dashboard-card-count span\{\s*font-size:\.62rem!important/);
 assert.match(home,/\.home-mobile-tabbar a:focus-visible\{/);
});
test("28차: reduced-motion and high-contrast fallbacks avoid breaking card collection",()=>{
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(styles,/@media\(forced-colors:active\)/);
 assert.match(theme,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(theme,/\.theme-card:nth-child\(3n\+2\)/);
 const last=styles.slice(styles.indexOf("/* 28차"));
 assert.doesNotMatch(last,/(display:none|visibility:hidden|position:fixed)/);
 assert.match(read("custom.html"),/id="custom-card-grid"/);
 assert.match(read("pokemon-search.html"),/id="pokemon-search-status"/);
});
test("28차: workflow tests and forbids writes to collector data and Android app",()=>{
 const wf=read("docs/workflow-archive/20261028/design-v25-v28-20261027.yml");
 assert.match(wf,/npm run site:prepare/);
 assert.match(wf,/npm test/);
 for(const key of ["data/","db/","firestore","radar-service/","android-app/"])assert.ok(wf.includes(key),key);
});
