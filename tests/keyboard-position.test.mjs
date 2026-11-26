import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function makeContainer(document, keys) {
  const container = {
    scrollLeft: 0,
    buttons: [],
    contains: (node) => container.buttons.includes(node),
    querySelectorAll: () => container.buttons,
    rebuild() {
      container.scrollLeft = 0;
      container.buttons = keys.map((category) => {
        const button = {
          dataset: { category },
          focus() { document.activeElement = button; },
        };
        return button;
      });
    },
  };
  container.rebuild();
  return container;
}

test("people filters keep keyboard focus and strip position when rebuilt", async () => {
  const source = await read("people.js");
  const start = source.indexOf("function filterButtonKey");
  const end = source.indexOf("function renderPeopleFilters");
  const document = { activeElement: null };
  const context = { document };
  vm.runInNewContext(`${source.slice(start, end)}; this.keep = keepButtonPosition;`, context);

  const container = makeContainer(document, ["all", "주인공", "라이벌"]);
  const chosen = container.buttons[2];
  chosen.dataset.addedElsewhere = "1";
  document.activeElement = chosen;
  container.scrollLeft = 40;
  context.keep([container], () => container.rebuild());

  assert.notEqual(document.activeElement, chosen);
  assert.equal(document.activeElement, container.buttons[2]);
  assert.equal(container.scrollLeft, 40);

  const outside = { dataset: {} };
  document.activeElement = outside;
  context.keep([container], () => container.rebuild());
  assert.equal(document.activeElement, outside, "focus elsewhere on the page is never taken");
  assert.match(source, /keepButtonPosition\(\[generationFilters, categoryFilters, statusFilters\]/);
  assert.match(source, /keepButtonPosition\(\[summary\]/);
});

test("world generation buttons and the shared print button keep keyboard focus", async () => {
  const world = await read("world.js");
  assert.match(world, /button\.dataset\.generation = String\(item\.generation\)/);
  assert.match(world, /focusedGeneration === button\.dataset\.generation\) button\.focus\(\{ preventScroll: true \}\)/);
  const print = await read("print.js");
  assert.match(print, /const hadFocus=document\.activeElement===button;/);
  assert.match(print, /button\.focus\(\{preventScroll:true\}\)/);
});
