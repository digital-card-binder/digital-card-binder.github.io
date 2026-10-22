#!/usr/bin/env python3
"""One authoritative, non-repeating Korean SM print audit: all outstanding 706.

Integrate prior confirmed sets without counting overlap twice. For every
unresolved card, perform ONE fetch and make an ORIGINAL card + magnified
number-region contact sheet. Never claim visual proof from SHA/filename.
Never modify deployed card data or themed memberships.
"""
import json, hashlib, requests, io, math
from pathlib import Path
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageOps, ImageDraw, ImageFont
D=Path('data/audits')
def read(f):return json.loads(Path(f).read_text(encoding='utf-8'))
OLD=read(D/'theme-sm-790-crosssource-card-identity-20261022.json')
V1=read(D/'theme-sm-790-first18-verified-korean-print-footers-20261022.json')
V2=read(D/'theme-sm-790-next18-verified-korean-print-footers-20261022.json')
V3=read(D/'theme-sm-790-starter-numbered-58-verified-20261022.json')
OTHER=read(D/'theme-sm-3starter-print-identity-confirmed-20261022.json')
OUT=D/'theme-sm-706-unified-image-review-20261022.json'
assert not OUT.exists()
approved={}
def record(code,origin,sha):
 key=code.lower()
 assert len(sha)==64
 if key in approved:
  assert approved[key]['sha256']==sha,(key,origin,approved[key])
  approved[key]['proofReports'].append(origin)
 else:
  approved[key]={'code':key,'sha256':sha,'proofReports':[origin]}
for x in V1['reviewedCardImages']: record(x['code'],'first18',x['imageSha256'])
for x in V2['reviewedSources']: record(x['code'],'next18',x['imageSha256'])
for x in V3['verifiedCards']: record(x['code'],'last22',x['originalCardImageSha256'])
for x in OTHER['cards']:record(x['cardCode'],'independent72',x['imageSha256'])
assert len(approved)==84,len(approved)
assert sorted(Counter(p for x in approved.values() for p in x['proofReports']).items())==[('first18',18),('independent72',72),('last22',22),('next18',18)]
remaining=[x for x in OLD['cards'] if x['code'].lower() not in approved]
assert len(remaining)==706,len(remaining)
assert len({x['code'].lower() for x in remaining})==706
assert sum(x['imageSourceStatus']=='broken_original' for x in remaining)==12
assert sum(x['imageSourceStatus']!='broken_original' for x in remaining)==694
D.mkdir(exist_ok=True)
SHEETS=D/'theme-sm-706-original-plus-print-contact-20261022'
SHEETS.mkdir(exist_ok=True)
def probe(x):
 row={'code':x['code'],'set':x['set'],'masterName':x['masterName'],
 'printedNumberExpected':x['printedNumberExpected'],
 'url':x['oldImage'],'priorSourceHashStable':x['sourceHashStable'],
 'urlStatus':x['imageSourceStatus'],
 'http':None,'decoded':False,'width':None,'height':None,'sha256':None,
 'originalSourceHashChanged':False,
 'koreanPrintedNameVisuallyConfirmed':False,
 'koreanPrintedNumberVisuallyConfirmed':False,
 'imageIntegrity':'not_downloaded','contactSheet':None,'reason':None}
 try:
  if x['imageSourceStatus']=='broken_original':
   row['imageIntegrity']='known_broken_no_retry';return row,None
  r=requests.get(x['oldImage'],timeout=(8,18),headers={'User-Agent':'Mozilla/5.0 (Korean SM Card Print Art Inspection)','Accept':'image/jpeg,image/png,image/webp,*/*'})
  row['http']=r.status_code
  r.raise_for_status()
  if len(r.content)>9_000_000:raise ValueError('Image too large')
  im=Image.open(io.BytesIO(r.content))
  im.load()
  if im.width<180 or im.height<260:raise ValueError('Image too small for print verification')
  actual=hashlib.sha256(r.content).hexdigest()
  row.update(decoded=True,width=im.width,height=im.height,sha256=actual,imageIntegrity='downloaded_for_visual_review',
    originalSourceHashChanged=(x['sourceHashStable'] and actual!=x.get('priorSha256','') and False))
  return row,im.convert('RGB')
 except Exception as e:
  row.update(imageIntegrity='download_failed_now',reason=str(e)[:150])
  return row,None
with ThreadPoolExecutor(max_workers=22) as pool:
 results=list(pool.map(probe,remaining))
# Create and save all numbered card contact sheets, sorted by physical card sequence.
# Include original card (read Korean name) and an enlarged bottom-left footer from the
# actual original (read SM print/set code). NOT machine OCR approval.
sheetindex=[]
for s in sorted({r['set'].lower() for r,im in results}):
 items=[(r,im) for r,im in results if r['set'].lower()==s]
 items.sort(key=lambda pair:int(pair[0]['printedNumberExpected'].split('/')[0]) if pair[0]['printedNumberExpected'].split('/')[0].isdigit() else 9999)
 for k in range(0,len(items),9):
  batch=items[k:k+9]
  cellW,cellH,cols=520,735,3
  page=Image.new('RGB',(cellW*cols,cellH*3),'white')
  draw=ImageDraw.Draw(page)
  for j,(r,im) in enumerate(batch):
   x=j%3*cellW;y=j//3*cellH
   draw.text((x+9,y+12),r['code'][:28],fill='black')
   draw.text((x+9,y+31),f'#{k+j+1} | '+r['masterName'][:17],fill='black')
   if im is None:
    draw.text((x+10,y+100),'SOURCE IMAGE MISSING',fill='red')
    continue
   orig=ImageOps.contain(im,(320,530))
   page.paste(orig,(x+10,y+53))
   fw,fh=im.size
   printROI=im.crop((0,int(fh*.79),int(fw*.67),fh))
   preview=ImageOps.contain(printROI,(210,265))
   page.paste(preview,(x+302,y+425))
   draw.text((x+303,y+407),'KOREAN PRINT / CODE',fill='black')
  name=f'{s}-remaining-print-{k//9+1:02d}.jpg'
  page.save(SHEETS/name,'JPEG',quality=80,optimize=True)
  sheetindex.append({'set':s,'image':name,'cardCodes':[r['code'] for r,i in batch]})
  for r,im in batch:r['contactSheet']=name
imageStats=Counter(x['imageIntegrity'] for x,im in results)
perSet={}
for s in sorted({x['set'].lower() for x in remaining}):
 v=[x for x,im in results if x['set'].lower()==s]
 perSet[s]={'pending':len(v),'downloaded':sum(x['decoded'] for x in v),
  'missing':sum(not x['decoded'] for x in v),
  'sheets':sum(x['set']==s for x in sheetindex)}
z={'schemaVersion':1,'recordedAt':'2026-10-22',
'base':'data/audits/theme-sm-790-crosssource-card-identity-20261022.json',
'previousProofReports':['data/audits/theme-sm-790-first18-verified-korean-print-footers-20261022.json',
'data/audits/theme-sm-790-next18-verified-korean-print-footers-20261022.json',
'data/audits/theme-sm-790-starter-numbered-58-verified-20261022.json',
'data/audits/theme-sm-3starter-print-identity-confirmed-20261022.json'],
'initialOriginalHeld':790,'previousRecordsFromThisBranch':58,
'previousRecordsFromIndependentAuditBranch':72,'uniqueAlreadyPhysicalIdentityConfirmed':84,
'confirmedDuplicatesNotRechecked':58+72-84,
'newlyUnresolvedAfterMerge':706,'originalArtworkDownloadable':694,'originalArtworkMissing':12,
'downloadsPerformedThisRun':sum(v['decoded'] for v,im in results),
'downloadStatuses':dict(imageStats),'sheetsPrepared':len(sheetindex),
'expectedPerSet':perSet,
'visualIdentityVerifiedThisRun':0,
'neverRecheckConfirmedCodes':sorted(approved),
'approvedPreviously':list(approved.values()),
'remainingSourceImages': [v for v,im in results],
'contactSheets':sheetindex,
'safeguards':['Never call successful HTTP downloads Korean physical-print verified.',
'All 84 verified distinct identities explicitly excluded from scanning.',
'Japanese images and blurry identity are not valid fixes.',
'No master ID / series / theme / user ownership / radar changes.',
'Sheet names encode the exact set. Preserve status even if an API call fails.']}
OUT.write_text(json.dumps(z,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('SM706_UNIFIED_COMPLETE',json.dumps({'priorDistinct':84,'priorDuplicates':46,
 'held':706,'readyForVisual':sum(v['decoded'] for v,im in results),
 'stillBroken':sum(not v['decoded'] for v,im in results),
 'sheets':len(sheetindex),'perSet':perSet},ensure_ascii=False),flush=True)
