#!/usr/bin/env python3
"""Build the Korean XY catalog.

Set membership and counts follow https://www.dogam.app/sets (Korean edition).
Pokemon Korea's official card search is preferred for Korean names, numbers,
detail URLs and images; Dogam's Korean card pages fill gaps in the old archive.
"""

from __future__ import annotations

import argparse
import concurrent.futures
from html.parser import HTMLParser
import json
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

SETS: list[dict[str, Any]] = [
    {"code":"XY","title":"THE BEST OF XY","count":188,"aliases":["THE BEST OF XY"]},
    {"code":"CP6","title":"확장팩 BASE PACK 20th Anniversary","count":113,"aliases":["BASE PACK 20th Anniversary","20th Anniversary"]},
    {"code":"CP5","title":"환상 전설 드림 컬렉션","count":38,"aliases":["환상 전설 드림 컬렉션","드림 컬렉션"]},
    {"code":"XY11-Br","title":"냉혹한 반역자","count":59,"aliases":["냉혹한 반역자"]},
    {"code":"XY11-Bb","title":"타오르는 투사","count":59,"aliases":["타오르는 투사"]},
    {"code":"CP4","title":"프리미엄 챔피언팩","count":140,"aliases":["프리미엄 챔피언팩","챔피언팩"]},
    {"code":"XY10","title":"초능력의 제왕","count":88,"aliases":["초능력의 제왕"]},
    {"code":"XYH","title":"메가 배틀 덱 「M다부니 EX」","count":27,"aliases":["M다부니 EX","M다부니EX"]},
    {"code":"XYG","title":"퍼펙트 배틀 덱 「지가르데 EX」","count":20,"aliases":["지가르데 EX","지가르데EX"]},
    {"code":"CP3","title":"포켓심쿵 컬렉션","count":32,"aliases":["포켓심쿵 컬렉션"]},
    {"code":"20th","title":"트레이너 세트 20th Anniversary","count":71,"aliases":["트레이너 세트 20th Anniversary","20th Anniversary 트레이너"]},
    {"code":"XY9","title":"천공의 분노","count":89,"aliases":["천공의 분노"]},
    {"code":"XYF","title":"콤보 덱 「골덕 BREAK +펄기아 EX」","count":17,"aliases":["골덕 BREAK","펄기아 EX","콤보 덱"]},
    {"code":"XY8-Bb","title":"푸른 충격","count":65,"aliases":["푸른 충격"]},
    {"code":"UBD","title":"덱 「음번 BREAK」","count":19,"aliases":["음번 BREAK","음번BREAK"]},
    {"code":"RBD","title":"덱 「라이츄 BREAK」","count":19,"aliases":["라이츄 BREAK","라이츄BREAK"]},
    {"code":"XY8-Br","title":"붉은 섬광","count":65,"aliases":["붉은 섬광"]},
    {"code":"XYE","title":"대전 세트 「염무왕 EX vs 토게키스 EX」","count":26,"aliases":["염무왕 EX","토게키스 EX","염무왕EX"]},
    {"code":"CP2","title":"레전드 컬렉션","count":27,"aliases":["레전드 컬렉션"]},
    {"code":"XY7","title":"밴디트링","count":97,"aliases":["밴디트링"]},
    {"code":"XY6","title":"에메랄드 브레이크","count":91,"aliases":["에메랄드 브레이크"]},
    {"code":"XYD","title":"메가 배틀 덱 「M레쿠쟈 EX」","count":20,"aliases":["M레쿠쟈 EX","M레쿠쟈EX"]},
    {"code":"CP1","title":"마그마단vs아쿠아단 더블크라이시스","count":34,"aliases":["더블크라이시스","마그마단vs아쿠아단"]},
    {"code":"XY5-Bg","title":"가이아 볼케이노","count":80,"aliases":["가이아 볼케이노"]},
    {"code":"XY5-Bt","title":"타이달스톰","count":80,"aliases":["타이달스톰"]},
    {"code":"XYC","title":"레전드 배틀 덱 「제르네아스 EX+이벨타르 EX」","count":25,"aliases":["제르네아스 EX","이벨타르 EX","레전드 배틀 덱"]},
    {"code":"XYB","title":"하이퍼 메탈 체인 덱 「디아루가 EX+킬가르도 EX」","count":20,"aliases":["디아루가 EX","킬가르도 EX","하이퍼 메탈 체인"]},
    {"code":"XY4","title":"팬텀게이트","count":97,"aliases":["팬텀게이트"]},
    {"code":"XY3","title":"라이징피스트","count":105,"aliases":["라이징피스트"]},
    {"code":"XYA","title":"메가 배틀 덱 「M리자몽 EX」","count":23,"aliases":["M리자몽 EX","M리자몽EX"]},
    {"code":"XY2","title":"와일드 블레이즈","count":90,"aliases":["와일드 블레이즈"]},
    {"code":"X30","title":"제르네아스 덱","count":15,"aliases":["제르네아스 덱","제르네아스덱"]},
    {"code":"Y30","title":"이벨타르 덱","count":15,"aliases":["이벨타르 덱","이벨타르덱"]},
    {"code":"XY1-Bx","title":"X컬렉션","count":63,"aliases":["X컬렉션","X 컬렉션"]},
    {"code":"XY1-By","title":"Y컬렉션","count":63,"aliases":["Y컬렉션","Y 컬렉션"]},
    {"code":"FXY","title":"XY 퍼스트 세트","count":42,"aliases":["XY 퍼스트 세트","퍼스트 세트"]},
    {"code":"XYP","title":"XY 프로모","count":191,"aliases":["XY 프로모","XY 프로모 카드","XY프로모"]},
]


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
            label = re.sub(r"\s+", " ", "".join(self.current_text)).strip()
            self.links.append((self.current_href, label))
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


def normalized(value: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]+", "", value.casefold())


_DOGAM_LINKS: list[tuple[str, str]] | None = None


def dogam_set_href(meta: dict[str, Any]) -> str:
    global _DOGAM_LINKS
    if _DOGAM_LINKS is None:
        parser = AnchorParser()
        parser.feed(dogam_text(DOGAM_SOURCE))
        _DOGAM_LINKS = parser.links

    title_key = normalized(meta["title"])
    code_key = normalized(meta["code"])
    candidates: list[tuple[int, int, str]] = []
    for href, label in _DOGAM_LINKS:
        if not re.fullmatch(r"/sets/[0-9A-Z]+", href):
            continue
        label_key = normalized(label)
        score = 0
        if title_key and title_key in label_key:
            score += 6
        if code_key and code_key in label_key:
            score += 4
        if score:
            candidates.append((-score, len(label_key), href))
    if not candidates:
        raise RuntimeError(f"{meta['code']} {meta['title']}: Dogam set link missing")
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
            f"{meta['code']} {meta['title']}: Dogam expected {meta['count']} "
            f"cards but found {len(items)}"
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


def resolve_products(meta: dict[str, Any], values: dict[str, str]) -> list[str]:
    options = list(values.values())

    # XY 퍼스트 세트는 스타팅 포켓몬 3종 상품으로 나뉘어 있어
    # 세 상품을 모두 합쳐야 Dogam의 FXY 42장과 일치한다.
    if meta["code"] == "FXY":
        products = [
            option for option in options
            if "xy퍼스트세트" in normalized(option)
        ]
        if products:
            return sorted(set(products))

    scored: list[tuple[int, int, str]] = []
    for option in options:
        option_key = normalized(option)
        if "xy" not in option.casefold():
            continue
        for alias in meta["aliases"]:
            alias_key = normalized(alias)
            if alias_key and alias_key in option_key:
                exact = int(option_key == alias_key)
                scored.append((-exact, len(option_key), option))
                break
    if not scored:
        legacy.log(f"공식 상품 미확인 · {meta['code']} {meta['title']} -> Dogam 보완")
        return []
    scored.sort()
    return [scored[0][2]]


def product_inventory(meta: dict[str, Any], product: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for card_type in (1, 2, 3):
        page = 0
        while True:
            page_records = legacy.ajax_page(product, card_type, page)
            records.extend(page_records)
            if len(page_records) < 30:
                break
            page += 1
    unique: dict[str, dict[str, str]] = {}
    for record in records:
        card_num = str(record.get("CardNum") or "").strip()
        if card_num:
            unique.setdefault(card_num, record)
    legacy.log(f"XY 공식 목록 · {meta['code']} {meta['title']}: {len(unique)}건")
    return list(unique.values())


def detail_record(record: dict[str, str]) -> dict[str, Any]:
    card_num = str(record.get("CardNum") or "").strip()
    detail = legacy.parse_detail(legacy.detail_payload(card_num))
    name = str(detail.get("name") or "").strip()
    if not name:
        for key in ("CardName", "card_name", "name", "title"):
            value = str(record.get(key) or "").strip()
            if value:
                name = value
                break
    if not name:
        raise RuntimeError(f"{card_num}: Korean card name missing")
    image_path = str(record.get("feature_image") or "").strip()
    return {
        "CardNum": card_num,
        "name": name,
        "number": str(detail.get("number") or "").strip(),
        "denominator": str(detail.get("denominator") or "").strip(),
        "image": legacy.feature_image_url(image_path) if image_path else "",
        "source": f"{legacy.OFFICIAL_BASE}/cards/detail/{card_num}",
    }


def representative_score(card: dict[str, Any]) -> tuple[int, int, str]:
    filename = card["image"].rsplit("/", 1)[-1].casefold()
    variant = bool(re.search(r"(?:mirror|reverse|foil|holo|parallel)", filename))
    return (int(variant), len(filename), card["CardNum"])


def build_group(meta: dict[str, Any], records: list[dict[str, str]], workers: int) -> dict[str, Any]:
    manifest = dogam_manifest(meta)

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        official_cards = list(pool.map(detail_record, records))

    by_number_name: dict[tuple[str, str], list[dict[str, Any]]] = {}
    by_name: dict[str, list[dict[str, Any]]] = {}
    for card in official_cards:
        number = str(int(card["number"])) if card["number"] else ""
        name_key = normalized(card["name"])
        by_number_name.setdefault((number, name_key), []).append(card)
        by_name.setdefault(name_key, []).append(card)

    selected: list[dict[str, Any]] = []
    fallbacks: list[tuple[int, dict[str, str]]] = []

    for index, item in enumerate(manifest):
        number = item["number"]
        name_key = normalized(item["name"])
        candidates = by_number_name.get((number, name_key), [])

        if not candidates and number:
            same_number = [
                card for card in official_cards
                if card["number"] and str(int(card["number"])) == number
            ]
            if len(same_number) == 1:
                candidates = same_number

        if not candidates and not number:
            same_name = by_name.get(name_key, [])
            if len(same_name) == 1:
                candidates = same_name

        if candidates:
            selected.append(min(candidates, key=representative_score).copy())
        else:
            selected.append({
                "CardNum": "",
                "name": item["name"],
                "number": number,
                "denominator": "",
                "image": "",
                "source": DOGAM_BASE + item["href"],
            })
            fallbacks.append((index, item))

    if fallbacks:
        legacy.log(f"Dogam 보완 · {meta['code']} {meta['title']}: {len(fallbacks)}장")
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers, 12)) as pool:
            details = list(pool.map(dogam_card_detail, [item for _, item in fallbacks]))
        for (index, _), detail in zip(fallbacks, details):
            selected[index]["image"] = detail["image"]
            selected[index]["denominator"] = detail["denominator"]
            selected[index]["source"] = detail["source"]

    finalized: list[dict[str, Any]] = []
    for order, (item, card) in enumerate(zip(manifest, selected), start=1):
        number = item["number"] or card["number"]
        if number:
            number_token = str(int(number)).zfill(3)
            denominator = card["denominator"]
            denominator = denominator.zfill(3) if denominator.isdigit() else denominator
            suffix = f"{number_token}/{denominator}" if denominator else number_token
        else:
            token = re.sub(r"[^0-9A-Za-z가-힣]+", "-", card["name"]).strip("-").upper()
            suffix = f"{token}-{order:03d}"
        finalized.append({
            "code": f"{meta['code'].lower()}_{suffix}",
            "image": card["image"],
            "owned": False,
            "status": "구함",
            "name": card["name"],
            "order": order,
            "source": card["source"],
        })

    if len(finalized) != meta["count"]:
        raise RuntimeError(f"{meta['code']}: card count mismatch")
    if len({card["code"] for card in finalized}) != len(finalized):
        raise RuntimeError(f"{meta['code']}: duplicate generated card codes")
    if any(not card["image"] for card in finalized):
        missing = [card["code"] for card in finalized if not card["image"]]
        raise RuntimeError(f"{meta['code']}: image missing: {missing}")

    fallback_count = sum(
        1 for card in finalized
        if card["image"].startswith("https://static.tcgexchange.kr/")
    )
    note = f"한글판 {len(finalized)}장 기준 · 포켓몬코리아 공식 이미지"
    if fallback_count:
        note += f" · 공식 검색 누락 {fallback_count}장은 Dogam 참고 이미지"

    return {
        "code": meta["code"],
        "title": f"{meta['title']} ({len(finalized)}장)",
        "displayName": meta["title"],
        "era": "XY",
        "release": "",
        "sourceProducts": meta["officialProducts"],
        "referenceImageRegion": "KR",
        "referenceNote": note,
        "referenceSource": DOGAM_SOURCE,
        "cards": finalized,
    }



KNOWN_JP_FALLBACK_CODES = {
    # 20th Trainer Set
    "20th_002/071", "20th_011/071", "20th_012/071",
    "20th_020/071", "20th_023/071", "20th_025/071",
    "20th_030/071", "20th_031/071", "20th_032/071",
    "20th_039/071", "20th_041/071",
    "20th_048/071", "20th_049/071", "20th_050/071",
    "20th_051/071", "20th_053/071", "20th_054/071",
    "20th_055/071", "20th_056/071", "20th_057/071",
    "20th_058/071", "20th_059/071", "20th_060/071",
    "20th_061/071", "20th_062/071", "20th_063/071",
    "20th_064/071", "20th_065/071", "20th_066/071",
    "20th_067/071", "20th_068/071", "20th_069/071",
    "20th_070/071", "20th_071/071",

    # Other XY sets / decks / promos
    "cp4_132/131", "cp4_134/131", "cp4_136/131",
    "cp4_137/131", "cp4_140/131", "cp5_038/036",
    "fxy_037", "fxy_038", "fxy_039", "fxy_041",
    "rbd_018", "rbd_019", "x30_015/014",
    "xy10_088/078", "xy3_104/096", "xy4_097/088",
    "xy7_093/081", "xy7_094/081", "xy9_089/080",
    "xya_022/021", "xyb_020/018", "xyc_024/023",
    "xyd_019/018", "xye_023/022", "xye_024/022",
    "xye_025/022", "xye_026/022", "xyf_017/016",
    "xyh_027/026", "xyp_122", "xyp_185", "xyp_186",
}

KOREAN_IMAGE_OVERRIDES = {
    "xyp_185": {
        "image": "https://tcgbox.co.kr/web/product/big/%EB%A0%88%EC%A0%84%EB%93%9C%EC%84%B8%ED%8A%B8/xy-p%20185.jpg",
        "source": "https://tcgbox.co.kr/product/%EC%B9%A0%EC%83%89%EC%A1%B0/4098/",
        "referenceSet": "XYP",
        "note": "한글판 XY-P 185 실물 참고 이미지",
    },
    "xyp_186": {
        "image": "https://tcgbox.co.kr/web/product/big/%EB%A0%88%EC%A0%84%EB%93%9C%EC%84%B8%ED%8A%B8/xy-p%20186.jpg",
        "source": "https://tcgbox.co.kr/product/%EC%B9%A0%EC%83%89%EC%A1%B0-break/4099/",
        "referenceSet": "XYP",
        "note": "한글판 XY-P 186 실물 참고 이미지",
    },

    # Korean official CDN URLs that still exist even though the current
    # Pokemon Korea search does not surface these exact deck slots.
    "rbd_018": {
        "image": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/RBD/RBD_018.jpg",
        "source": "https://pokemoncard.co.kr/cards",
        "referenceSet": "RBD",
        "note": "동일 수록판의 한글판 공식 이미지",
    },
    "rbd_019": {
        "image": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/RBD/RBD_019.jpg",
        "source": "https://pokemoncard.co.kr/cards",
        "referenceSet": "RBD",
        "note": "동일 수록판의 한글판 공식 이미지",
    },
    "xya_022/021": {
        "image": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XYA/XY60_022.jpg",
        "source": "https://pokemoncard.co.kr/cards",
        "referenceSet": "XYA",
        "note": "동일 수록판의 한글판 공식 이미지",
    },
    "xyd_019/018": {
        "image": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XYD/XYD_019.jpg",
        "source": "https://pokemoncard.co.kr/cards",
        "referenceSet": "XYD",
        "note": "동일 수록판의 한글판 공식 이미지",
    },
    "xye_023/022": {
        "image": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XYE/XYE_023.jpg",
        "source": "https://pokemoncard.co.kr/cards",
        "referenceSet": "XYE",
        "note": "동일 수록판의 한글판 공식 이미지",
    },
    "xye_024/022": {
        "image": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XYE/XYE_024.jpg",
        "source": "https://pokemoncard.co.kr/cards",
        "referenceSet": "XYE",
        "note": "동일 수록판의 한글판 공식 이미지",
    },
    "xye_025/022": {
        "image": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XYE/XYE_025.jpg",
        "source": "https://pokemoncard.co.kr/cards",
        "referenceSet": "XYE",
        "note": "동일 수록판의 한글판 공식 이미지",
    },
    "xye_026/022": {
        "image": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XYE/XYE_026.jpg",
        "source": "https://pokemoncard.co.kr/cards",
        "referenceSet": "XYE",
        "note": "동일 수록판의 한글판 공식 이미지",
    },
    "xyf_017/016": {
        "image": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XYF/XYF_017.jpg",
        "source": "https://pokemoncard.co.kr/cards",
        "referenceSet": "XYF",
        "note": "동일 수록판의 한글판 공식 이미지",
    },
    "xyh_027/026": {
        "image": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XYH/XYH_027.png",
        "source": "https://pokemoncard.co.kr/cards",
        "referenceSet": "XYH",
        "note": "동일 수록판의 한글판 공식 이미지",
    },
}

REFERENCE_SET_PRIORITY = {
    "CP6": 0,
    "CP4": 1,
    "XY2": 2,
    "XYA": 3,
    "XYB": 4,
    "XYC": 5,
    "XYD": 6,
    "XYE": 7,
    "XYF": 8,
    "XYG": 9,
    "XYH": 10,
    "XY1-Bx": 11,
    "XY1-By": 12,
    "FXY": 13,
}


def korean_reference_key(name: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣]+", "", str(name or "")).casefold()


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
        target_set = str(group.get("code") or "")

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
                raise RuntimeError(f"{code}: Korean official replacement image missing")

            source_set, candidate = sorted(
                candidates,
                key=lambda item: (
                    0 if item[0] == target_set else 1,
                    REFERENCE_SET_PRIORITY.get(item[0], 99),
                    1 if item[0] in {"XYP", "XY"} else 0,
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
                f" · 일본판 대체용 한글판 공식 참고 이미지 "
                f"{replaced_in_group}장"
            )
        if fallback_count:
            note += f" · 공식 검색 누락 {fallback_count}장은 Dogam 참고 이미지"
        group["referenceNote"] = note

    if replacements != len(KNOWN_JP_FALLBACK_CODES):
        raise RuntimeError(
            f"XY JP replacement mismatch: {replacements}/"
            f"{len(KNOWN_JP_FALLBACK_CODES)}"
        )
    return replacements

def run(workers: int) -> None:
    official_values = legacy.official_product_values()
    for meta in SETS:
        meta["officialProducts"] = resolve_products(meta, official_values)
        if meta["officialProducts"]:
            legacy.log(f"상품 연결 · {meta['code']} -> {meta['officialProducts'][0]}")

    inventories = {meta["code"]: [] for meta in SETS}
    jobs = [
        (meta, product)
        for meta in SETS
        for product in meta["officialProducts"]
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers, 12)) as pool:
        futures = {
            pool.submit(product_inventory, meta, product): meta
            for meta, product in jobs
        }
        for future in concurrent.futures.as_completed(futures):
            meta = futures[future]
            inventories[meta["code"]].extend(future.result())

    groups: list[dict[str, Any]] = []
    for meta in SETS:
        unique: dict[str, dict[str, str]] = {}
        for record in inventories[meta["code"]]:
            card_num = str(record.get("CardNum") or "").strip()
            if card_num:
                unique.setdefault(card_num, record)
        group = build_group(meta, list(unique.values()), workers)
        groups.append(group)
        legacy.log(f"완료 · {group['code']} {group['displayName']}: {len(group['cards'])}장")

    replacement_count = replace_known_japanese_fallbacks(groups)
    legacy.log(f"XY 일본판 이미지 교체 완료 · {replacement_count}장")

    existing = json.loads(LEGACY_PATH.read_text(encoding="utf-8"))
    preserved = [
        group for group in existing
        if str(group.get("era") or "").upper() != "XY"
    ]
    output = [*preserved, *groups]
    LEGACY_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    total = sum(len(group["cards"]) for group in groups)
    if len(groups) != 37 or total != 2313:
        raise RuntimeError(f"XY total mismatch: {len(groups)} sets / {total} cards")
    legacy.log(f"XY 저장 완료 · {len(groups)}세트 / {total}장")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=16)
    args = parser.parse_args()
    try:
        run(args.workers)
        return 0
    except Exception as error:
        print(f"오류: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
