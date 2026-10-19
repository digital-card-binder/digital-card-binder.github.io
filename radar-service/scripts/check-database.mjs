import {radarDatabase,fetchDatabaseSummary} from "../lib/db.mjs";
async function main(){
  const db=radarDatabase();
  const status=await db.collection("radarSystem").doc("status").get();
  if(!status.exists)throw Error("RADAR_DATABASE_NOT_SEEDED");
  const counts=await fetchDatabaseSummary(db);
  console.log(JSON.stringify({database:"(default)",seededAt:status.data()?.seededAt||null,
    collections:counts,approvedSources:"check /api/v1/coverage for approvedSourceCount",status:"available"},null,2));
}
main().catch(error=>{console.error("DB_CHECK_FAILED",String(error?.message||error));process.exitCode=1;});
