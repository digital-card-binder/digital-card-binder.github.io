import {readdir,readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";

const CORE = new Set([
  "verify.yml",
  "watch-official-card-updates.yml",
  "sync-site-versions.yml",
  "deploy-card-images.yml",
  "deploy-firestore-rules.yml",
  "radar-live-smoke.yml",
  "build-android-apk.yml"
]);
const EVENTS=["push","pull_request","schedule","workflow_dispatch","workflow_call","repository_dispatch","issues","issue_comment"];
function rootEventBlock(source) {
  const lines=String(source).split(/\r?\n/);
  const at=lines.findIndex(line=>/^(?:"on"|'on'|on):\s*(?:#.*)?$/.test(line));
  if(at<0){
    const inline=lines.find(line=>/^(?:"on"|'on'|on):\s*\[/.test(line))||"";
    return {content:inline,inline:true};
  }
  let end=at+1;
  for(;end<lines.length;end++){
    const s=lines[end];
    if(s.trim()&&!/^\s/.test(s)&&!/^#/.test(s))break;
  }
  return {content:lines.slice(at+1,end).join("\n"),inline:false};
}
function hasEvent(block,event) {
  if(block.inline)return new RegExp("\\b"+event+"\\b").test(block.content);
  return new RegExp("^  "+event+":(?:\\s|$)","m").test(block.content);
}
function eventBody(block,event) {
  const lines=block.content.split("\n");
  const at=lines.findIndex(line=>new RegExp("^  "+event+":(?:\\s|$)").test(line));
  if(at<0)return "";
  let end=at+1;
  for(;end<lines.length;end++)if(/^  [\w-]+:/.test(lines[end]))break;
  return lines.slice(at,end).join("\n");
}
export function classifyWorkflow(file,source) {
  const block=rootEventBlock(source);
  const events=EVENTS.filter(e=>hasEvent(block,e));
  const push=eventBody(block,"push");
  const hasPush=events.includes("push");
  const hasSchedule=events.includes("schedule");
  const hasMain=hasPush&&(
    !/^[ \t]{4}branches(?:-ignore)?:/m.test(push)||
    /\bmain\b/m.test(push)
  );
  const pathScoped=hasPush&&/^[ \t]{4}paths(?:-ignore)?:/m.test(push);
  const writeAccess=/(?:^|\n)\s{2,}contents:\s*write\s*$/m.test(source);
  const core=CORE.has(path.basename(file));
  const manualOnly=events.length===1&&events[0]==="workflow_dispatch";
  const historicalBranchOnly=hasPush&&!hasMain&&!hasSchedule&&/20\d{6}|v\d+|stage|audit|stabiliz|design|ux/i.test(file);
  const mainWrite=hasMain&&writeAccess;
  const group=core?"protect-operational":
    hasSchedule?"scheduled-review":
    mainWrite?"main-write-review":
    hasMain?"main-trigger-review":
    manualOnly?"manual-only-review":
    historicalBranchOnly?"historical-branch-review":"other-review";
  return {file,events,group,writeAccess,hasMain,pathScoped,manualOnly,historicalBranchOnly};
}
export async function inspectWorkflows(directory) {
  const entries=(await readdir(directory)).filter(x=>/\.ya?ml$/.test(x)).sort();
  const workflows=[];
  for(const file of entries){
    const source=await readFile(path.join(directory,file),"utf8");
    workflows.push(classifyWorkflow(file,source));
  }
  const counts={};
  for(const w of workflows)counts[w.group]=(counts[w.group]||0)+1;
  const aggregate={
    total:workflows.length,
    classifications:counts,
    scheduled:workflows.filter(w=>w.events.includes("schedule")).length,
    mainTriggered:workflows.filter(w=>w.hasMain).length,
    mainWriteAccess:workflows.filter(w=>w.hasMain&&w.writeAccess).length,
    manualOnly:workflows.filter(w=>w.manualOnly).length,
    historicalBranchOnly:workflows.filter(w=>w.historicalBranchOnly).length,
    notAutomaticallyDeactivated:workflows.length,
    protectedCore:[...CORE].filter(file=>entries.includes(file))
  };
  return {aggregate,workflows};
}
function markdown(report) {
  const {aggregate:a,workflows}=report;
  const lines=[
    "# GitHub Actions: read-only inventory",
    "",
    "This report classifies configured trigger and repository write permission, not actual last-run activity.",
    "No workflow has been deleted, disabled or edited by this audit.",
    "",
    "| Metric | Count |","|---|---:|",
    ...Object.entries(a).filter(([k,v])=>typeof v==="number").map(([k,v])=>`| ${k} | ${v} |`),
    "",
    "## Critical workflows: do not remove without verifying replacements",
    ...a.protectedCore.map(x=>"- \`"+x+"\`"),
    "",
    "## Groups",
    ...Object.entries(a.classifications).map(([key,count])=>"- "+key+": "+count),
    "",
    "## Main-branch write-permission review (not safe automatic deletion)",
    ...workflows.filter(w=>w.hasMain&&w.writeAccess).map(w=>"- "+w.file+(w.pathScoped?" (path scoped)":" (broad or no declared path filter)")),
    "",
    "## Old branch/manual candidates — manual approval required",
    ...workflows.filter(w=>w.historicalBranchOnly||w.manualOnly).map(w=>"- "+w.file+" ("+w.events.join(", ")+")"),
    "",
    "A candidate can still have a useful workflow_dispatch or make changes to main when manually started.",
    "Check recent runs, referenced branches, secrets/permissions, and pending audits before disabling.",
    ""
  ];
  return lines.join("\n");
}
if(process.argv[1]&&import.meta.url===new URL("file://"+path.resolve(process.argv[1])).href){
  const directory=path.resolve(process.argv[2]||".github/workflows");
  const out=path.resolve(process.argv[3]||".artifacts/workflow-inventory");
  const report=await inspectWorkflows(directory);
  for(const core of ["verify.yml","watch-official-card-updates.yml"]){
    if(!report.aggregate.protectedCore.includes(core))throw Error("Protected workflow missing: "+core);
  }
  await mkdir(out,{recursive:true});
  await writeFile(path.join(out,"inventory.json"),JSON.stringify(report,null,2)+"\n");
  await writeFile(path.join(out,"inventory.md"),markdown(report));
  console.log("WORKFLOW_AUDIT_SUMMARY "+JSON.stringify(report.aggregate));
  console.log("WORKFLOW_AUDIT_OUTPUT "+out);
}
