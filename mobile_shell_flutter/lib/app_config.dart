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

  static const List<String> syncedFiles = <String>[
    'index.html',
    'task.html',
    'tasks/new-level.html',
    'tasks/check-tbm-villa-wall.html',
    'tasks/check-slabs.html',
    'tasks/check-excavation-level.html',
    'tasks/stake-demarcation.html',
    'tasks/stake-villa-points.html',
    'tasks/survey-for-consultant.html',
    'tasks/natural-ground-survey.html',
    'manifest.json',
    'version.json',
    'sw.js',
    'assets/css/home.css',
    'assets/css/task.css',
    'assets/css/style.css',
    'assets/css/tasks/new-level.css',
    'assets/css/tasks/check-tbm-villa-wall.css',
    'assets/css/tasks/check-slabs.css',
    'assets/css/tasks/check-excavation-level.css',
    'assets/css/tasks/stake-demarcation.css',
    'assets/css/tasks/stake-villa-points.css',
    'assets/css/tasks/survey-for-consultant.css',
    'assets/css/tasks/natural-ground-survey.css',
    'assets/JS/home.js',
    'assets/JS/pwa-update.js',
    'assets/JS/task.js',
    'assets/JS/script.js',
    'assets/JS/tasks/new-level.js',
    'assets/JS/tasks/check-tbm-villa-wall.js',
    'assets/JS/tasks/check-slabs.js',
    'assets/JS/tasks/check-excavation-level.js',
    'assets/JS/tasks/stake-demarcation.js',
    'assets/JS/tasks/stake-villa-points.js',
    'assets/JS/tasks/survey-for-consultant.js',
    'assets/JS/tasks/natural-ground-survey.js',
    'assets/icons/brand-logo.png',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
  ];
}
