#!/usr/bin/env python3
"""Resume XY archive-based color evidence without falsely completing 12 visual themes.

This script consumes the immutable 2026-10-26 image audit from the earlier
self-hosted Cloudflare review branch. It classifies *only* artwork color.
Individual narrative/scene inspection is a separate manual evidence gate.
The initial CP3 4-card 12-theme visual review is preserved untouched.
"""
from __future__ import annotations
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "data/audits/theme-xy-all37-image-color-proof-20261026.json"
RESULT = "data/audits/theme-xy-color-resume-20261026.json"
SOURCE_BLOB = "273b4137f543a8bbe64a3b642c8e0069652dcf17"
def load(p):
    return json.loads((ROOT / p).read_text(encoding="utf8"))
def save(p, o):
    (ROOT / p).write_text(json.dumps(o, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
def norm(s):
    return str(s or "").strip().lower()

proof = load(SOURCE)
assert proof["totalMasterCards"] == 2313
assert proof["actualSourceImageColorReviewed"] == 2117
assert proof["held"] == 196
assert proof["newStrictlyCompletedSetCount"] == 0
assert proof["otherElevenThemeVisualCertificationsPending"] is True
assert len(proof["sets"]) == 37 and len(proof["cards"]) == 2313
assert Counter(c["status"] for c in proof["cards"]) == {
    "official-source-color-reviewed": 2117, "held": 196
}
master = [s for s in load("data/series.json") + load("data/series-legacy.json") if s.get("era") == "XY"]
assert len(master) == 37 and sum(len(s["cards"]) for s in master) == 2313
sets = {norm(s["code"]): s for s in master}
assert len(sets) == 37
art = load("data/art-themes.json")
status = load("data/audits/theme-series-review-status.json")
assert set(g["code"] for g in art["groups"]) == {
    "sleeping", "connected", "evolution", "night", "season", "color",
    "sunset", "reflections", "food", "street", "work", "cameo"
}
theme_before = sum(len(g["cards"]) for g in art["groups"])
assert theme_before == 22041, "Unexpected base: stop rather than overwrite concurrent work"
group = next(g for g in art["groups"] if g["code"] == "color")
existing = {(norm(c.get("set")), norm(c.get("code"))): c for c in group["cards"]}
original_cp3 = status["reviews"]["CP3"].copy()
assert original_cp3["reviewedCardCount"] == 4 and original_cp3["status"] == "partial"

added = 0
preserved = 0
evidence_by_set = Counter()
hold_by_set = Counter()
seen = set()
for row in proof["cards"]:
    code_set = norm(row["set"])
    s = sets[code_set]
    n = row["index"]
    assert 1 <= n <= len(s["cards"]), (code_set, n)
    card = s["cards"][n - 1]
    assert row["code"] == card["code"] and row["name"] == card["name"]
    assert row["url"] == card["image"]
    assert (code_set, n) not in seen
    seen.add((code_set, n))
    if row["status"] == "held":
        hold_by_set[code_set] += 1
        continue
    assert row["status"] == "official-source-color-reviewed"
    assert row.get("actualImageColorAnalyzed") is True
    assert row.get("printedFooterVisuallyVerified") is False
    assert row.get("sourceHost") == "cards.image.pokemonkorea.co.kr"
    assert re.fullmatch("[a-f0-9]{64}", str(row.get("sha256", "")))
    assert row.get("colorCategory") and row.get("colorDistribution")
    assert card["code"].split("_", 1)[-1].split("/", 1)[0].isdigit()
    color_code = card["code"].split("/", 1)[0].upper()
    assert re.fullmatch(r"[A-Z0-9-]+_\d{3}", color_code), color_code
    key = (code_set, norm(color_code))
    evidence_by_set[code_set] += 1
    if key in existing:
        prev = existing[key]
        assert norm(prev["name"]) == norm(card["name"]), key
        assert norm(prev["set"]) == code_set
        preserved += 1
        continue
    payload = {
        "code": color_code,
        "name": card["name"],
        "series": "XY",
        "set": s["code"],
        "setName": s.get("displayName") or s.get("name") or s["code"],
        "cardNumber": card["code"].split("_", 1)[1],
        "rarity": card.get("rarity") or "",
        "category": row["colorCategory"],
        "image": card["image"],
        "evidence": (
            "2026-10-26 기존 자체 보관 한국판 카드 이미지(WebP)를 디코딩하여 "
            "일러스트 영역의 색상만 자동 분석. 이미지 SHA256=" + row["sha256"] +
            "; 출처 " + SOURCE +
            "; 연결/진화/배경/카메오 등 장면 및 실물 한글 인쇄번호는 별도 미검수."
        ),
    }
    group["cards"].append(payload)
    existing[key] = payload
    added += 1
assert len(seen) == 2313
assert sum(evidence_by_set.values()) == 2117
assert sum(hold_by_set.values()) == 196
assert preserved == 4, "Expected the four CP3 color tags already committed on main"
assert added == 2113, added
assert theme_before + added == 24154
assert len({(norm(c.get("set")), norm(c.get("code"))) for c in group["cards"]}) == len(group["cards"])
# Keep twelve-theme screened counts and manual approval untouched.
for s in master:
    code = s["code"]
    key = next((k for k in status["reviews"] if norm(k) == norm(code)), code)
    current = status["reviews"].get(key) or {}
    assert current.get("status") != "complete", f"XY {code} unexpectedly fully approved"
    status["reviews"][key] = {
        **current,
        "status": "partial",
        "sourceColorAuditAt": "2026-10-26",
        "sourceColorEvidenceReviewedCount": evidence_by_set[norm(code)],
        "sourceColorHeldCount": hold_by_set[norm(code)],
        "sourceColorAuditEvidence": RESULT,
    }
assert status["reviews"]["CP3"]["reviewedCardCount"] == 4
assert status["reviews"]["CP3"]["reviewedThemes"] == original_cp3["reviewedThemes"]
assert status["reviews"]["CP3"]["evidence"] == original_cp3["evidence"]
art["updatedAt"] = "2026-10-26"
status["updatedAt"] = "2026-10-26"
save("data/art-themes.json", art)
save("data/audits/theme-series-review-status.json", status)
save(RESULT, {
    "schemaVersion": 1,
    "recordedAt": "2026-10-26",
    "scope": "XY 37 Korean catalog sets, 2,313 records: archived IMAGE-PIXEL COLOR ONLY",
    "sourceEvidenceFile": SOURCE,
    "sourceEvidenceGitBlob": SOURCE_BLOB,
    "masterSetCount": 37,
    "masterCardCount": 2313,
    "archiveSourceColorReviewed": 2117,
    "archiveHeld": 196,
    "newColorThemeRows": added,
    "existingColorThemeRowsPreserved": preserved,
    "allThemeRowsBefore": theme_before,
    "allThemeRowsAfter": theme_before + added,
    "cardMasterModified": False,
    "ownershipOrFirestoreModified": False,
    "radarModified": False,
    "otherElevenThemesReviewedByThisChange": False,
    "allTwelveThemeVisualReviewComplete": False,
    "strictlyCompletedSetsAdded": 0,
    "nextWork": "Individual Korean printing and all 12 illustration themes still require per-card inspection; held cards need alternative Korean-print image proof.",
    "sets": [{
        "set": s["code"],
        "masterCards": len(s["cards"]),
        "archiveColorReviewed": evidence_by_set[norm(s["code"])],
        "held": hold_by_set[norm(s["code"])],
        "allTwelveThemesComplete": False,
    } for s in master],
})
test_file = ROOT / "tests/theme-card-identity.test.mjs"
test = test_file.read_text(encoding="utf8")
assert test.count("assert.equal(total,22041);") == 1
test_file.write_text(test.replace(
    "assert.equal(total,22041);",
    "assert.equal(total,24154); // XY archived artwork COLOR only; 11 story/scene themes still pending"
), encoding="utf8")
print("XY_COLOR_RESUMED", json.dumps({
    "archivedImageColorAnalyzed": 2117, "held": 196,
    "newColorThemeRows": added, "preservedCP3": preserved,
    "themeRowsAfter": theme_before + added,
    "completeTwelveThemeSets": 0,
}, ensure_ascii=False))
