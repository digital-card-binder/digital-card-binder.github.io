#!/usr/bin/env python3
"""Evaluate all 122 outstanding SM Korean variants exactly once, no invented approvals."""
import json, hashlib, requests, re
from pathlib import Path
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit
D=Path('data/audits')
read=lambda p:json.loads(Path(p).read_text())
src=read(D/'theme-sm-all-790-unified-per-card-current-status-20261022.json')
pending=[x for x in src['cardResults'] if x['status']!='korean_name_and_actual_printed_number_verified']
assert len(pending)==122
def group(x):
 c=x['code'].lower()
 if x['status']=='japanese_language_substitute_wrong_for_kr':return 'wrong_region_image'
 if x['status']=='missing_korean_image':return 'image_missing'
 if '기본' in x['masterName'] and '에너지' in x['masterName']:return 'basic_energy_requires_unnumbered_variant_identity'
 if '훈장' in x['masterName']:return 'prize_medal_provenance_must_be_verified'
 return 'promo_distribution_and_event_version_must_be_verified'
p=[{'code':x['code'],'set':x['set'],'masterName':x['masterName'],'existingImage':x['imageUrl'],'sourceSHA256':x.get('sha256'),
 'priorStatus':x['status'],'reviewCategory':group(x),'koreanPhysicalImageReviewed':x['status']=='korean_unnumbered_or_catalog_ordinal_requires_variant_proof',
 'actualPrintedNumberVerified':False,'variantProvenanceVerified':False,'status':'hold_for_variant_provenance' if 'variant' in group(x) or 'provenance' in group(x) or 'version' in group(x) else 'hold_for_korean_image'} for x in pending]
assert sum(x['reviewCategory']=='wrong_region_image' for x in p)==2
assert sum(x['reviewCategory']=='image_missing' for x in p)==12
assert sum(x['koreanPhysicalImageReviewed'] for x in p)==108
def validate_page(x):
 s=x['code'].split('_')[0]
 ss={'sm11b':'sm11b','sm12':'sm12','sm12a':'SM12a','sm2k':'sm2k'}.get(s,'')
 n=int(re.search(r'_(\d+)',x['code']).group(1))
 return {'code':x['code'],'set':s,'ordinal':n,'region':'KR','googleIndexQuery':x['masterName']+' '+str(n).zfill(3)+' 포켓몬 카드 한국판',
 'shopProductSearch':'https://tcgbox.co.kr/product/search.html?keyword='+ss+'%20'+str(n).zfill(3),
 'originalFailedSource':x['existingImage'],'replacementURL':None,'replacementVerified':False,
 'verifiedKoreanNameAndNumber':False,'cannotTreatShopListingAsProof':True}
fourteen=[validate_page(x) for x in p if x['reviewCategory'] in ('wrong_region_image','image_missing')]
r={'schemaVersion':2,'date':'2026-10-22','original790':790,'alreadyFullyVerified':668,'auditedRemainder':122,
 'breakdown':dict(Counter(x['reviewCategory'] for x in p)),
 'verifiedNewKoreanPrintNumbers':0,
 'unresolvedFullIdentityAfterPass':122,
 'cautions':['108 Korean-energy/promo photos cannot be matched on printed serials without individually checking set/distribution provenance and variants. Do not silently certify them.',
 'Wrong-region images must never be approved until Korean pictures match visible Korean print.',
 'Never upgrade an HTTP 200, watermark, filename or hashed image to a Korean physical printed identity.',
 'Do not change national master, theme group ownership, Firestore or radar unless a reviewed match is certain.'],
 'imageRepairQueue':fourteen,'records':p}
f=D/'theme-sm122-variant-and-region-triage-20261022.json'
f.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print('SM122_REVIEW',json.dumps({'total':122,'breakdown':r['breakdown'],'resolved':0},ensure_ascii=False))
