import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Android v0.9 keeps version, FCM, and update-check contracts aligned", () => {
  const appGradle = read("android-app/app/build.gradle");
  const rootGradle = read("android-app/build.gradle");
  const manifest = read("android-app/app/src/main/AndroidManifest.xml");
  const application = read("android-app/app/src/main/java/io/github/digitalcardbinder/app/BinderApplication.java");
  const messaging = read("android-app/app/src/main/java/io/github/digitalcardbinder/app/DigitalCardBinderMessagingService.java");
  const version = JSON.parse(read("app-version.json"));
  const buildWorkflow = read(".github/workflows/build-android-apk.yml");
  const pushWorkflow = read(".github/workflows/send-android-news-notification.yml");

  assert.match(appGradle, /versionCode\s+12/);
  assert.match(appGradle, /versionName\s+'0\.9'/);
  assert.match(rootGradle, /com\.google\.gms\.google-services/);
  assert.match(appGradle, /firebase-bom:34\.18\.0/);
  assert.match(appGradle, /firebase-messaging/);

  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /\.BinderApplication/);
  assert.match(manifest, /\.DigitalCardBinderMessagingService/);
  assert.match(manifest, /com\.google\.firebase\.MESSAGING_EVENT/);
  assert.match(application, /NOTIFICATION_TOPIC\s*=\s*"updates"/);
  assert.match(application, /app-version\.json/);
  assert.match(messaging, /NOTIFICATION_CHANNEL_ID/);

  assert.equal(version.versionCode, 12);
  assert.equal(version.versionName, "0.9");
  assert.match(version.apkUrl, /DigitalCardBinder_v0\.9\.apk$/);

  assert.match(buildWorkflow, /Build Android APK v0\.9/);
  assert.match(buildWorkflow, /google-services\.json/);
  assert.match(pushWorkflow, /news\.json/);
  assert.match(pushWorkflow, /send-android-news-notification\.mjs/);
});
