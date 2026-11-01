# Native release readiness

## Supported product matrix

| Platform | Status |
| --- | --- |
| Web / PWA | Ready |
| iPadOS native app | Ready |
| iPhone native app | Unsupported |
| Android staff app (phones and tablets) | Built in CI (KS_ANDROID_STAFF_v1) |

`android/` is the Android staff app (KS_ANDROID_STAFF_v1): the portal plus a second launcher icon, "Phone", that opens it on the phone keypad. Calls use the Twilio Voice Android SDK through Android Telecom (ring on the lock screen, foreground service during a call), staff alerts arrive through Firebase, and the app has fingerprint/face lock, business-card scan, PDF mark-up and Share -> deal. `.github/workflows/android.yml` builds a debug APK on every pull request and, run by hand, a signed release bundle (AAB) that it uploads to Google Play's internal track when the secrets are set (it skips the upload with a notice otherwise).

Local build (Android Studio or the Android SDK installed):

```sh
npm ci && npm run build
npm run android:sync                       # brand file + npx cap sync android
node scripts/android-google-services.mjs   # placeholder unless GOOGLE_SERVICES_JSON is set
cd android && gradle assembleDebug          # Gradle 8.14 (the wrapper jar is not committed)
```

## Local iPadOS build

BF-Portal requires Node 22 and npm 10 or newer. On macOS with Xcode installed, run the web checks and sync before building the unsigned Simulator application:

```sh
npm ci
npm run typecheck
npm run test:ci
npm run build
test -f dist/index.html
npx cap sync ios
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  clean build
```

The App scheme embeds BorealWidget and compiles it as part of the complete application build. Both the App and BorealWidget targets specify iPad as their only device family.

## BF PORTAL IPADOS

### READY

- Existing Capacitor iOS project
- Application identifier `com.boreal.portal`
- iPad-only App and BorealWidget targets
- Working BorealWidget architecture, WidgetBridgePlugin, snapshot provider, summary model, SummaryWidget, and `group.com.boreal.portal` App Group contract
- Existing shared `bfportal://` deep-link routing
- Widget publishing and App Group persistence remain iPadOS-only; staff authentication is never placed in widget/App Group storage

### NEEDS APPLE CREDENTIALS/MANUAL SETUP

- Paid Apple Developer team
- Production provisioning
- Push configuration where applicable
- TestFlight and App Store submission
