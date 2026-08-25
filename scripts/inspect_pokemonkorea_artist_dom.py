#!/usr/bin/env python3
import os, re, subprocess, tempfile
from collections import Counter, defaultdict

ARTISTS=["Mitsuhiro Arita","Kagemaru Himeno","Kouki Saitou","Naoki Saito","kawayoo"]
with tempfile.TemporaryDirectory() as td:
    repo=os.path.join(td,"cards-database")
    subprocess.run(["git","clone","--depth=1","-q","https://github.com/tcgdex/cards-database.git",repo],check=True)
    base=os.path.join(repo,"data-asia")
    hits=defaultdict(list)
    for root,_,files in os.walk(base):
        for fn in files:
            if not fn.endswith('.ts'): continue
            path=os.path.join(root,fn)
            try: text=open(path,encoding='utf-8').read()
            except: continue
            for artist in ARTISTS:
                if re.search(r'illustrator:\s*["\']'+re.escape(artist)+r'["\']',text):
                    rel=os.path.relpath(path,base)
                    hits[artist].append(rel)
    for artist in ARTISTS:
        paths=hits[artist]
        eras=Counter(p.split(os.sep)[0] for p in paths)
        print("ARTIST",artist,"COUNT",len(paths),"ERAS",dict(sorted(eras.items())))
        print("SAMPLE",paths[:12])
