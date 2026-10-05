import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("simple binder mode keeps empty and image slots directly tappable", async () => {
  const css = await read("studio.css");
  const js = await read("studio-custom.js");

  assert.match(
    css,
    /studio-custom-workspace:not\(\.is-advanced-open\) \.studio-custom-slot-layer\s*\{[\s\S]*?pointer-events:\s*auto/,
  );
  assert.match(js, /selectQuickSlot\(slot\.index\)/);
  assert.match(js, /quickSlotPhotoInput.*loadQuickSlotPhoto/);
  assert.match(js, /quickEmptyButton.*clearQuickSlot/);
});

test("mobile binder page controls remain finger-sized and keep the active page visible", async () => {
  const css = await read("studio.css");
  const js = await read("studio-custom.js");

  assert.match(
    css,
    /@media \(max-width: 690px\)[\s\S]*?\.studio-custom-page-toolbar button,[\s\S]*?\.studio-custom-page-chip\s*\{[\s\S]*?min-height:\s*44px/,
  );
  assert.match(css, /\.studio-custom-page-chip\s*\{[\s\S]*?flex-basis:\s*44px;[\s\S]*?min-width:\s*44px/);
  assert.match(js, /activeChip\.scrollIntoView\(\{ block: "nearest", inline: "nearest", behavior: "smooth" \}\)/);
});

test("binder studio keeps the simplified version picker and cross-page drag contracts", async () => {
  const html = await read("studio.html");
  const css = await read("studio.css");
  const js = await read("studio-custom.js");
  const variants = JSON.parse(await read("data/series-print-variant-images.json"));

  assert.match(html, /id="studio-variant-dialog"/);
  assert.match(js, /function openQuickVariants\(/);
  assert.match(js, /function pageDropTargetAtPoint\(/);
  assert.match(js, /function movePlacementToPage\(/);
  assert.match(js, /}, 650\);/);
  assert.match(css, /\.studio-custom-page-chip\.is-drag-page-target/);
  assert.ok(Object.keys(variants.slots || {}).length >= 400);
});
