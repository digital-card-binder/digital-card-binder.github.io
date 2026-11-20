import { execFileSync } from "node:child_process";
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
  assert.match(script, /name_matches\(c\["name"\], (plan\["dexIds"\]|dex_ids), dex_names\)/);
  assert.match(script, /visual_match\(query, /);
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

test("trainer/energy cards are matched by translated card name only when the name and rarity are unambiguous", () => {
  const script = read("scripts/sync_artist_dex.py");
  assert.match(script, /learn_name_dictionary\(name_pairs\)/);
  assert.match(script, /name-ambiguous/);
  let output = null;
  try {
    output = execFileSync("python3", ["-I", "-c", `
import sys, json
sys.path.insert(0, "scripts")
import sync_artist_dex as s
d = s.learn_name_dictionary([("ネストボール", "네스트볼"), ("ネストボール", "네스트볼"), ("ふしぎなアメ", "이상한사탕"), ("ふしぎなアメ", "이상한 사탕 ")])
conflict = s.learn_name_dictionary([("A", "가"), ("A", "나")])
catalog = {("sv1", 1): [{"name": "네스트볼", "rarity": "U"}], ("sv1", 9): [{"name": "네스트볼", "rarity": "SR"}]}
by_set = {"sv1": [1, 9]}
print(json.dumps({
  "dict": d, "conflict": conflict,
  "low": s.name_candidates("sv1", "네스트볼", "Uncommon", catalog, by_set),
  "high": s.name_candidates("sv1", "네스트볼", "Ultra Rare", catalog, by_set),
}, ensure_ascii=False))
`], { encoding: "utf8", cwd: new URL("..", import.meta.url) });
  } catch (error) {
    // python or Pillow (imported by the sync script) is not available in this environment
    if (error.code === "ENOENT" || /ModuleNotFoundError/.test(String(error.stderr))) return;
    throw error;
  }
  const result = JSON.parse(output);
  assert.equal(result.dict["ネストボール"], "네스트볼");
  assert.equal(result.dict["ふしぎなアメ"], "이상한사탕");
  assert.deepEqual(result.conflict, {});
  assert.deepEqual(result.low, [1]);
  assert.deepEqual(result.high, [9]);
});
