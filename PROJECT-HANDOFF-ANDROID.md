# Field Site - Android Handoff Plan

Last updated: 2026-02-14

## IMPORTANT STATUS UPDATE (2026-02-16)

1. `mobile-shell` (Capacitor) is archived and no longer the delivery path.
2. Official Android shell is `mobile_shell_flutter`.
3. Any old Capacitor build steps in this document are legacy reference only.
4. For production, use Flutter build/signing workflow only.

## 1) الهدف النهائي

تحويل مشروع `field-site` إلى تطبيق أندرويد (`APK`) مع نموذج تحديث مركزي:

1. مصدر الحقيقة للتحديثات يكون نسخة الويب المنشورة أونلاين.
2. الـAPK يكون Android Shell (Capacitor) يفتح نفس الرابط.
3. عند نزول نسخة جديدة يظهر للمستخدم Banner داخل التطبيق فيه زر `تحديث الآن`.
4. لا نحتاج إعادة تثبيت APK إلا عند تغييرات Native.

## 2) ما تم تنفيذه بالفعل

1. تم تنفيذ Update Flow داخل الويب:
   - إضافة Update Banner في `field-site/index.html`.
   - إضافة زر `تحديث الآن` + `لاحقًا`.
   - عند الضغط على `تحديث الآن` يتم إرسال `SKIP_WAITING` للـService Worker ثم reload بعد `controllerchange`.

2. تم إعادة بناء `Service Worker`:
   - ملف `field-site/sw.js` يستخدم:
   - `network-first` لملفات `index/manifest/sw/version`.
   - `stale-while-revalidate` لباقي الملفات.
   - حذف أي cache قديم عند `activate`.
   - Message contract مفعل: `type: "SKIP_WAITING"`.

3. تم تجهيز PWA Assets:
   - إضافة الأيقونات:
   - `field-site/assets/icons/icon-192.png`
   - `field-site/assets/icons/icon-512.png`
   - تحديث `field-site/manifest.json` ليتوافق مع المسارات.

4. تم إضافة metadata للإصدار:
   - `field-site/version.json` موجود حاليًا على:
   - `"version": "1.0.0"`
   - `"releasedAt": "2026-02-14T00:00:00Z"`
   - `"minShell": "1.0.0"`

5. تم إعداد قواعد كاش Cloudflare:
   - ملف `field-site/_headers` يطبق:
   - `no-cache` لـ `index.html`, `sw.js`, `manifest.json`, `version.json`
   - `max-age=300` لـ `/assets/*`

6. تم إنشاء هيكل Android Shell:
   - مجلد `mobile-shell/` جاهز وفيه:
   - `package.json` (أوامر Capacitor وAndroid)
   - `capacitor.config.ts` (url مضبوط على الرابط الحقيقي)
   - `README.md`, `tsconfig.json`, `www/index.html`

7. تم ربط shell بالرابط المنشور:
   - `mobile-shell/capacitor.config.ts`
   - `server.url = "https://atlas.geotools.workers.dev"`

8. تم التحقق من النشر:
   - `https://atlas.geotools.workers.dev` -> 200
   - `https://atlas.geotools.workers.dev/version.json` -> 200
   - `https://atlas.geotools.workers.dev/sw.js` -> 200

## 3) الحالة الحالية (Current State)

1. الويب جاهز ومرفوع ويستقبل تحديثات.
2. PWA update behavior جاهز.
3. Android shell config جاهز.
4. المتبقي فقط تنفيذ Build فعلي للـAPK على جهاز فيه Node + Java + Android SDK.

## 4) ما لم يتم تنفيذه بعد (Pending)

1. تشغيل `npm install` داخل `mobile-shell`.
2. إضافة منصة Android (`npx cap add android`).
3. عمل `sync` لملفات Capacitor.
4. فتح Android Studio وبناء نسخة Signed Release APK.
5. اختبار APK على جهاز فعلي قبل التوزيع.
6. توزيع APK عبر رابط مباشر داخلي.

## 5) خطوات التنفيذ على ويندوز التاني (Step-by-Step)

افتح Terminal داخل:

`d:\001-reports\mobile-shell`

ثم نفذ بالترتيب:

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

داخل Android Studio:

1. انتظر Gradle Sync يكتمل.
2. من القائمة: `Build > Generate Signed Bundle / APK`.
3. اختَر `APK`.
4. أنشئ/اختَر keystore.
5. Build نوع `release`.
6. الناتج المتوقع:
   - `mobile-shell/android/app/build/outputs/apk/release/app-release.apk`

## 6) Checklist إغلاق المشروع

1. تثبيت APK على موبايل Android.
2. فتح التطبيق والتأكد أنه يفتح بدون شريط متصفح.
3. تعديل بسيط في `field-site/index.html` ثم إعادة رفع `field-site`.
4. زيادة `version.json` وتحديث `CACHE_VERSION` في `sw.js`.
5. فتح التطبيق على الموبايل.
6. التأكد أن Banner يظهر: نسخة جديدة متاحة.
7. الضغط على `تحديث الآن` والتأكد أن المحتوى الجديد ظهر.
8. التأكد أن بيانات `localStorage` ما اتحذفتش.

## 7) Workflow أي تحديث مستقبلي

كل تحديث ويب جديد:

1. عدّل ملفات `field-site`.
2. حدث `field-site/version.json`:
   - `version`
   - `releasedAt`
3. حدث `CACHE_VERSION` داخل `field-site/sw.js`.
4. ارفع `field-site` على Cloudflare.
5. لو حصل cache قديم عند بعض المستخدمين:
   - Purge انتقائي لـ:
   - `/index.html`
   - `/sw.js`
   - `/manifest.json`
   - `/version.json`

متى نعيد بناء APK؟

1. فقط إذا غيرت Native layer (plugins/permissions/icon native/package id).
2. تغييرات الويب العادية لا تحتاج APK جديد.

## 8) ملاحظات مهمة

1. لو النص العربي ظهر مشوه في أي Editor، افتح الملف بـ `UTF-8`.
2. `mobile-shell/android` غير متولد بعد، وسيتولد بعد `npx cap add android`.
3. `server.url` حاليًا مرتبط مباشرة بالإنتاج:
   - `https://atlas.geotools.workers.dev`

## 9) Prompt جاهز لبدء محادثة جديدة على الجهاز التاني

انسخ النص التالي كبداية:

```text
Continue from current state:
- Project path: C:\Users\Taher\OneDrive\001-reports
- Web app deployed at https://atlas.geotools.workers.dev
- PWA update flow is implemented (update banner + SKIP_WAITING flow)
- Service worker caching strategy is already updated
- Need to continue from mobile-shell APK build steps:
  npm install -> npx cap add android -> npx cap sync android -> open Android Studio -> generate signed release APK
```
