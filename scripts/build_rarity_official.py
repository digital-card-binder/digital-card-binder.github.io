#!/usr/bin/env python3
"""공식 카드검색 스크랩(kinbo-ptcg/ptcg-kr-db)에서 카드별 희귀도를 뽑아 data/rarity-official.json 을 만든다.

사용: python3 scripts/build_rarity_official.py /tmp/ptcg-kr-db
- 우리 series.json 에 있는 카드(세트코드_번호)만 남긴다.
- 카탈로그 희귀도와 다른 카드, 희귀도가 비어 있는 카드 현황을 data/audits/rarity-official-audit.json 에 기록한다.
- 기존 데이터는 수정하지 않는다(읽기 + 새 파일 2개 생성).
"""
import glob, json, re, sys, collections
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ptcg-kr-db")
norm = lambda s: s.lower().replace("+", "plus")

official = {}
for f in glob.glob(str(root / "card_data/**/*.json"), recursive=True):
    try:
        data = json.load(open(f, encoding="utf-8"))
    except Exception:
        continue
    if not isinstance(data, list):
        continue
    for card in data:
        for v in card.get("version_infos", []):
            if str(v.get("number", "")).isdigit() and v.get("rarity"):
                official[(norm(v["prodCode"]), int(v["number"]))] = v["rarity"]

series = json.load(open("data/series.json", encoding="utf-8"))
sets, conflicts, blank_left = {}, [], collections.Counter()
for g in series:
    sc = norm(g["code"])
    for c in g["cards"]:
        m = re.match(r"(.+)_(\d+)/", c["code"])
        if not m:
            continue
        num = int(m.group(2))
        off = official.get((norm(m.group(1)), num))
        cur = c.get("rarity")
        if off:
            sets.setdefault(g["code"], {})[f"{num:03d}"] = off
            if cur not in (None, "") and cur != off:
                conflicts.append({"set": g["code"], "number": num, "name": c["name"], "catalog": cur, "official": off})
        elif cur in (None, ""):
            blank_left[g["code"]] += 1

out = {
    "source": "https://github.com/kinbo-ptcg/ptcg-kr-db (pokemoncard.co.kr 카드검색 스크랩)",
    "note": "공식 스크랩 기준 희귀도. 세트코드는 series.json 의 code, 키는 3자리 카드번호.",
    "sets": sets,
}
Path("data/rarity-official.json").write_text(
    json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
audit = {
    "coveredSets": len(sets),
    "coveredCards": sum(len(v) for v in sets.values()),
    "conflictCount": len(conflicts),
    "conflicts": conflicts,
    "blankRarityNotCoveredBySet": dict(blank_left.most_common()),
}
Path("data/audits/rarity-official-audit.json").write_text(
    json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(audit["coveredSets"], audit["coveredCards"], audit["conflictCount"], sum(blank_left.values()))
