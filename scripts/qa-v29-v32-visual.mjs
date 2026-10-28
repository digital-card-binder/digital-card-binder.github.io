import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

// 29차 visual audit runs against the checked-out branch served over localhost,
// never against the currently deployed main branch.
const base = process.env.QA_BASE_URL || "http://127.0.0.1:8765";
const output = process.env.QA_OUTPUT || ".artifacts/ui-v29-32";
await mkdir(output, { recursive: true });
const routes = [
  ["home","/index.html"],["search","/pokemon-search.html"],
  ["custom","/custom.html"],["series","/series.html"],
  ["theme","/theme.html"],["packs","/packs.html"],
  ["national","/national.html"],["ar","/ar.html"],
  ["pokemon","/pokemon-collections.html"],["artists","/artists.html"],
  ["people","/people.html"],["fossil","/fossil.html"],
  ["trainer","/trainer-pokemon.html"],["world","/world.html"]
];
const viewports = [
  {name:"desktop",width:1365,height:900,isMobile:false},
  {name:"mobile",width:390,height:844,isMobile:true},
  {name:"small",width:320,height:720,isMobile:true}
];
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
const results = [];
try {
  for (const v of viewports) {
    const context = await browser.newContext({
      viewport:{width:v.width,height:v.height},isMobile:v.isMobile,
      hasTouch:v.isMobile,reducedMotion:"reduce",deviceScaleFactor:1
    });
    try {
      for (const [name,path] of routes) {
        if (v.name === "small" && !["home","search","custom","series"].includes(name)) continue;
        const page = await context.newPage();
        const jsErrors=[];
        page.on("pageerror",err=>jsErrors.push(String(err).slice(0,170)));
        try {
          const response=await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:30000});
          await page.waitForTimeout(650);
          const audit=await page.evaluate(()=>{
            const w=window.innerWidth;
            const root=document.documentElement;
            const body=document.body;
            const main=document.querySelector(".main-content");
            const mainRect=main?.getBoundingClientRect();
            const actionable=[...document.querySelectorAll("button,a,select,input")].filter(el=>{
              const st=getComputedStyle(el);
              const r=el.getBoundingClientRect();
              return st.display!=="none"&&st.visibility!=="hidden"&&r.width>0&&r.height>0&&r.top>=0&&r.top<innerHeight;
            });
            return {
              width:w,scrollWidth:root.scrollWidth,bodyWidth:body.scrollWidth,
              horizontalOverflow:Math.max(0,root.scrollWidth-w),
              mainFits:!!main&&mainRect.width<=w+4,
              tooSmallButtons:actionable.filter(el=>el.tagName==="BUTTON"&&el.getBoundingClientRect().height<28).length,
              visibleButtons:actionable.filter(el=>el.tagName==="BUTTON").length,
              heading:document.querySelector("main h1")?.textContent?.trim()?.slice(0,60)||"",
              imageCount:document.querySelectorAll(".pokemon-card img,.home-feature-card img").length
            };
          });
          const result={viewport:v.name,page:name,status:response?.status()??0,...audit,jsErrors};
          results.push(result);
          if(["home","search","custom","series","theme"].includes(name)&&v.name!=="small") {
            await page.screenshot({path:output+"/"+name+"-"+v.name+".png",fullPage:false,animations:"disabled",timeout:12000});
          }
          console.log(JSON.stringify(result));
        } catch(error) {
          results.push({viewport:v.name,page:name,error:String(error).slice(0,400),jsErrors});
        } finally {await page.close();}
      }
    } finally {await context.close();}
  }
} finally {await browser.close();}
await writeFile(output+"/results.json",JSON.stringify({base,createdAt:new Date().toISOString(),results},null,2)+"\n");
const failures=results.filter(r=>r.error||r.status!==200||r.horizontalOverflow>12||!r.mainFits);
console.log("Visual layout audit:",results.length,"pages,",failures.length,"failures");
for(const f of failures)console.error("QA FAILURE",JSON.stringify(f));
if(failures.length)process.exitCode=1;
