#!/usr/bin/env python3
"""포켓몬 컬렉션 누락 보충: 카드명이 컬렉션 포켓몬과 일치하는데 빠진 카드를 추가한다.
기존 카드·accountIndex는 바꾸지 않고, 새 카드는 해당 포켓몬 그룹의 최대 accountIndex + 1부터 붙인다."""
import json, re, sys
from collections import defaultdict, Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = ["data/pokemon-collections.json", "data/pokemon-collections-21-40.json"]
SUFFIX = {"EX", "GX", "V", "VMAX", "VSTAR", "ex", "V-UNION", "BREAK", "LV.X", "◇", "☆", "δ", "V유니온", "TAG", "TEAM"}
PREFIX = re.compile(r"^(M|원시|알로라|가라르|히스이|팔데아|블랙|화이트)\s*")
NON_KOREAN_SETS = {"base"}
IMG_BASE = "https://cards.image.pokemonkorea.co.kr"


def tokens(name):
    out = set()
    for part in name.split("&"):
        words = [w for w in re.split(r"\s+", part.strip()) if w not in SUFFIX]
        base = " ".join(words)
        out.add(base)
        out.add(PREFIX.sub("", base))
    return out


def load(path):
    raw = (ROOT / path).read_text(encoding="utf-8")
    return json.loads(raw), raw


def main(write):
    data, raws = {}, {}
    for f in FILES:
        data[f], raws[f] = load(f)
    groups = {g["name"]: (f, g) for f in FILES for g in data[f]}
    catalog = json.loads((ROOT / "data/pokemon-search-index.json").read_text(encoding="utf-8"))
    series_case = {g["code"].lower(): g["code"] for g in json.loads((ROOT / "data/series.json").read_text(encoding="utf-8"))}
    have_set = Counter()
    have_img, have_key = defaultdict(set), defaultdict(set)
    for name, (_, g) in groups.items():
        for c in g["cards"]:
            m = c["meta"].split(" · ")
            have_set[m[-1].lower()] += 1
            have_key[name].add((m[-1].lower(), m[0].split("/")[0].lstrip("0")))
            have_img[name].add(c["image"].split("?")[0])
    added = []
    for grp in catalog["groups"]:
        st = grp[0].lower()
        if st in NON_KOREAN_SETS:
            continue  # 한국 정식 발매가 아닌 세트(해외판 Base Set)는 제외
        for e in grp[4]:
            raw_img = e[3]
            image = (IMG_BASE + raw_img[1:]) if raw_img.startswith("@") else raw_img
            if image.startswith("/"):
                image = "https://digital-card-binder.github.io" + image
            num_full = e[0].split("_", 1)[-1]
            num = num_full.split("/")[0].lstrip("0")
            for name in set(groups) & tokens(e[1]):
                if (st, num) in have_key[name] or image.split("?")[0] in have_img[name]:
                    continue
                _, g = groups[name]
                nxt = max((c["accountIndex"] for c in g["cards"] if isinstance(c.get("accountIndex"), int)), default=-1) + 1
                token = series_case.get(st, grp[0])
                card = {"name": e[1], "meta": f"{num_full} · {e[9] or '—'} · {token}", "image": image, "owned": False, "accountIndex": nxt}
                g["cards"].append(card)
                have_key[name].add((st, num)); have_img[name].add(image.split("?")[0])
                added.append({"pokemon": name, "set": token, "code": e[0], "name": e[1]})
    print("added", len(added), dict(Counter(a["set"] for a in added)))
    if write:
        for f in FILES:
            compact = "\n" not in raws[f].strip()[:3] and raws[f].lstrip().startswith("[{")
            text = (json.dumps(data[f], ensure_ascii=False, separators=(",", ":")) if compact
                    else json.dumps(data[f], ensure_ascii=False, indent=2)) + "\n"
            (ROOT / f).write_text(text, encoding="utf-8")
        (ROOT / "data/audits/pokemon-collections-gap-fill.json").write_text(
            json.dumps({"addedCount": len(added), "added": added}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main("--write" in sys.argv))
