#!/usr/bin/env node
/* Inspect public Korean Dogam set references for the final 11 image holds, read only. */
const home=await (await fetch("https://www.dogam.app/sets",{signal:AbortSignal.timeout(30000)})).text();
for(const code of ["SM1M","SM1S","S6K","S4a","S-P"]) {
 const at=home.indexOf(code);
 console.log("SET_DISCOVERY",JSON.stringify({code,found:at>=0,nearby:at>=0?home.slice(Math.max(0,at-650),at+230):""}));
}
