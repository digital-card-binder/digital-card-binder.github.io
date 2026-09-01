#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = json.loads((ROOT / "data/5ban-legacy-audit.json").read_text(encoding="utf-8"))
FIVEBAN_TOTAL = int(AUDIT["fivebanTotal"])
CATALOG_TOTAL = int(AUDIT["artistCatalogTotal"])
LEGACY_TOTAL = int(AUDIT["uniqueLegacyImages"])

if (FIVEBAN_TOTAL, CATALOG_TOTAL, LEGACY_TOTAL) != (1443, 4838, 745):
    raise RuntimeError(f"Unexpected audit totals: {FIVEBAN_TOTAL}, {CATALOG_TOTAL}, {LEGACY_TOTAL}")


def replace(path: str, old: str, new: str, *, count: int | None = None) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    occurrences = text.count(old)
    expected = 1 if count is None else count
    if occurrences != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrences of {old!r}, found {occurrences}")
    target.write_text(text.replace(old, new), encoding="utf-8")


replace("collector-collection-registry.js", "catalogCount: 4093,", "catalogCount: 4838,")
replace("scripts/validate_artist_data.py", "EXPECTED_CARD_COUNT = 4093", "EXPECTED_CARD_COUNT = 4838")
replace("tests/collector-registry.test.mjs", "4093", "4838", count=2)
replace("artists.js", "./data/artists.json?v=20260901-1", "./data/artists.json?v=20260901-2")

builder_path = ROOT / "scripts/build_5ban_artist_data.py"
builder = builder_path.read_text(encoding="utf-8")
for old, new in (
    ("EXPECTED_5BAN_TOTAL = 698", "EXPECTED_5BAN_TOTAL = 1443"),
    ("EXPECTED_FINAL_TOTAL = 4093", "EXPECTED_FINAL_TOTAL = 4838"),
    ("def build_5ban_group() -> dict:", "def build_5ban_group(existing_cards: list[dict] | None = None) -> dict:"),
):
    if builder.count(old) != 1:
        raise RuntimeError(f"builder: expected one {old!r}")
    builder = builder.replace(old, new)

old_merge = """    m6 = [m6_card(number, name, rarity) for number, name, rarity in M6_5BAN]\n    cards = m6 + cards\n    for order, card in enumerate(cards, start=1):\n"""
new_merge = """    m6 = [m6_card(number, name, rarity) for number, name, rarity in M6_5BAN]\n    cards = m6 + cards\n\n    # Preserve officially reconciled Korean legacy rows that are outside the\n    # modern TCGdex/local-image build floor. This prevents a routine rebuild\n    # from deleting the BW/XY catalog added by reconcile_5ban_legacy.py.\n    seen_images = {common.normalized_image(str(card.get(\"image\") or \"\")) for card in cards}\n    for existing in existing_cards or []:\n        image = str(existing.get(\"image\") or \"\")\n        image_id = common.normalized_image(image)\n        if not image.startswith(OFFICIAL_IMAGE_PREFIX) or image_id in seen_images:\n            continue\n        preserved = dict(existing)\n        preserved[\"owned\"] = False\n        cards.append(preserved)\n        seen_images.add(image_id)\n\n    for order, card in enumerate(cards, start=1):\n"""
if builder.count(old_merge) != 1:
    raise RuntimeError("builder: modern merge anchor changed")
builder = builder.replace(old_merge, new_merge)

old_main = """    payload = json.loads(target.read_text(encoding=\"utf-8\"))\n    artists = [artist for artist in payload.get(\"artists\", []) if artist.get(\"name\") != ARTIST]\n\n    by_name = {artist.get(\"name\"): artist for artist in artists}\n"""
new_main = """    payload = json.loads(target.read_text(encoding=\"utf-8\"))\n    existing_fiveban = next(\n        (artist for artist in payload.get(\"artists\", []) if artist.get(\"name\") == ARTIST),\n        {\"cards\": []},\n    )\n    artists = [artist for artist in payload.get(\"artists\", []) if artist.get(\"name\") != ARTIST]\n\n    by_name = {artist.get(\"name\"): artist for artist in artists}\n"""
if builder.count(old_main) != 1:
    raise RuntimeError("builder: main anchor changed")
builder = builder.replace(old_main, new_main)

old_call = "    fiveban = build_5ban_group()\n"
new_call = "    fiveban = build_5ban_group(list(existing_fiveban.get(\"cards\") or []))\n"
if builder.count(old_call) != 1:
    raise RuntimeError("builder: build call anchor changed")
builder = builder.replace(old_call, new_call)
builder_path.write_text(builder, encoding="utf-8")

doc = f"""# 5ban Graphics 작가도감 데이터 메모\n\n- 작가명: 5ban Graphics\n- 기본 보유 상태: 0장 / 전체 미보유\n- 한글판 현재 확정 반영: {FIVEBAN_TOTAL:,}장\n  - SM · 소드&실드 · SV · MEGA 기존 공식 이미지 매칭: 685장\n  - M6 스톰에메랄다: 13장\n  - BW · XY 및 해당 시기 한국 프로모 공식 전수 대조 추가: {LEGACY_TOTAL:,}장\n- 구세대 검수 범위: 포켓몬코리아 카드검색에 노출된 관련 상품 {len(AUDIT['productsScanned'])}개, 카드 상세 {AUDIT['uniqueDetailPages']:,}건\n- 구세대 선정 기준: 공식 카드 상세 페이지의 `일러스트` 값이 `5ban Graphics`와 정확히 일치\n- 재포장/상품 중복 처리: 동일 포켓몬코리아 공식 카드 이미지 엔트리는 1장으로 통합\n- 작가도감 전체: 40명 / {CATALOG_TOTAL:,}장\n- 기존 Firebase 사용자 보유 override는 변경하지 않는다.\n- 이 수량은 서로 다른 그림의 개수가 아니라 한글판 수집 카드 엔트리 수다.\n"""
(ROOT / "docs/5ban-graphics-data-note.md").write_text(doc, encoding="utf-8")

print(f"Finalized 5ban={FIVEBAN_TOTAL}, artist catalog={CATALOG_TOTAL}, legacy={LEGACY_TOTAL}")
