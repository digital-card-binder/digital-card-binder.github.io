#!/usr/bin/env python3
from __future__ import annotations
import json, os, re, subprocess, tempfile
from collections import defaultdict
from pathlib import Path
ARTISTS=['nagimiso','Ken Sugimori','Kouki Saitou','Akira Komayama','Masakazu Fukuda','Megumi Mizutani','Anesaki Dynamic','Hideki Ishikawa','Shin Nagasawa','takuyoa']
REF='d9083b73db080979123ebf5e9e97338d4e0745b2'
REPO='https://github.com/tcgdex/cards-database.git'
LEGACY_ROOTS=('Diamond & Pearl','Platinum','HeartGold & SoulSilver','Black & White','XY')
OUT=Path('data/artist-top10-global-legacy-sets.json')
def main():
    by=defaultdict(lambda: defaultdict(list))
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(['git','clone','--filter=blob:none','-q',REPO,td+'/db'],check=True)
        subprocess.run(['git','-C',td+'/db','checkout','-q',REF],check=True)
        base=Path(td+'/db/data')
        for series in LEGACY_ROOTS:
            root=base/series
            if not root.exists(): continue
            for p in root.rglob('*.ts'):
                if not re.fullmatch(r'0*\d+\.ts',p.name): continue
                t=p.read_text(encoding='utf-8',errors='ignore')
                m=re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]",t)
                if not m: continue
                artist=next((a for a in ARTISTS if a.casefold()==m.group(1).strip().casefold()),None)
                if not artist: continue
                rel=p.relative_to(root).parts
                if len(rel)<2: continue
                setname=rel[0]
                nm=re.search(r"name:\s*\{(.*?)\n\s*\}",t,re.S)
                block=nm.group(1) if nm else ''
                names={k:v for k,v in re.findall(r"([a-z]{2}):\s*['\"]([^'\"]+)",block)}
                by[artist][f'{series} / {setname}'].append({'number':int(p.stem),'names':names,'path':str(p.relative_to(base))})
    out={'artists':{},'totals':{}}
    for a in ARTISTS:
        sets=[]; total=0
        for s,cards in sorted(by[a].items()):
            cards=sorted(cards,key=lambda x:x['number']); total+=len(cards)
            sets.append({'set':s,'count':len(cards),'cards':cards})
        out['artists'][a]={'count':total,'sets':sets}; out['totals'][a]=total
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(out['totals'],ensure_ascii=False))
    for a in ARTISTS:
        print('\n'+a)
        for s in out['artists'][a]['sets']:
            print(' ',s['set'],s['count'])
if __name__=='__main__': main()
