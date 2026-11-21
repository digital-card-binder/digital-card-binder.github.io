#!/usr/bin/env python3
"""희귀도 통합 맵(data/rarity-map.json) 생성.

우선순위: 공식 스크랩(data/rarity-official.json) > dogam 신규 세트(data/rarity-dogam-newsets.json).
읽기 전용 입력 2개 + series.json 으로 새 파일 1개와 커버리지 리포트를 만든다. 기존 데이터는 수정하지 않는다.
"""
import json, re
from collections import Counter
from pathlib import Path

official = json.load(open("data/rarity-official.json", encoding="utf-8"))["sets"]
dogam = json.load(open("data/rarity-dogam-newsets.json", encoding="utf-8"))["sets"]
series = json.load(open("data/series.json", encoding="utf-8"))

merged = {k: dict(v) for k, v in official.items()}
dogam_cards = 0
for code, by_rarity in dogam.items():
    for rarity, nums in by_rarity.items():
        for n in nums:
            if n not in merged.setdefault(code, {}):
                merged[code][n] = rarity
                dogam_cards += 1

cover, secret_blank = {}, Counter()
for g in series:
    if g.get("era") not in ("S", "SM", "SV", "M"):
        continue
    total = known = 0
    for c in g["cards"]:
        m = re.match(r".+_(\d+)/(\d+)", c["code"])
        if not m:
            continue
        total += 1
        n = m.group(1)
        if n in merged.get(g["code"], {}) or c.get("rarity") not in (None, ""):
            known += 1
        elif int(n) > int(m.group(2)):
            secret_blank[g["code"]] += 1
    cover[g["code"]] = [known, total]

Path("data/rarity-map.json").write_text(json.dumps(
    {"note": "공식 스크랩 우선, 없으면 dogam(신규 세트). 키는 세트코드→3자리 카드번호→희귀도.",
     "sets": merged}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
Path("data/audits/rarity-map-audit.json").write_text(json.dumps(
    {"dogamAddedCards": dogam_cards,
     "setsWithSecretCardsStillBlank": dict(secret_blank.most_common()),
     "coverageKnownOverTotal": cover}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(len(merged), sum(len(v) for v in merged.values()), dogam_cards, dict(secret_blank.most_common(12)))
