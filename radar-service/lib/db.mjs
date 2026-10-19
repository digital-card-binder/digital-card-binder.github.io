import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {gridCell,nearbyCells} from "./radar-query.mjs";

// This service is bound to a completely separate Firebase PROJECT.
// Only its free Spark (default) database may be accessed; never the collector's Firebase project.
const DATABASE_ID = "(default)";
const cache=new Map();
export function radarDatabase() {
  if(process.env.RADAR_FIRESTORE_DATABASE!==DATABASE_ID)
    throw new Error("RADAR_DATABASE_NOT_CONFIGURED");
  const projectId=process.env.GOOGLE_CLOUD_PROJECT;
  if(!projectId)throw new Error("RADAR_PROJECT_NOT_CONFIGURED");
  if(projectId==="pokemon-dex-40e92")throw new Error("COLLECTOR_FIREBASE_PROJECT_FORBIDDEN");
  if(!/^digital-card-radar-db(?:-[a-z0-9-]+)?$/.test(projectId))
    throw new Error("UNRECOGNIZED_RADAR_FIREBASE_PROJECT");
  let credential=applicationDefault();
  if(process.env.RADAR_SERVICE_ACCOUNT_JSON) {
    const config=JSON.parse(process.env.RADAR_SERVICE_ACCOUNT_JSON);
    if(config.project_id!==projectId || !config.private_key || !config.client_email)
      throw new Error("RADAR_SERVICE_ACCOUNT_PROJECT_MISMATCH");
    credential=cert(config);
  }
  const app=getApps().find(app=>app.name==="card-radar-service") ||
    initializeApp({credential,projectId},"card-radar-service");
  return getFirestore(app,DATABASE_ID);
}
function cacheKey(cells) {
  return cells.join(",");
}
export async function fetchNearbyStores(db,lat,lng,radiusKm,{now=Date.now()}={}) {
  const cells=nearbyCells(lat,lng,radiusKm),key=cacheKey(cells);
  const cached=cache.get(key);
  if(cached&&cached.until>now)return cached.value;
  let next=0,partial=false;
  const found=new Map();
  async function worker(){
    while(next<cells.length){
      const cell=cells[next++];
      const result=await db.collection("radarStores").where("cell","==",cell).limit(351).get();
      if(result.docs.length>=351)partial=true;
      for(const record of result.docs.slice(0,350)){
        const data=record.data()||{};
        // Ignore malformed or unapproved locations.
        if(data.locationStatus!=="verified" || !Number.isFinite(data.lat) ||
          !Number.isFinite(data.lng) || gridCell(data.lat,data.lng)!==cell)continue;
        found.set(record.id,{...data,storeId:record.id});
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(4,cells.length)},worker));
  const value={stores:[...found.values()],coverageLimited:partial};
  cache.set(key,{until:now+30000,value});
  if(cache.size>64)cache.clear();
  return value;
}
export async function fetchDatabaseSummary(db) {
  const names=["radarStores","radarRetailers","radarProducts","radarSets",
    "radarSkuMappings","radarStoreAliases","radarObservations","radarSources"];
  const summaries=await Promise.all(names.map(async name=>{
    const result=await db.collection(name).count().get();
    return [name,result.data().count];
  }));
  return Object.fromEntries(summaries);
}
