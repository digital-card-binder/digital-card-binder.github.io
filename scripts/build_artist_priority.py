#!/usr/bin/env python3
"""Build Korean-only artist priority ranking for future artist-dex expansion."""
from __future__ import annotations

import json, os, re, subprocess, tempfile
from collections import defaultdict
from pathlib import Path

from build_popular_artist_data import build_local_index, normalized_image, TCGDEX_REPO, TCGDEX_REF

SNAPSHOT_DATE = "2026-08-26"
# Collector-hype snapshot from PokemonPredictor artist gallery (2026-08-24).
# Only tracked names need overrides; untracked artists use a conservative baseline.
HYPE = {
    "ken sugimori": (70,4), "nagimiso": (70,5), "keiji kinebuchi": (63,7),
    "masakazu fukuda": (62,8), "taiga kasai": (62,9), "kouki saitou": (61,10),
    "takuyoa": (59,12), "hajime kusajima": (59,14), "megumi mizutani": (58,16),
    "match": (58,17), "5ban graphics": (57,18), "aky cg works": (57,19),
    "sumiyoshi kizuki": (57,20), "yuu nishida": (55,28), "kanako eo": (55,29),
    "planeta mochizuki": (54,31), "gossan": (54,33), "midori harada": (54,35),
    "chibi": (54,36), "toyste beach": (54,37), "akira komayama": (53,40),
    "atsushi furusawa": (53,41), "hironobu yoshida": (53,42), "dom": (53,43),
    "mahou": (52,50), "jiro sasumo": (51,52), "kyoko umemoto": (51,54),
    "ryota murayama": (50,58), "hideki ishikawa": (50,60), "you iribi": (50,61),
    "souichirou gunjima": (50,62), "satoma": (50,63), "toshinao aoki": (49,66),
    "eske yoshinob": (49,67), "hncl": (48,68), "teeziro": (47,74),
    "shigenori negishi": (47,76), "ayaka yoshida": (47,79), "rend": (47,81),
    "uninori": (47,82), "so-taro": (47,83), "ligton": (47,84), "kirisaki": (46,87),
    "anesaki dynamic": (46,89), "danciao": (45,92), "shin nagasawa": (45,93),
    "hasuno": (45,94),
}
# Manual collector-recognition boosts for guest/crossover artists not reliably tracked there.
GUEST_HYPE = {
    "yu nagaba": (65, 999), "tetsuo hara": (60, 999), "mika pikazo": (55, 999),
    "demizuposuka": (55, 999), "james turner": (55, 999), "kinu nishimura": (50, 999),
}
# Style is intentionally the subjective component of the score. Distinctive, recognizable
# bodies of work get higher values; unreviewed lower-priority artists receive a neutral baseline.
STYLE = {
    "ken sugimori":24,"kouki saitou":23,"nagimiso":25,"masakazu fukuda":24,"taiga kasai":25,
    "akira komayama":23,"megumi mizutani":22,"yuu nishida":24,"atsushi furusawa":25,"midori harada":24,
    "sumiyoshi kizuki":23,"shin nagasawa":21,"anesaki dynamic":21,"takuyoa":22,"gossan":22,
    "shigenori negishi":21,"ayaka yoshida":21,"ryuta fuse":21,"hideki ishikawa":21,"yu nagaba":25,
    "tetsuya koizumi":20,"hasuno":21,"satoshi nakai":20,"yoshinobu saito":20,"kyoko umemoto":20,
    "taira akitsu":21,"dom":22,"hncl":22,"chibi":22,"mahou":22,"james turner":25,"mika pikazo":25,
    "demizuposuka":25,"tetsuo hara":25,"kinu nishimura":24,"kanako eo":24,"hajime kusajima":22,
    "hironobu yoshida":22,"keiji kinebuchi":24,"match":23,"you iribi":20,"satoma":22,"uninori":22,
    "rend":22,"ligton":21,"shinya komatsu":21,"en morikura":22,"haru akasaka":22,"takumi wada":22,
    "satoshi shirai":20,"tokiya":21,"toshinao aoki":21,"yuya oka":20,"nisota niso":21,
    "kurumitsu":21,"otumami":21,"scav":21,"kiyotaka oshiyama":24,"saki hayashiro":21,
    "nagomi nijo":22,"tomomi ozaki":20,"susumu maeya":22,"nelnal":22,
}
STUDIO_WORDS = (
    "inc.", "graphics", "works", "studio", "planeta", "beach", "empire", "conceptlab",
    "mugenup", "orbitallink", "game freak", "spike chunsoft", "n-design", "d.a.g",
)
ERA_ORDER = {"DP":0,"BW":1,"XY":2,"SM":3,"S":4,"SV":5,"M":6}
HIGH_RARITY = re.compile(r"\b(SR|HR|UR|SAR|AR|CSR|CHR|SSR|ACE|PROMO)\b", re.I)


def card_count_score(n: int) -> int:
    if n >= 100: return 20
    if n >= 60: return 16
    if n >= 30: return 12
    if n >= 10: return 8
    return 4


def main() -> None:
    completed_payload = json.loads(Path("data/artists.json").read_text(encoding="utf-8"))
    completed = {a["name"].casefold().rstrip(".") for a in completed_payload["artists"]}
    local = build_local_index()
    seen, eras, sets, high = defaultdict(set), defaultdict(set), defaultdict(set), defaultdict(int)

    with tempfile.TemporaryDirectory() as td:
        repo = os.path.join(td, "tcgdex")
        subprocess.run(["git","clone","--filter=blob:none","-q",TCGDEX_REPO,repo], check=True)
        subprocess.run(["git","-C",repo,"checkout","-q",TCGDEX_REF], check=True)
        base = os.path.join(repo, "data-asia")
        for root, _, files in os.walk(base):
            for filename in files:
                if not re.fullmatch(r"0*\d+\.ts", filename):
                    continue
                rel = os.path.relpath(os.path.join(root, filename), base).split(os.sep)
                if len(rel) < 3:
                    continue
                era, set_name = rel[0], rel[1]
                number = int(filename[:-3])
                text = Path(root, filename).read_text(encoding="utf-8", errors="ignore")
                match = re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]", text)
                if not match:
                    continue
                artist = match.group(1).strip()
                for row in local.get((set_name.casefold(), number), []):
                    image = str(row.get("image") or "").strip()
                    if not image:
                        continue
                    image_id = normalized_image(image)
                    if image_id in seen[artist]:
                        continue
                    seen[artist].add(image_id)
                    eras[artist].add(era)
                    sets[artist].add(set_name)
                    rarity_text = f"{row.get('rarity') or ''} {row.get('cardNumber') or ''}"
                    if HIGH_RARITY.search(rarity_text):
                        high[artist] += 1

    individuals, studios = [], []
    for artist, cards in seen.items():
        key = artist.casefold().rstrip(".")
        if key in completed:
            continue
        count = len(cards)
        hype, hype_rank = HYPE.get(key, GUEST_HYPE.get(key, (35, 999)))
        popularity = round(min(35, hype / 81 * 35), 1)
        count_score = card_count_score(count)
        earliest = min((ERA_ORDER.get(e, 99) for e in eras[artist]), default=99)
        age = {0:8,1:8,2:8,3:6,4:4,5:2,6:1}.get(earliest, 1)
        breadth = 6 if len(sets[artist]) >= 50 else 5 if len(sets[artist]) >= 30 else 4 if len(sets[artist]) >= 20 else 3 if len(sets[artist]) >= 10 else 2
        rare = 6 if high[artist] >= 20 else 5 if high[artist] >= 12 else 4 if high[artist] >= 7 else 3 if high[artist] >= 3 else 2 if high[artist] >= 1 else 1
        difficulty = min(20, age + breadth + rare)
        style = STYLE.get(key, 18 if hype >= 50 else 16 if hype >= 45 else 15)
        total = round(popularity + difficulty + count_score + style, 1)
        entry = {
            "rank": 0, "name": artist, "totalScore": total,
            "popularityScore": popularity, "difficultyScore": difficulty,
            "cardCountScore": count_score, "styleScore": style,
            "koreanCardCountMatched": count, "highRarityMatched": high[artist],
            "verifiedSetCount": len(sets[artist]),
            "eras": sorted(eras[artist], key=lambda e: ERA_ORDER.get(e,99)),
            "hype": hype, "hypeRank": None if hype_rank == 999 else hype_rank,
            "status": "pending",
        }
        is_studio = any(word in key for word in STUDIO_WORDS)
        (studios if is_studio else individuals).append(entry)

    sort_key = lambda x: (-x["totalScore"], x["hypeRank"] or 999, -x["koreanCardCountMatched"], x["name"].casefold())
    individuals.sort(key=sort_key); studios.sort(key=sort_key)
    for i, entry in enumerate(individuals, 1): entry["rank"] = i
    for i, entry in enumerate(studios, 1): entry["rank"] = i

    result = {
        "snapshotDate": SNAPSHOT_DATE,
        "scope": "Pokemon Korea official-image-matched Korean cards only",
        "weights": {"popularity":35,"collectionDifficulty":20,"koreanCardCount":20,"styleDistinctiveness":25},
        "notes": [
            "Japanese/English-only cards are excluded from Korean card counts and difficulty scoring.",
            "Studio/team credits are ranked separately from individual/pseudonymous illustrators.",
            "Popularity uses a 2026-08-24 collector-hype snapshot where available; untracked names use a conservative baseline.",
            "Style distinctiveness is the intentionally subjective component and is curated most heavily for higher-priority candidates.",
            "Matched counts are a planning floor based on cards already mapped to official Pokemon Korea images; final artist builds may recover additional Korean cards through official-search/manual reconciliation."
        ],
        "verifiedIllustratorCreditCount": len(seen),
        "completedArtistCount": len(completed_payload["artists"]),
        "remainingCreditCount": len(individuals) + len(studios),
        "individualCandidateCount": len(individuals),
        "studioCandidateCount": len(studios),
        "individualRanking": individuals,
        "studioRanking": studios,
        "sources": {
            "pokemonKorea": "https://pokemoncard.co.kr/cards",
            "illustratorIndex": f"https://github.com/tcgdex/cards-database/tree/{TCGDEX_REF}/data-asia",
            "popularity": "https://www.pokemonpredictor.com/artists/"
        }
    }
    out = Path("data/artist-priority.json")
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out}: {len(individuals)} individual + {len(studios)} studio candidates")
    for e in individuals[:20]:
        print(e["rank"], e["name"], e["totalScore"], e["koreanCardCountMatched"])

if __name__ == "__main__":
    main()
