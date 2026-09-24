# Digital Card Binder Android app

This Android WebView shell opens the live Digital Card Binder site so site updates are reflected without rebuilding the APK. Native bridges handle Google sign-in and owner-only Google Sheets authorization without loading Google OAuth inside the embedded WebView.

## v0.9

- Firebase Cloud Messaging topic subscription for site news notifications.
- Android notification permission prompt and dedicated `updates` notification channel.
- Remote app version manifest (`/app-version.json`) with in-app update prompts for future APK releases.
- Firebase Android configuration is generated only during the GitHub Actions build and is not committed to the repository.
- The Android build workflow publishes `DigitalCardBinder_v0.9.apk` only after a successful build.

The package ID intentionally remains `io.github.digitalcardbinder.app.test` so app updates install over the existing app when they use the same test signing key.
