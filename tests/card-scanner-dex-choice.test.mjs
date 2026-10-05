import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("scanner requires an explicit standalone dex choice", () => {
  const source = read("card-scanner.js");

  assert.doesNotMatch(source, /defaultSelected:\s*true/);
  assert.match(source, /checkbox[.]checked = false/);
  assert.match(source, /어느 도감에 기록할까요[?]/);
  assert.match(source, /선택한 도감만 변경/);
  assert.match(source, /도감을 선택해 주세요/);
  assert.match(source, /selectedMembershipInputs/);
  assert.match(source, /updateMembershipSelectionUi/);
  assert.match(source, /input\[type="checkbox"\]:checked:not\(:disabled\)/);
});

test("scanner can offer all card-level standalone dex destinations", () => {
  const source = read("card-scanner.js");

  for (const collectionId of [
    "series",
    "ar",
    "pokemon",
    "artist",
    "people",
    "trainerPokemon",
    "fossil",
    "world",
    "artThemes",
    "national",
    "custom",
  ]) {
    assert.match(
      source,
      new RegExp(`"${collectionId}"`),
      `${collectionId}: scan destination`,
    );
  }

  assert.match(source, /catalogService[.]worldGroups\(\)/);
  assert.match(source, /[.]json\("\.\/data\/art-themes[.]json"\)/);
  assert.match(source, /[.]json\("\.\/data\/people[.]json"\)/);
});

test("people scan writes people-only ownership fields", () => {
  const source = read("card-scanner.js");
  const start = source.indexOf("async function writePeopleMembership");
  const end = source.indexOf("async function writeNationalRepresentative", start);
  assert.ok(start >= 0 && end > start);

  const peopleWriter = source.slice(start, end);
  assert.match(peopleWriter, /peopleOwned/);
  assert.match(peopleWriter, /peopleOverrides/);
  assert.doesNotMatch(peopleWriter, /overrides:\s*\{/);
  assert.doesNotMatch(peopleWriter, /writeFixedMembership/);
});

test("scanner only persists checked missing memberships", () => {
  const source = read("card-scanner.js");
  const start = source.indexOf("async function saveSelectedMemberships");
  const end = source.indexOf("buildUi();", start);
  assert.ok(start >= 0 && end > start);
  const save = source.slice(start, end);

  assert.match(save, /checked:not\(:disabled\)/);
  assert.match(save, /selectedIds[.]has\(membership[.]id\)/);
  assert.match(save, /!membership[.]owned/);
  assert.match(save, /membership[.]mode === "people"/);
  assert.match(save, /writePeopleMembership\(membership\)/);
});

test("scanner destination chooser is mobile touch friendly", () => {
  const css = read("card-scanner.css");
  assert.match(css, /[.]card-scan-membership[.]is-selected/);
  assert.match(css, /[.]card-scan-current-badge/);
  assert.match(css, /[.]card-scan-membership-actions > span/);
  assert.match(
    css,
    /@media \(max-width: 690px\)[\s\S]*?[.]card-scan-save-row[\s\S]*?position: sticky/,
  );
});
