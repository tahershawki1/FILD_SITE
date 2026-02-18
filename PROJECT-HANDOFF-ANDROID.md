# Field Site - Android Handoff Plan (Flutter)

Last updated: 2026-02-17

## Current Status

1. `mobile_shell_flutter` is the official and only mobile path.
2. `mobile-shell` (Capacitor) was removed from this repository on 2026-02-17.
3. Android build, signing, and release must be done from Flutter workflow only.

## 1) Final Goal

Build and deliver an Android APK shell for `field-site` where:

1. The web app remains the source of truth for feature/content updates.
2. The APK is a Flutter WebView shell that opens the production URL.
3. Web updates should not require a new APK unless native layer changes are needed.

## 2) What Is Already Implemented

1. Web update flow exists in `field-site` (banner + service worker update handling).
2. PWA/service worker files are present:
   - `field-site/sw.js`
   - `field-site/version.json`
   - `field-site/manifest.json`
   - `field-site/_headers`
3. Flutter shell exists and loads production URL:
   - `mobile_shell_flutter/lib/main.dart`
   - target URL: `https://atlas.geotools.workers.dev`

## 3) Current Android Shell Config (Flutter)

1. Android namespace/application id:
   - `com.taher.fieldsite`
   - file: `mobile_shell_flutter/android/app/build.gradle.kts`
2. Flutter app version:
   - `1.0.0+1`
   - file: `mobile_shell_flutter/pubspec.yaml`
3. Current release build type is still using debug signing config:
   - file: `mobile_shell_flutter/android/app/build.gradle.kts`
   - this must be replaced with proper release signing before production distribution.

## 4) Build Steps (Windows)

Open terminal in:

`d:\001-reports\mobile_shell_flutter`

Run:

```bash
flutter pub get
flutter doctor
flutter build apk --release
```

Expected APK output:

`mobile_shell_flutter/build/app/outputs/flutter-apk/app-release.apk`

Optional split-per-ABI output:

```bash
flutter build apk --release --split-per-abi
```

## 5) Production Signing (Required Before External Distribution)

Current config uses debug signing for release builds. To ship externally:

1. Create a release keystore.
2. Add `key.properties` in `mobile_shell_flutter/android/` (not committed).
3. Update signing config in `mobile_shell_flutter/android/app/build.gradle.kts` to use release keys.
4. Rebuild using `flutter build apk --release`.

## 6) Validation Checklist

1. Install APK on a real Android device.
2. Confirm app opens production URL inside WebView.
3. Confirm back navigation behavior works as expected.
4. Confirm loading/error states appear correctly on network issues.
5. Confirm a web-only update (in `field-site`) appears without rebuilding APK.

## 7) Future Update Workflow

For normal web updates:

1. Update files in `field-site/`.
2. Bump `field-site/version.json` version and release date.
3. Update cache version logic in `field-site/sw.js` when needed.
4. Deploy `field-site` to Cloudflare.
5. Purge affected cache paths if required.

When to rebuild APK:

1. Native permission changes.
2. Native plugin changes.
3. App id/icon/native Android config changes.

## 8) Quick Resume Prompt

Use this in a new session:

```text
Continue from current state:
- Project path: d:\001-reports
- Official mobile app: mobile_shell_flutter (Flutter only)
- Old mobile-shell (Capacitor) path was removed on 2026-02-17
- Web app is deployed at https://atlas.geotools.workers.dev
- Build Android release APK from:
  d:\001-reports\mobile_shell_flutter
  flutter pub get
  flutter build apk --release
```
