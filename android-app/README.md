# Digital Card Binder Android app

This Android WebView shell opens the live Digital Card Binder site so site updates are reflected without rebuilding the APK. Native bridges handle Google sign-in and owner-only Google Sheets authorization without loading Google OAuth inside the embedded WebView.

## v1.0.2

- Card Radar's '내 위치' button now requests Android foreground location permission through the native WebView; approximate or precise location works, only for the trusted HTTPS site.
- Geolocation access is never pre-granted to unrelated web origins and is not requested at app startup.
- Existing users must install the new APK to receive this native permission bridge.

## v1.0.1

- Binder Studio image inputs can open the device camera as well as the gallery.
- Capture-enabled inputs such as quick slot photo and page scan open the rear camera directly.
- Camera output is shared through an app-private FileProvider cache URI; no storage permission is required.

## v1.0

- Firebase Cloud Messaging topic subscription for site news notifications.
- Android notification permission prompt and dedicated `updates` notification channel.
- Remote app version manifest (`/app-version.json`) with in-app update prompts for future APK releases.
- Firebase Android configuration is generated only during the GitHub Actions build and is not committed to the repository.
- Native Android print bridge opens the system PrintManager from Binder Studio, including Save as PDF.
- The Android build workflow publishes `DigitalCardBinder_v1.0.apk` only after a successful build.

The package ID intentionally remains `io.github.digitalcardbinder.app.test` so app updates install over the existing app when they use the same test signing key.
