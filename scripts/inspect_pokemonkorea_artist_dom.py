#!/usr/bin/env python3
import os,re,subprocess,tempfile
from collections import Counter,defaultdict

EXISTING={
"Narumi Sato","OKACHEKE","Shinji Kanda","Asako Ito","Gapao","Yukihiro Tada","Tetsu Kayama","Jerky","Pani kobayashi","Ounishi","Sachiko Adachi","Yuka Morii","Tomokazu Komiya","AKIRA EGAWA","OOYAMA","HYOGONOSUKE","miki kudo","Miki Tanaka","sui","Atsuko Nishida","Aya Kusube","Shibuzoh","Saya Tsuruta","ryoma uratsuka","Tika Matsuno","sowsow","Yukiko Baba","Sekio","Naoyo Kimura"}
with tempfile.TemporaryDirectory() as td:
    repo=os.path.join(td,'db')
    subprocess.run(['git','clone','--depth=1','-q','https://github.com/tcgdex/cards-database.git',repo],check=True)
    base=os.path.join(repo,'data-asia')
    hits=defaultdict(list)
    rx=re.compile(r'illustrator:\s*["\']([^"\']+)["\']')
    for root,_,files in os.walk(base):
        relroot=os.path.relpath(root,base)
        era=relroot.split(os.sep)[0]
        if era not in {'SM','S','SV','M'}: continue
        for fn in files:
            if not fn.endswith('.ts'): continue
            path=os.path.join(root,fn)
            text=open(path,encoding='utf-8',errors='ignore').read()
            m=rx.search(text)
            if not m: continue
            artist=m.group(1).strip()
            if artist in EXISTING: continue
            hits[artist].append(os.path.relpath(path,base))
    ranked=sorted(hits.items(),key=lambda kv:(-len(kv[1]),kv[0].lower()))
    for artist,paths in ranked[:100]:
        eras=Counter(p.split(os.sep)[0] for p in paths)
        print(f'{len(paths):4d} | {artist:30s} | '+','.join(f'{k}:{v}' for k,v in sorted(eras.items())))
