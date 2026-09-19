#!/usr/bin/env python3
"""Build the Korean Black & White catalog from official Pokemon Korea data.

Set membership/counts follow the Korean-language set catalog reference at
https://www.dogam.app/sets. Card names, printed numbers, product membership,
detail URLs, and image URLs come from Pokemon Korea's official card search.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from typing import Any
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_legacy_series_data as legacy  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
LEGACY_PATH = ROOT / "data" / "series-legacy.json"
DOGAM_SOURCE = "https://www.dogam.app/sets"
DOGAM_BASE = "https://www.dogam.app"
# Known Japanese fallback scans are replaced with same-card Korean official references.

SETS: list[dict[str, Any]] = [
    {"code":"BW1-Bb","title":"블랙 컬렉션","count":56,"aliases":["블랙 컬렉션"]},
    {"code":"BW1-Bw","title":"화이트 컬렉션","count":56,"aliases":["화이트 컬렉션"]},
    {"code":"BD","title":"볼트로스 덱","count":16,"aliases":["볼트로스 덱","볼트로스덱"]},
    {"code":"TD","title":"토네로스 덱","count":16,"aliases":["토네로스 덱","토네로스덱"]},
    {"code":"FS","title":"BW 퍼스트 세트","count":40,"aliases":["BW 퍼스트 세트","퍼스트 세트"],"multiAliases":["퍼스트 세트 - 풀의 진화","퍼스트 세트 - 불꽃의 진화","퍼스트 세트 - 물의 진화"]},
    {"code":"BW2","title":"레드 컬렉션","count":72,"aliases":["레드 컬렉션"]},
    {"code":"BTV","title":"배틀 체인지덱 비크티니 덱","count":24,"aliases":["배틀 체인지덱 비크티니 덱","비크티니 덱"]},
    {"code":"BGc","title":"배틀 강화덱 - 코바르온 덱","count":16,"aliases":["코바르온 덱","코바르온덱"]},
    {"code":"PBG","title":"플라스마단 스페셜 세트","count":18,"aliases":["플라스마단 덱","플라스마단 스페셜 세트"]},
    {"code":"BGt","title":"배틀 강화덱 - 테라키온 덱","count":17,"aliases":["테라키온 덱","테라키온덱"]},
    {"code":"BGv","title":"배틀 강화덱 - 비리디온 덱","count":17,"aliases":["비리디온 덱","비리디온덱"]},
    {"code":"BW3-Bh","title":"헤일 블리자드","count":57,"aliases":["헤일 블리자드"]},
    {"code":"BW3-Bp","title":"사이코 드라이브","count":57,"aliases":["사이코 드라이브"]},
    {"code":"BW4","title":"다크러시","count":76,"aliases":["다크러시"]},
    {"code":"BKR","title":"배틀 강화 60장 덱 - 레시라무 EX","count":20,"aliases":["레시라무 EX","레시라무EX"]},
    {"code":"BGZ","title":"배틀 강화 60장 덱 - 제크로무 EX","count":20,"aliases":["제크로무 EX","제크로무EX"]},
    {"code":"DC","title":"드래곤 컬렉션","count":20,"aliases":["드래곤 컬렉션"]},
    {"code":"BW5-Brn","title":"드래곤 블레이드","count":55,"aliases":["드래곤 블레이드"]},
    {"code":"BW5-Brz","title":"드래곤 블라스트","count":55,"aliases":["드래곤 블라스트"]},
    {"code":"GBR","title":"한카리아스 덱","count":18,"aliases":["한카리아스 덱","한카리아스덱"]},
    {"code":"SZD","title":"삼삼드래 덱","count":18,"aliases":["삼삼드래 덱","삼삼드래덱"]},
    {"code":"BW6-Bc","title":"콜드플레어","count":65,"aliases":["콜드플레어"]},
    {"code":"BW6-Bf","title":"프리즈볼트","count":65,"aliases":["프리즈볼트"]},
    {"code":"KD","title":"트레이너 세트 「케르디오」","count":18,"aliases":["케르디오"]},
    {"code":"BW7","title":"플라스마게일","count":79,"aliases":["플라스마게일"]},
    {"code":"PPD","title":"플라스마단 파워 덱","count":19,"aliases":["플라스마단 파워 덱","플라스마단 파워덱"]},
    {"code":"BGB","title":"배틀 강화 60장 덱 - 블랙큐레무 EX","count":20,"aliases":["블랙큐레무 EX","블랙큐레무EX"]},
    {"code":"BGW","title":"배틀 강화 60장 덱 - 화이트큐레무 EX","count":20,"aliases":["화이트큐레무 EX","화이트큐레무EX"]},
    {"code":"BW8-Brf","title":"스파이럴포스","count":58,"aliases":["스파이럴포스"]},
    {"code":"BW8-Brn","title":"볼트너클","count":58,"aliases":["볼트너클"]},
    {"code":"SC","title":"샤이니 컬렉션","count":25,"aliases":["샤이니 컬렉션"]},
    {"code":"BW9","title":"메갈로캐논","count":86,"aliases":["메갈로캐논"]},
    {"code":"K+K","title":"최강 폭류 덱 「거북왕 + 큐레무 EX」","count":19,"aliases":["거북왕 + 큐레무 EX","거북왕+큐레무 EX","최강 폭류 덱"]},
    {"code":"MG-Bg","title":"30장 덱 대전 게노세크트","count":17,"aliases":["30장 덱 대전 set 뮤츠VS게노세크트","30장 덱 대전 뮤츠VS게노세크트"]},
    {"code":"MG-Bm","title":"30장 덱 대전 뮤츠","count":17,"aliases":["30장 덱 대전 set 뮤츠VS게노세크트","30장 덱 대전 뮤츠VS게노세크트"]},
    {"code":"EBB","title":"EX 배틀 부스트","count":95,"aliases":["EX 배틀 부스트","배틀 부스트"]},
    {"code":"BWP","title":"BW 프로모 카드","count":72,"aliases":["BW 프로모 카드","BW프로모카드"]},
]

ENERGY_ORDER = {
    "기본 풀 에너지": 1, "기본 불꽃 에너지": 2, "기본 물 에너지": 3,
    "기본 번개 에너지": 4, "기본 초 에너지": 5, "기본 격투 에너지": 6,
    "기본 악 에너지": 7, "기본 강철 에너지": 8,
}
ENERGY_TOKEN = {
    "기본 풀 에너지":"ENERGY-GRASS","기본 불꽃 에너지":"ENERGY-FIRE",
    "기본 물 에너지":"ENERGY-WATER","기본 번개 에너지":"ENERGY-LIGHTNING",
    "기본 초 에너지":"ENERGY-PSYCHIC","기본 격투 에너지":"ENERGY-FIGHTING",
    "기본 악 에너지":"ENERGY-DARKNESS","기본 강철 에너지":"ENERGY-METAL",
}


class AnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.current_href: str | None = None
        self.current_text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.current_href = href
            self.current_text = []

    def handle_data(self, data: str) -> None:
        if self.current_href is not None:
            self.current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.current_href is not None:
            value = re.sub(r"\s+", " ", "".join(self.current_text)).strip()
            self.links.append((self.current_href, value))
            self.current_href = None
            self.current_text = []


def dogam_text(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": legacy.USER_AGENT,
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
        },
    )
    with urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace")


_DOGAM_SET_LINKS: list[tuple[str, str]] | None = None


def dogam_set_href(meta: dict[str, Any]) -> str:
    global _DOGAM_SET_LINKS
    if _DOGAM_SET_LINKS is None:
        parser = AnchorParser()
        parser.feed(dogam_text(DOGAM_SOURCE))
        _DOGAM_SET_LINKS = parser.links

    code_token = re.sub(r"[^0-9a-z]+", "", meta["code"].casefold())
    title_token = legacy.compact(meta["title"])
    candidates: list[tuple[int, int, str]] = []
    for href, label in _DOGAM_SET_LINKS:
        if not re.fullmatch(r"/sets/[0-9A-Z]+", href):
            continue
        label_compact = legacy.compact(label)
        label_code = re.sub(r"[^0-9a-z]+", "", label.casefold())
        score = 0
        if title_token and title_token in label_compact:
            score += 4
        if code_token and code_token in label_code:
            score += 3
        if score:
            candidates.append((-score, len(label_compact), href))
    if not candidates:
        raise RuntimeError(
            f"{meta['code']} {meta['title']}: dogam set link not found"
        )
    candidates.sort()
    return candidates[0][2]


def parse_dogam_card_text(value: str) -> tuple[str, str]:
    text = re.sub(r"\s+", " ", value).strip()
    match = re.match(r"^(.*?)[ ]+([0-9]{1,3})$", text)
    if not match:
        match = re.match(r"^(.*?)([0-9]{3})$", text)
    if match:
        name = re.sub(r"\s*No[.]\s*$", "", match.group(1), flags=re.I).strip()
        return name, str(int(match.group(2)))
    return re.sub(r"\s*No[.]\s*$", "", text, flags=re.I).strip(), ""


def dogam_manifest(meta: dict[str, Any]) -> list[dict[str, str]]:
    set_href = dogam_set_href(meta)
    parser = AnchorParser()
    parser.feed(dogam_text(DOGAM_BASE + set_href))
    prefix = set_href.rstrip("/") + "/cards/"
    seen: set[str] = set()
    items: list[dict[str, str]] = []
    for href, label in parser.links:
        if not href.startswith(prefix) or href in seen:
            continue
        seen.add(href)
        name, number = parse_dogam_card_text(label)
        if name:
            items.append({"name": name, "number": number, "href": href})
    if len(items) != meta["count"]:
        raise RuntimeError(
            f"{meta['code']} {meta['title']}: dogam expected {meta['count']} "
            f"cards but found {len(items)}: {[(x['name'], x['number']) for x in items]}"
        )
    return items


def dogam_card_detail(item: dict[str, str]) -> dict[str, str]:
    url = DOGAM_BASE + item["href"]
    html = dogam_text(url)
    image_match = re.search(
        r"https://static[.]tcgexchange[.]kr/[A-Za-z0-9._/-]+[.](?:png|jpe?g|webp)",
        html,
        re.I,
    )
    denominator = ""
    if item.get("number"):
        padded = str(int(item["number"])).zfill(3)
        fraction = re.search(
            rf"(?<![0-9]){re.escape(padded)}\s*/\s*([0-9]{{1,3}}|[A-Za-z0-9-]+)",
            html,
            re.I,
        )
        if fraction:
            denominator = fraction.group(1)
    return {
        "image": image_match.group(0) if image_match else "",
        "denominator": denominator,
        "source": url,
    }


def normalized_card_name(value: str) -> str:
    return re.sub(r"\s+", "", value).casefold()


def resolve_products(meta: dict[str, Any], values: dict[str, str]) -> list[str]:
    options = list(values.values())
    multi_aliases = meta.get("multiAliases") or []
    if multi_aliases:
        resolved: list[str] = []
        for alias in multi_aliases:
            compact_alias = legacy.compact(alias)
            matches = [
                option for option in options
                if compact_alias and compact_alias in legacy.compact(option)
            ]
            if not matches:
                raise RuntimeError(
                    f"{meta['code']} {meta['title']}: official product option missing for {alias}"
                )
            resolved.append(min(matches, key=lambda option: len(legacy.compact(option))))
        return list(dict.fromkeys(resolved))

    scored: list[tuple[int,int,str]] = []
    for option in options:
        compact_option = legacy.compact(option)
        for alias in meta["aliases"]:
            a = legacy.compact(alias)
            if a and a in compact_option:
                exact = int(compact_option == a)
                scored.append((-exact, len(compact_option), option))
                break
    if not scored:
        raise RuntimeError(f"{meta['code']} {meta['title']}: official product option missing")
    scored.sort()
    return [scored[0][2]]

def product_inventory(meta: dict[str, Any], product: str) -> list[dict[str,str]]:
    records: list[dict[str,str]] = []
    for card_type in (1,2,3):
        page = 0
        while True:
            page_records = legacy.ajax_page(product, card_type, page)
            records.extend(page_records)
            if len(page_records) < 30:
                break
            page += 1
    unique: dict[str,dict[str,str]] = {}
    for record in records:
        card_num = str(record.get("CardNum") or "").strip()
        if card_num:
            unique.setdefault(card_num, record)
    legacy.log(f"BW 공식 목록 · {meta['code']} {meta['title']}: {len(unique)}건")
    return list(unique.values())

def detail_record(record: dict[str,str]) -> dict[str,Any]:
    card_num = str(record.get("CardNum") or "").strip()
    if not card_num:
        raise RuntimeError(f"official CardNum missing: {record}")
    detail = legacy.parse_detail(legacy.detail_payload(card_num))
    name = str(detail.get("name") or "").strip()
    if not name:
        for key in ("CardName","card_name","name","title"):
            value = str(record.get(key) or "").strip()
            if value:
                name = value
                break
    if not name:
        raise RuntimeError(f"{card_num}: Korean card name missing")
    image_path = str(record.get("feature_image") or "").strip()
    image = legacy.feature_image_url(image_path) if image_path else ""
    return {
        "CardNum":card_num,
        "name":name,
        "number":str(detail.get("number") or "").strip(),
        "denominator":str(detail.get("denominator") or "").strip(),
        "rarity":str(detail.get("rarity") or "").strip(),
        "image":image,
        "source":f"{legacy.OFFICIAL_BASE}/cards/detail/{card_num}",
    }

def card_identity(card: dict[str,Any]) -> tuple[str,str]:
    if card["number"]:
        return ("number", str(int(card["number"])))
    # Old promo pages sometimes omit the printed number in the parser.
    promo = re.fullmatch(r"PR(20\d{2})\d{3}(\d{3})", card["CardNum"])
    if promo:
        return ("promo", str(int(promo.group(2))))
    return ("name", re.sub(r"\s+"," ",card["name"]).strip().casefold())

def representative_score(card: dict[str,Any]) -> tuple[int,int,str]:
    filename = card["image"].rsplit("/",1)[-1].casefold()
    variant = bool(re.search(r"(?:mirror|reverse|foil|holo|parallel)", filename))
    return (int(variant), len(filename), card["CardNum"])

def infer_promo_number(card: dict[str,Any]) -> None:
    if card["number"]:
        return
    # BW promo CardNum values in the official archive are sequential within
    # their PRYYYYxxxxxx family. Use the final three digits only when needed.
    match = re.fullmatch(r"PR20\d{2}\d{3}(\d{3})", card["CardNum"])
    if match:
        card["number"] = str(int(match.group(1)))
        card["denominator"] = "BW-P"

def build_group(meta: dict[str,Any], records: list[dict[str,str]], workers: int) -> dict[str,Any]:
    manifest = dogam_manifest(meta)

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        official_cards = list(pool.map(detail_record, records))

    if meta["code"] == "BWP":
        for card in official_cards:
            infer_promo_number(card)

    by_number_name: dict[tuple[str, str], list[dict[str, Any]]] = {}
    by_name: dict[str, list[dict[str, Any]]] = {}
    for card in official_cards:
        number = str(int(card["number"])) if card["number"] else ""
        name_key = normalized_card_name(card["name"])
        by_number_name.setdefault((number, name_key), []).append(card)
        by_name.setdefault(name_key, []).append(card)

    selected: list[dict[str, Any]] = []
    fallbacks: list[tuple[int, dict[str, str]]] = []

    for index, item in enumerate(manifest):
        name_key = normalized_card_name(item["name"])
        number = item["number"]
        candidates = by_number_name.get((number, name_key), [])

        if not candidates and number:
            number_matches = [
                card for card in official_cards
                if card["number"] and str(int(card["number"])) == number
            ]
            if len(number_matches) == 1:
                candidates = number_matches

        if not candidates:
            name_matches = by_name.get(name_key, [])
            if len(name_matches) == 1:
                candidates = name_matches

        if candidates:
            selected.append(min(candidates, key=representative_score).copy())
        else:
            selected.append({
                "CardNum": "",
                "name": item["name"],
                "number": number,
                "denominator": "",
                "rarity": "",
                "image": "",
                "source": DOGAM_BASE + item["href"],
            })
            fallbacks.append((index, item))

    if fallbacks:
        legacy.log(
            f"Dogam 보완 · {meta['code']} {meta['title']}: {len(fallbacks)}장"
        )
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers, 12)) as pool:
            details = list(pool.map(
                dogam_card_detail,
                [item for _, item in fallbacks],
            ))
        for (index, item), detail in zip(fallbacks, details):
            selected[index]["image"] = detail["image"]
            selected[index]["denominator"] = detail["denominator"]
            selected[index]["source"] = detail["source"]

    finalized=[]
    for order,(item,card) in enumerate(zip(manifest,selected),start=1):
        number=item["number"] or card["number"]
        if number:
            number_token=str(int(number)).zfill(3)
            denominator=card["denominator"]
            denominator=denominator.zfill(3) if denominator.isdigit() else denominator
            # Some Korean constructed-deck energies are printed as "No. 014"
            # without a denominator. Preserve that form instead of inventing
            # a denominator from the set size.
            suffix=f"{number_token}/{denominator}" if denominator else number_token
        else:
            token=ENERGY_TOKEN.get(card["name"])
            if not token:
                token=re.sub(r"[^0-9A-Za-z가-힣]+","-",card["name"]).strip("-").upper()
                token=f"{token}-{order:03d}"
            suffix=token

        finalized.append({
            "code":f"{meta['code'].lower()}_{suffix}",
            "image":card["image"],
            "owned":False,
            "status":"구함",
            "name":card["name"],
            "order":order,
            "source":card["source"],
        })

    if len(finalized) != meta["count"]:
        raise RuntimeError(
            f"{meta['code']} {meta['title']}: expected {meta['count']} cards, "
            f"selected {len(finalized)}"
        )
    if len({card["code"] for card in finalized}) != len(finalized):
        raise RuntimeError(f"{meta['code']}: duplicate generated card codes")

    fallback_count=sum(
        1 for card in finalized
        if card["image"].startswith("https://static.tcgexchange.kr/")
    )
    note=f"한글판 {len(finalized)}장 기준 · 포켓몬코리아 공식 이미지"
    if fallback_count:
        note += f" · 공식 검색 누락 {fallback_count}장은 Dogam 참고 이미지"

    return {
        "code":meta["code"],
        "title":f"{meta['title']} ({len(finalized)}장)",
        "displayName":meta["title"],
        "era":"BW",
        "release":"",
        "sourceProducts":meta["officialProducts"],
        "referenceImageRegion":"KR",
        "referenceNote":note,
        "referenceSource":DOGAM_SOURCE,
        "cards":finalized,
    }


KNOWN_JP_FALLBACK_CODES = {
    "gbr_016/015",
    "gbr_017/015",
    "gbr_018/015",
    "szd_016/015",
    "szd_017/015",
    "szd_018/015",
    "k+k_019/018",
    "bw3-bh_056/052",
    "bw4_076/069",
    "bw5-brn_055/050",
    "bwp_027",
    "bwp_031",
    "bwp_033",
    "bwp_035",
    "fs_037/034",
    "bwp_056",
}

KOREAN_IMAGE_OVERRIDES = {
    "bwp_056": {
        "image": "https://cdn6966.templcdn.com/wp-content/uploads/2021/07/KR_056BW.jpg",
        "source": "https://pokumon.com/card/victory-cup-056-bw-korean-promo/",
        "referenceSet": "BWP",
        "note": "한글판 056/BW 실물 참고 이미지",
    },
}

ENERGY_NAME_ALIASES = {
    "물에너지": "기본물에너지",
    "번개에너지": "기본번개에너지",
    "격투에너지": "기본격투에너지",
    "풀에너지": "기본풀에너지",
    "초에너지": "기본초에너지",
    "악에너지": "기본악에너지",
    "번개기본에너지": "기본번개에너지",
}


def korean_reference_key(name: str) -> str:
    value = re.sub(r"[^0-9A-Za-z가-힣]+", "", str(name or "")).casefold()
    return ENERGY_NAME_ALIASES.get(value, value)


def replace_known_japanese_fallbacks(groups: list[dict[str, Any]]) -> int:
    official_pool: dict[str, list[tuple[str, dict[str, Any]]]] = {}
    for group in groups:
        for card in group.get("cards", []):
            if "pokemonkorea.co.kr" not in str(card.get("image") or ""):
                continue
            official_pool.setdefault(korean_reference_key(card.get("name", "")), []).append(
                (str(group.get("code") or ""), card)
            )

    replacements = 0
    for group in groups:
        replaced_in_group = 0
        for card in group.get("cards", []):
            code = str(card.get("code") or "")
            if code not in KNOWN_JP_FALLBACK_CODES:
                continue

            override = KOREAN_IMAGE_OVERRIDES.get(code)
            if override:
                card["image"] = override["image"]
                card["imageSource"] = override["source"]
                card["imageReferenceSet"] = override["referenceSet"]
                card["imageReferenceNote"] = override["note"]
                replacements += 1
                replaced_in_group += 1
                continue

            candidates = official_pool.get(korean_reference_key(card.get("name", "")), [])
            if not candidates:
                raise RuntimeError(
                    f"{card.get('code')}: Korean official replacement image missing"
                )
            source_set, candidate = sorted(
                candidates,
                key=lambda item: (
                    0 if item[0] == str(group.get("code") or "") else 1,
                    0 if item[0] not in {"BWP"} else 1,
                    item[0],
                    str(item[1].get("code") or ""),
                ),
            )[0]
            card["image"] = candidate["image"]
            card["imageSource"] = candidate.get("source", "")
            card["imageReferenceSet"] = source_set
            card["imageReferenceNote"] = "동일 카드명의 한글판 공식 참고 이미지 (다른 수록판)"
            replacements += 1
            replaced_in_group += 1

        fallback_count = sum(
            1
            for card in group.get("cards", [])
            if "static.tcgexchange.kr" in str(card.get("image") or "")
        )
        note = (
            f"한글판 {len(group.get('cards', []))}장 기준 · "
            "포켓몬코리아 공식 이미지"
        )
        if replaced_in_group:
            note += (
                f" · 일본판 대체용 한글판 공식 참고 이미지 {replaced_in_group}장"
            )
        if fallback_count:
            note += f" · 공식 검색 누락 {fallback_count}장은 Dogam 한글판 참고 이미지"
        group["referenceNote"] = note

    if replacements != len(KNOWN_JP_FALLBACK_CODES):
        raise RuntimeError(
            f"BW JP replacement mismatch: {replacements}/"
            f"{len(KNOWN_JP_FALLBACK_CODES)}"
        )
    return replacements


def run(workers:int)->None:
    official_values=legacy.official_product_values()
    jobs: list[tuple[dict[str, Any], str]] = []
    for meta in SETS:
        meta["officialProducts"]=resolve_products(meta,official_values)
        legacy.log(
            f"상품 연결 · {meta['code']} -> " + " | ".join(meta["officialProducts"])
        )
        for product in meta["officialProducts"]:
            jobs.append((meta, product))

    inventories={meta["code"]: [] for meta in SETS}
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers,12)) as pool:
        futures={
            pool.submit(product_inventory, meta, product):(meta, product)
            for meta, product in jobs
        }
        for future in concurrent.futures.as_completed(futures):
            meta, product=futures[future]
            inventories[meta["code"]].extend(future.result())

    for meta in SETS:
        unique={}
        for record in inventories[meta["code"]]:
            card_num=str(record.get("CardNum") or "").strip()
            if card_num:
                unique.setdefault(card_num, record)
        inventories[meta["code"]]=list(unique.values())

    groups=[]
    for meta in SETS:
        group=build_group(meta,inventories[meta["code"]],workers)
        groups.append(group)
        legacy.log(f"완료 · {group['code']} {group['displayName']}: {len(group['cards'])}장")

    replacement_count = replace_known_japanese_fallbacks(groups)
    legacy.log(f"BW 일본판 이미지 교체 완료 · {replacement_count}장")

    existing=json.loads(LEGACY_PATH.read_text(encoding="utf-8"))
    bw_codes={m["code"].casefold() for m in SETS}
    preserved=[
        g for g in existing
        if str(g.get("code") or "").casefold() not in bw_codes
        and str(g.get("era") or "").upper()!="BW"
    ]
    output=[*preserved,*groups]
    LEGACY_PATH.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

    total=sum(len(g["cards"]) for g in groups)
    if total!=1477:
        raise RuntimeError(f"BW total mismatch: expected 1477, got {total}")
    legacy.log(f"BW 저장 완료 · {len(groups)}세트 / {total}장")

def main()->int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--workers",type=int,default=16)
    args=parser.parse_args()
    try:
        run(args.workers)
        return 0
    except Exception as error:
        print(f"오류: {error}",file=sys.stderr)
        return 1

if __name__=="__main__":
    raise SystemExit(main())
