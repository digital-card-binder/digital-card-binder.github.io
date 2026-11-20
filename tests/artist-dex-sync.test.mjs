import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const artists = JSON.parse(read("data/artists.json"));
const roster = JSON.parse(read("data/artist-roster.json"));

test("artist dex follows the roster and keeps ownership keys stable", () => {
  assert.deepEqual(artists.artists.map((artist) => artist.name), roster.artists);
  assert.equal(artists.artistCount, roster.artists.length);
  assert.equal(artists.cardCount, artists.artists.reduce((sum, artist) => sum + artist.cards.length, 0));
  for (const artist of artists.artists) {
    // order는 수집 기록 키이므로 1부터 빈틈없이 이어지고, 화면 순서는 displayOrder가 맡는다.
    assert.deepEqual(artist.cards.map((card) => card.order), artist.cards.map((_, index) => index + 1), artist.name);
    const display = artist.cards.map((card) => card.displayOrder).sort((a, b) => a - b);
    assert.deepEqual(display, artist.cards.map((_, index) => index + 1), `${artist.name} displayOrder`);
  }
});

test("artist dex sync only adds verified Korean cards and never rewrites existing ones", () => {
  const script = read("scripts/sync_artist_dex.py");
  assert.match(script, /기존 카드가 바뀌었습니다/);
  assert.match(script, /name_matches\(card\["name"\], dex_ids, dex_names\)/);
  assert.match(script, /visual_match\(query, set_fingerprints\.get/);
  assert.match(script, /no-visual-match/);
  const report = JSON.parse(read("data/audits/artist-dex-sync.json"));
  assert.equal(report.tcgdexRef, roster.tcgdexRef);
  assert.match(artists.illustratorIndex, new RegExp(roster.tcgdexRef));
});

test("artist page sorts by display order and new series trigger an automatic sync", () => {
  assert.match(read("artists.js"), /\(a\.displayOrder\?\?a\.order\)-\(b\.displayOrder\?\?b\.order\)/);
  const workflow = read(".github/workflows/sync-artist-dex.yml");
  assert.match(workflow, /data\/pokemon-search-index\.json/);
  assert.match(workflow, /data\/artist-roster\.json/);
  assert.match(workflow, /python scripts\/sync_artist_dex\.py --clone --latest/);
  assert.match(workflow, /python scripts\/validate_artist_data\.py data\/artists\.json/);
});
