# Field Site Android Shell

This folder contains a Capacitor Android shell that loads the web app from Cloudflare.

## 1) Update server URL

Edit `capacitor.config.ts`:

- `server.url`: set your Cloudflare Pages/custom domain URL.

## 2) Install and create Android project

```bash
npm install
npm run android:add
npm run android:sync
```

## 3) Build release APK

```bash
npm run android:release
```

Release output (default):

- `mobile-shell/android/app/build/outputs/apk/release/app-release.apk`

## 4) Sign for production

Use Android Studio (`Build > Generate Signed Bundle / APK`) or Gradle signing config.

## 5) Update cycle

- Web content updates: deploy only `field-site` to Cloudflare.
- Native updates (plugins/permissions): rebuild and redistribute APK.
