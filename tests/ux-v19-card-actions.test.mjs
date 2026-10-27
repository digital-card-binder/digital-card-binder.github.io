import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const js=read("custom-mobile-ux.js"),html=read("custom.html");
const css=read("custom.css"),search=read("pokemon-search.css");
test("19차: personal dex card menu is an accessible dialog and restores trigger focus",()=>{
  assert.match(html,/id="custom-card-menu-dialog"[^>]*aria-labelledby="custom-card-menu-title"/);
  assert.match(js,/more\.setAttribute\("aria-haspopup", "dialog"\)/);
  assert.match(js,/more\.setAttribute\("aria-controls", "custom-card-menu-dialog"\)/);
  assert.match(js,/lastMenuTrigger = more/);
  assert.match(js,/lastMenuTrigger\?\.isConnected/);
  assert.match(js,/focus\(\{ preventScroll: true \}\)/);
  assert.match(js,/dialog\.showModal\(\)/);
});
test("19차: mobile card management sheet keeps safe targets and close controls",()=>{
  assert.match(css,/\.custom-card-menu-dialog\[open\]\s*\{/);
  assert.match(css,/\.custom-card-menu-actions button\s*\{\s*min-height:48px/);
  assert.match(html,/id="custom-card-menu-close"/);
  assert.match(html,/id="custom-undo-button"/);
});
test("19차: mobile search ownership action stays reachable without changing save semantics",()=>{
  assert.match(search,/#pokemon-search-dialog \.pokemon-search-dialog-actions\s*\{\s*position:sticky/);
  assert.match(search,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(search,/min-height:48px/);
  assert.match(read("pokemon-search.html"),/id="pokemon-search-toggle-owned"/);
  assert.match(read("pokemon-search.js"),/addEventListener\("click", toggleOwned\)/);
});
