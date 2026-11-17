import sys
sys.path.insert(0,"scripts")
import build_card_visual_fingerprints as b
import urllib.request
cards=[c for c in b.collect_cards(b.DEFAULT_INDEX) if c["rawCode"] in("sm2k_057/050","sm60a_001","sm8b_245/150","sm9_110/095","sm12a_212/173")]
for c in cards:
    cands=b.source_url_candidates(c["source"])
    ok=None
    for u in cands:
        try:
            d=b.read_remote_payload(u,browser_headers=True);ok=("script",u,len(d));break
        except Exception as e: pass
    print("P1",c["rawCode"],len(cands),ok)
    for ua in ("Mozilla/5.0",b.BROWSER_USER_AGENT):
        hits=0;last=None
        for u in cands:
            try:
                r=urllib.request.urlopen(urllib.request.Request(b.normalized_request_url(u),headers={"User-Agent":ua,"Referer":"https://tcgbox.co.kr/","Accept":"image/avif,image/webp,image/apng,image/*,*/*;q=0.8"}),timeout=30);hits+=1;last=u;break
            except Exception as e: last=str(e)
        print("P2",c["rawCode"],ua[:20],hits,last)
