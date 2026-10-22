#!/usr/bin/env python3
"""Build conservative, evidence-grounded hold decisions for all 19 SM source-audited sets."""
import json
from pathlib import Path
D=Path("data/audits")
P=D/"theme-sm-remaining19-master-preflight-20261022.json"
SRC=D/"theme-sm-remaining19-source-evidence-20261022.json"
OUT=D/"theme-sm-remaining19-visual-decisions-20261022.json"
assert not OUT.exists()
pre=json.loads(P.read_text())
src=json.loads(SRC.read_text())
assert pre["totalSets"]==19 and src["canonicalSlots"]==1320
codes={x["set"].lower() for x in pre["summaries"]}
assert len(codes)==19
held=[]
per={}
for summary in pre["summaries"]:
    key=summary["set"].lower()
    rows=[r for r in src["cards"] if r["set"].lower()==key]
    assert len(rows)==summary["masterCardCount"]
    eligible=0; excluded=0
    for r in rows:
        reasons=[]
        if r["imageHost"]!="cards.image.pokemonkorea.co.kr":
            reasons.append("third-party/missing original source: exact Korean printed number not yet verified")
        if not r["decoded"]:reasons.append("image fetch/decode failed")
        if r["imageSourceError"]:reasons.append(r["imageSourceError"])
        if r["duplicateArtworkSource"] or r["sourceDuplicatedWithinSet"]:
            reasons.append("repeated image hash or URL: print variant identity needs review")
        if not r["observedArtColor"]:reasons.append("source artwork palette unavailable or unverified")
        if reasons:
            excluded+=1
            held.append({"set":r["set"],"index":r["index"],"canonicalCode":r["canonicalCode"],
                "imageHost":r["imageHost"],"reason":"; ".join(dict.fromkeys(reasons))})
        else:eligible+=1
    per[summary["set"]]={"masterCards":len(rows),"officialColorEligible":eligible,
      "otherSourcesOrHolds":excluded,"priorThemePlacements":summary["previousThemeCount"]}
assert len(held)+sum(v["officialColorEligible"] for v in per.values())==1320
out={"schemaVersion":1,"recordedAt":"2026-10-22",
 "sourceEvidenceFile":str(SRC),"sourceRunId":39713248175,
 "totalSeriesSourceChecked":19,"totalCanonicalCards":1320,
 "contactSheetsPrepared":len(src["contactSheets"]),
 "allSheetsManuallyInspected":False,
 "strictPrintedKoreanFooterVerificationComplete":False,
 "reviewType":"Conservative source-and-hash screen with machine artwork-color evidence; NOT subjective visual-theme certification",
 "colorEligibleSlots":1320-len(held),
 "heldCount":len(held),"sets":per,"held":held,
 "next":"Inspect held third-party Korean cards at full printed-number resolution, then classify 11 non-color themes manually from contact sheets."}
OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
print("ALL19_COLOR_EVIDENCE_GATES",json.dumps({"sets":19,"cards":1320,
 "eligible":out["colorEligibleSlots"],"held":len(held),
 "pages":out["contactSheetsPrepared"],"perSet":per},ensure_ascii=False),flush=True)
