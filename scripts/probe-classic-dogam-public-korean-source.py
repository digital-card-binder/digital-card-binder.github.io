#!/usr/bin/env python3
"""Bounded public-source discovery for Korean Classic images; no image copying.
This is not a crawler. Check robots and fetch at most /sets plus ONE CLL set page.
"""
from urllib.request import urlopen,Request
from urllib.parse import urljoin,urlsplit
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup
from pathlib import Path
from time import sleep
import json,re,html
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/"data/audits/theme-classic-dogam-public-source-check-20261013.json"
BASE="https://www.dogam.app"
UA="DigitalCardBinder-PublicKoreanClassicSourceResearch/1.0"
record={"schemaVersion":1,"recordedAt":"2026-10-13",
"purpose":"Limited inspection of public Korean Classic catalog and print-language source candidates only",
"fetchedPages":[],"imageBinariesDownloaded":0,"cardDataMutations":0,
"imageCopiesCreated":0,"source":"https://www.dogam.app/sets",
"archiveDecision":"not_decided_until_Korean_print_and_reuse_basis_checked"}
try:
 def fetch(url):
  assert urlsplit(url).hostname=="www.dogam.app"
  with urlopen(Request(url,headers={"User-Agent":UA,"Accept-Language":"ko-KR,ko;q=0.8"}),timeout=17) as resp:
   return resp.status,resp.read(600000).decode("utf8","replace"),resp.headers.get_content_type()
 robots_url=BASE+"/robots.txt"
 status,body,typ=fetch(robots_url)
 rp=RobotFileParser();rp.parse(body.splitlines())
 record["robots"]={"status":status,"bodyBeginning":body[:1700],
  "setsPermitted":rp.can_fetch(UA,BASE+"/sets"),
  "setCardsPermitted":rp.can_fetch(UA,BASE+"/sets/example")}
 record["fetchedPages"].append({"url":robots_url,"http":status,"size":len(body)})
 if not record["robots"]["setsPermitted"]: raise RuntimeError("robots.txt forbids /sets; no further access")
 status,body,typ=fetch(BASE+"/sets")
 record["fetchedPages"].append({"url":BASE+"/sets","http":status,"size":len(body)})
 soup=BeautifulSoup(body,"html.parser")
 matches=[]
 for a in soup.select("a[href]"):
  label=a.get_text(" ",strip=True)
  href=urljoin(BASE,a["href"])
  if "클래식" in label and any(k in label for k in ("CLL","CLK","CLF")):
   matches.append({"label":label[:180],"url":href})
 record["sets"]=matches
 if len(matches)!=3: raise RuntimeError("Expected exactly three Korean Classic public set links; found "+str(len(matches)))
 chosen=next(x for x in matches if "CLL" in x["label"])
 if urlsplit(chosen["url"]).hostname!="www.dogam.app" or not rp.can_fetch(UA,chosen["url"]):
  raise RuntimeError("CLL set URL disallowed or outside expected domain")
 sleep(.8)
 status,body,typ=fetch(chosen["url"])
 record["fetchedPages"].append({"url":chosen["url"],"http":status,"size":len(body)})
 page=BeautifulSoup(body,"html.parser")
 imgs=[]
 for im in page.select("img[src],img[data-src]"):
  url=urljoin(chosen["url"],im.get("src") or im.get("data-src"))
  alt=im.get("alt","")
  if urlsplit(url).scheme not in ("https","http"):continue
  imgs.append({"alt":alt[:90],"url":url,"host":urlsplit(url).hostname})
 cardLinks=[]
 for a in page.select("a[href]"):
  href=urljoin(chosen["url"],a["href"])
  if ("/cards/" in href or "/card/" in href) and urlsplit(href).hostname=="www.dogam.app":
   cardLinks.append({"name":a.get_text(" ",strip=True)[:90],"url":href})
 record["sampleCLL"]={"title":page.title.get_text(strip=True) if page.title else "",
  "visibleImageTags":len(imgs),"images":imgs[:16],
  "cardLinkCount":len(cardLinks),"firstLinks":cardLinks[:15],
  "hints":{"usesNextJs":"__NEXT_DATA__" in body,"jsonldCount":len(page.select('script[type="application/ld+json"]'))}}
 record["status"]="limited_metadata_discovery_only"
except Exception as ex:
 record["status"]="blocked_or_unavailable"
 record["error"]=str(ex)[:350]
out.write_text(json.dumps(record,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps({k:v for k,v in record.items() if k not in ("sampleCLL",)},ensure_ascii=False))
