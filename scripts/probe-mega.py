import re,sys
from urllib.request import Request,urlopen
UA={"User-Agent":"Mozilla/5.0","Accept":"*/*"}
def get(u,ref=None,n=400000):
    h=dict(UA)
    if ref:h["Referer"]=ref
    try:
        with urlopen(Request(u,headers=h),timeout=25) as r:
            return r.status,r.headers.get("content-type"),r.read(n)
    except Exception as e:
        return str(e),None,b""
for u in ["https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/MEZ/MEZ_001.png","https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/MEZ/MEZ_001.jpg","https://pokemoncard.co.kr/s3.php?key=home%2Fdata%2Fcards.image_www%2Fdata%2Fwmimages%2FMEGA%2FMEZ%2FMEZ_001.png&w=512","https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M1L/M1L_001.png"]:
    s,c,b=get(u,"https://pokemoncard.co.kr/");print("PROBE",u[-60:],s,c,len(b))
for page in ["https://collec-hub.store/cards/ko/mez/001","https://collec-hub.store/cards/ko/mee/001","https://collec-hub.store/cards/ko/mem/001"]:
    s,c,b=get(page);t=b.decode("utf8","ignore");print("PAGE",page,s,len(t))
    for m in sorted(set(re.findall(r'https?://[^"\'\s)]+\.(?:webp|png|jpg)',t)))[:15]:print("  IMG",m)
    for m in sorted(set(re.findall(r'/media/pokecards/[^"\'\s)]+',t)))[:15]:print("  REL",m)
