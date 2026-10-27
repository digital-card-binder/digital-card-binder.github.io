import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, statSync, existsSync} from "node:fs";
import {createHash} from "node:crypto";
const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const config=JSON.parse(read("app-version.json"));
const manifest=JSON.parse(read("manifest.webmanifest"));
const gradle=read("android-app/app/build.gradle");
const native=read("android-app/app/src/main/java/io/github/digitalcardbinder/app/MainActivity.java");
const app=read("android-app/app/src/main/java/io/github/digitalcardbinder/app/BinderApplication.java");
const permissions=read("android-app/app/src/main/AndroidManifest.xml");
const pwa=read("pwa.js");

test("published Android v1.0.2 binary matches Gradle and remote update manifest",()=>{
  assert.equal(config.versionCode,17);
  assert.equal(config.versionName,"1.0.2");
  assert.match(gradle,/applicationId 'io\.github\.digitalcardbinder\.app\.test'/);
  assert.match(gradle,/versionCode 17/);
  assert.match(gradle,/versionName '1\.0\.2'/);
  assert.match(gradle,/minSdk 26/);
  assert.match(gradle,/targetSdk 35/);
  assert.match(gradle,/compileSdk 36/);
  const apkName="DigitalCardBinder_v"+config.versionName+".apk";
  assert.ok(existsSync(new URL("../"+apkName,import.meta.url)), "Published APK must exist in the repository");
  const data=readFileSync(new URL("../"+apkName,import.meta.url));
  assert.ok(data.length>1_000_000,"APK must be non-trivial (not a placeholder)");
  assert.equal(data.subarray(0,2).toString(),"PK","APK is a ZIP-compatible binary");
  const releaseUrl=new URL(config.apkUrl);
  assert.equal(releaseUrl.protocol,"https:");
  assert.equal(releaseUrl.hostname,"raw.githubusercontent.com");
  assert.equal(releaseUrl.pathname,"/digital-card-binder/digital-card-binder.github.io/main/"+apkName);
  assert.ok(createHash("sha256").update(data).digest("hex").length===64);
});

test("Android trusted WebView and current web/PWA features are maintained",()=>{
  assert.match(native,/private static final String HOME_URL = "https:\/\/digital-card-binder\.github\.io\/"/);
  assert.match(native,/isTrustedWebPage\(\)/);
  assert.match(native,/onShowFileChooser/);
  assert.match(native,/onGeolocationPermissionsShowPrompt/);
  assert.match(native,/isTrustedGeolocationOrigin\(origin\)/);
  assert.match(native,/PrintAttributes\.MediaSize\.ISO_A4/);
  assert.match(native,/fileChooserParams\.isCaptureEnabled\(\)/);
  assert.match(native,/onBackPressed\(\)/);
  assert.match(native,/webView\.goBack\(\)/);
  assert.match(native,/webView\.saveState\(outState\)/);
  assert.match(app,/app-version\.json/);
  assert.match(permissions,/android\.permission\.INTERNET/);
  assert.match(permissions,/ACCESS_FINE_LOCATION/);
  assert.doesNotMatch(permissions,/ACCESS_BACKGROUND_LOCATION/);
  assert.match(permissions,/androidx\.core\.content\.FileProvider/);
  assert.match(pwa,/async function latestAndroidRelease\(/);
  assert.match(pwa,/maybePromptAndroidNativeUpdate\(/);
  assert.equal(manifest.id,"/");
  assert.equal(manifest.scope,"/");
  assert.ok(manifest.start_url.startsWith("/"));
  assert.equal(manifest.display,"standalone");
  for(const icon of manifest.icons){
    assert.ok(existsSync(new URL(".."+icon.src.split("?")[0],import.meta.url)),"Missing PWA icon: "+icon.src);
  }
});

test("PWA home, global search, own dex, studio and card radar navigation are discoverable",()=>{
  const home=read("index.html");
  const shared=read("site-mobile-nav.js");
  for(const url of ["./pokemon-search.html","./series.html","./custom.html"])assert.ok(shared.includes(url),url);
  assert.match(home,/home-mobile-tabbar/);
  assert.match(read("studio.html"),/site-mobile-nav\.js/);
  assert.match(read("custom.html"),/site-mobile-nav\.js/);
  assert.match(read("pokemon-search.html"),/site-mobile-nav\.js/);
  assert.match(read("card-radar.html"),/card-radar/);
});

test("Android build workflow and packaged artifact use matching v1.0.2 release names",()=>{
  const workflow=read(".github/workflows/build-android-apk.yml");
  assert.match(workflow,/DigitalCardBinder_v1\.0\.2\.apk/);
  assert.match(workflow,/assembleDebug/);
  assert.match(workflow,/google-services\.json/);
  assert.match(workflow,/Build Android APK v1\.0\.2/);
  assert.ok(statSync(new URL("../DigitalCardBinder_v1.0.2.apk",import.meta.url)).size>1_000_000);
});
