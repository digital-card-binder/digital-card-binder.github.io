#!/usr/bin/env python3
"""Hard fail if a Korean-image held card was promoted by the XY English image crossmatch."""
import json
def j(path):
 with open(path,encoding='utf8') as f:return json.load(f)
manifest=j('data/audits/theme-xy-scene-review-manifest-20261026.json')
proof=j('data/audits/theme-xy-verified-cameo-image-match-20261027.json')
color={(str(s['set']).lower(),str(c['code']).lower().split('/')[0]):
  (c.get('archiveColorStatus'),c.get('imageHoldReason')) for s in manifest['sets'] for c in s['cards']}
holds=[];unknown=[]
for e in proof['newEntries']:
 k=(e['koreanSet'].lower(),e['koreanCardCode'].lower().split('/')[0])
 st=color.get(k)
 if st is None:unknown.append((k,'not-in-manifest'))
 elif st[0]!='official-source-color-reviewed':holds.append((k,st))
print("XY_SAFETY_GUARD",json.dumps({'newThemeRows':len(proof['newEntries']),'imageHeldRowsAccidentallyRegistered':holds,'unmatchedMasterEvidence':unknown},ensure_ascii=False))
assert not holds and not unknown,"Remove held and uncategorized image mappings before publishing!"
assert proof['full12ScreenedNow']==5 and proof['remaining12ThemeCardReviews']==2308
