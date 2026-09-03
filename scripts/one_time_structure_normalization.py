from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise RuntimeError(f"Expected block not found in {path}: {old[:120]!r}")
    content = content.replace(old, new, 1)
    write(path, content)


def merge_pokemon_groups() -> tuple[int, int]:
    base = json.loads(read("data/pokemon-collections.json"))
    sequence = json.loads(read("data/pokemon-collections-21-40.json"))
    merged: dict[str, dict] = {}
    for group in [*base, *sequence]:
        name = str(group.get("name") or "").strip()
        if name:
            merged[name] = group
    groups = list(merged.values())
    return len(groups), sum(len(group.get("cards") or []) for group in groups)


pokemon_group_count, pokemon_card_count = merge_pokemon_groups()

# 1) Main push also runs the full verification suite.
replace_once(
    ".github/workflows/verify.yml",
    "on:\n  pull_request:\n",
    "on:\n  push:\n    branches:\n      - main\n  pull_request:\n",
)

# 2) Keep transient trigger files out of Git going forward.
gitignore = read(".gitignore")
if ".tmp-*\n" not in gitignore:
    if not gitignore.endswith("\n"):
        gitignore += "\n"
    gitignore += ".tmp-*\n"
write(".gitignore", gitignore)

# 3) Registry: Pokémon collections must use both committed Pokémon data sources.
registry_path = "collector-collection-registry.js"
registry = read(registry_path)
old_registry_loader = '''    const pathByCollection = {
      artist: "./data/artists.json",
      series: "./data/series.json",
      pokemon: "./data/pokemon-collections.json",
      ar: "./data/ar.json",
      trainerPokemon: "./data/trainer-pokemon.json",
    };
    const payload = await fetchJson(pathByCollection[collectionId]);
    let sourceGroups = collectionId === "artist"
      ? payload.artists || []
      : collectionId === "trainerPokemon"
        ? payload.groups || []
        : payload || [];
'''
new_registry_loader = '''    const pathByCollection = {
      artist: "./data/artists.json",
      series: "./data/series.json",
      pokemon: "./data/pokemon-collections.json",
      ar: "./data/ar.json",
      trainerPokemon: "./data/trainer-pokemon.json",
    };
    let payload;
    if (collectionId === "pokemon") {
      const [baseGroups, sequenceGroups] = await Promise.all([
        fetchJson("./data/pokemon-collections.json"),
        fetchJson("./data/pokemon-collections-21-40.json"),
      ]);
      const mergedByName = new Map();
      [...(baseGroups || []), ...(sequenceGroups || [])].forEach((group) => {
        const name = cleanString(group?.name);
        if (name) mergedByName.set(name, group);
      });
      payload = [...mergedByName.values()];
    } else {
      payload = await fetchJson(pathByCollection[collectionId]);
    }
    let sourceGroups = collectionId === "artist"
      ? payload.artists || []
      : collectionId === "trainerPokemon"
        ? payload.groups || []
        : payload || [];
'''
if old_registry_loader not in registry:
    raise RuntimeError("Registry loader block changed unexpectedly")
registry = registry.replace(old_registry_loader, new_registry_loader, 1)
registry = registry.replace("      catalogCount: 679,", f"      catalogCount: {pokemon_card_count},", 1)
write(registry_path, registry)

# 4) Dashboard: use accountIndex-compatible keys and merge staged AR/Pokémon data.
dashboard_path = "dashboard.js"
dashboard = read(dashboard_path)
old_identity_start = '''  function pageCardIdentity(category, group, card, groupIndex, cardIndex) {
    const groupId = groupIdentity(group, groupIndex);

    if (category === "artist") {
'''
new_identity_start = '''  function pageCardIdentity(category, group, card, groupIndex, cardIndex) {
    const groupId = groupIdentity(group, groupIndex);
    const accountIndex = Number.isInteger(card.accountIndex)
      ? card.accountIndex
      : cardIndex;

    if (category === "trainerPokemon") {
      return [
        "trainerPokemon",
        groupId,
        card.meta || card.code || card.name || cardIndex,
        accountIndex,
      ].join("::");
    }

    if (category === "artist") {
'''
if old_identity_start not in dashboard:
    raise RuntimeError("Dashboard identity block changed unexpectedly")
dashboard = dashboard.replace(old_identity_start, new_identity_start, 1)
dashboard = dashboard.replace(
    '''    return [
      groupId,
      card.meta || card.code || card.name || cardIndex,
      cardIndex,
    ].join("::");
  }

  async function fetchJson(url) {''',
    '''    return [
      groupId,
      card.meta || card.code || card.name || cardIndex,
      accountIndex,
    ].join("::");
  }

  async function fetchJson(url) {''',
    1,
)
old_dashboard_loader = '''  async function loadCatalogs() {
    const [pokedex, artists, series, pokemon, ar, packs, people, trainerPokemon] = await Promise.all([
      fetchJson("./data/pokedex.json"),
      fetchJson("./data/artists.json"),
      fetchJson("./data/series.json"),
      fetchJson("./data/pokemon-collections.json"),
      fetchJson("./data/ar.json"),
      fetchPacks(),
      fetchJson("./data/people.json"),
      fetchJson("./data/trainer-pokemon.json"),
    ]);
    return buildCatalogs(
      pokedex, artists, series, pokemon, ar, packs, people, trainerPokemon,
    );
  }
'''
new_dashboard_loader = '''  function mergeGroupsByName(baseGroups, extraGroups) {
    const merged = new Map();
    [...(baseGroups || []), ...(extraGroups || [])].forEach((group) => {
      const name = String(group?.name || "").trim();
      if (name) merged.set(name, group);
    });
    return [...merged.values()];
  }

  function mergeGroupsByCode(baseGroups, extraGroups) {
    const merged = new Map();
    [...(baseGroups || []), ...(extraGroups || [])].forEach((group) => {
      const code = String(group?.code || group?.name || "").trim().toLowerCase();
      if (code) merged.set(code, group);
    });
    return [...merged.values()];
  }

  async function loadCatalogs() {
    const [
      pokedex,
      artists,
      series,
      pokemon,
      pokemonSequence,
      ar,
      arSupplement,
      packs,
      people,
      trainerPokemon,
    ] = await Promise.all([
      fetchJson("./data/pokedex.json"),
      fetchJson("./data/artists.json"),
      fetchJson("./data/series.json"),
      fetchJson("./data/pokemon-collections.json"),
      fetchJson("./data/pokemon-collections-21-40.json"),
      fetchJson("./data/ar.json"),
      fetchJson("./data/ar-supplement.json").catch(() => []),
      fetchPacks(),
      fetchJson("./data/people.json"),
      fetchJson("./data/trainer-pokemon.json"),
    ]);
    return buildCatalogs(
      pokedex,
      artists,
      series,
      mergeGroupsByName(pokemon, pokemonSequence),
      mergeGroupsByCode(ar, arSupplement),
      packs,
      people,
      trainerPokemon,
    );
  }
'''
if old_dashboard_loader not in dashboard:
    raise RuntimeError("Dashboard catalog loader block changed unexpectedly")
dashboard = dashboard.replace(old_dashboard_loader, new_dashboard_loader, 1)
write(dashboard_path, dashboard)

# 5) Owner Sheets: read the same staged AR/Pokémon sources as the live pages.
sheets_path = "owner-sheets-sync.js"
sheets = read(sheets_path)
sheets = sheets.replace(
    '''    pokemon: "./data/pokemon-collections.json",
    ar: "./data/ar.json",
    packs: "./packs.js",''',
    '''    pokemon: "./data/pokemon-collections.json",
    pokemonSequence: "./data/pokemon-collections-21-40.json",
    ar: "./data/ar.json",
    arSupplement: "./data/ar-supplement.json",
    packs: "./packs.js",''',
    1,
)
old_sheets_loader = '''  async function loadCatalogs() {
    if (!catalogPromise) {
      catalogPromise = Promise.all([
        fetchJson(DATA_FILES.pokedex),
        fetchJson(DATA_FILES.artists),
        fetchJson(DATA_FILES.series),
        fetchJson(DATA_FILES.pokemon),
        fetchJson(DATA_FILES.ar),
        fetchPacks(),
        fetchJson(DATA_FILES.trainerPokemon),
      ]).then(([pokedex, artists, series, pokemon, ar, packs, trainerPokemon]) => ({
        pokedex,
        artists,
        series,
        pokemon,
        ar,
        packs,
        trainerPokemon,
      }));
    }
    return catalogPromise;
  }
'''
new_sheets_loader = '''  function mergeGroupsByName(baseGroups, extraGroups) {
    const merged = new Map();
    [...(baseGroups || []), ...(extraGroups || [])].forEach((group) => {
      const name = String(group?.name || "").trim();
      if (name) merged.set(name, group);
    });
    return [...merged.values()];
  }

  function mergeGroupsByCode(baseGroups, extraGroups) {
    const merged = new Map();
    [...(baseGroups || []), ...(extraGroups || [])].forEach((group) => {
      const code = String(group?.code || group?.name || "").trim().toLowerCase();
      if (code) merged.set(code, group);
    });
    return [...merged.values()];
  }

  async function loadCatalogs() {
    if (!catalogPromise) {
      catalogPromise = Promise.all([
        fetchJson(DATA_FILES.pokedex),
        fetchJson(DATA_FILES.artists),
        fetchJson(DATA_FILES.series),
        fetchJson(DATA_FILES.pokemon),
        fetchJson(DATA_FILES.pokemonSequence),
        fetchJson(DATA_FILES.ar),
        fetchJson(DATA_FILES.arSupplement).catch(() => []),
        fetchPacks(),
        fetchJson(DATA_FILES.trainerPokemon),
      ]).then(([
        pokedex,
        artists,
        series,
        pokemon,
        pokemonSequence,
        ar,
        arSupplement,
        packs,
        trainerPokemon,
      ]) => ({
        pokedex,
        artists,
        series,
        pokemon: mergeGroupsByName(pokemon, pokemonSequence),
        ar: mergeGroupsByCode(ar, arSupplement),
        packs,
        trainerPokemon,
      }));
    }
    return catalogPromise;
  }
'''
if old_sheets_loader not in sheets:
    raise RuntimeError("Sheets catalog loader block changed unexpectedly")
sheets = sheets.replace(old_sheets_loader, new_sheets_loader, 1)
write(sheets_path, sheets)

# 6) Static-site verification includes all current collection pages.
check_path = "scripts/check-static-site.mjs"
check_source = read(check_path)
check_source = check_source.replace(
    '''  "people.html",
  "collector-settings.html",''',
    '''  "people.html",
  "trainer-pokemon.html",
  "world.html",
  "custom.html",
  "collector-settings.html",''',
    1,
)
write(check_path, check_source)

# 7) Registry regression expectations now reflect the combined Pokémon catalog.
registry_test_path = "tests/collector-registry.test.mjs"
registry_test = read(registry_test_path)
registry_test = registry_test.replace("    pokemon: 679,", f"    pokemon: {pokemon_card_count},", 1)
registry_test = registry_test.replace("    pokemon: 47,", f"    pokemon: {pokemon_group_count},", 1)
write(registry_test_path, registry_test)

# 8) Add a structural contract test and ensure the existing AR baseline test actually runs.
structure_test = r'''import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const registry = read("collector-collection-registry.js");
const dashboard = read("dashboard.js");
const sheets = read("owner-sheets-sync.js");
const verify = read(".github/workflows/verify.yml");

const htmlFiles = [
  "index.html",
  "national.html",
  "packs.html",
  "artists.html",
  "series.html",
  "pokemon-collections.html",
  "ar.html",
  "people.html",
  "trainer-pokemon.html",
  "world.html",
  "custom.html",
  "collector-settings.html",
];

test("all consumers include staged Pokemon collection data", () => {
  for (const [name, source] of [
    ["registry", registry],
    ["dashboard", dashboard],
    ["owner sheets", sheets],
  ]) {
    assert.match(source, /pokemon-collections-21-40[.]json/, name);
  }
});

test("dashboard and owner sheets include AR supplement data", () => {
  assert.match(dashboard, /ar-supplement[.]json/);
  assert.match(sheets, /ar-supplement[.]json/);
});

test("dashboard identity uses accountIndex and trainerPokemon namespace", () => {
  assert.match(dashboard, /const accountIndex = Number[.]isInteger\(card[.]accountIndex\)/);
  assert.match(dashboard, /"trainerPokemon",\s*groupId,/s);
  assert.match(dashboard, /card[.]meta \|\| card[.]code \|\| card[.]name \|\| cardIndex,\s*accountIndex,/s);
});

test("main pushes run the verification suite", () => {
  assert.match(verify, /push:\s*branches:\s*- main/s);
});

test("static navigation does not ship known stale collection counts", () => {
  for (const file of htmlFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /29 ARTISTS/, file);
    assert.doesNotMatch(source, /SV · M · 498 CARDS/, file);
    assert.doesNotMatch(source, /1025 POKÉMON/, file);
  }
});
'''
write("tests/structure-consistency.test.mjs", structure_test)

package_path = "package.json"
package = read(package_path)
old_registry_script = '"test:registry": "node --test tests/collector-registry.test.mjs tests/world-exploration-data.test.mjs tests/trainer-pokemon-data.test.mjs"'
new_registry_script = '"test:registry": "node --test tests/collector-registry.test.mjs tests/world-exploration-data.test.mjs tests/trainer-pokemon-data.test.mjs tests/ar-count-baseline.test.mjs tests/structure-consistency.test.mjs"'
if old_registry_script not in package:
    raise RuntimeError("package.json registry test command changed unexpectedly")
package = package.replace(old_registry_script, new_registry_script, 1)
write(package_path, package)

# 9) Remove stale static labels that were previously corrected only at runtime.
for html_path in ROOT.glob("*.html"):
    source = html_path.read_text(encoding="utf-8")
    source = source.replace("29 ARTISTS", "40 ARTISTS")
    source = source.replace("SV · M · 498 CARDS", "SV · M · 510 CARDS")
    source = source.replace("1025 POKÉMON", f"{pokemon_group_count} POKÉMON")
    html_path.write_text(source, encoding="utf-8")

nav_path = "collector-nav.js"
nav = read(nav_path)
nav = re.sub(r'pokemonCount\.textContent = "\d+ POKÉMON";', f'pokemonCount.textContent = "{pokemon_group_count} POKÉMON";', nav, count=1)
write(nav_path, nav)

# 10) Remove files proven to be transient or duplicate, without touching the live APK.
(ROOT / ".tmp-trainer-trigger").unlink(missing_ok=True)

duplicate_apk = ROOT / "downloads" / "DigitalCardBinder_v0.8.apk"
if duplicate_apk.exists():
    needle = "downloads/DigitalCardBinder_v0.8.apk"
    for candidate in ROOT.rglob("*"):
        if not candidate.is_file() or candidate == duplicate_apk or ".git" in candidate.parts:
            continue
        if candidate.suffix.lower() not in {".html", ".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".py", ".gradle", ".xml"}:
            continue
        try:
            if needle in candidate.read_text(encoding="utf-8"):
                raise RuntimeError(f"Duplicate APK is still referenced by {candidate.relative_to(ROOT)}")
        except UnicodeDecodeError:
            pass
    duplicate_apk.unlink()
    try:
        duplicate_apk.parent.rmdir()
    except OSError:
        pass

# 11) Leave a maintenance note so future changes follow one data rule.
maintenance = f'''# Structure maintenance guide

This repository intentionally preserves existing Firestore documents and collection keys.
Structural cleanup must not migrate or reset user collection data unless a separate migration is explicitly designed and tested.

## Canonical catalog rules

- AR: the effective catalog is `data/ar.json` plus `data/ar-supplement.json`, merged by set code. All dashboard, public summary, page and owner-Sheets consumers must see the same effective catalog.
- Pokemon collections: the effective populated catalog is `data/pokemon-collections.json` plus `data/pokemon-collections-21-40.json`, merged by Pokemon name. Current populated groups: {pokemon_group_count}; current cards: {pokemon_card_count}.
- Trainer x Pokemon: account keys are namespaced with `trainerPokemon::` and use `accountIndex` when present.
- Custom dex: stored under `pokemonCollectionsDex.customDexes`. `custom-sharing.js` remains a compatibility extension and must load before dashboard/settings consumers that need the custom registry entry.
- World exploration: ownership and representative-card overrides are currently browser-local (`localStorage`) by design. Do not silently migrate them into Firestore during unrelated cleanup.

## Deployment safety

- `backup/pre-structure-cleanup-20260903` is the immutable pre-cleanup rollback reference.
- Feature work should use a branch and pull request.
- `npm test` must pass before merge.
- The Verify workflow runs for pull requests and direct pushes to `main`.

## Repository hygiene

- Do not commit `.tmp-*` trigger files.
- Keep only the live root `DigitalCardBinder_v0.8.apk`; old build outputs belong in GitHub Actions artifacts/releases, not duplicate repository paths.
- Avoid introducing new `*-fix.js` or `*-supplement.js` files for permanent behavior unless there is a staged-data reason. Prefer consolidating stable behavior into the owning module after compatibility is verified.
'''
write("docs/structure-maintenance.md", maintenance)

README = read("README.md")
if "structure-maintenance.md" not in README:
    README += "\n## 구조 유지보수\n\n도감 데이터의 단일 기준, 롤백 원칙과 임시 파일 정리 기준은 [구조 유지보수 가이드](./docs/structure-maintenance.md)를 참고하세요.\n"
    write("README.md", README)

print(f"Normalized structure for {pokemon_group_count} populated Pokemon groups / {pokemon_card_count} cards")
