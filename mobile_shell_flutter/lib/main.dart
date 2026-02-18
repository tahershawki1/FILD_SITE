import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'app_config.dart';
import 'services/auth_service.dart';
import 'services/local_site_server.dart';
import 'services/offline_site_service.dart';
import 'services/session_store.dart';
import 'splash_screen.dart';
import 'web_redirect_stub.dart' if (dart.library.html) 'web_redirect_web.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  _applySystemUiStyle();
  runApp(const FieldSiteApp());
}

void _applySystemUiStyle() {
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
}

enum AppStage {
  booting,
  login,
  offlineFirstLogin,
  shell,
}

class FieldSiteApp extends StatelessWidget {
  const FieldSiteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: FieldSiteShellPage(),
    );
  }
}

class FieldSiteShellPage extends StatefulWidget {
  const FieldSiteShellPage({super.key});

  @override
  State<FieldSiteShellPage> createState() => _FieldSiteShellPageState();
}

class _FieldSiteShellPageState extends State<FieldSiteShellPage>
    with WidgetsBindingObserver {
  _FieldSiteShellPageState()
      : _siteUri = _resolveSiteUri(),
        _sessionStore = SessionStore(),
        _localSiteServer = LocalSiteServer();

  static Uri _resolveSiteUri() {
    const envUrl = AppConfig.siteUrl;
    final parsed = Uri.tryParse(envUrl);
    var siteUri = parsed == null || !parsed.hasScheme
        ? Uri.parse(AppConfig.defaultSiteUrl)
        : parsed;

    if (!kIsWeb &&
        defaultTargetPlatform == TargetPlatform.android &&
        (siteUri.host == 'localhost' || siteUri.host == '127.0.0.1')) {
      siteUri = siteUri.replace(host: '10.0.2.2');
    }
    return siteUri;
  }

  final Uri _siteUri;
  final SessionStore _sessionStore;
  final LocalSiteServer _localSiteServer;

  late final AuthService _authService = AuthService(siteUri: _siteUri);
  late final OfflineSiteService _offlineSiteService = OfflineSiteService(
    siteUri: _siteUri,
    sessionStore: _sessionStore,
  );

  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  WebViewController? _webViewController;
  AppStage _stage = AppStage.booting;

  bool _showSplash = true;
  bool _isSubmittingLogin = false;
  String? _loginError;

  bool _isLoadingPage = true;
  int _progress = 0;
  String? _pageErrorMessage;

  bool _hasUpdate = false;
  bool _checkingUpdate = false;
  bool _isApplyingUpdate = false;
  String? _remoteVersion;
  String? _localVersion;

  static const String _disableZoomJS = '''
    (function() {
      var meta = document.querySelector('meta[name="viewport"]');
      if (meta) {
        meta.setAttribute('content',
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
      } else {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        document.head.appendChild(meta);
      }

      document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) { e.preventDefault(); }
      }, { passive: false });

      var lastTouchEnd = 0;
      document.addEventListener('touchend', function(e) {
        var now = Date.now();
        if (now - lastTouchEnd <= 300) { e.preventDefault(); }
        lastTouchEnd = now;
      }, { passive: false });

      document.addEventListener('wheel', function(e) {
        if (e.ctrlKey) { e.preventDefault(); }
      }, { passive: false });
    })();
  ''';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _applySystemUiStyle();

    if (kIsWeb) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        redirectToSite(_siteUri.toString());
      });
      return;
    }

    unawaited(_bootstrap());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _applySystemUiStyle();
      unawaited(_checkForUpdates());
    }
  }

  Future<void> _bootstrap() async {
    final loggedIn = await _sessionStore.isLoggedIn();
    if (!loggedIn) {
      final online = await _authService.hasInternet();
      if (!mounted) return;
      setState(() {
        _stage = online ? AppStage.login : AppStage.offlineFirstLogin;
      });
      return;
    }

    await _startShell();
  }

  Future<void> _startShell() async {
    if (!mounted) return;
    setState(() {
      _stage = AppStage.booting;
      _isLoadingPage = true;
      _progress = 0;
      _pageErrorMessage = null;
      _loginError = null;
      _isSubmittingLogin = false;
    });

    try {
      final dir = await _offlineSiteService.ensureBundleReady();
      await _localSiteServer.start(dir);
      await _configureWebView();
      if (!mounted) return;
      setState(() {
        _stage = AppStage.shell;
      });
      unawaited(_checkForUpdates());
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _stage = AppStage.login;
        _loginError = 'تعذر تجهيز النسخة المحلية من الموقع.';
      });
    }
  }

  Future<void> _configureWebView() async {
    final controller = WebViewController();
    _webViewController = controller;

    await controller.setJavaScriptMode(JavaScriptMode.unrestricted);
    await controller.enableZoom(false);

    if (await controller.supportsSetScrollBarsEnabled()) {
      await controller.setVerticalScrollBarEnabled(false);
      await controller.setHorizontalScrollBarEnabled(false);
    }
    await controller.setOverScrollMode(WebViewOverScrollMode.never);
    await controller.setUserAgent('FieldSiteApp/2.0 (Android; Mobile Offline)');

    await controller.setNavigationDelegate(
      NavigationDelegate(
        onNavigationRequest: (request) async {
          final uri = Uri.parse(request.url);

          if (_isLocalHost(uri) && uri.path == '/logout') {
            await _logoutUser();
            return NavigationDecision.prevent;
          }

          if (_isLocalHost(uri) && uri.path.startsWith('/admin')) {
            await _openExternalAdmin(path: uri.path, query: uri.query);
            return NavigationDecision.prevent;
          }

          if (!_isLocalHost(uri) && (uri.scheme == 'http' || uri.scheme == 'https')) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
            return NavigationDecision.prevent;
          }

          return NavigationDecision.navigate;
        },
        onPageStarted: (_) {
          if (!mounted) return;
          setState(() {
            _isLoadingPage = true;
            _progress = 0;
            _pageErrorMessage = null;
          });
        },
        onProgress: (value) {
          if (!mounted) return;
          setState(() {
            _progress = value;
          });
        },
        onPageFinished: (_) async {
          await controller.runJavaScript(_disableZoomJS);
          if (!mounted) return;
          setState(() {
            _isLoadingPage = false;
            _progress = 100;
          });
        },
        onWebResourceError: (error) {
          if (!mounted || error.isForMainFrame != true) return;
          setState(() {
            _isLoadingPage = false;
            _pageErrorMessage = error.description;
          });
        },
      ),
    );

    await controller.loadRequest(_localSiteServer.entryUri);
  }

  bool _isLocalHost(Uri uri) {
    return uri.host == '127.0.0.1' || uri.host == 'localhost';
  }

  Future<void> _handleLoginPressed() async {
    if (_isSubmittingLogin) return;

    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    if (username.isEmpty || password.isEmpty) {
      setState(() {
        _loginError = 'ادخل اسم المستخدم وكلمة المرور.';
      });
      return;
    }

    setState(() {
      _isSubmittingLogin = true;
      _loginError = null;
    });

    final result = await _authService.login(username: username, password: password);
    if (!mounted) return;

    switch (result.status) {
      case AuthLoginStatus.successUser:
        await _sessionStore.saveLogin(username);
        _passwordController.clear();
        if (mounted) {
          setState(() {
            _isSubmittingLogin = false;
          });
        }
        await _startShell();
        break;
      case AuthLoginStatus.adminAccount:
        await _openExternalAdmin(path: '/admin/login');
        setState(() {
          _isSubmittingLogin = false;
          _loginError =
              'حساب الإدارة يتم تشغيله أونلاين فقط في المتصفح الخارجي.';
        });
        break;
      case AuthLoginStatus.invalidCredentials:
        setState(() {
          _isSubmittingLogin = false;
          _loginError = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
        });
        break;
      case AuthLoginStatus.offline:
        setState(() {
          _isSubmittingLogin = false;
          _loginError = 'لا يوجد اتصال بالإنترنت. مطلوب اتصال لأول تسجيل.';
        });
        break;
      case AuthLoginStatus.failed:
        setState(() {
          _isSubmittingLogin = false;
          _loginError = result.message ?? 'فشل تسجيل الدخول.';
        });
        break;
    }
  }

  Future<void> _openExternalAdmin({
    required String path,
    String query = '',
  }) async {
    final uri = _siteUri.replace(path: path, query: query.isEmpty ? null : query);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _logoutUser() async {
    await _sessionStore.clearLogin();
    await _localSiteServer.stop();
    final online = await _authService.hasInternet();
    if (!mounted) return;
    setState(() {
      _stage = online ? AppStage.login : AppStage.offlineFirstLogin;
      _webViewController = null;
      _hasUpdate = false;
      _remoteVersion = null;
      _localVersion = null;
    });
  }

  Future<void> _retryFirstLoginConnectivity() async {
    setState(() {
      _stage = AppStage.booting;
    });
    final online = await _authService.hasInternet();
    if (!mounted) return;
    setState(() {
      _stage = online ? AppStage.login : AppStage.offlineFirstLogin;
    });
  }

  Future<void> _checkForUpdates() async {
    if (_stage != AppStage.shell || _checkingUpdate || _isApplyingUpdate) return;
    _checkingUpdate = true;
    try {
      final result = await _offlineSiteService.checkForUpdate();
      if (!mounted || _stage != AppStage.shell) return;
      setState(() {
        _hasUpdate = result.hasUpdate;
        _remoteVersion = result.remoteVersion;
        _localVersion = result.localVersion;
      });
    } finally {
      _checkingUpdate = false;
    }
  }

  Future<void> _applyUpdateNow() async {
    if (_isApplyingUpdate) return;
    setState(() {
      _isApplyingUpdate = true;
    });

    try {
      final remoteVersion = await _offlineSiteService.downloadAndApplyRemoteUpdate();
      if (!mounted) return;
      setState(() {
        _isApplyingUpdate = false;
        _hasUpdate = false;
        _localVersion = remoteVersion ?? _localVersion;
      });

      await _webViewController?.loadRequest(_localSiteServer.entryUri);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isApplyingUpdate = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('فشل تنزيل التحديث. تأكد من الإنترنت وحاول مرة أخرى.'),
        ),
      );
    }
  }

  Future<void> _handleBackPress() async {
    if (_stage != AppStage.shell) {
      await SystemNavigator.pop();
      return;
    }

    final controller = _webViewController;
    if (controller == null) {
      await SystemNavigator.pop();
      return;
    }

    if (await controller.canGoBack()) {
      await controller.goBack();
      return;
    }
    await SystemNavigator.pop();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _usernameController.dispose();
    _passwordController.dispose();
    unawaited(_localSiteServer.stop());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_showSplash) {
      return SplashScreen(
        onSplashEnd: () {
          if (!mounted) return;
          setState(() {
            _showSplash = false;
          });
        },
      );
    }

    if (kIsWeb) {
      return _buildWebRedirectScreen();
    }

    switch (_stage) {
      case AppStage.booting:
        return _buildBootingScreen();
      case AppStage.login:
        return _buildLoginScreen();
      case AppStage.offlineFirstLogin:
        return _buildOfflineFirstLoginScreen();
      case AppStage.shell:
        return _buildShellScreen();
    }
  }

  Widget _buildWebRedirectScreen() {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(strokeWidth: 3),
                const SizedBox(height: 16),
                const Text(
                  'Redirecting to site...',
                  style: TextStyle(
                    color: Colors.black87,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => redirectToSite(_siteUri.toString()),
                  child: const Text('Open now'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBootingScreen() {
    return const Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(strokeWidth: 3),
            SizedBox(height: 14),
            Text(
              'جاري تجهيز التطبيق...',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOfflineFirstLoginScreen() {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.wifi_off_rounded, size: 54, color: Colors.black54),
                const SizedBox(height: 14),
                const Text(
                  'مطلوب اتصال بالإنترنت لأول تسجيل دخول',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'بعد أول تسجيل، سيتم تشغيل الموقع محليًا داخل التطبيق حتى بدون إنترنت.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.black54),
                ),
                const SizedBox(height: 18),
                ElevatedButton(
                  onPressed: _retryFirstLoginConnectivity,
                  child: const Text('إعادة المحاولة'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginScreen() {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFD6DFEA)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 14,
                      offset: Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'تسجيل الدخول',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'الدخول بحساب المستخدم لتشغيل النسخة الأوفلاين',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.black54, fontSize: 13),
                    ),
                    const SizedBox(height: 18),
                    TextField(
                      controller: _usernameController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'اسم المستخدم',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _passwordController,
                      obscureText: true,
                      onSubmitted: (_) => _handleLoginPressed(),
                      decoration: const InputDecoration(
                        labelText: 'كلمة المرور',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    if (_loginError != null) ...[
                      const SizedBox(height: 10),
                      Text(
                        _loginError!,
                        style: const TextStyle(
                          color: Colors.redAccent,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _isSubmittingLogin ? null : _handleLoginPressed,
                      child: Text(_isSubmittingLogin ? 'جارٍ التحقق...' : 'دخول'),
                    ),
                    TextButton(
                      onPressed: () => _openExternalAdmin(path: '/admin/login'),
                      child: const Text('لوحة الإدارة (أونلاين فقط)'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildShellScreen() {
    final controller = _webViewController;
    if (controller == null) {
      return _buildBootingScreen();
    }

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) return;
          _handleBackPress();
        },
        child: Scaffold(
          backgroundColor: Colors.white,
          body: Stack(
            children: [
              Positioned.fill(child: WebViewWidget(controller: controller)),
              if (_isLoadingPage && _pageErrorMessage == null)
                Positioned.fill(
                  child: ColoredBox(
                    color: Colors.white,
                    child: SafeArea(
                      top: true,
                      bottom: false,
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const CircularProgressIndicator(strokeWidth: 3),
                            const SizedBox(height: 14),
                            const Text(
                              'جاري تحميل الموقع...',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '$_progress%',
                              style: const TextStyle(color: Colors.black54),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              if (_pageErrorMessage != null)
                Positioned.fill(
                  child: ColoredBox(
                    color: Colors.white,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'تعذر عرض الصفحة المحلية',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _pageErrorMessage!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.black54),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: () async {
                                setState(() {
                                  _isLoadingPage = true;
                                  _progress = 0;
                                  _pageErrorMessage = null;
                                });
                                await controller.loadRequest(_localSiteServer.entryUri);
                              },
                              child: const Text('إعادة المحاولة'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              if (_hasUpdate || _isApplyingUpdate)
                Positioned(
                  left: 12,
                  right: 12,
                  top: MediaQuery.paddingOf(context).top + 10,
                  child: Material(
                    color: Colors.transparent,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: const Color(0xFFD6DFEA)),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x22000000),
                            blurRadius: 12,
                            offset: Offset(0, 5),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'يوجد تحديث جديد للموقع',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'الحالية: ${_localVersion ?? '-'} | الجديدة: ${_remoteVersion ?? '-'}',
                            style: const TextStyle(color: Colors.black54, fontSize: 12),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              ElevatedButton(
                                onPressed: _isApplyingUpdate ? null : _applyUpdateNow,
                                child: Text(
                                  _isApplyingUpdate ? 'جارٍ التحديث...' : 'تحديث الآن',
                                ),
                              ),
                              const SizedBox(width: 8),
                              TextButton(
                                onPressed: _isApplyingUpdate
                                    ? null
                                    : () {
                                        setState(() {
                                          _hasUpdate = false;
                                        });
                                      },
                                child: const Text('لاحقًا'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
