import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
test("25차: airy light foundation uses visible ink and a pale card-safe palette",()=>{
 for(const rule of ["--surface-soft:#f8fbff","--ink:#1d3047","--bright-blue-pale:#eaf5ff","--bright-lilac:#f2eeff","--bright-coral:#fff0ec"])
  assert.ok(css.includes(rule),rule);
 assert.match(css,/body:not\(\[data-page="dashboard"\]\) \.main-content > \.hero/);
 assert.match(css,/background:\s*radial-gradient\(circle at 91% 10%/);
 assert.match(css,/\.progress-ring::before\{\s*background:#fff/);
 assert.match(css,/\.hero \.hero-description,/);
});
test("25차: collector state and card images remain semantically untouched",()=>{
 const part=css.slice(css.indexOf("/* 25차"));
 assert.doesNotMatch(part,/\.is-missing|\.is-owned|\.missing-overlay|filter:grayscale/);
 assert.doesNotMatch(part,/display:none|visibility:hidden/);
});
