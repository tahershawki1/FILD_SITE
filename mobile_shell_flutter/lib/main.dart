import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  _applySystemUiStyle();
  runApp(const FieldSiteApp());
}

void _applySystemUiStyle() {
  SystemChrome.setEnabledSystemUIMode(
    SystemUiMode.manual,
    overlays: <SystemUiOverlay>[SystemUiOverlay.top, SystemUiOverlay.bottom],
  );

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.black,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
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
  static final Uri _siteUri = Uri.parse('https://atlas.geotools.workers.dev');

  WebViewController? _webViewController;
  bool _isLoading = true;
  int _progress = 0;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _applySystemUiStyle();

    if (kIsWeb) {
      _isLoading = false;
      return;
    }

    _webViewController = WebViewController();
    _configureWebView();
  }

  Future<void> _configureWebView() async {
    final controller = _webViewController;
    if (controller == null) return;

    await controller.setJavaScriptMode(JavaScriptMode.unrestricted);

    if (await controller.supportsSetScrollBarsEnabled()) {
      await controller.setVerticalScrollBarEnabled(false);
      await controller.setHorizontalScrollBarEnabled(false);
    }

    await controller.setOverScrollMode(WebViewOverScrollMode.never);

    await controller.setNavigationDelegate(
      NavigationDelegate(
        onPageStarted: (_) {
          if (!mounted) return;
          setState(() {
            _isLoading = true;
            _progress = 0;
            _errorMessage = null;
          });
        },
        onProgress: (value) {
          if (!mounted) return;
          setState(() {
            _progress = value;
          });
        },
        onPageFinished: (_) {
          if (!mounted) return;
          setState(() {
            _progress = 100;
            _isLoading = false;
          });
        },
        onWebResourceError: (error) {
          if (!mounted || error.isForMainFrame != true) return;
          setState(() {
            _isLoading = false;
            _errorMessage = error.description;
          });
        },
      ),
    );

    await controller.loadRequest(_siteUri);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _applySystemUiStyle();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _handleBackPress() async {
    final controller = _webViewController;
    if (controller == null) return;

    if (await controller.canGoBack()) {
      await controller.goBack();
      return;
    }

    await SystemNavigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return const Scaffold(
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'This app shell is for Android/iOS only.',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: 10),
                  Text(
                    'Run on a phone or emulator to use WebView.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final controller = _webViewController;
    if (controller == null) {
      return const SizedBox.shrink();
    }

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: Colors.black,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) return;
          _handleBackPress();
        },
        child: Scaffold(
          body: Stack(
            children: [
              Positioned.fill(child: WebViewWidget(controller: controller)),
              if (_isLoading && _errorMessage == null)
                Positioned.fill(
                  child: ColoredBox(
                    color: const Color(0xFF0A1020),
                    child: SafeArea(
                      top: true,
                      bottom: false,
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const CircularProgressIndicator(strokeWidth: 3),
                              const SizedBox(height: 16),
                              const Text(
                                'Loading site...',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '$_progress%',
                                style: const TextStyle(color: Colors.white70),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              if (_errorMessage != null)
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
                              'Failed to load page',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _errorMessage!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.black54),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: () {
                                setState(() {
                                  _isLoading = true;
                                  _progress = 0;
                                  _errorMessage = null;
                                });
                                controller.reload();
                              },
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
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
