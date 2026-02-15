import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const FieldSiteApp());
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

class _FieldSiteShellPageState extends State<FieldSiteShellPage> {
  static final Uri _siteUri = Uri.parse('https://atlas.geotools.workers.dev');

  late final WebViewController _webViewController;
  int _progress = 0;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _webViewController =
        WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setNavigationDelegate(
            NavigationDelegate(
              onPageStarted: (_) {
                if (!mounted) return;
                setState(() {
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
                });
              },
              onWebResourceError: (error) {
                if (!mounted) return;
                setState(() {
                  _errorMessage = error.description;
                });
              },
            ),
          )
          ..loadRequest(_siteUri);
  }

  Future<void> _handleBackPress() async {
    if (await _webViewController.canGoBack()) {
      await _webViewController.goBack();
      return;
    }

    await SystemNavigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBackPress();
      },
      child: Scaffold(
        body: Stack(
          children: [
            Positioned.fill(child: WebViewWidget(controller: _webViewController)),
            if (_progress < 100)
              const Align(
                alignment: Alignment.topCenter,
                child: LinearProgressIndicator(minHeight: 2),
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
                            'تعذر تحميل الصفحة',
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
                                _errorMessage = null;
                              });
                              _webViewController.reload();
                            },
                            child: const Text('إعادة المحاولة'),
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
    );
  }
}
