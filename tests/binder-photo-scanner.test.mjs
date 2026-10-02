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

test("degenerate scan rejects instead of silently importing a centered crop", async () => {
  await assert.rejects(api.warpPerspective(canvas(100, 100), [trapezoid[0], trapezoid[2], trapezoid[1], trapezoid[3]], 1));
  assert.equal(api.scan, undefined);
});
