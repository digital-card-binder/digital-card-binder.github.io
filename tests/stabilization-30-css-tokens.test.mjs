import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("30차: remove obsolete 130px mobile search overhang instead of stacking another override",()=>{
 const home=read("home-preview.css");
 assert.doesNotMatch(home,/width:\s*calc\(100% \+ 130px\)/);
 assert.match(home,/\.home-search\s*\{\s*width:\s*100%;\s*max-width:\s*100%;\s*margin-top:\s*15px/);
});
test("30차: account menu uses same light palette instead of dark legacy styles",()=>{
 const css=read("home-preview.css");
 const start=css.indexOf("/* Dedicated mobile account popover. */");
 const end=css.indexOf("/* Native mobile account details:",start);
 const menu=css.slice(start,end);
 assert.match(menu,/background: rgba\(255, 255, 255, 0\.985\)/);
 assert.match(menu,/background: #f1f7ff/);
 assert.match(menu,/color: #294c6d/);
 assert.doesNotMatch(menu,/rgba\(3, 25, 45, 0\.985\)/);
});
test("30차: shared focus and touch sizes reuse existing design tokens",()=>{
 const ui=read("ui-consistency.css");
 assert.match(ui,/--dcb-control-touch:var\(--dcb-ux-touch,44px\)/);
 assert.match(ui,/--dcb-control-focus:var\(--dcb-ux-accent,#176783\)/);
 assert.match(read("styles.css"),/--dcb-ux-touch: 44px/);
 assert.match(read("styles.css"),/--dcb-ux-accent: #176783/);
});
