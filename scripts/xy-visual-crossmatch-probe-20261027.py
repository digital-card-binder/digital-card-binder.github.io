#!/usr/bin/env python3
"""Probe whether independently numbered XY English/Korean cards share crop-level art."""
import io,json,urllib.request
from PIL import Image,ImageOps
import imagehash
UA={"User-Agent":"Mozilla/5.0 (compatible; XYArtAudit/1.0)"}
cases=[
("blue Axew 108","https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XY8/XY8_BLUE_045.jpg","https://images.pokemontcg.io/xy8/108.png"),
("red Axew 109","https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XY8/XY8_RED_048.jpg","https://images.pokemontcg.io/xy8/109.png"),
("blue Axew wrong 109","https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XY8/XY8_BLUE_045.jpg","https://images.pokemontcg.io/xy8/109.png"),
]
def load(url):
 req=urllib.request.Request(url,headers=UA)
 with urllib.request.urlopen(req,timeout=30) as r:
  raw=r.read()
 im=Image.open(io.BytesIO(raw)).convert("RGB")
 return im,len(raw)
def variants(im):
 w,h=im.size
 r={}
 for key,a,b,c,d in [
 ("full",0.0,0.0,1,1),
 ("art",.10,.13,.89,.52),
 ("inner",.13,.16,.85,.49),
 ("artwide",.085,.115,.92,.55),
 ("artnarrow",.16,.18,.83,.48)
 ]:
  r[key]=im.crop((round(w*a),round(h*b),round(w*c),round(h*d)))
 return r
def metrics(a,b):
 va,vb=variants(a),variants(b)
 return {k:{"p":int(imagehash.phash(va[k])-imagehash.phash(vb[k])), "d":int(imagehash.dhash(va[k])-imagehash.dhash(vb[k]))} for k in va}
for name,korean,english in cases:
 try:
  ki,ks=load(korean)
  ei,es=load(english)
  print("PROBE",json.dumps({"name":name,"korean_size":ki.size,"en_size":ei.size,"byte_counts":[ks,es],"distance":metrics(ki,ei)},ensure_ascii=False),flush=True)
 except Exception as e:
  print("PROBE_FAILED",json.dumps({"name":name,"error":str(e)},ensure_ascii=False),flush=True)
