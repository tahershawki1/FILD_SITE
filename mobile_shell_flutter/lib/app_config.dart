class AppConfig {
  static const String defaultSiteUrl = 'https://atlas.geotools.workers.dev';
  static const String siteUrl = String.fromEnvironment(
    'SITE_URL',
    defaultValue: defaultSiteUrl,
  );

  static const String appSessionCookie = 'field_site_session';
  static const String adminSessionCookie = 'field_site_admin_session';

  static const String prefsLoggedInKey = 'field_site_logged_in';
  static const String prefsUsernameKey = 'field_site_username';
  static const String prefsLocalVersionKey = 'field_site_local_version';

  static const String localSiteDirName = 'field_site_offline_bundle';
  static const String bundledSiteAssetPrefix = 'assets/offline_site';

  static const List<String> syncedFiles = <String>[
    'index.html',
    'task.html',
    'manifest.json',
    'version.json',
    'sw.js',
    'assets/css/home.css',
    'assets/css/task.css',
    'assets/css/style.css',
    'assets/JS/home.js',
    'assets/JS/task.js',
    'assets/JS/script.js',
    'assets/JS/pwa-update.js',
    'assets/icons/brand-logo.png',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
  ];
}
