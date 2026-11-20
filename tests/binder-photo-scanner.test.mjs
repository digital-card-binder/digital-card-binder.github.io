import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";

// Tiny pixel canvas for testing the geometry and resampling without a browser.
function canvas(width = 0, height = 0, data = null) {
  const surface = { width, height, data };
  surface.getContext = () => ({
    drawImage(source) { surface.data = new Uint8ClampedArray(source.data); },
    getImageData() { return { data: surface.data }; },
    createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData(output) { surface.data = output.data; },
  });
  return surface;
}
function scanner() {
  const context = { window: {}, document: { createElement: () => canvas() }, setTimeout };
  vm.runInNewContext(readFileSync(new URL("../binder-photo-scanner.js", import.meta.url), "utf8"), context);
  return context.window.DigitalCardBinder.photoScanner;
}
const api = scanner();
const trapezoid = [{ x: 20, y: 15 }, { x: 75, y: 25 }, { x: 85, y: 80 }, { x: 10, y: 85 }];

test("homography maps every corner and differs from a bilinear quad", () => {
  const map = api.unitSquareToQuad(trapezoid);
  for (const [i, [u, v]] of [[0, [0, 0]], [1, [1, 0]], [2, [1, 1]], [3, [0, 1]]]) {
    const p = map(u, v);
    assert.ok(Math.abs(p.x - trapezoid[i].x) < 1e-8);
    assert.ok(Math.abs(p.y - trapezoid[i].y) < 1e-8);
  }
  const center = map(0.5, 0.5);
  assert.ok(Math.abs(center.y - trapezoid.reduce((sum, p) => sum + p.y, 0) / 4) > 1);
});

test("crossed, mirrored, collinear, nonfinite and out-of-bounds corners cannot be applied", () => {
  assert.equal(api.validCorners(trapezoid, 100, 100), true);
  for (const bad of [
    [trapezoid[0], trapezoid[2], trapezoid[1], trapezoid[3]],
    [...trapezoid].reverse(),
    [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 30, y: 10 }, { x: 40, y: 10 }],
    [{ x: NaN, y: 0 }, ...trapezoid.slice(1)],
    [{ x: -1, y: 0 }, ...trapezoid.slice(1)],
  ]) assert.equal(api.validCorners(bad, 100, 100), false);
});

test("inverse warp samples selected page pixels and produces the chosen grid aspect", async () => {
  const data = new Uint8ClampedArray(100 * 100 * 4);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
    const i = (y * 100 + x) * 4;
    data.set([x, y, (x < 5 || x > 90 || y < 5 || y > 90) ? 255 : 0, 255], i);
  }
  const source = canvas(100, 100, data);
  for (const [cols, rows] of [[3, 3], [3, 4], [4, 4]]) {
    const aspect = cols * 63 / (rows * 88);
    const output = await api.warpPerspective(source, trapezoid, aspect, 100);
    assert.ok(Math.abs(output.width / output.height - aspect) < 0.006);
    assert.ok(output.data.every((v, i) => i % 4 !== 2 || v === 0), "background remains outside the selected quad");
    const map = api.unitSquareToQuad(trapezoid);
    for (const [x, y] of [[0, 0], [output.width - 1, output.height - 1], [30, 40]]) {
      const expected = map(x / (output.width - 1), y / (output.height - 1));
      const i = (y * output.width + x) * 4;
      assert.ok(Math.abs(output.data[i] - expected.x) <= 0.5);
      assert.ok(Math.abs(output.data[i + 1] - expected.y) <= 0.5);
      assert.equal(output.data[i + 3], 255);
    }
  }
});

test("uniform photos have no false auto-detected page and safe initial corners remain valid", () => {
  assert.equal(api.detectPage(canvas(100, 100, new Uint8ClampedArray(40000))), null);
  assert.equal(api.validCorners(api.originalCorners({ width: 100, height: 100 }, 0.025), 100, 100), true);
});

test("pocket gutter counts distinguish 3x3, 3x4 and 4x4 even when their aspect is the same", () => {
  for (const [cols, rows] of [[2, 2], [3, 3], [3, 4], [4, 3], [4, 4], [4, 5], [5, 4]]) {
    const size = 400;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const inGutter = (position, count) => Array.from({ length: count - 1 }, (_, i) => (i + 1) * (size - 1) / count)
        .some((divider) => Math.abs(position - divider) < 5);
      const value = inGutter(x, cols) || inGutter(y, rows) ? 30 : 210;
      data.set([value, value, value, 255], (y * size + x) * 4);
    }
    const image = canvas(size, size, data);
    const detected = api.detectPocketGrid(image, api.originalCorners(image));
    assert.ok(detected, `${cols}x${rows} has repeated gutters`);
    assert.equal(detected.cols, cols);
    assert.equal(detected.rows, rows);
  }
});

test("grid suggestion does not guess a count from aspect or from just one divider direction", () => {
  const data = new Uint8ClampedArray(100 * 100 * 4).fill(210);
  const image = canvas(100, 100, data);
  assert.equal(api.detectPocketGrid(image, api.originalCorners(image)), null);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
    if (Math.abs(x - 33) < 2 || Math.abs(x - 66) < 2) data.set([20, 20, 20, 255], (y * 100 + x) * 4);
  }
  assert.equal(api.detectPocketGrid(image, api.originalCorners(image)), null);
  assert.equal(api.detectPocketGrid(image, [trapezoid[0], trapezoid[2], trapezoid[1], trapezoid[3]]), null);
});

test("degenerate scan rejects instead of silently importing a centered crop", async () => {
  await assert.rejects(api.warpPerspective(canvas(100, 100), [trapezoid[0], trapezoid[2], trapezoid[1], trapezoid[3]], 1));
  assert.equal(api.scan, undefined);
});


test("adaptive slot crops keep every imported cell at card aspect", () => {
  for (const [cols, rows] of [[3, 3], [3, 4], [4, 4]]) {
    const aspect = cols * 63 / (rows * 88);
    const height = 1200;
    const width = Math.round(height * aspect);
    const crops = api.buildSlotCrops({ cols, rows }, null, width, height, 63 / 88);
    assert.equal(crops.length, cols * rows);
    for (const crop of crops) {
      assert.ok(crop.x >= 0 && crop.y >= 0);
      assert.ok(crop.x + crop.width <= 1.000001);
      assert.ok(crop.y + crop.height <= 1.000001);
      const cropAspect = crop.width * width / (crop.height * height);
      assert.ok(Math.abs(cropAspect - 63 / 88) < 0.004);
    }
  }
});

test("detected pocket gutters expose divider geometry for crop alignment", () => {
  const cols = 3, rows = 4, size = 480;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const inGutter = (position, count) => Array.from({ length: count - 1 }, (_, i) => (i + 1) * (size - 1) / count)
      .some((divider) => Math.abs(position - divider) < 6);
    const value = inGutter(x, cols) || inGutter(y, rows) ? 25 : 215;
    data.set([value, value, value, 255], (y * size + x) * 4);
  }
  const image = canvas(size, size, data);
  const detected = api.detectPocketGrid(image, api.originalCorners(image));
  assert.ok(detected);
  assert.equal(detected.xDividers.length, cols - 1);
  assert.equal(detected.yDividers.length, rows - 1);
  assert.ok(detected.xDividers.every((item) => item.halfWidth > 0));
  assert.ok(detected.yDividers.every((item) => item.halfWidth > 0));
});

test("reliable inferred pocket bounds can remove outer page margins", () => {
  const page = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const layout = {
    cols: 3,
    rows: 4,
    confidence: 0.9,
    xBounds: { start: 0.08, end: 0.94, confidence: 0.9 },
    yBounds: { start: 0.06, end: 0.95, confidence: 0.9 },
  };
  const refined = api.refineCornersToPocket(page, layout, 101, 101);
  assert.ok(refined[0].x > page[0].x);
  assert.ok(refined[0].y > page[0].y);
  assert.ok(refined[2].x < page[2].x);
  assert.ok(refined[2].y < page[2].y);
});


test("scanned card matcher samples small crop offsets without weakening confidence rules", () => {
  const matcher = readFileSync(new URL("../card-visual-matcher.js", import.meta.url), "utf8");

  assert.match(matcher, /function photoCropVariants\(/);
  assert.match(matcher, /\[0\.018, -0\.018, 0\]/);
  assert.match(matcher, /\[0\.018, 0\.018, 0\]/);
  assert.match(matcher, /\[0\.018, 0, -0\.018\]/);
  assert.match(matcher, /\[0\.018, 0, 0\.018\]/);
  assert.match(matcher, /photoCropVariants\(crop\)\.map/);
  assert.match(matcher, /top\.distance <= 7\.5 && gap >= 4\.25/);
  assert.match(matcher, /top\.distance <= 9\.0 && gap >= 6\.0/);
  assert.match(matcher, /function confidentScan\(/);
  assert.match(matcher, /top\.distance <= 10\.75 && gap >= 3\.25 && fullDistance <= 20/);
  assert.match(matcher, /top\.distance <= 12\.75 && gap >= 5\.0 && fullDistance <= 18/);
  assert.match(matcher, /function reviewableScan\(/);
  assert.match(matcher, /top\.distance <= 22/);
});

test("successful page scan immediately performs conservative card recognition", () => {
  const studio = readFileSync(new URL("../studio-custom.js", import.meta.url), "utf8");

  assert.match(studio, /let autoRecognizeAfterImport = false/);
  assert.match(studio, /autoRecognizeAfterImport = true/);
  assert.match(studio, /if \(autoRecognizeAfterImport\) \{\s*await recognizeImportedPhotoCards\(\)/);
  assert.match(studio, /matcher\.confidentScan\?\.\(matches\) \|\| matcher\.confident\(matches\)/);
  assert.match(studio, /matcher\.reviewableScan\?\.\(matches\)/);
  assert.match(studio, /스캔 완료 · 카드 자동인식을 시작합니다/);
  assert.match(studio, /애매한 칸은 사진 그대로 유지했습니다/);
});

test("scanned slot backgrounds stay as underlays when cards move over them", () => {
  const studio = readFileSync(new URL("../studio-custom.js", import.meta.url), "utf8");

  assert.match(studio, /underlayImageId/);
  assert.match(studio, /function imageUnderlaySlot\(/);
  assert.match(studio, /function cardSlotWithUnderlay\(/);
  assert.match(studio, /const underlay = imageUnderlaySlot\(state\.slots\[slotIndex\], slotIndex\)/);
  assert.match(studio, /const underlay = next\[entry\.slotIndex\]/);
  assert.doesNotMatch(studio, /if \(target\?\.type === "image"\) \{\s*state\.slots\[targetIndex\] = \{ index: targetIndex, type: "empty" \}/);
  assert.match(studio, /source\.slots\[resolvedOrigin\] = sourceUnderlay \|\| \{ index: resolvedOrigin, type: "empty" \}/);
  assert.match(studio, /targetUnderlay/);
  assert.match(studio, /slot\.type === "card" \? clean\(slot\.underlayImageId\) : ""/);
});


test("custom binder can move background tiles independently of cards", () => {
  const studio = readFileSync(new URL("../studio-custom.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../studio.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../studio.css", import.meta.url), "utf8");

  assert.match(html, /id="studio-background-move-toggle"/);
  assert.match(html, /배경 조각 이동 시작/);
  assert.match(studio, /backgroundTileMoveMode: false/);
  assert.match(studio, /function slotWithImageUnderlay\(/);
  assert.match(studio, /function moveBackgroundTile\(/);
  assert.match(studio, /function startBackgroundTileDrag\(/);
  assert.match(studio, /state\.slots\[originIndex\] = slotWithImageUnderlay/);
  assert.match(studio, /state\.slots\[targetIndex\] = slotWithImageUnderlay/);
  assert.match(studio, /카드는 움직이지 않습니다/);
  assert.match(css, /\.studio-custom-preview-stage\.is-background-move \.studio-custom-slot-layer/);
  assert.match(css, /\.studio-custom-preview-stage\.is-background-move \.studio-custom-card-placement/);
  assert.match(css, /\.studio-background-drag-ghost/);
});


test("mobile 4x4 preview fits and background move is available from quick editor", () => {
  const studio = readFileSync(new URL("../studio-custom.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../studio.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../studio.css", import.meta.url), "utf8");

  assert.match(html, /id="studio-quick-background"/);
  assert.match(html, /<strong>배경 이동<\/strong>/);
  assert.match(studio, /const quickBackgroundButton = panel\.querySelector\("#studio-quick-background"\)/);
  assert.match(studio, /quickBackgroundButton\?\.addEventListener\("click"/);
  assert.match(studio, /window\.matchMedia\("\(max-width: 690px\)"\)\.matches/);
  assert.match(studio, /availableWidth \/ logicalWidth/);
  assert.match(studio, /applyStageGeometry\(\);\s*state\.placements\.forEach\(clampPlacement\)/);
  assert.match(css, /@media\(max-width:690px\)[\s\S]*?\.studio-quick-actions\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.studio-custom-preview-wrap \{\s*overflow-x: hidden;/);
  assert.match(css, /\.studio-custom-preview-stage\.is-background-move \.studio-custom-card-layer \{\s*z-index: 3;/);
});


test("custom binder exposes a compact collapsible usage guide", () => {
  const html = readFileSync(new URL("../studio.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../studio.css", import.meta.url), "utf8");

  assert.match(html, /<details class="studio-binder-guide">/);
  assert.match(html, /<strong>바인더 사용법<\/strong>/);
  assert.match(html, /페이지 스캔/);
  assert.match(html, /카드 찾기/);
  assert.match(html, /배경 이동/);
  assert.match(html, /나만의도감에 저장/);
  assert.match(css, /\.studio-binder-guide > summary/);
  assert.match(css, /\.studio-binder-guide\[open\] \.studio-binder-guide-chevron/);
});

test("page scan narrows unresolved slots to the Pokémon family of confirmed cards", () => {
  const studio = readFileSync(new URL("../studio-custom.js", import.meta.url), "utf8");
  const matcher = readFileSync(new URL("../card-visual-matcher.js", import.meta.url), "utf8");

  // 후보 범위만 좁히고 확정 기준(confidentScan)은 그대로 쓴다.
  assert.match(matcher, /options\?\.filter\) === "function"|typeof options\?\.filter === "function"/);
  assert.match(matcher, /fullIndex\.filter\(\(entry\) => options\.filter\(entry\.card\)\)/);
  assert.match(studio, /PAGE_THEME_MIN_ANCHORS = 2/);
  assert.match(studio, /PAGE_THEME_MAX_SPAN = 4/);
  assert.match(studio, /function inferPageTheme\(/);
  assert.match(studio, /rankImageCrop\(image, target\.crop, state\.catalog, 18, \{ filter: inTheme \}\)/);
  assert.match(studio, /if \(confirmed\.has\(target\.index\)\) continue;/);
  assert.match(studio, /matcher\.confidentScan\?\.\(pool\) \|\| matcher\.confident\(pool\)/);
  assert.match(studio, /후보 더 보기/);
});

test("page warp downsamples big photos first and slot crops keep more of each pocket", () => {
  const scanner = readFileSync(new URL("../binder-photo-scanner.js", import.meta.url), "utf8");

  assert.match(scanner, /const prescale = ratio > 1\.7 \? 1\.5 \/ ratio : 1;/);
  assert.match(scanner, /analysisCanvas\(image, Math\.max\(width, height\) \* prescale\)/);
  assert.match(scanner, /defaultPadRatio = 0\.004/);
  assert.match(scanner, /leftGap \* 0\.8/);
  assert.match(scanner, /rightGap \* 0\.8/);
});

test("unresolved scanned slots show a candidate badge that opens a tap-to-confirm sheet", () => {
  const studio = readFileSync(new URL("../studio-custom.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../studio.css", import.meta.url), "utf8");

  assert.match(studio, /studio-slot-review-badge/);
  assert.match(studio, /function openSlotCandidateSheet\(slotIndex\)/);
  assert.match(studio, /slot\.type === "card" \? null : state\.photoReview\?\.get\(slot\.index\)/);
  assert.match(studio, /recognitionCandidateButton\(slotIndex, match\)/);
  assert.match(studio, /사진 그대로 두기/);
  assert.match(css, /\.studio-slot-review-badge \{/);
  assert.match(css, /\.studio-slot-candidate-sheet \{/);
});

test("display crops tile the page without per-cell padding so spanning art stays continuous", () => {
  for (const [cols, rows] of [[3, 3], [3, 4], [4, 4]]) {
    const aspect = cols * 63 / (rows * 88);
    const height = 1200;
    const width = Math.round(height * aspect);
    const crops = api.buildDisplayCrops({ cols, rows }, null, width, height, 63 / 88);
    assert.equal(crops.length, cols * rows);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const crop = crops[row * cols + col];
        assert.ok(Math.abs(crop.x - col / cols) < 1e-5);
        assert.ok(Math.abs(crop.y - row / rows) < 1e-5);
        assert.ok(Math.abs(crop.width * width / (crop.height * height) - 63 / 88) < 0.004);
      }
    }
  }
});

test("display crops follow locally measured seams on a slightly bent page", () => {
  const cols = 3, rows = 3, width = 360, height = 480;
  // 2번째 가로 이음매가 열마다 다른 높이(320 / 316 / 312)에 있는 휜 페이지.
  const seamY = [[160, 160, 160], [320, 316, 312]];
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const col = Math.min(cols - 1, Math.floor(x * cols / width));
    const vertical = [120, 240].some((divider) => Math.abs(x - divider) < 5);
    const horizontal = seamY.some((line) => Math.abs(y - line[col]) < 5);
    const value = vertical || horizontal ? 25 : 215;
    data.set([value, value, value, 255], (y * width + x) * 4);
  }
  const image = canvas(width, height, data);
  // 전체 분할선은 평균 위치(가운데 열)로 주어진다고 가정한다.
  const layout = {
    cols, rows,
    xDividers: [{ position: 120 / width, halfWidth: 0.012 }, { position: 240 / width, halfWidth: 0.012 }],
    yDividers: [{ position: 160 / height, halfWidth: 0.01 }, { position: 316 / height, halfWidth: 0.01 }],
  };
  const seams = api.measureLocalSeams(image, { cols, rows }, layout);
  assert.ok(seams);
  const found = seams.horizontal[1].map((seam) => Math.round(seam.position * height));
  for (let col = 0; col < cols; col += 1) assert.ok(Math.abs(found[col] - seamY[1][col]) <= 2, `column ${col}: ${found[col]}`);

  const crops = api.buildDisplayCrops({ cols, rows }, layout, width, height, 63 / 88, 0.06, seams);
  // 어떤 칸에도 어두운 이음매 줄이 들어가지 않는다.
  crops.forEach((crop, index) => {
    const x = Math.round((crop.x + crop.width / 2) * width);
    for (const fy of [0.002, 0.5, 0.998]) {
      const y = Math.min(height - 1, Math.round((crop.y + crop.height * fy) * height));
      assert.ok(data[(y * width + x) * 4] > 100, `slot ${index} touches a seam at y=${y}`);
    }
  });
  // 같은 행의 칸은 각자 자기 열의 이음매에서 끝난다.
  const bottoms = [3, 4, 5].map((index) => Math.round((crops[index].y + crops[index].height) * height));
  assert.ok(bottoms[0] >= bottoms[2] + 6, `bottoms ${bottoms}`);
});

test("scanned page shows continuous display crops while recognition keeps card-safe crops", () => {
  const scanner = readFileSync(new URL("../binder-photo-scanner.js", import.meta.url), "utf8");
  const studio = readFileSync(new URL("../studio-custom.js", import.meta.url), "utf8");

  assert.match(scanner, /const displayCrops = buildDisplayCrops\(/);
  assert.match(scanner, /localSeams = measureLocalSeams\(corrected, grid, latestLayout\)/);
  assert.match(studio, /displayCrops\?\.\[index\] \|\| scanCrops\?\.\[index\] \|\| fallback/);
  assert.match(studio, /function recognitionCropForSlot\(slot, sourceId\)/);
  assert.match(studio, /crop: recognitionCropForSlot\(slot, source\.id\)/);
});
