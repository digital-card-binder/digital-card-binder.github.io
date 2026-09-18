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
from pathlib import Path
import re
import sys
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_legacy_series_data as legacy  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
LEGACY_PATH = ROOT / "data" / "series-legacy.json"
DOGAM_SOURCE = "https://www.dogam.app/sets"

SETS: list[dict[str, Any]] = [
    {"code":"BW1-Bb","title":"블랙 컬렉션","count":56,"aliases":["블랙 컬렉션"]},
    {"code":"BW1-Bw","title":"화이트 컬렉션","count":56,"aliases":["화이트 컬렉션"]},
    {"code":"BD","title":"볼트로스 덱","count":16,"aliases":["볼트로스 덱","볼트로스덱"]},
    {"code":"TD","title":"토네로스 덱","count":16,"aliases":["토네로스 덱","토네로스덱"]},
    {"code":"FS","title":"BW 퍼스트 세트","count":40,"aliases":["BW 퍼스트 세트","퍼스트 세트"]},
    {"code":"BW2","title":"레드 컬렉션","count":72,"aliases":["레드 컬렉션"]},
    {"code":"BTV","title":"배틀 체인지덱 비크티니 덱","count":24,"aliases":["배틀 체인지덱 비크티니 덱","비크티니 덱"]},
    {"code":"BGc","title":"배틀 강화덱 - 코바르온 덱","count":16,"aliases":["코바르온 덱","코바르온덱"]},
    {"code":"PBG","title":"플라스마단 스페셜 세트","count":18,"aliases":["플라스마단 스페셜 세트"]},
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
    {"code":"MG-Bg","title":"30장 덱 대전 게노세크트","count":17,"aliases":["게노세크트"]},
    {"code":"MG-Bm","title":"30장 덱 대전 뮤츠","count":17,"aliases":["30장 덱 대전 뮤츠","뮤츠"]},
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

def resolve_product(meta: dict[str, Any], values: dict[str, str]) -> str:
    options = list(values.values())
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
    return scored[0][2]

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
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        cards = list(pool.map(detail_record, records))

    if meta["code"] == "BWP":
        for card in cards:
            infer_promo_number(card)

    deduped: dict[tuple[str,str],dict[str,Any]] = {}
    for card in cards:
        key = card_identity(card)
        current = deduped.get(key)
        if current is None or representative_score(card) < representative_score(current):
            deduped[key] = card
    cards = list(deduped.values())

    numbered = [c for c in cards if c["number"]]
    numberless = [c for c in cards if not c["number"]]
    numbered.sort(key=lambda c:int(c["number"]))
    numberless.sort(key=lambda c:(ENERGY_ORDER.get(c["name"],999),c["name"],c["CardNum"]))
    cards = [*numbered,*numberless]

    if len(cards) != meta["count"]:
        summary=[(c["number"],c["denominator"],c["name"],c["CardNum"]) for c in cards]
        raise RuntimeError(
            f"{meta['code']} {meta['title']}: expected {meta['count']} cards, "
            f"official catalog produced {len(cards)} after dedupe\n{summary}"
        )

    finalized=[]
    for order,card in enumerate(cards,start=1):
        if card["number"]:
            number=str(int(card["number"])).zfill(3)
            denominator=card["denominator"]
            denominator=denominator.zfill(3) if denominator.isdigit() else denominator
            suffix=f"{number}/{denominator or str(meta['count']).zfill(3)}"
        else:
            token=ENERGY_TOKEN.get(card["name"])
            if not token:
                token=re.sub(r"[^0-9A-Za-z가-힣]+","-",card["name"]).strip("-").upper()
                token=f"{token}-{card['CardNum'][-4:]}"
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

    return {
        "code":meta["code"],
        "title":f"{meta['title']} ({len(finalized)}장)",
        "displayName":meta["title"],
        "era":"BW",
        "release":"",
        "sourceProducts":[meta["officialProduct"]],
        "referenceImageRegion":"KR",
        "referenceNote":f"한글판 {len(finalized)}장 기준 · 포켓몬코리아 공식 이미지",
        "referenceSource":DOGAM_SOURCE,
        "cards":finalized,
    }

def run(workers:int)->None:
    official_values=legacy.official_product_values()
    for meta in SETS:
        meta["officialProduct"]=resolve_product(meta,official_values)
        legacy.log(f"상품 연결 · {meta['code']} -> {meta['officialProduct']}")

    inventories={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers,12)) as pool:
        futures={pool.submit(product_inventory,m,m["officialProduct"]):m for m in SETS}
        for future in concurrent.futures.as_completed(futures):
            meta=futures[future]
            inventories[meta["code"]]=future.result()

    groups=[]
    for meta in SETS:
        group=build_group(meta,inventories[meta["code"]],workers)
        groups.append(group)
        legacy.log(f"완료 · {group['code']} {group['displayName']}: {len(group['cards'])}장")

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
