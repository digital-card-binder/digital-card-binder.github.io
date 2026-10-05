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
});

test("successful page scan immediately performs conservative card recognition", () => {
  const studio = readFileSync(new URL("../studio-custom.js", import.meta.url), "utf8");

  assert.match(studio, /let autoRecognizeAfterImport = false/);
  assert.match(studio, /autoRecognizeAfterImport = true/);
  assert.match(studio, /if \(autoRecognizeAfterImport\) \{\s*await recognizeImportedPhotoCards\(\)/);
  assert.match(studio, /스캔 완료 · 카드 자동인식을 시작합니다/);
  assert.match(studio, /애매한 칸은 사진 그대로 유지했습니다/);
});
