#!/usr/bin/env python3
"""Build Korean Sword & Shield / Sun & Moon series catalogs.

The Korean Pokemon Card search is the source of truth for product membership,
card numbers, Korean card names, and image URLs. Reprint products are queried
too, then collapsed only when the set code and printed card number are equal.
That intentionally treats parallel foil/mirror images as one collection slot.

Fetched pages are cached below ``tmp/legacy-series-cache`` so an interrupted
run can be resumed without repeatedly requesting the same official pages.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import threading
import time
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen
from http.cookiejar import CookieJar


ROOT = Path(__file__).resolve().parents[1]
SERIES_PATH = ROOT / "data" / "series.json"
CACHE_ROOT = ROOT / "tmp" / "legacy-series-cache"
OFFICIAL_BASE = "https://pokemoncard.co.kr"
OFFICIAL_CARD_IMAGE_BASE = (
    "https://cards.image.pokemonkorea.co.kr/data/"
)
POKELLECTOR_BASE = "https://jp.pokellector.com"

USER_AGENT = (
    "Mozilla/5.0 (compatible; DigitalCardBinderDataBuilder/1.0; "
    "+https://digital-card-binder.github.io/)"
)


# Product order is the Korean release order shown in the catalog. Alternate
# packaging with the same set is kept in the source list because it can expose
# additional printed card numbers in Korea.
PRODUCTS: list[dict[str, str]] = [
    # Sword & Shield
    {"era": "S", "code": "s1W", "title": "소드", "product": "소드&실드 확장팩 「소드」"},
    {"era": "S", "code": "s1H", "title": "실드", "product": "소드&실드 확장팩 「실드」"},
    {"era": "S", "code": "s1a", "title": "VMAX라이징", "product": "소드&실드 강화 확장팩 「VMAX라이징」"},
    {"era": "S", "code": "s2", "title": "반역크래시", "product": "소드&실드 확장팩 「반역크래시」"},
    {"era": "S", "code": "s2a", "title": "폭염워커", "product": "소드&실드 강화 확장팩 「폭염워커」"},
    {"era": "S", "code": "s3", "title": "무한존", "product": "소드&실드 확장팩 「무한존」"},
    {"era": "S", "code": "s3a", "title": "전설의 고동", "product": "소드&실드 강화 확장팩 「전설의 고동」"},
    {"era": "S", "code": "s4", "title": "앙천의 볼트태클", "product": "소드&실드 확장팩 「앙천의 볼트태클」"},
    {"era": "S", "code": "s4a", "title": "샤이니스타 V", "product": "소드&실드 하이클래스팩 「샤이니스타 V」"},
    {"era": "S", "code": "s5I", "title": "일격마스터", "product": "소드&실드 확장팩 「일격마스터」"},
    {"era": "S", "code": "s5R", "title": "연격마스터", "product": "소드&실드 확장팩 「연격마스터」"},
    {"era": "S", "code": "s5a", "title": "쌍벽의 파이터", "product": "소드&실드 강화 확장팩 「쌍벽의 파이터」"},
    {"era": "S", "code": "s6H", "title": "백은의 랜스", "product": "소드&실드 확장팩 「백은의 랜스」"},
    {"era": "S", "code": "s6K", "title": "칠흑의 가이스트", "product": "소드&실드 확장팩 「칠흑의 가이스트」"},
    {"era": "S", "code": "s6a", "title": "이브이 히어로즈", "product": "소드&실드 강화 확장팩 「이브이 히어로즈」"},
    {"era": "S", "code": "s7D", "title": "마천퍼펙트", "product": "소드&실드 확장팩 「마천퍼펙트」"},
    {"era": "S", "code": "s7R", "title": "창공스트림", "product": "소드&실드 확장팩 「창공스트림」"},
    {"era": "S", "code": "s8", "title": "퓨전아츠", "product": "소드&실드 확장팩 「퓨전아츠」"},
    {"era": "S", "code": "s8a", "title": "25th ANNIVERSARY COLLECTION", "product": "소드&실드 확장팩 「25th ANNIVERSARY COLLECTION」"},
    {"era": "S", "code": "s8b", "title": "VMAX 클라이맥스", "product": "소드&실드 하이클래스팩 「VMAX 클라이맥스」"},
    {"era": "S", "code": "s9", "title": "스타버스", "product": "소드&실드 확장팩 「스타버스」"},
    {"era": "S", "code": "s9a", "title": "배틀리전", "product": "소드&실드 강화 확장팩 「배틀리전」"},
    {"era": "S", "code": "s10P", "title": "스페이스 저글러", "product": "소드&실드 확장팩 「스페이스 저글러」"},
    {"era": "S", "code": "s10D", "title": "타임게이저", "product": "소드&실드 확장팩 「타임게이저」"},
    {"era": "S", "code": "s10a", "title": "다크판타스마", "product": "소드&실드 강화 확장팩 「다크판타스마」"},
    {"era": "S", "code": "s10b", "title": "Pokémon GO", "product": "소드&실드 강화 확장팩 「Pokémon GO」"},
    {"era": "S", "code": "s11", "title": "로스트어비스", "product": "소드&실드 확장팩 「로스트어비스」"},
    {"era": "S", "code": "s11a", "title": "백열의 아르카나", "product": "소드&실드 강화 확장팩 「백열의 아르카나」"},
    {"era": "S", "code": "s12", "title": "패러다임트리거", "product": "소드&실드 확장팩 「패러다임트리거」"},
    {"era": "S", "code": "s12a", "title": "VSTAR 유니버스", "product": "소드&실드 하이클래스팩 「VSTAR 유니버스」"},
    # Sun & Moon
    {"era": "SM", "code": "sm1S", "title": "썬 컬렉션", "product": "썬&문 확장팩 제1탄 「썬 컬렉션」"},
    {"era": "SM", "code": "sm1M", "title": "문 컬렉션", "product": "썬&문 확장팩 제1탄 「문 컬렉션」"},
    {"era": "SM", "code": "sm1+", "title": "썬&문", "product": "썬&문 강화 확장팩 「썬&문」"},
    {"era": "SM", "code": "sm2K", "title": "알로라의 햇빛", "product": "썬&문 확장팩 제2탄 「알로라의 햇빛」"},
    {"era": "SM", "code": "sm2L", "title": "알로라의 달빛", "product": "썬&문 확장팩 제2탄 「알로라의 달빛」"},
    {"era": "SM", "code": "sm2+", "title": "새로운 시련", "product": "썬&문 강화 확장팩 「새로운 시련」"},
    {"era": "SM", "code": "sm3H", "title": "어둠을 밝힌 무지개", "product": "썬&문 확장팩 제3탄 「어둠을 밝힌 무지개」"},
    {"era": "SM", "code": "sm3N", "title": "빛을 삼킨 어둠", "product": "썬&문 확장팩 제3탄 「빛을 삼킨 어둠」"},
    {"era": "SM", "code": "sm3+", "title": "빛나는 전설", "product": "썬&문 강화 확장팩 「빛나는 전설」"},
    {"era": "SM", "code": "sm4S", "title": "각성의 용사", "product": "썬&문 확장팩 제4탄 「각성의 용사」"},
    {"era": "SM", "code": "sm4A", "title": "초차원의 침략자", "product": "썬&문 확장팩 제4탄 「초차원의 침략자」"},
    {"era": "SM", "code": "sm4+", "title": "GX 배틀부스트", "product": "썬&문 강화 확장팩 「GX 배틀부스트」"},
    {"era": "SM", "code": "sm4+", "title": "GX 배틀부스트", "product": "썬&문 강화 확장팩 「GX 배틀부스트 REMASTER」"},
    {"era": "SM", "code": "sm5S", "title": "울트라썬", "product": "썬&문 확장팩 제5탄 「울트라썬」"},
    {"era": "SM", "code": "sm5M", "title": "울트라문", "product": "썬&문 확장팩 제5탄 「울트라문」"},
    {"era": "SM", "code": "sm5+", "title": "울트라포스", "product": "썬&문 강화 확장팩 「울트라포스」"},
    {"era": "SM", "code": "sm6", "title": "금단의 빛", "product": "썬&문 확장팩 제6탄 「금단의 빛」"},
    {"era": "SM", "code": "sm6a", "title": "드래곤스톰", "product": "썬&문 강화 확장팩 「드래곤스톰」"},
    {"era": "SM", "code": "sm6b", "title": "챔피언로드", "product": "썬&문 강화 확장팩 「챔피언로드」"},
    {"era": "SM", "code": "sm7", "title": "창공의 카리스마", "product": "썬&문 확장팩 제7탄 「창공의 카리스마」"},
    {"era": "SM", "code": "sm7a", "title": "플라스마 스파크", "product": "썬&문 강화 확장팩 「플라스마 스파크」"},
    {"era": "SM", "code": "sm7b", "title": "페어리라이즈", "product": "썬&문 강화 확장팩 「페어리라이즈」"},
    {"era": "SM", "code": "sm8", "title": "버스트임팩트", "product": "썬&문 확장팩 제8탄 「버스트임팩트」"},
    {"era": "SM", "code": "sm8a", "title": "다크오더", "product": "썬&문 강화 확장팩 「다크오더」"},
    {"era": "SM", "code": "sm8b", "title": "GX 울트라샤이니", "product": "썬&문 하이클래스팩 「GX 울트라샤이니」"},
    {"era": "SM", "code": "sm8b", "title": "GX 울트라샤이니", "product": "썬&문 하이클래스팩 「GX 울트라샤이니 ULTIMATE」"},
    {"era": "SM", "code": "sm9", "title": "태그볼트", "product": "썬&문 확장팩 「태그볼트」"},
    {"era": "SM", "code": "sm9a", "title": "나이트유니슨", "product": "썬&문 강화 확장팩 「나이트유니슨」"},
    {"era": "SM", "code": "sm9b", "title": "풀메탈월", "product": "썬&문 강화 확장팩 「풀메탈월」"},
    {"era": "SM", "code": "sm10", "title": "더블블레이즈", "product": "썬&문 확장팩 「더블블레이즈」"},
    {"era": "SM", "code": "sm10a", "title": "GG엔드", "product": "썬&문 강화 확장팩 「GG엔드」"},
    {"era": "SM", "code": "sm10b", "title": "스카이레전드", "product": "썬&문 강화 확장팩 「스카이레전드」"},
    {"era": "SM", "code": "smp2", "title": "명탐정 피카츄", "product": "썬&문 영화 스페셜 팩 「명탐정 피카츄」"},
    {"era": "SM", "code": "sm11", "title": "미라클트윈", "product": "썬&문 확장팩 제11탄 「미라클트윈」"},
    {"era": "SM", "code": "sm11a", "title": "리믹스바우트", "product": "썬&문 강화 확장팩 「리믹스바우트」"},
    {"era": "SM", "code": "sm11b", "title": "드림리그", "product": "썬&문 강화 확장팩 「드림리그」"},
    {"era": "SM", "code": "sm12", "title": "얼터제네시스", "product": "썬&문 확장팩 제12탄 「얼터제네시스」"},
    {"era": "SM", "code": "sm12a", "title": "TAG TEAM GX 태그올스타즈", "product": "썬&문 하이클래스팩 「TAG TEAM GX 태그올스타즈」"},
]


PRINT_LOCK = threading.Lock()


def log(message: str) -> None:
    with PRINT_LOCK:
        print(message, flush=True)


def compact(value: str) -> str:
    return re.sub(r"\s+", "", html.unescape(value)).casefold()


def cache_path(kind: str, key: str, suffix: str) -> Path:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    path = CACHE_ROOT / kind / f"{digest}{suffix}"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def request_bytes(
    url: str,
    *,
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    attempts: int = 4,
) -> bytes:
    request_headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
        **(headers or {}),
    }
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = Request(url, data=data, headers=request_headers)
            with urlopen(request, timeout=75) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"request failed: {url}") from last_error


def cached_request(
    kind: str,
    key: str,
    url: str,
    *,
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    suffix: str = ".html",
) -> bytes:
    path = cache_path(kind, key, suffix)
    if path.exists() and path.stat().st_size:
        return path.read_bytes()
    payload = request_bytes(url, data=data, headers=headers)
    path.write_bytes(payload)
    return payload


class GoodsOptionsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_goods_select = False
        self.options: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "select" and attributes.get("name") == "GoodsName":
            self.in_goods_select = True
        elif tag == "option" and self.in_goods_select:
            value = attributes.get("value")
            if value:
                self.options.append(html.unescape(value))

    def handle_endtag(self, tag: str) -> None:
        if tag == "select" and self.in_goods_select:
            self.in_goods_select = False


def official_product_values() -> dict[str, str]:
    payload = cached_request(
        "official", "cards-index", f"{OFFICIAL_BASE}/cards"
    ).decode("utf-8", errors="replace")
    parser = GoodsOptionsParser()
    parser.feed(payload)
    values: dict[str, str] = {}
    for option in parser.options:
        values.setdefault(compact(option), option)
    return values


def parse_json_response(payload: bytes) -> dict[str, Any]:
    text = payload.decode("utf-8", errors="replace")
    start = text.find('{"status"')
    if start < 0:
        start = text.find("{")
    if start < 0:
        raise ValueError(f"official response did not contain JSON: {text[:120]!r}")
    return json.loads(text[start:])


def ajax_page(product: str, card_type: int, page: int) -> list[dict[str, str]]:
    form: dict[str, str] = {
        "action": "get_more_cards",
        "limit": str(page),
        "GoodsName": product,
        "CardTypeNum": str(card_type),
        "CardType": "all",
        "order": "ASC",
        "orderby": "CardNum",
    }
    if card_type == 1:
        form.update(
            {
                "CardMonType": "all",
                "Weakness": "all",
                "Resistance": "all",
                "TechErg": "all",
                "ability_label1": "all",
                "hp": "0,380",
                "retreat": "0,5",
            }
        )
    body = urlencode(form).encode("utf-8")
    key = json.dumps([product, card_type, page], ensure_ascii=False)
    payload = cached_request(
        "ajax",
        key,
        f"{OFFICIAL_BASE}/v2/ajax2_dev2",
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": f"{OFFICIAL_BASE}/cards",
            "X-Requested-With": "XMLHttpRequest",
        },
        suffix=".json",
    )
    response = parse_json_response(payload)
    result = response.get("result") or []
    if isinstance(result, dict):
        return list(result.values())
    return list(result)


def product_inventory(product: dict[str, str], official_value: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for card_type in (1, 2, 3):
        page = 0
        while True:
            page_records = ajax_page(official_value, card_type, page)
            for record in page_records:
                records.append({**record, **product, "officialProduct": official_value})
            if len(page_records) < 30:
                break
            page += 1
    log(f"공식 목록 · {product['code']} {product['title']}: {len(records)}건")
    return records


def feature_image_url(value: str) -> str:
    path = value.split("?", 1)[0].lstrip("/")
    return f"{OFFICIAL_CARD_IMAGE_BASE}{path}"


def image_identity(value: str) -> tuple[str, str] | None:
    path = value.split("?", 1)[0]
    match = re.search(r"wmimages/(?:S|SM)/([^/]+)/([^/]+)$", path, re.IGNORECASE)
    if not match:
        return None
    filename = match.group(2).rsplit(".", 1)[0]
    # The filename prefix is the printed set code. This matters for Korean
    # repackage results stored in generic PROMO/temp image directories.
    actual_code = filename.split("_", 1)[0] or match.group(1)
    number_match = re.search(r"_([0-9]{1,4})(?:[^0-9]|$)", filename)
    if number_match:
        return actual_code, str(int(number_match.group(1)))
    token = filename.split("_", 1)[-1].strip()
    return (actual_code, token) if token else None


def preferred_record(left: dict[str, str], right: dict[str, str]) -> dict[str, str]:
    def score(record: dict[str, str]) -> tuple[int, int, str]:
        path = record["feature_image"].split("?", 1)[0]
        filename = path.rsplit("/", 1)[-1]
        variant = bool(re.search(r"(?:mirror|ball|reverse|foil|holo)", filename, re.I))
        return (int(variant), len(filename), record.get("CardNum", ""))

    return min((left, right), key=score)


def group_inventory(records: Iterable[dict[str, str]]) -> list[dict[str, Any]]:
    slots: dict[tuple[str, str, str], dict[str, str]] = {}
    group_meta: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for product in PRODUCTS:
        group_key = compact(product["code"])
        if group_key in group_meta:
            group_meta[group_key]["products"].append(product["product"])
            continue
        group_meta[group_key] = {
            "code": product["code"],
            "title": product["title"],
            "era": product["era"],
            "products": [product["product"]],
        }
        order.append(group_key)

    for record in records:
        identity = image_identity(record.get("feature_image", ""))
        if not identity:
            log(f"경고 · 이미지 경로에서 세트/번호를 읽지 못함: {record}")
            continue
        actual_code, printed_number = identity
        group_key = compact(record["code"])
        slot_key = (group_key, actual_code.casefold(), printed_number.casefold())
        current = slots.get(slot_key)
        slots[slot_key] = record if current is None else preferred_record(current, record)

    groups: list[dict[str, Any]] = []
    for group_key in order:
        meta = group_meta[group_key]
        cards = []
        for (slot_group, actual_code_key, printed_number), record in slots.items():
            if slot_group != group_key:
                continue
            actual_code, _ = image_identity(record["feature_image"]) or (actual_code_key, printed_number)
            number = int(printed_number) if printed_number.isdigit() else None
            cards.append(
                {
                    "number": number,
                    "numberToken": printed_number,
                    "actualCode": actual_code,
                    "CardNum": record["CardNum"],
                    "image": feature_image_url(record["feature_image"]),
                }
            )
        cards.sort(
            key=lambda card: (
                card["number"] is None,
                card["number"] if card["number"] is not None else 99999,
                card["actualCode"].casefold(),
                card["numberToken"].casefold(),
            )
        )
        if cards:
            groups.append({**meta, "cards": cards})
    return groups


class SetLinksParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        attributes = dict(attrs)
        classes = (attributes.get("class") or "").split()
        code = attributes.get("name")
        href = attributes.get("href")
        if "button" in classes and code and href and "Expansion" in href:
            self.links.setdefault(compact(code), href)


def set_links() -> dict[str, str]:
    payload = cached_request("pokellector", "sets", f"{POKELLECTOR_BASE}/sets")
    parser = SetLinksParser()
    parser.feed(payload.decode("utf-8", errors="replace"))
    return parser.links


def pokellector_alias(code: str) -> str:
    aliases = {
        "sm1p": "sm1+",
        "sm2p": "sm2+",
        "sm3p": "sm3+",
        "sm4p": "sm4+",
        "sm5p": "sm5+",
    }
    return aliases.get(compact(code), code)


def comparable_set_code(code: str) -> str:
    value = compact(code).replace("+", "p")
    return re.sub(r"[^a-z0-9]", "", value)


def pokellector_names(code: str, links: dict[str, str]) -> dict[int, str]:
    lookup = compact(pokellector_alias(code))
    href = links.get(lookup)
    if not href:
        return {}
    payload = cached_request(
        "pokellector-sets", lookup, f"{POKELLECTOR_BASE}{href}"
    ).decode("utf-8", errors="replace")
    names: dict[int, str] = {}
    for match in re.finditer(
        r'<div class="plaque">\s*#([0-9]+)\s*-\s*(.*?)\s*</div>',
        payload,
        re.DOTALL | re.IGNORECASE,
    ):
        name = html.unescape(re.sub(r"<[^>]+>", "", match.group(2))).strip()
        names[int(match.group(1))] = name
    return names


def image_key(value: str) -> str:
    return value.split("?", 1)[0].replace("http://", "https://")


def walk_dicts(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_dicts(child)


def existing_image_names() -> dict[str, str]:
    names: dict[str, str] = {}
    for path in (ROOT / "data").glob("*.json"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for record in walk_dicts(payload):
            image = record.get("image") or record.get("imageUrl")
            name = (
                record.get("name")
                or record.get("pokemonName")
                or record.get("actualName")
            )
            if image and name and str(name).strip():
                names.setdefault(image_key(str(image)), str(name).strip())
    return names


def pokemon_name_map() -> dict[str, str]:
    payload = json.loads((ROOT / "data" / "pokedex.json").read_text(encoding="utf-8"))
    return {
        str(record["nameEn"]).casefold(): str(record["nameKo"])
        for record in payload["records"]
    }


def translate_pokemon_name(english: str, species: dict[str, str]) -> str | None:
    value = english.strip()
    suffix = ""
    for candidate in (" V-UNION", " VMAX", " VSTAR", " GX", " EX", " ex", " V"):
        if value.endswith(candidate):
            value = value[: -len(candidate)].strip()
            suffix = candidate
            break

    prefix = ""
    for source, korean in (
        ("Alolan ", "알로라 "),
        ("Galarian ", "가라르 "),
        ("Hisuian ", "히스이 "),
        ("Radiant ", "찬란한 "),
        ("Shining ", "빛나는 "),
    ):
        if value.startswith(source):
            value = value[len(source) :]
            prefix = korean
            break

    parts = re.split(r"\s*&\s*", value)
    translated: list[str] = []
    for part in parts:
        korean = species.get(part.casefold())
        if not korean:
            return None
        translated.append(korean)
    return f"{prefix}{'&'.join(translated)}{suffix}"


def detail_payload(card_num: str) -> str:
    return cached_request(
        "details",
        card_num,
        f"{OFFICIAL_BASE}/cards/detail/{card_num}",
    ).decode("utf-8", errors="replace")


def parse_detail(payload: str) -> dict[str, str]:
    name_match = re.search(
        r'<span class="card-hp title">\s*(.*?)\s*</span>',
        payload,
        re.DOTALL | re.IGNORECASE,
    )
    number_match = re.search(
        r'<span class="p_num">\s*([0-9]+)\s*/\s*([A-Za-z0-9+_-]+)'
        r'\s*<span[^>]*>\s*([^<]*)',
        payload,
        re.DOTALL | re.IGNORECASE,
    )
    result: dict[str, str] = {}
    if name_match:
        result["name"] = html.unescape(
            re.sub(r"<[^>]+>", "", name_match.group(1))
        ).strip()
    if number_match:
        result["number"] = number_match.group(1).zfill(3)
        denominator = number_match.group(2)
        result["denominator"] = (
            denominator.zfill(3) if denominator.isdigit() else denominator
        )
        rarity = html.unescape(number_match.group(3)).strip()
        if rarity:
            result["rarity"] = rarity
    return result


def enrich_groups(groups: list[dict[str, Any]], workers: int) -> None:
    links = set_links()
    known_images = existing_image_names()
    species = pokemon_name_map()

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers, 16)) as pool:
        future_names = {
            pool.submit(pokellector_names, group["code"], links): group
            for group in groups
        }
        for future in concurrent.futures.as_completed(future_names):
            group = future_names[future]
            group["referenceNames"] = future.result()

    details_needed: dict[str, list[dict[str, Any]]] = {}
    denominator_cards: dict[tuple[str, str], dict[str, Any]] = {}
    for group in groups:
        for card in group["cards"]:
            existing = known_images.get(image_key(card["image"]))
            same_numbering = comparable_set_code(card["actualCode"]) == comparable_set_code(
                group["code"]
            )
            english = (
                group["referenceNames"].get(card["number"])
                if same_numbering and card["number"] is not None
                else None
            )
            translated = translate_pokemon_name(english, species) if english else None
            card["name"] = existing or translated or ""
            if not card["name"]:
                details_needed.setdefault(card["CardNum"], []).append(card)
            if card["number"] is not None:
                denominator_cards.setdefault(
                    (compact(group["code"]), card["actualCode"].casefold()), card
                )

    # One official detail per printed set code supplies that code's denominator.
    for card in denominator_cards.values():
        details_needed.setdefault(card["CardNum"], []).append(card)

    log(
        f"한국어명 공식 상세 조회: {len(details_needed)}건 "
        f"(전체 슬롯 {sum(len(group['cards']) for group in groups)}장)"
    )
    parsed_details: dict[str, dict[str, str]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(detail_payload, card_num): card_num
            for card_num in details_needed
        }
        completed = 0
        for future in concurrent.futures.as_completed(futures):
            card_num = futures[future]
            parsed_details[card_num] = parse_detail(future.result())
            completed += 1
            if completed % 100 == 0 or completed == len(futures):
                log(f"공식 상세 · {completed}/{len(futures)}")

    for card_num, target_cards in details_needed.items():
        detail = parsed_details.get(card_num, {})
        for card in target_cards:
            if not card["name"] and detail.get("name"):
                card["name"] = detail["name"]
            if detail.get("number"):
                card["number"] = int(detail["number"])
                card["numberToken"] = str(int(detail["number"]))
            if detail.get("denominator"):
                card["detailDenominator"] = detail["denominator"]

    denominators: dict[tuple[str, str], str] = {}
    for (group_key, actual_code), card in denominator_cards.items():
        detail = parsed_details.get(card["CardNum"], {})
        denominator = detail.get("denominator")
        if not denominator:
            raise RuntimeError(
                f"{group_key}/{actual_code}: official denominator missing"
            )
        denominators[(group_key, actual_code)] = denominator

    for group in groups:
        group_key = compact(group["code"])
        for card in group["cards"]:
            card["denominator"] = card.get("detailDenominator") or denominators.get(
                (group_key, card["actualCode"].casefold()), ""
            )
        main_card = next(
            (
                card
                for card in group["cards"]
                if comparable_set_code(card["actualCode"])
                == comparable_set_code(group["code"])
                and card["denominator"]
            ),
            next((card for card in group["cards"] if card["denominator"]), None),
        )
        if not main_card:
            raise RuntimeError(f"{group['code']}: main denominator missing")
        group["denominator"] = main_card["denominator"]
        deduplicated: dict[tuple[str, str], dict[str, Any]] = {}
        for card in group["cards"]:
            printed = (
                str(card["number"])
                if card["number"] is not None
                else card["numberToken"].casefold()
            )
            identity = (card["actualCode"].casefold(), printed)
            current = deduplicated.get(identity)
            if current is None:
                deduplicated[identity] = card
                continue

            def representative_score(candidate: dict[str, Any]) -> tuple[int, int, int, str]:
                filename = candidate["image"].rsplit("/", 1)[-1]
                printed_number = candidate["number"]
                filename_match = re.search(r"_([0-9]{1,4})(?:[^0-9]|$)", filename)
                filename_number = int(filename_match.group(1)) if filename_match else None
                has_variant_label = bool(
                    re.search(r"(?:mirror|ball|reverse|foil|holo)", filename, re.I)
                )
                return (
                    int(filename_number != printed_number),
                    int(has_variant_label),
                    len(filename),
                    candidate["CardNum"],
                )

            deduplicated[identity] = min(
                (current, card), key=representative_score
            )
        group["cards"] = sorted(
            deduplicated.values(),
            key=lambda card: (
                card["number"] is None,
                card["number"] if card["number"] is not None else 99999,
                card["actualCode"].casefold(),
                card["numberToken"].casefold(),
            ),
        )
        group.pop("referenceNames", None)


def finalize_groups(groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    finalized: list[dict[str, Any]] = []
    for group in groups:
        denominator = group["denominator"]
        cards: list[dict[str, Any]] = []
        for order, source in enumerate(group["cards"], start=1):
            name = str(source.get("name", "")).strip()
            if not name:
                raise RuntimeError(
                    f"{group['code']} #{source['number']:03d}: Korean name missing"
                )
            if source["number"] is not None:
                number = f"{source['number']:03d}"
                suffix = f"{number}/{source['denominator'] or denominator}"
            else:
                suffix = source["numberToken"].replace("_", "-").upper()
            cards.append(
                {
                    "code": f"{source['actualCode'].lower()}_{suffix}",
                    "image": source["image"],
                    "owned": False,
                    "status": "구함",
                    "name": name,
                    "order": order,
                    "source": f"{OFFICIAL_BASE}/cards/detail/{source['CardNum']}",
                }
            )
        finalized.append(
            {
                "code": group["code"],
                "title": f"{group['title']} ({len(cards)}/{denominator})",
                "displayName": group["title"],
                "era": group["era"],
                "release": "",
                "sourceProducts": group["products"],
                "cards": cards,
            }
        )
    return finalized


def run(args: argparse.Namespace) -> None:
    CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    official_values = official_product_values()
    resolved: list[tuple[dict[str, str], str]] = []
    for product in PRODUCTS:
        value = official_values.get(compact(product["product"]))
        if not value:
            raise RuntimeError(f"official product option missing: {product['product']}")
        resolved.append((product, value))

    all_records: list[dict[str, str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(args.workers, 12)) as pool:
        futures = {
            pool.submit(product_inventory, product, value): product
            for product, value in resolved
        }
        for future in concurrent.futures.as_completed(futures):
            all_records.extend(future.result())

    groups = group_inventory(all_records)
    log("\n번호별 공식 슬롯")
    for group in groups:
        log(f"  {group['era']:>2} · {group['code']:<6} · {len(group['cards']):>3}장 · {group['title']}")
    log(f"합계: {len(groups)}세트 / {sum(len(group['cards']) for group in groups)}장")
    if args.inventory_only:
        return

    enrich_groups(groups, args.workers)
    legacy_groups = finalize_groups(groups)
    existing = json.loads(SERIES_PATH.read_text(encoding="utf-8"))
    legacy_codes = {group["code"].casefold() for group in legacy_groups}
    preserved = [
        group for group in existing if group.get("code", "").casefold() not in legacy_codes
    ]
    output = [*legacy_groups, *preserved]
    SERIES_PATH.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    log(
        f"저장 완료: {SERIES_PATH.relative_to(ROOT)} · "
        f"{len(output)}세트 / {sum(len(group['cards']) for group in output)}장"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--inventory-only",
        action="store_true",
        help="print official set/card counts without writing series.json",
    )
    parser.add_argument("--workers", type=int, default=20)
    args = parser.parse_args()
    if args.workers < 1 or args.workers > 32:
        parser.error("--workers must be between 1 and 32")
    try:
        run(args)
    except Exception as error:  # noqa: BLE001 - command-line diagnostic
        print(f"오류: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
