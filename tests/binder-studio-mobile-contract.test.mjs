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

test("binder studio keeps the simplified version picker and direct cross-page drag contracts", async () => {
  const html = await read("studio.html");
  const css = await read("studio.css");
  const js = await read("studio-custom.js");
  const variants = JSON.parse(await read("data/series-print-variant-images.json"));

  assert.match(html, /id="studio-variant-dialog"/);
  assert.match(js, /function openQuickVariants\(/);
  assert.match(js, /function pageDropTargetAtPoint\(/);
  assert.match(js, /function slotIndexAtPoint\(/);
  assert.match(js, /function movePlacementToPage\(/);
  assert.match(js, /activePlacementDrag\.switchPage\(page\.id, "tap"\)/);
  assert.match(js, /switchPromise = task/);
  assert.match(js, /studio-custom-drag-ghost/);
  assert.doesNotMatch(js, /}, 650\);/);
  assert.match(css, /\.studio-custom-page-chip\.is-drag-page-target/);
  assert.match(css, /\.studio-custom-drag-ghost/);
  assert.match(css, /\.studio-custom-slot\.is-drag-slot-target/);
  assert.ok(Object.keys(variants.slots || {}).length >= 400);
});


test("mobile simple mode puts the binder itself before secondary controls", async () => {
  const html = await read("studio.html");
  const css = await read("studio.css");

  assert.match(html, /class="studio-preview-panel studio-custom-preview-panel"/);
  assert.match(
    css,
    /@media \(max-width: 690px\)[\s\S]*?studio-custom-workspace:not\(\.is-advanced-open\) \.studio-custom-preview-panel\s*\{[\s\S]*?order:\s*-1/,
  );
  assert.match(
    css,
    /studio-custom-workspace:not\(\.is-advanced-open\) \.studio-custom-library-panel\s*\{[\s\S]*?display:\s*none/,
  );
  assert.match(css, /칸을 눌러 편집 · 카드는 드래그해서 이동/);
});

test("simple card search stays hidden until the Card Search quick action is used", async () => {
  const html = await read("studio.html");
  const css = await read("studio.css");
  const js = await read("studio-custom.js");

  assert.match(html, /studio-control-card studio-custom-card-search-card/);
  assert.match(
    css,
    /studio-custom-workspace:not\(\.is-advanced-open\):not\(\.is-search-open\) \.studio-custom-card-search-card/,
  );
  assert.match(js, /panel\.classList\.add\("is-search-open"\)/);
  assert.match(js, /panel\.classList\.remove\("is-search-open"\)/);
  assert.match(js, /previewPanel\.scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});

test("mobile simple save card hides secondary account controls", async () => {
  const css = await read("studio.css");

  assert.match(css, /studio-custom-save-card #studio-custom-linked-dex/);
  assert.match(css, /studio-custom-save-card #studio-custom-new-button/);
  assert.match(css, /studio-custom-save-card #studio-custom-delete-button/);
  assert.match(css, /studio-custom-save-card \.studio-custom-visibility-note/);
});


test("quick slot photos are center-cropped to the physical card ratio", async () => {
  const js = await read("studio-custom.js");

  assert.match(js, /function centeredCardCrop\(width, height, targetAspect = CARD_WIDTH_MM \/ CARD_HEIGHT_MM\)/);
  assert.match(js, /targetAspect \/ sourceAspect/);
  assert.match(js, /sourceAspect \/ targetAspect/);
  assert.match(
    js,
    /crop: centeredCardCrop\(image\.naturalWidth, image\.naturalHeight\)/,
  );
  assert.doesNotMatch(
    js,
    /loadQuickSlotPhoto[\s\S]*?crop: \{ x: 0, y: 0, width: 1, height: 1 \}/,
  );
});
