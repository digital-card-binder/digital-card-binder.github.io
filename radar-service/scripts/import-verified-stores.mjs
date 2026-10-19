// Privileged standalone importer: reviewed store locations only, no stock.
import {readFile} from "node:fs/promises";
import {radarDatabase} from "../lib/db.mjs";
import {prepareVerifiedStoreImport,writeVerifiedStoreImport} from "../lib/store-import.mjs";

async function main(){
  const source=process.argv[2];
  if(!source)throw Error("USAGE: node scripts/import-verified-stores.mjs <reviewed-stores.json>");
  const config=JSON.parse(await readFile(source,"utf8"));
  const rows=prepareVerifiedStoreImport(config);
  const committing=process.env.RADAR_STORE_IMPORT_MODE==="commit";
  if(committing && process.env.RADAR_ALLOW_STORE_IMPORT!=="yes")
    throw Error("EXPLICIT_STORE_IMPORT_APPROVAL_REQUIRED");
  if(process.env.GOOGLE_CLOUD_PROJECT!=="digital-card-radar-db" ||
    process.env.RADAR_FIRESTORE_DATABASE!=="(default)")
    throw Error("ISOLATED_RADAR_FIREBASE_PROJECT_REQUIRED");
  const db=radarDatabase();
  const result=await writeVerifiedStoreImport(db,rows,{dryRun:!committing});
  // Print only counts, no credentials, personal information, or stock.
  console.log(JSON.stringify({operation:"reviewed_store_import",...result}));
}
main().catch(error=>{
  console.error("STORE_IMPORT_REFUSED",String(error?.message||error).slice(0,150));
  process.exitCode=1;
});
