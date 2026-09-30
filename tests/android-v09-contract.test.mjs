import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Android v1.0 keeps version, FCM, and update-check contracts aligned", () => {
  const appGradle = read("android-app/app/build.gradle");
  const rootGradle = read("android-app/build.gradle");
  const manifest = read("android-app/app/src/main/AndroidManifest.xml");
  const application = read("android-app/app/src/main/java/io/github/digitalcardbinder/app/BinderApplication.java");
  const activity = read("android-app/app/src/main/java/io/github/digitalcardbinder/app/MainActivity.java");
  const messaging = read("android-app/app/src/main/java/io/github/digitalcardbinder/app/DigitalCardBinderMessagingService.java");
  const version = JSON.parse(read("app-version.json"));
  const buildWorkflow = read(".github/workflows/build-android-apk.yml");
  const pushWorkflow = read(".github/workflows/send-android-news-notification.yml");

  assert.match(appGradle, /versionCode\\s+15/);
  assert.match(appGradle, /versionName\s+'1\.0'/);
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

  assert.equal(version.versionCode, 15);
  assert.equal(version.versionName, "1.0");
  assert.match(version.apkUrl, /DigitalCardBinder_v1\.0\.apk$/);

  assert.match(buildWorkflow, /Build Android APK v1\.0/);
  assert.match(buildWorkflow, /google-services\.json/);
  assert.match(pushWorkflow, /news\.json/);
  assert.match(pushWorkflow, /send-android-news-notification\.mjs/);
});
