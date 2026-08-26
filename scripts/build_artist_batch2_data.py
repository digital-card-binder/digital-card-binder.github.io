#!/usr/bin/env python3
"""Build Ryo Ueda, Kagemaru Himeno, Mitsuhiro Arita, kodama and Hitoshi Ariga.

Illustrator assignment is read from a pinned TCGdex Asia snapshot. Korean
names/images/numbers are taken from this repository's committed Pokemon Korea
catalogs. Rows duplicated across local catalogs are coalesced by official image.
"""
from __future__ import annotations

import glob, json, os, re, subprocess, sys, tempfile
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ARTISTS=["Ryo Ueda","Kagemaru Himeno","Mitsuhiro Arita","kodama","Hitoshi Ariga"]
TCGDEX_REPO="https://github.com/tcgdex/cards-database.git"
TCGDEX_REF="d9083b73db080979123ebf5e9e97338d4e0745b2"
OFFICIAL_CARDS_URL="https://pokemoncard.co.kr/cards"
OFFICIAL_IMAGE_PREFIX="https://cards.image.pokemonkorea.co.kr/data/"
OFFICIAL_DETAIL_PREFIX="https://pokemoncard.co.kr/cards/detail/"
ERA_RANK={"M":0,"SV":1,"S":2,"SM":3,"XY":4,"BW":5,"DP":6}

EXPLICIT_SKIPS={
    ("Kagemaru Himeno","S5I",87),  # Japanese Phoebe HR; Korean release has SR 081/070.
    ("Hitoshi Ariga","SM6",110),   # Japanese Unit Energy F/D/F UR; not in Korean configuration.
}

MANUAL_OVERRIDES={
    ("Ryo Ueda","CP1",32): dict(name="마그마단의 비밀기지",set="CP1",rarity="U",cardNumber="031/034 U",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP1/XY_CP1_031.jpg?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2015003031"),
    ("Ryo Ueda","CP1",31): dict(name="아쿠아단의 비밀기지",set="CP1",rarity="U",cardNumber="032/034 U",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP1/XY_CP1_032.jpg?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2015003032"),

    ("Kagemaru Himeno","S11",2): dict(name="도나리",set="S11",rarity="U",cardNumber="002/100 U",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S11/S11_002.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2022014002"),
    ("Kagemaru Himeno","SV4a",314): dict(name="요씽리스",set="SV4a",rarity="S",cardNumber="314/190 S",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_314.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2024001314"),
    ("Kagemaru Himeno","SV4a",289): dict(name="포푸니",set="SV4a",rarity="S",cardNumber="289/190 S",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_289.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2024001289"),
    ("Kagemaru Himeno","SV4a",295): dict(name="오라티프",set="SV4a",rarity="S",cardNumber="295/190 S",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_295.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2024001295"),

    ("Mitsuhiro Arita","S8b",56): dict(name="모르페코 V-UNION",set="S8b",rarity="RRR",cardNumber="056/184 RRR",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S8b/S8b_056.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2022001056"),
    ("Mitsuhiro Arita","S8b",57): dict(name="모르페코 V-UNION",set="S8b",rarity="RRR",cardNumber="057/184 RRR",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S8b/S8b_057.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2022001056"),
    ("Mitsuhiro Arita","S8b",58): dict(name="모르페코 V-UNION",set="S8b",rarity="RRR",cardNumber="058/184 RRR",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S8b/S8b_058.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2022001056"),
    ("Mitsuhiro Arita","S8b",59): dict(name="모르페코 V-UNION",set="S8b",rarity="RRR",cardNumber="059/184 RRR",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S8b/S8b_059.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2022001056"),
    ("Mitsuhiro Arita","S6H",87): dict(name="토네로스 VMAX",set="S6H",rarity="HR",cardNumber="087/070 HR",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S6H/S6H_087.png?w=400",source=OFFICIAL_CARDS_URL),
    ("Mitsuhiro Arita","S5I",88): dict(name="머스타드",set="S5I",rarity="HR",cardNumber="088/070 HR",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S5I/S5I_088.png?w=400",source=OFFICIAL_CARDS_URL),
    ("Mitsuhiro Arita","S8",39): dict(name="뮤 V",set="S8",rarity="RR",cardNumber="039/100 RR",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S8/S8_039.png?w=400",source=OFFICIAL_CARDS_URL),
    ("Mitsuhiro Arita","CP2",2): dict(name="레시라무",set="CP2",rarity="",cardNumber="002/027",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP2/XY_CP2_002.jpg?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2015008002"),
    ("Mitsuhiro Arita","CP2",20): dict(name="블랙큐레무",set="CP2",rarity="",cardNumber="020/027",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP2/XY_CP2_020.jpg?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2015008020"),
    ("Mitsuhiro Arita","CP1",10): dict(name="마그마단의 오뚝군",set="CP1",rarity="C",cardNumber="010/034 C",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP1/XY_CP1_010.jpg?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2015003010"),
    ("Mitsuhiro Arita","CP1",18): dict(name="아쿠아단의 그라에나",set="CP1",rarity="C",cardNumber="019/034 C",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP1/XY_CP1_019.jpg?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2015003019"),

    ("Hitoshi Ariga","S6H",90): dict(name="피오니",set="S6H",rarity="HR",cardNumber="090/070 HR",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S6H/S6H_090.png?w=400",source=OFFICIAL_CARDS_URL),
    ("Hitoshi Ariga","SV4a",278): dict(name="저승갓숭",set="SV4a",rarity="S",cardNumber="278/190 S",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_278.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2024001278"),
    ("Hitoshi Ariga","SV4a",296): dict(name="마피티프",set="SV4a",rarity="S",cardNumber="296/190 S",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_296.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2024001296"),
    ("Hitoshi Ariga","SV4a",212): dict(name="팔데아 켄타로스",set="SV4a",rarity="S",cardNumber="212/190 S",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_212.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2024001212"),
    ("Hitoshi Ariga","SV4a",194): dict(name="스라크",set="SV4a",rarity="S",cardNumber="194/190 S",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_194.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2024001194"),
    ("Hitoshi Ariga","SV4a",288): dict(name="니로우",set="SV4a",rarity="S",cardNumber="288/190 S",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_288.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2024001288"),
    ("Hitoshi Ariga","SV4a",200): dict(name="눈설왕",set="SV4a",rarity="S",cardNumber="200/190 S",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_200.png?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2024001200"),
    ("Hitoshi Ariga","CP2",12): dict(name="후파 EX",set="CP2",rarity="",cardNumber="012/027",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP2/XY_CP2_012.jpg?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2015008012"),
    ("Hitoshi Ariga","CP1",19): dict(name="마그마단의 그라에나",set="CP1",rarity="C",cardNumber="018/034 C",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP1/XY_CP1_018.jpg?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2015003018"),
    ("Hitoshi Ariga","CP1",5): dict(name="아쿠아단의 씨카이저",set="CP1",rarity="R",cardNumber="005/034 R",image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP1/XY_CP1_005.jpg?w=400",source="https://pokemoncard.co.kr/cards/detail/BS2015003005"),
}

def normalized_image(url):
    p=urlsplit(url); return urlunsplit((p.scheme,p.netloc,p.path,"",""))

def iter_dicts(node):
    if isinstance(node,dict):
        yield node
        for v in node.values(): yield from iter_dicts(v)
    elif isinstance(node,list):
        for v in node: yield from iter_dicts(v)

def row_name(row):
    for key in ("name","pokemonName","cardName"):
        value=str(row.get(key) or "").strip()
        if value: return value
    return ""

def local_identities(row):
    image=str(row.get("image") or "").strip()
    if not image.startswith(OFFICIAL_IMAGE_PREFIX): return []
    pairs=[]; raw=str(row.get("code") or "").strip(); setv=str(row.get("set") or "").strip(); numv=str(row.get("cardNumber") or row.get("number") or "").strip()
    m=re.match(r"^([^_]+)_0*(\d+)(?:/|$)",raw,re.I)
    if m: pairs.append((m.group(1),int(m.group(2))))
    im=re.search(r"/wmimages/[^/]+/([^/]+)/([^/?#]+)",image,re.I)
    if im:
        folder,filename=im.groups(); nm=re.search(r"_0*(\d{1,4})(?:[_\.]|$)",filename,re.I)
        if nm: pairs.append((folder,int(nm.group(1))))
    nm=re.search(r"(\d{1,4})",numv)
    if setv and nm: pairs.append((setv,int(nm.group(1))))
    return pairs

def build_local_index():
    idx=defaultdict(list)
    for filename in sorted(glob.glob("data/*.json")):
        if filename.replace("\\","/") in {"data/artists.json","data/artists-popular.json"}: continue
        try: payload=json.loads(Path(filename).read_text(encoding="utf-8"))
        except Exception: continue
        for row in iter_dicts(payload):
            image=str(row.get("image") or "").strip()
            if not image.startswith(OFFICIAL_IMAGE_PREFIX): continue
            for set_name,number in local_identities(row): idx[(set_name.casefold(),number)].append(row)
    return idx

def clone_tcgdex(target):
    subprocess.run(["git","clone","--filter=blob:none","-q",TCGDEX_REPO,target],check=True)
    subprocess.run(["git","-C",target,"checkout","-q",TCGDEX_REF],check=True)

def korean_sets(base):
    result=set()
    for era in os.listdir(base):
        ep=os.path.join(base,era)
        if not os.path.isdir(ep): continue
        for filename in os.listdir(ep):
            if not filename.endswith('.ts'): continue
            text=Path(ep,filename).read_text(encoding='utf-8',errors='ignore')
            if re.search(r"\bko\s*:",text) or re.search(r"['\"]ko['\"]\s*:",text): result.add((era,filename[:-3]))
    return result

def artist_rows(base):
    grouped=defaultdict(list)
    for root,_,files in os.walk(base):
        for filename in files:
            if not filename.endswith('.ts'): continue
            path=os.path.join(root,filename); text=Path(path).read_text(encoding='utf-8',errors='ignore')
            m=re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]",text)
            if not m: continue
            illustrator=m.group(1)
            for artist in ARTISTS:
                if illustrator.casefold()!=artist.casefold(): continue
                rel=os.path.relpath(path,base); parts=rel.split(os.sep)
                if len(parts)>=3 and re.fullmatch(r"0*\d+",Path(filename).stem): grouped[artist].append((parts[0],parts[1],int(Path(filename).stem),rel))
    return grouped

def name_quality(name):
    lowered=name.casefold()
    special=sum(token in lowered for token in (" ex"," gx"," vmax"," vstar"," v-union"," break"," v"))
    return (special,len(name))

def code_quality(code):
    code=str(code or "").strip()
    return ("/" in code, bool(re.search(r"\s[A-Z]{1,4}$",code)), len(code))

def coalesce_image_rows(rows,fallback_set,fallback_number):
    by_image=defaultdict(list)
    for row in rows:
        image=str(row.get("image") or "").strip()
        if image.startswith(OFFICIAL_IMAGE_PREFIX): by_image[normalized_image(image)].append(row)
    cards=[]
    for _,group in sorted(by_image.items()):
        image=str(group[0].get("image") or "").strip()
        names=[row_name(r) for r in group if row_name(r)]
        if not names: continue
        name=max(names,key=name_quality)
        rich=max(group,key=lambda r:code_quality(r.get("code")))
        card_number=str(rich.get("cardNumber") or "").strip()
        if not card_number:
            code=str(rich.get("code") or "").strip(); m=re.match(r"^[^_]+_(.+)$",code)
            card_number=m.group(1) if m else f"{fallback_number:03d}"
        rarity=str(rich.get("rarity") or "").strip()
        if not rarity:
            m=re.search(r"\s([A-Z]{1,4})$",card_number); rarity=m.group(1) if m else ""
        source=next((str(r.get("source") or "").strip() for r in group if str(r.get("source") or "").startswith(OFFICIAL_DETAIL_PREFIX)),OFFICIAL_CARDS_URL)
        cards.append(dict(name=name,owned=False,set=fallback_set,rarity=rarity,image=image,imageBw="",source=source,cardNumber=card_number))
    return cards

def set_sort_key(item):
    era,set_name,number,_=item; nums=tuple(int(x) for x in re.findall(r"\d+",set_name))
    return (ERA_RANK.get(era,99),tuple(-x for x in nums),set_name.casefold(),number)

def build():
    local=build_local_index()
    with tempfile.TemporaryDirectory() as td:
        repo=os.path.join(td,"tcgdex"); clone_tcgdex(repo); base=os.path.join(repo,"data-asia")
        krsets=korean_sets(base); grouped=artist_rows(base); artists=[]; unresolved=[]
        for artist in ARTISTS:
            cards=[]; seen=set()
            for era,set_name,number,relative in sorted(grouped[artist],key=set_sort_key):
                key=(artist,set_name,number); override=MANUAL_OVERRIDES.get(key); rows=local.get((set_name.casefold(),number),[])
                if override: candidates=[{**override,"owned":False,"imageBw":""}]
                elif rows: candidates=coalesce_image_rows(rows,set_name,number)
                elif key in EXPLICIT_SKIPS: continue
                elif (era,set_name) in krsets:
                    unresolved.append((artist,relative)); continue
                else: continue
                if not candidates:
                    unresolved.append((artist,relative)); continue
                for card in candidates:
                    identity=(card['set'].casefold(),card['cardNumber'],card['name'],normalized_image(card['image']))
                    if identity in seen: continue
                    seen.add(identity); cards.append(card)
            for order,card in enumerate(cards,1): card['order']=order
            artists.append({'name':artist,'cards':cards})
    if unresolved: raise RuntimeError('Unresolved Korean artist cards: '+', '.join(f'{a}:{p}' for a,p in unresolved))
    expected={'Ryo Ueda':58,'Kagemaru Himeno':114,'Mitsuhiro Arita':161,'kodama':79,'Hitoshi Ariga':98}
    for artist in artists:
        if len(artist['cards'])!=expected[artist['name']]: raise RuntimeError(f"Unexpected {artist['name']} count: {len(artist['cards'])}")
    return {'source':'Pokemon Korea official card data + TCGdex illustrator index','sourceUrl':OFFICIAL_CARDS_URL,'illustratorIndex':f'https://github.com/tcgdex/cards-database/tree/{TCGDEX_REF}/data-asia','artistCount':5,'cardCount':sum(len(a['cards']) for a in artists),'ownedCount':0,'artists':artists}

def main():
    output=Path(sys.argv[1] if len(sys.argv)>1 else 'data/artists-batch2.json'); output.parent.mkdir(parents=True,exist_ok=True)
    payload=build(); output.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f"Wrote {payload['artistCount']} artists / {payload['cardCount']} cards to {output}")
    for artist in payload['artists']: print(f"  {artist['name']}: {len(artist['cards'])}")

if __name__=='__main__': main()
