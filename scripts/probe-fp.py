import sys,json
sys.path.insert(0,"scripts")
import build_card_visual_fingerprints as b
import urllib.request
cards=[c for c in b.collect_cards(b.DEFAULT_INDEX) if c["rawCode"] in("sm2k_057/050","sm60a_001","sm8b_245/150","sm9_110/095","sm2k_001/050","clf_003/032")]
for c in cards:
    u=b.public_url(c["project"],c["path"])
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"}),timeout=30)
        d=r.read(300);print("PR",c["rawCode"],u[-60:],r.status,r.headers.get("content-type"),d[:40])
    except Exception as e:print("PR",c["rawCode"],u[-60:],e)
    try:
        r=urllib.request.urlopen(urllib.request.Request(c["source"].replace(" ","%20"),headers={"User-Agent":"Mozilla/5.0","Referer":"https://tcgbox.co.kr/"}),timeout=30);print("PS",c["rawCode"],r.status)
    except Exception as e:print("PS",c["rawCode"],e)
