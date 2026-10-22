#!/usr/bin/env python3
"""Revalidate exactly the Korean-original image bytes for proposed SM artwork scene themes."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib, json, requests
D=Path('data/audits')
dec=json.loads((D/'theme-sm19-scene-decisions-20261022.json').read_text())
raw=json.loads((D/'theme-sm-remaining19-source-evidence-20261022.json').read_text())
outfile=D/'theme-sm19-scene-source-recheck-20261022.json'
assert not outfile.exists()
assert raw['canonicalSlots']==1320
assert len(dec['reviewedVisualSets'])==6
ref={(r['set'].lower(),r['index']):r for r in raw['cards']}
keys=sorted({(a['set'],a['number']) for a in dec['candidateSelections']})
assert len(keys)>100
def check(key):
 row=ref[key]
 status={'set':key[0],'number':key[1],'imageUrl':row['originalImageReference'],
         'sourceSha256':row['actualSha256'],'match':False,'reason':None}
 if row['imageHost']!='cards.image.pokemonkorea.co.kr':
  status['reason']='third-party image source cannot establish Korean printed number'
  return status
 if not row['decoded'] or row['imageSourceError'] or row['duplicateArtworkSource']:
  status['reason']='bad, low-resolution or duplicate Korean source'
  return status
 try:
  r=requests.get(row['originalImageReference'],timeout=(8,24),
                 headers={'User-Agent':'Mozilla/5.0 (Korean Art Review/1.0)'})
  r.raise_for_status()
  actual=hashlib.sha256(r.content).hexdigest()
  status['actualSha256']=actual
  status['match']=(actual==row['actualSha256'])
  if not status['match']:status['reason']='source SHA256 changed since first image review'
 except Exception as exc:
  status['reason']=str(exc)[:240]
 return status
with ThreadPoolExecutor(max_workers=22) as t:
 rows=list(t.map(check,keys))
passed=sum(x['match'] for x in rows)
assert len(rows)==len(keys)
print('SM19_SCENE_SHA_RECHECK',json.dumps({'uniqueCardArtworks':len(keys),
  'matchedOriginalSha256':passed,'held':len(rows)-passed},ensure_ascii=False))
outfile.write_text(json.dumps({'schemaVersion':1,'recordedAt':'2026-10-22',
 'sourceEvidence':str(D/'theme-sm-remaining19-source-evidence-20261022.json'),
 'uniqueProposedCardArtworks':len(keys),'matchedOriginalSha256':passed,
 'rows':rows},ensure_ascii=False,indent=2)+'\n')
