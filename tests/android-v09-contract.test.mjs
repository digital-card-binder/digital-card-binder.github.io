import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Android v1.0.2 keeps FCM, camera, update-check and trusted WebView GPS aligned", () => {
  const appGradle = read("android-app/app/build.gradle");
  const rootGradle = read("android-app/build.gradle");
  const manifest = read("android-app/app/src/main/AndroidManifest.xml");
  const filePaths = read("android-app/app/src/main/res/xml/file_paths.xml");
  const application = read("android-app/app/src/main/java/io/github/digitalcardbinder/app/BinderApplication.java");
  const activity = read("android-app/app/src/main/java/io/github/digitalcardbinder/app/MainActivity.java");
  const messaging = read("android-app/app/src/main/java/io/github/digitalcardbinder/app/DigitalCardBinderMessagingService.java");
  const version = JSON.parse(read("app-version.json"));
  const buildWorkflow = read(".github/workflows/build-android-apk.yml");
  const pushWorkflow = read(".github/workflows/send-android-news-notification.yml");

  assert.match(appGradle, /versionCode\s+17/);
  assert.match(appGradle, /versionName\s+'1\.0\.2'/);
  assert.match(rootGradle, /com\.google\.gms\.google-services/);
  assert.match(appGradle, /firebase-bom:34\.18\.0/);
  assert.match(appGradle, /firebase-messaging/);

  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /\.BinderApplication/);
  assert.match(manifest, /\.DigitalCardBinderMessagingService/);
  assert.match(manifest, /com\.google\.firebase\.MESSAGING_EVENT/);
  assert.match(application, /NOTIFICATION_TOPIC\s*=\s*"updates"/);
  assert.match(application, /app-version\.json/);
  assert.match(application, /getLongVersionCode\(\)/);
  assert.doesNotMatch(application, /CURRENT_VERSION_CODE/);
  assert.match(messaging, /NOTIFICATION_CHANNEL_ID/);
  assert.match(activity, /freshHomeUrl\(\)/);
  assert.match(activity, /[?]native=android&launch=/);
  assert.match(activity, /System[.]currentTimeMillis\(\)/);
  assert.match(activity, /webView[.]loadUrl\(freshHomeUrl\(\)\)/);
  assert.match(activity, /startPrint\(String jobName, boolean landscape\)/);
  assert.match(activity, /createPrintDocumentAdapter/);
  assert.match(activity, /PrintAttributes[.]MediaSize[.]ISO_A4/);
  assert.match(activity, /onShowFileChooser/);
  assert.match(activity, /FILE_CHOOSER_REQUEST_CODE/);
  assert.match(activity, /FileChooserParams[.]parseResult/);
  assert.match(activity, /MediaStore[.]ACTION_IMAGE_CAPTURE/);
  assert.match(activity, /fileChooserParams[.]isCaptureEnabled[(][)]/);
  assert.match(activity, /FileProvider[.]getUriForFile/);
  assert.match(manifest, /androidx[.]core[.]content[.]FileProvider/);
  assert.match(filePaths, /external-cache-path/);

  assert.equal(version.versionCode, 17);
  assert.equal(version.versionName, "1.0.2");
  assert.match(version.apkUrl, /DigitalCardBinder_v1\.0\.2\.apk$/);

  assert.match(buildWorkflow, /Build Android APK v1\.0\.2/);
  assert.match(buildWorkflow, /google-services\.json/);
  assert.match(pushWorkflow, /news\.json/);
  assert.match(pushWorkflow, /send-android-news-notification\.mjs/);
});

test("Native Android WebView location permission requests are scoped and consented",()=>{
  const manifest=read("android-app/app/src/main/AndroidManifest.xml");
  const activity=read("android-app/app/src/main/java/io/github/digitalcardbinder/app/MainActivity.java");
  const gradle=read("android-app/app/build.gradle");
  const workflow=read(".github/workflows/build-android-apk.yml");
  const version=JSON.parse(read("app-version.json"));

  assert.match(manifest,/android[.]permission[.]ACCESS_FINE_LOCATION/);
  assert.match(manifest,/android[.]permission[.]ACCESS_COARSE_LOCATION/);
  assert.doesNotMatch(manifest,/ACCESS_BACKGROUND_LOCATION/);
  assert.match(activity,/settings[.]setGeolocationEnabled\(true\)/);
  assert.match(activity,/onGeolocationPermissionsShowPrompt/);
  assert.match(activity,/onGeolocationPermissionsHidePrompt/);
  assert.match(activity,/hasForegroundLocationPermission\(\)/);
  assert.match(activity,/onRequestPermissionsResult\(/);
  assert.match(activity,/LOCATION_PERMISSION_REQUEST_CODE\s*=\s*4110/);
  assert.match(activity,/Manifest[.]permission[.]ACCESS_COARSE_LOCATION/);
  assert.match(activity,/Manifest[.]permission[.]ACCESS_FINE_LOCATION/);
  assert.match(activity,/requestPermissions\(new String\[\]\{/);
  assert.match(activity,/isTrustedGeolocationOrigin\(origin\)/);
  assert.match(activity,/HOME_HOST[.]equalsIgnoreCase\(uri[.]getHost\(\)\)/);
  assert.match(activity,/"https"[.]equalsIgnoreCase\(uri[.]getScheme\(\)\)/);
  assert.match(activity,/callback[.]invoke\(origin, false, false\)/);
  assert.match(activity,/callback[.]invoke\(origin, true, false\)/);
  assert.match(activity,/completeGeolocationRequest\(hasForegroundLocationPermission\(\)\)/);
  assert.doesNotMatch(activity,/setGeolocationEnabled\(false\)/);
  assert.doesNotMatch(activity,/callback[.]invoke\(origin, true, true\)/);
  assert.match(gradle,/versionCode\s+17/);
  assert.match(gradle,/versionName\s+'1[.]0[.]2'/);
  assert.match(workflow,/DigitalCardBinder_v1[.]0[.]2[.]apk/);
  assert.match(workflow,/Build Android APK v1[.]0[.]2/);
  assert.equal(version.versionCode,17);
  assert.equal(version.versionName,"1.0.2");
  assert.match(version.apkUrl,/DigitalCardBinder_v1[.]0[.]2[.]apk$/);
});

test("Android update dialog and homepage install use the latest release metadata, never hardcoded v1.0",()=>{
  const pwa=read("pwa.js");
  const current=JSON.parse(read("app-version.json"));
  assert.match(pwa,/const versionName = String\(payload[?][.]versionName \|\| ""\)[.]trim\(\)/);
  assert.match(pwa,/update[.]textContent = versionName \? `v\$\{versionName\} 업데이트` : "업데이트"/);
  assert.match(pwa,/update[.]addEventListener\("click", \(\) => \{\s*window[.]location[.]href = apkUrl/);
  assert.match(pwa,/async function latestAndroidRelease\(\)/);
  assert.match(pwa,/const \{ apkUrl, versionName \} = await latestAndroidRelease\(\)/);
  assert.match(pwa,/link[.]download = `DigitalCardBinder_v\$\{versionName\}[.]apk`/);
  assert.doesNotMatch(pwa,/v1[.]0 업데이트|DigitalCardBinder_v1[.]0[.]apk|v1[.]0 파일을 준비 중/);
  assert.equal(current.versionName,"1.0.2");
  assert.ok(current.apkUrl.endsWith("/DigitalCardBinder_v"+current.versionName+".apk"));
  const home=read("index.html");
  assert.match(home,/pwa[.]js[?]v=[a-f0-9]{12}/,"pwa.js must use versioned URL for updated screens");
});
