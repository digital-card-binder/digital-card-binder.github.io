#!/usr/bin/env python3
"""Create isolated preview crops from the Korean official Pokemon TCG Classic marketing graphics.
Proposals only: no public card artwork replacement until the human checks these crops.
Each crop retains the original pixels and the full source URL for provenance.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlsplit
from PIL import Image,ImageDraw
from io import BytesIO
import json,base64,hashlib
root=Path(__file__).resolve().parents[1]
output=root/"data/audits/theme-classic-korean-official-card-crop-proposals-20261013"
output.mkdir(parents=True,exist_ok=True)
official=json.loads((root/"data/audits/theme-classic-official-product-20261013/index.json").read_text())
region=json.loads((root/"data/audits/theme-classic-three-102-card-regional-print-checkpoint-20261013.json").read_text())
# manually mapped rectangles on the official original 860px-wide product infographics.
# Covers intact illustrated card borders, slightly overscanned to avoid clipping.
regions={
 "CLL":{"021":(332,1497,531,1765),"026":(550,1497,748,1765),"030":(332,1784,532,2061),
        "033":(547,1784,748,2061)},
 "CLK":{"014":(115,1497,313,1765),"025":(331,1497,530,1765),"031":(550,1497,749,1765),
        "015":(115,1784,313,2062),"021":(332,1784,532,2062),"033":(549,1784,751,2062)},
 "CLF":{"001":(117,647,231,812),"002":(262,647,379,812),"003":(115,270,379,631),
        "017":(480,972,747,1305),
        "015":(115,1497,310,1765),"026":(332,1497,530,1765),"025":(550,1497,751,1765),
        "010":(115,1784,313,2062),"028":(332,1784,533,2062),"033":(550,1784,750,2062)}}
expectedNames={
 "CLL":{"021":"컴퓨터 통신","026":"작열하는 목탄","030":"이수재","033":"기본 불꽃 에너지"},
 "CLK":{"014":"뮤츠","025":"대해의 물방울","031":"로켓단의 간부","015":"마티스의 꼬렛","021":"배틀서처","033":"기본 물 에너지"},
 "CLF":{"001":"이상해씨","002":"이상해풀","003":"이상해꽃","017":"루기아 ex",
        "015":"럭키","026":"오박사","025":"태양의 씨","010":"롱스톤","028":"포켓몬 간호사","033":"기본 풀 에너지"}}
results=[]
for code in ["CLL","CLK","CLF"]:
 index=json.loads((root/f"data/audits/theme-nine-sets-owned-image-20261013/{code}/visual-index.json").read_text())
 u=official["records"][code]["sourceUrl"]
 assert urlsplit(u).hostname=="data1.pokemonkorea.co.kr"
 with urlopen(Request(u,headers={"User-Agent":"DigitalCardBinder-Korean-Official-Card-Design-Evidence/1.0"}),timeout=25) as r:raw=r.read(6_500_000)
 img=Image.open(BytesIO(raw));img.load()
 assert img.width==860 and img.height>=2300,(code,img.size)
 assert hashlib.sha256(raw).hexdigest()==official["records"][code]["sha256"], "Unexpected official marketing source content"
 subdir=output/code;subdir.mkdir(exist_ok=True)
 for no,bounds in regions[code].items():
  id=code+"_"+no
  row=next((c for c in index["cards"] if str(c["masterCode"]).upper().startswith(id+"/")),None)
  assert row and row["koreanMasterName"]==expectedNames[code][no],(id,row)
  proof=next(c for c in region["sets"][code]["cards"] if c["cardKey"]==id)
  assert proof["visualPrintLanguageStatus"] in ("Japanese_language_image_wrong_for_Korean_master",
   "language_neutral_energy_physical_Korean_print_evidence_pending"), id
  crop=img.crop(bounds)
  # Detect over-large erroneous crop coordinates before saving.
  assert 105<=crop.width<=300 and 150<=crop.height<=400,(id,crop.size)
  mem=BytesIO();crop.save(mem,format="WEBP",quality=92,method=6)
  file=id+".webp.b64"
  (subdir/file).write_text(base64.b64encode(mem.getvalue()).decode("ascii"),encoding="ascii")
  results.append({"cardKey":id,"canonicalOrder":row["canonicalOrder"],
    "koreanMasterName":row["koreanMasterName"],"officialPage":"https://pokemoncard.co.kr/card/590",
    "officialProductGraphicUrl":u,"originalGraphicSHA256":hashlib.sha256(raw).hexdigest(),
    "cropBoxSourcePixels":list(bounds),"cropPixelSize":list(crop.size),
    "cropProof":f"data/audits/theme-classic-korean-official-card-crop-proposals-20261013/{code}/{file}",
    "KoreanMarketingArtworkPrintedIdentityStatus":"visually_pending_manual_approval",
    "priorArchivedLanguageStatus":proof["visualPrintLanguageStatus"],
    "notInProduction":True,"qualityCaution":"Small marketing image, not standalone individual original-card scan"})
results.sort(key=lambda x:x["cardKey"])
(output/"index.json").write_text(json.dumps({"schemaVersion":1,"recordedAt":"2026-10-13",
 "title":"Official Korean Pokemon TCG Classic product image crop candidates for pending wrong-language source scans",
 "policy":"Staged proposals only; this does not replace 80 existing live Japanese-language source images or clear 6 energy edition holds. Original marketing art is only 860px wide, so low-resolution crops require approval.",
 "officialProductPage":"https://pokemoncard.co.kr/card/590","count":len(results),
 "items":results},ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps({"candidateCount":len(results),"sets":{code:sum(x["cardKey"].startswith(code) for x in results) for code in regions}},ensure_ascii=False))
