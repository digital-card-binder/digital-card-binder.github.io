#!/usr/bin/env python3
"""Verify live public S-P 022 Korean art and preserve physical-release hold."""
import hashlib,json,pathlib,time,urllib.request,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
REPORT_PATH=ROOT/"data/audits/sp022-official-Korean-preview-recovery-20261018.json"
QUEUE_PATH=ROOT/"data/audits/korean-recovery-active-queue-20261018.json"
DETAIL=ROOT/"data/audits/theme-sp-001-060-Korean-art-review-20261013.json"
PROGRESS=ROOT/"data/audits/theme-sp-series-progress-20261013.json"
PROOF=ROOT/"data/audits/sp022-live-Korean-image-proof-20261018.json"
report=json.loads(REPORT_PATH.read_text(encoding="utf-8"))
queue=json.loads(QUEUE_PATH.read_text(encoding="utf-8"))
local=(ROOT/report["selfhostedPath"]).read_bytes()
assert local[:4]==b"RIFF" and local[8:12]==b"WEBP"
assert hashlib.sha256(local).hexdigest()==report["selfhostedSha256"]
expected=report["selfhostedUrl"]
last=None
for attempt in range(8):
 try:
  req=urllib.request.Request(expected,headers={"User-Agent":"Mozilla/5.0 (PokémonCardImageWebVerifier)","Cache-Control":"no-cache"})
  response=urllib.request.urlopen(req,timeout=22)
  remote=response.read(3_500_000)
  if len(remote)<35000 or hashlib.sha256(remote).hexdigest()!=report["selfhostedSha256"]:
   raise RuntimeError("Live image mismatch/short binary")
  break
 except Exception as e:
  last=e;print("SP022_LIVE_WAIT",attempt,str(e)[:140],flush=True)
  time.sleep(6+attempt*3)
else:raise RuntimeError("Live owned WebP unverified: "+str(last))
if queue["counts"]["initial"]!=191 or queue["counts"]["totalClosed"]!=167 or queue["counts"]["stillUnresolved"]!=24:raise RuntimeError("191 queue unexpectedly changed")
item=next((r for r in queue["unresolved"] if r["workId"]==161),None)
if not item or item["slot"]!="S-P_022":raise RuntimeError("S-P queue item absent")
if item.get("imageComplete") is True and item.get("officialKoreanPreviewImageVerified") is True:
 print("Already verified, no repeat");raise SystemExit(0)
if item["issue"]!="Japanese image replacement needed":raise RuntimeError("Unrecognized S-P issue")
item["imageComplete"]=True
item["officialKoreanPreviewImageVerified"]=True
item["officialKoreanPreviewUrl"]=report["officialKoreanArtUrl"]
item["koreanImageOwnedUrl"]=expected
item["liveSelfHostedSha256"]=report["selfhostedSha256"]
item["actualPhysicalKoreanPrintDistributed"]=None
item["issue"]="official_Korean_preview_image_verified_physical_distribution_status_pending"
item["status"]="image_restored_from_first_party_2020_event_art_distribution_unconfirmed"
item["action"]="Site now displays genuine 022/S-P Korean event-preview full card art; original event was postponed. Confirm actual printed-distribution record before treating as released/closing 191 scope. Preserve canonical 022 and owner's status."
count=queue["counts"]
count["byIssue"]=dict(collections.Counter(r["issue"] for r in queue["unresolved"]))
queue["status"]="24_unresolved_23_image_verified_identity_or_distribution_holds_1_Korean_photo_still_missing"
queue["imageCompletionSnapshot"]["stillMissingOrConflictedCardImages"]=1
queue["imageCompletionSnapshot"]["firstPartySPO22KoreanImageRestoredNotDistributionProven"]=True
queue["imageCompletionSnapshot"]["SPO22VerifiedOwnUrl"]=expected
queue["nextPriority"]=[
 "S6K 094: Korean physical Echoing Horn 094 image still absent (retail image URLs 404), preserve 093 Korean Fog Crystal and correct owner card number.",
 "S-P 022: official preview Korean art selfhosted/verified, but 2020 official event postponed; check physical distribution and exclude if truly unissued, never claim release from event mockup.",
 "SN 025/026: identical unnumbered Lightning Energy with potential virtual duplicate; decide collection canonical count/migration only after confirmed unique print mapping.",
 "Classic six unnumbered Energies: validate virtual catalog-only numbering; do not assume physically printed 033/034.",
 "MEGA 14: first-party Korean promo physical print identities pending; all fourteen images verified and already selfhosted."
]
# Correct documented image source while preserving thematic review hold.
detail=json.loads(DETAIL.read_text(encoding="utf-8"))
slot=next(x for x in detail["items"] if x["cardKey"]=="S-P_022")
slot["artworkObservation"]="포켓몬코리아 2019-20 코리안리그 시즌 2 경품 페이지의 한글 나옹 VMAX 카드 전체 이미지, 하단 022/S-P 확인; 대회 연기로 실물 배포 근거 별도 대기."
slot["sourceOwnedCDN"]=expected
slot["status"]="first_party_Korean_image_fixed_physical_release_unverified_theme_hold"
slot["officialKoreanPreviewImageVerified"]=True
slot["confirmedKoreanPrintedImage"]=False  # Physical card distribution is not evidenced by official preview.
detail["note"]="S-P 022 old Japanese photo replaced with 2020 official Korean card preview, but distribution and independent 12-theme review still on hold."
progress=json.loads(PROGRESS.read_text(encoding="utf-8"))
for r in progress.get("remaining",[]):
 if r.get("key")=="S-P_022":r["reason"]="Korean official image self-hosted; 2020 league event postponed, physical printed-distribution proof still pending"
progress["note"]="S-P 022 Korean official promo artwork recovered and displayed; physical distribution and 12-theme review NOT complete. S-P 115 separately tracked."
proof={"schemaVersion":1,"date":"2026-10-18","card":"S-P_022","ownUrl":expected,"sha256":report["selfhostedSha256"],"liveSha256":hashlib.sha256(remote).hexdigest(),"bytes":len(remote),"passed":True,
 "firstPartyEvent":report["officialEventPage"],"physicalDistributionConfirmed":False,
 "191CompletedUnchanged":167,"191RemainingUnchanged":24,"remainingImageMissingCount":1,
 "userOwnedStatesModified":False,"canonicalIdModified":False,"themeCompleteClaimed":False}
for path,value in ((QUEUE_PATH,queue),(DETAIL,detail),(PROGRESS,progress),(PROOF,proof)):
 path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("SP022_LIVE_VERIFIED",json.dumps(proof,ensure_ascii=False))
