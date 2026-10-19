import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {radarDatabase} from "../lib/db.mjs";
const root=new URL("../../data/radar-master/",import.meta.url);
const packPath=new URL("../../packs.js",import.meta.url);
async function loadJson(file){return JSON.parse(await readFile(new URL(file,root),"utf8"));}
async function main(){
  if(process.env.RADAR_ENABLE_INITIAL_SEED!=="yes")throw Error("SET_RADAR_ENABLE_INITIAL_SEED=yes");
  if(process.env.RADAR_FIRESTORE_DATABASE!=="card-radar")throw Error("WRONG_DB");
  const {validateMaster}=await import("../../lib/radar-master.mjs");
  const names=["sets","retailers","stores","products","retailer-skus","store-aliases","inventory-observations"];
  const docs=Object.fromEntries(await Promise.all(names.map(async name=>[name,await loadJson(name+".json")])));
  const verified=validateMaster({sets:docs.sets,retailers:docs.retailers,stores:docs.stores,
    products:docs.products,skus:docs["retailer-skus"],aliases:docs["store-aliases"],
    observations:docs["inventory-observations"]},{packSource:await readFile(packPath,"utf8")});
  if(verified.skuMappings||verified.observations||verified.aliases)
    throw Error("SEED_ONLY_VERIFIED_MASTER_UNEXPECTED_MAPPING");
  const db=radarDatabase(),batch=db.batch();
  for(const row of docs.retailers.items)batch.set(db.collection("radarRetailers").doc(row.retailerId),{
    retailerId:row.retailerId,name:row.name,kind:row.kind,adapterState:row.adapterState,
    permissionStatus:row.permissionStatus
  },{merge:true});
  for(const row of docs.sets.items)batch.set(db.collection("radarSets").doc(row.setId),{
    setId:row.setId,setCode:row.setCode,series:row.series,title:row.title,source:row.source
  },{merge:true});
  for(const row of docs.products.items)batch.set(db.collection("radarProducts").doc(row.productId),{
    productId:row.productId,setId:row.setId,name:row.title,packageType:row.packageType,
    identityStatus:row.identityStatus
  },{merge:true});
  for(const row of docs.stores.items)batch.set(db.collection("radarStores").doc(row.storeId),{
    storeId:row.storeId,retailerId:row.retailerId,name:row.name,kind:row.kind,
    lat:row.latitude,lng:row.longitude,cell:(await import("../lib/radar-query.mjs")).gridCell(row.latitude,row.longitude),
    address:row.address||"",locationStatus:row.locationStatus,
    verifiedLocationSource:row.verifiedLocationSource||""
  },{merge:true});
  batch.set(db.collection("radarSystem").doc("status"),{
    schemaVersion:2,service:"card-radar",masterReady:true,seededAt:new Date().toISOString(),
    source:"data/radar-master",confirmedStock:0
  },{merge:true});
  await batch.commit();
  console.log(JSON.stringify({status:"seeded",database:"card-radar",counts:verified},null,2));
}
main().catch(error=>{console.error(String(error?.message||error));process.exitCode=1;});
