#!/usr/bin/env python3
"""Build the complete Korean Sun & Moon catalog.

Dogam's Korean set pages define set membership and counts. Existing Pokemon
Korea official images in data/series.json are preferred for exact slots.
Cards absent from the current Pokemon Korea archive are filled from the Korean
Dogam card page and are audited separately for image language.
"""

from __future__ import annotations

import argparse
import concurrent.futures
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from typing import Any
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SERIES_PATH = ROOT / "data" / "series.json"
DOGAM_BASE = "https://www.dogam.app"
DOGAM_SOURCE = f"{DOGAM_BASE}/sets"
OFFICIAL_IMAGE_HOST = "https://cards.image.pokemonkorea.co.kr/"
USER_AGENT = "Mozilla/5.0 (compatible; DigitalCardBinderSM/1.0)"

SETS: list[dict[str, Any]] = [
    {"code":"sm1S","title":"썬 컬렉션","count":73,"href":"/sets/01KW0QNJW0GT90NCK2075KBWN4"},
    {"code":"sm1M","title":"문 컬렉션","count":73,"href":"/sets/01KW0QNJ2ZXVSQJ7D8ED81SN3B"},
    {"code":"sm1+","title":"썬&문","count":77,"href":"/sets/01KW0QNGGZKR1GPQ1DQ55B39MN"},
    {"code":"sm60A","title":"전력 배틀 스타터 세트 「루가루암 GX」","count":27,"href":"/sets/01KW0QNH9ZKS7FSBEXTQ9MZGS0"},
    {"code":"sm2K","title":"알로라의 햇빛","count":62,"href":"/sets/01KW0QNEZ0CVFEB2YEH850TS9Z"},
    {"code":"sm2L","title":"알로라의 달빛","count":62,"href":"/sets/01KW0QNE6017DEXACKWMFCNJ63"},
    {"code":"sm2+","title":"새로운 시련","count":75,"href":"/sets/01KW0QNDCQ089HFDETJPJD04CY"},
    {"code":"sm3H","title":"어둠을 밝힌 무지개","count":64,"href":"/sets/01KW0QNBR56RCVP24EW0HDHKWJ"},
    {"code":"sm3N","title":"빛을 삼킨 어둠","count":64,"href":"/sets/01KW0QNAYWHR7RRPP0TTBAXA57"},
    {"code":"sm3+","title":"빛나는 전설","count":91,"href":"/sets/01KW0QNA5H0AH7D3CH7RD4TN53"},
    {"code":"sm4S","title":"각성의 용사","count":62,"href":"/sets/01KW0QN8KQWGZ8A7AE25DF3KFN"},
    {"code":"sm4A","title":"초차원의 침략자","count":62,"href":"/sets/01KW0QN9CKJE884MXMV303V15E"},
    {"code":"sm4+","title":"GX 배틀부스트","count":125,"href":"/sets/01KW0QN7TJPX6BAF87RRM8KY06"},
    {"code":"sm5S","title":"울트라썬","count":78,"href":"/sets/01KW0QN68HC2X1MNMF4BJ2WTD8"},
    {"code":"sm5M","title":"울트라문","count":78,"href":"/sets/01KW0QN5FJJGY9ZRWPY4PW40N9"},
    {"code":"sm5+","title":"울트라포스","count":72,"href":"/sets/01KW0QN4PHMDE887S8FV4WDRP0"},
    {"code":"sm6","title":"금단의 빛","count":110,"href":"/sets/01KW0QN3X827ZKKT8Z56TQWKR7"},
    {"code":"sm6a","title":"드래곤스톰","count":75,"href":"/sets/01KW0QN34874V05CERC2P3NRSQ"},
    {"code":"sm6b","title":"챔피언로드","count":86,"href":"/sets/01KW0QN2BABDT2J880V5QEVVW7"},
    {"code":"sm7","title":"창공의 카리스마","count":112,"href":"/sets/01KW0QN1J77KNWMB5HRWTMGSG8"},
    {"code":"sm7a","title":"플라스마 스파크","count":73,"href":"/sets/01KW0QN0SJWP8QSHR9YE1YV1C1"},
    {"code":"sm7b","title":"페어리라이즈","count":63,"href":"/sets/01KW0QMZ7JP3VZEE4THPD6JK49"},
    {"code":"sm8","title":"버스트임팩트","count":111,"href":"/sets/01KW0QMYEJTGFTFNZ2M9MK3KAE"},
    {"code":"sm8a","title":"다크오더","count":65,"href":"/sets/01KW0QMXNHJQ1M54DARZKW2111"},
    {"code":"sm8b","title":"GX 울트라샤이니","count":250,"href":"/sets/01KW0QMWWANP5EK6BM6JSF9GJ4"},
    {"code":"sm9","title":"태그볼트","count":118,"href":"/sets/01KW0QMVA9HDCAN5RND0A9G5ZC"},
    {"code":"sm9a","title":"나이트유니슨","count":70,"href":"/sets/01KW0QMTH3H5VCAX6HA5C4DRAB"},
    {"code":"sm9b","title":"풀메탈월","count":69,"href":"/sets/01KW0QMRYXN87FSEY7WGDNBD3T"},
    {"code":"sm10","title":"더블블레이즈","count":116,"href":"/sets/01KW0QMQD7F9M15XQWWQZVCD5X"},
    {"code":"sm10a","title":"GG엔드","count":69,"href":"/sets/01KW0QMNTZDBPV03N86RWMCMA2"},
    {"code":"sm10b","title":"스카이레전드","count":69,"href":"/sets/01KW0QMN1X3B23924SHDB615DN"},
    {"code":"smp2","title":"영화 스페셜 팩 「명탐정 피카츄」","count":24,"href":"/sets/01KW0QMM8XX3ZAQ9B7RKFP8HRH"},
    {"code":"sm11","title":"미라클트윈","count":115,"href":"/sets/01KW0QMJQ1B83D15DJ4VKFWX9N"},
    {"code":"sm11a","title":"리믹스바우트","count":80,"href":"/sets/01KW0QMHXXETJ8TACBHW1Z8499"},
    {"code":"sm11b","title":"드림리그","count":75,"href":"/sets/01KW0QMH4X2QNAZKD608VN2GKM"},
    {"code":"sm12","title":"얼터제네시스","count":117,"href":"/sets/01KW0QMGBK8VDVWJ50FYJ6QKS7"},
    {"code":"sm12a","title":"TAG TEAM GX 태그올스타즈","count":235,"href":"/sets/01KW0QMFJK5M82YHNFWTTABTTX"},
    {"code":"SMP","title":"썬&문 프로모 카드","count":249,"href":"/sets/01KW0T6KX2S3MM9YFN9JJ3X5E5"},
    {"code":"sm30A","title":"썬&문 랜덤30장덱","count":89,"href":"/sets/01KY171AKQEXR9NSFG468M4Q40"},
    {"code":"sm60B","title":"전격 스타터 세트 「라이코 GX」","count":23,"href":"/sets/01KY1DGEMKVK2J1EQFQG9E97GE"},
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
            self.links.append((self.current_href, re.sub(r"\s+", " ", "".join(self.current_text)).strip()))
            self.current_href = None
            self.current_text = []

def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language":"ko-KR,ko;q=0.9,en;q=0.5"})
    with urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace")

def normalized(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣]+", "", str(value or "")).casefold()

def parse_manifest_label(label: str) -> tuple[str, str]:
    text = re.sub(r"\s+", " ", label).strip()
    match = re.match(r"^(.*?)[ ]+([0-9]{1,3})$", text)
    if not match:
        match = re.match(r"^(.*?)([0-9]{3})$", text)
    if match:
        return match.group(1).strip(), str(int(match.group(2)))
    return text, ""

def dogam_manifest(meta: dict[str, Any]) -> list[dict[str, str]]:
    parser = AnchorParser()
    parser.feed(fetch_text(DOGAM_BASE + meta["href"]))
    prefix = meta["href"].rstrip("/") + "/cards/"
    seen: set[str] = set()
    items: list[dict[str, str]] = []
    for href, label in parser.links:
        if not href.startswith(prefix) or href in seen:
            continue
        seen.add(href)
        name, number = parse_manifest_label(label)
        items.append({"href":href,"name":name,"number":number})
    if len(items) != meta["count"]:
        raise RuntimeError(f"{meta['code']}: expected {meta['count']} Dogam cards, got {len(items)}")
    return items

def dogam_card_detail(item: dict[str, str]) -> dict[str, str]:
    url = DOGAM_BASE + item["href"]
    html = fetch_text(url)
    image_match = re.search(r"https://static[.]tcgexchange[.]kr/[A-Za-z0-9._/-]+[.](?:png|jpe?g|webp)", html, re.I)
    denominator = ""
    if item["number"]:
        padded = str(int(item["number"])).zfill(3)
        fraction = re.search(rf"(?<![0-9]){re.escape(padded)}\s*/\s*([0-9]{{1,3}}|[A-Za-z0-9-]+)", html, re.I)
        if fraction:
            denominator = fraction.group(1)
    return {"image":image_match.group(0) if image_match else "", "denominator":denominator, "source":url}

def current_number(card: dict[str, Any]) -> str:
    code = str(card.get("code") or "")
    match = re.search(r"_0*([0-9]+)(?:/|$)", code)
    return str(int(match.group(1))) if match else ""

def prefix_for(code: str) -> str:
    if code.upper() == "SMP":
        return "sm-p"
    return code.lower().replace("+", "plus")

def generated_code(meta: dict[str, Any], number: str, denominator: str, order: int, name: str) -> str:
    prefix = prefix_for(meta["code"])
    if number:
        num = str(int(number)).zfill(3)
        den = denominator.zfill(3) if denominator.isdigit() else denominator
        if meta["code"].upper() == "SMP" and not den:
            den = "SM-P"
        return f"{prefix}_{num}/{den}" if den else f"{prefix}_{num}"
    token = re.sub(r"[^0-9A-Za-z가-힣]+", "-", name).strip("-").upper() or "CARD"
    return f"{prefix}_{token}-{order:03d}"

def build_group(meta: dict[str, Any], existing: dict[str, Any] | None, workers: int) -> dict[str, Any]:
    manifest = dogam_manifest(meta)
    official_cards = [
        card for card in (existing or {}).get("cards", [])
        if str(card.get("image") or "").startswith(OFFICIAL_IMAGE_HOST)
    ]
    by_number: dict[str, list[dict[str, Any]]] = {}
    by_number_name: dict[tuple[str,str], list[dict[str, Any]]] = {}
    by_name: dict[str, list[dict[str, Any]]] = {}
    for card in official_cards:
        num = current_number(card)
        nk = normalized(card.get("name"))
        if num:
            by_number.setdefault(num, []).append(card)
            by_number_name.setdefault((num,nk), []).append(card)
        by_name.setdefault(nk, []).append(card)

    selected: list[dict[str, Any] | None] = []
    fallbacks: list[tuple[int,dict[str,str]]] = []
    for idx,item in enumerate(manifest):
        num=item["number"]; nk=normalized(item["name"])
        candidates=by_number_name.get((num,nk),[]) if num else by_name.get(nk,[])
        if not candidates and num and len(by_number.get(num,[]))==1:
            candidates=by_number[num]
        if candidates:
            selected.append(dict(candidates[0]))
        else:
            selected.append(None)
            fallbacks.append((idx,item))

    if fallbacks:
        print(f"Dogam fallback {meta['code']}: {len(fallbacks)}", flush=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers,16)) as pool:
            details=list(pool.map(dogam_card_detail,[item for _,item in fallbacks]))
        for (idx,item),detail in zip(fallbacks,details):
            if not detail["image"]:
                raise RuntimeError(f"{meta['code']} {item['name']} {item['number']}: Dogam image missing")
            selected[idx]={
                "code": generated_code(meta,item["number"],detail["denominator"],idx+1,item["name"]),
                "image": detail["image"],
                "owned": False,
                "status": "구함",
                "name": item["name"],
                "order": idx+1,
                "source": detail["source"],
                "imageReferenceNote": "포켓몬코리아 공식 검색 누락 · Dogam 한글판 카탈로그 참고 이미지",
            }

    cards: list[dict[str, Any]] = []
    for order,(item,card) in enumerate(zip(manifest,selected),start=1):
        if card is None:
            raise RuntimeError(f"{meta['code']}: unresolved card")
        row=dict(card)
        row["owned"]=False
        row["status"]="구함"
        row["order"]=order
        if not str(row.get("name") or "").strip():
            row["name"]=item["name"]
        cards.append(row)

    if len(cards)!=meta["count"]:
        raise RuntimeError(f"{meta['code']}: count mismatch")
    if len({str(c.get("code") or "") for c in cards})!=len(cards):
        dup=[c.get("code") for c in cards]
        raise RuntimeError(f"{meta['code']}: duplicate codes {dup}")
    fallback_count=sum("static.tcgexchange.kr" in str(c.get("image") or "") for c in cards)
    official_count=len(cards)-fallback_count
    products=list((existing or {}).get("sourceProducts") or [])
    return {
        "code":meta["code"],
        "title":f"{meta['title']} ({len(cards)}장)",
        "displayName":meta["title"],
        "era":"SM",
        "release":str((existing or {}).get("release") or ""),
        "sourceProducts":products,
        "referenceImageRegion":"KR",
        "referenceNote":f"한글판 {len(cards)}장 기준 · 포켓몬코리아 공식 이미지 {official_count}장 · Dogam 보완 {fallback_count}장",
        "referenceSource":DOGAM_SOURCE,
        "cards":cards,
    }

def run(workers: int) -> None:
    data=json.loads(SERIES_PATH.read_text(encoding="utf-8"))
    existing={str(g.get("code") or "").casefold():g for g in data if str(g.get("era") or "").upper()=="SM"}
    groups=[]
    for meta in SETS:
        group=build_group(meta,existing.get(meta["code"].casefold()),workers)
        groups.append(group)
        print(f"SM complete {group['code']}: {len(group['cards'])}", flush=True)
    total=sum(len(g["cards"]) for g in groups)
    if len(groups)!=40 or total!=3608:
        raise RuntimeError(f"SM total mismatch: {len(groups)} groups / {total} cards")
    preserved=[g for g in data if str(g.get("era") or "").upper()!="SM"]
    # Keep the S -> SM -> newer-series ordering used by the existing file.
    s_last=max((i for i,g in enumerate(preserved) if str(g.get("era") or "").upper()=="S"),default=-1)
    output=preserved[:s_last+1]+groups+preserved[s_last+1:]
    SERIES_PATH.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"SM saved: 40 groups / {total} cards", flush=True)

def main() -> int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--workers",type=int,default=16)
    args=parser.parse_args()
    if not 1<=args.workers<=24:
        parser.error("--workers must be 1..24")
    run(args.workers)
    return 0

if __name__=="__main__":
    raise SystemExit(main())
