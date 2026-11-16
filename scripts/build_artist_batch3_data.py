#!/usr/bin/env python3
"""Build artist dex batch 3: nagimiso, Ken Sugimori, Kouki Saitou, Akira Komayama,
Masakazu Fukuda, Megumi Mizutani, Anesaki Dynamic, Hideki Ishikawa, Shin Nagasawa, takuyoa.

Illustrator assignment is read from a pinned TCGdex Asia snapshot. Korean
names/images/numbers are taken from this repository's committed Pokemon Korea
catalogs. Rows duplicated across local catalogs are coalesced by official image.
"""
from __future__ import annotations

import glob, json, os, re, subprocess, sys, tempfile
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ARTISTS=["nagimiso","Ken Sugimori","Kouki Saitou","Akira Komayama","Masakazu Fukuda","Megumi Mizutani","Anesaki Dynamic","Hideki Ishikawa","Shin Nagasawa","takuyoa"]
TCGDEX_REPO="https://github.com/tcgdex/cards-database.git"
TCGDEX_REF="d9083b73db080979123ebf5e9e97338d4e0745b2"
OFFICIAL_CARDS_URL="https://pokemoncard.co.kr/cards"
OFFICIAL_IMAGE_PREFIX="https://cards.image.pokemonkorea.co.kr/data/"
OFFICIAL_DETAIL_PREFIX="https://pokemoncard.co.kr/cards/detail/"
ERA_RANK={"M":0,"SV":1,"S":2,"SM":3,"XY":4,"BW":5,"DP":6}

EXPLICIT_SKIPS={}

MANUAL_OVERRIDES={}

def official_image(row):
    """Official Pokemon Korea image URL for a catalog row.

    Newer catalogs store the self-hosted CDN copy in `image` and keep the official
    URL in `sourceImage`; the artist dex stores official URLs (the runtime image
    CDN rewrites them), so prefer whichever field holds the official URL.
    """
    for key in ("image","sourceImage"):
        value=str(row.get(key) or "").strip()
        if value.startswith(OFFICIAL_IMAGE_PREFIX):
            return value if "?" in value else value+"?w=400"
    return ""

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
    image=official_image(row)
    if not image: return []
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
            if not official_image(row): continue
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
        image=official_image(row)
        if image: by_image[normalized_image(image)].append(row)
    cards=[]
    for _,group in sorted(by_image.items()):
        image=official_image(group[0])
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

HELD=[]
CONFLICTS=[]

def existing_images():
    base=json.loads(Path('data/artists.json').read_text(encoding='utf-8'))
    return {c['image'].split('?')[0]:a['name'] for a in base['artists'] if a['name'] not in ARTISTS for c in a['cards']}

def build():
    local=build_local_index(); taken=existing_images()
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
            kept=[]
            for card in cards:
                owner=taken.get(card['image'].split('?')[0])
                if owner: CONFLICTS.append({'artist':artist,'card':card['name'],'set':card['set'],'cardNumber':card['cardNumber'],'alsoCreditedTo':owner}); continue
                kept.append(card)
            cards=kept
            for order,card in enumerate(cards,1): card['order']=order
            artists.append({'name':artist,'cards':cards})
    # 공식 이미지가 확인되지 않은 카드(서드파티 이미지만 있는 카드 등)는 도감에서 보류한다.
    HELD.extend(unresolved)
    return {'source':'Pokemon Korea official card data + TCGdex illustrator index','sourceUrl':OFFICIAL_CARDS_URL,'illustratorIndex':f'https://github.com/tcgdex/cards-database/tree/{TCGDEX_REF}/data-asia','artistCount':len(artists),'cardCount':sum(len(a['cards']) for a in artists),'ownedCount':0,'artists':artists}

def main():
    output=Path(sys.argv[1] if len(sys.argv)>1 else 'data/artists-batch3.json'); output.parent.mkdir(parents=True,exist_ok=True)
    payload=build()
    held=[{'artist':a,'tcgdexPath':p} for a,p in HELD]
    Path('data/audits/artist-batch3-held.json').write_text(json.dumps({'reason':'No Pokemon Korea official image verified in the committed catalogs; held out of the artist dex.','count':len(held),'cards':held,'attributionConflicts':CONFLICTS},ensure_ascii=False,indent=1),encoding='utf-8')
    output.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f"Wrote {payload['artistCount']} artists / {payload['cardCount']} cards to {output}")
    for artist in payload['artists']: print(f"  {artist['name']}: {len(artist['cards'])}")

if __name__=='__main__': main()
