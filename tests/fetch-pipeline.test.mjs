import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

function makePipeline(nativeImpl) {
  const calls = [];
  const window = {
    DigitalCardBinder: {},
    fetch: async (input, init) => {
      calls.push(typeof input === "string" ? input : input?.url);
      return nativeImpl(input, init);
    },
  };
  window.window = window;
  const context = vm.createContext({ window, console: { warn() {} }, Response, Headers });
  vm.runInContext(read("core/data/fetch-pipeline.js"), context);
  return { window, calls, pipeline: window.DigitalCardBinder.fetchPipeline };
}

const ok = (body) => new Response(JSON.stringify(body), { status: 200 });

test("handlers run in registration order and feed each other's response", async () => {
  const { window, pipeline } = makePipeline(async () => ok({ steps: [] }));
  for (const name of ["account", "guest"]) {
    pipeline.use(/data\/pokedex\.json(?:$|[?#])/, async (response) => {
      const data = await response.clone().json();
      data.steps.push(name);
      return ok(data);
    });
  }
  const data = await (await window.fetch("./data/pokedex.json?v=1")).json();
  assert.deepEqual(data.steps, ["account", "guest"]);
});

test("unrelated urls and non-OK responses are returned untouched", async () => {
  const bad = new Response("nope", { status: 404 });
  const { window, pipeline } = makePipeline(async (input) => (String(input).includes("missing") ? bad : ok({ a: 1 })));
  let touched = 0;
  pipeline.use(/data\/people\.json(?:$|[?#])/, async (response) => { touched += 1; return response; });
  await window.fetch("./data/pokedex.json");
  assert.equal(await window.fetch("./data/missing/people.json"), bad);
  assert.equal(touched, 0);
  await window.fetch("./data/people.json");
  assert.equal(touched, 1);
});

test("a throwing handler keeps the previous response and does not block later handlers", async () => {
  const { window, pipeline } = makePipeline(async () => ok({ v: 0 }));
  pipeline.use(/pokedex/, async () => { throw new Error("boom"); });
  pipeline.use(/pokedex/, async (response) => ok({ v: (await response.clone().json()).v + 1 }));
  assert.equal((await (await window.fetch("./data/pokedex.json")).json()).v, 1);
});

test("native fetch bypasses handlers and the pipeline is installed once", async () => {
  const { window, pipeline, calls } = makePipeline(async () => ok({ v: 0 }));
  pipeline.use(/pokedex/, async () => ok({ v: 99 }));
  assert.equal((await (await pipeline.native("./data/pokedex.json")).json()).v, 0);
  assert.equal((await (await window.fetch("./data/pokedex.json")).json()).v, 99);
  const before = window.fetch;
  vm.runInContext(read("core/data/fetch-pipeline.js"), vm.createContext({ window, console }));
  assert.equal(window.fetch, before);
  assert.equal(calls.length, 2);
  assert.throws(() => pipeline.use("pokedex", () => {}), { name: "TypeError" });
});

test("national and people pages load the pipeline before the managers that use it", () => {
  const cases = {
    "national.html": ["firebase-collection-manager.js", "guest-empty-dex.js"],
    "people.html": ["firebase-people-manager.js"],
  };
  for (const [page, scripts] of Object.entries(cases)) {
    const html = read(page);
    const pipeline = html.indexOf("core/data/fetch-pipeline.js");
    assert.ok(pipeline > 0, `${page} loads the fetch pipeline`);
    for (const script of scripts) {
      assert.ok(pipeline < html.indexOf(script), `${page}: pipeline must load before ${script}`);
      assert.match(read(script), /fetchPipeline\.use\(/, `${script} registers through the pipeline`);
    }
  }
});

test("on the national page the account handler is registered before the guest handler", () => {
  const html = read("national.html");
  assert.ok(html.indexOf("firebase-collection-manager.js") < html.indexOf("guest-empty-dex.js"));
});
