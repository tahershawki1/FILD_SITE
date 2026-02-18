import 'dart:convert';
import 'dart:io';

class LocalSiteServer {
  static const String _appStatePath = '/__app_state';
  static const String _appStateFileName = '__app_state.json';

  HttpServer? _server;
  Directory? _rootDirectory;
  File? _appStateFile;
  String _appStateJson = '{}';

  Uri get entryUri {
    final server = _server;
    if (server == null) {
      throw StateError('Server is not started.');
    }
    return Uri.parse('http://127.0.0.1:${server.port}/index.html');
  }

  Future<void> start(Directory rootDirectory) async {
    if (_server != null) return;
    _rootDirectory = rootDirectory;
    _appStateFile = File(
      '${rootDirectory.path}${Platform.pathSeparator}$_appStateFileName',
    );
    await _loadAppStateFromDisk();
    _server = await HttpServer.bind(
      InternetAddress.loopbackIPv4,
      0,
      shared: true,
    );
    _server!.listen(_handleRequest, onError: (_, __) {});
  }

  Future<void> stop() async {
    final server = _server;
    _server = null;
    _rootDirectory = null;
    _appStateFile = null;
    _appStateJson = '{}';
    await server?.close(force: true);
  }

  Future<void> _handleRequest(HttpRequest request) async {
    final root = _rootDirectory;
    if (root == null) {
      request.response.statusCode = HttpStatus.serviceUnavailable;
      await request.response.close();
      return;
    }

    if (request.uri.path == _appStatePath) {
      await _handleAppStateRequest(request);
      return;
    }

    if (request.method != 'GET' && request.method != 'HEAD') {
      request.response.statusCode = HttpStatus.methodNotAllowed;
      await request.response.close();
      return;
    }

    var relativePath = request.uri.path;
    if (relativePath == '/' || relativePath.isEmpty) {
      relativePath = '/index.html';
    }
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.substring(1);
    }
    relativePath = Uri.decodeComponent(relativePath).replaceAll('\\', '/');
    if (relativePath.contains('..')) {
      request.response.statusCode = HttpStatus.forbidden;
      await request.response.close();
      return;
    }

    final file = File(
      '${root.path}${Platform.pathSeparator}${relativePath.replaceAll('/', Platform.pathSeparator)}',
    );

    if (!await file.exists()) {
      request.response.statusCode = HttpStatus.notFound;
      request.response.headers.contentType = ContentType.text;
      request.response.write('Not found');
      await request.response.close();
      return;
    }

    final mimeType = _contentTypeFor(relativePath);
    if (mimeType != null) {
      request.response.headers.contentType = mimeType;
    }
    request.response.headers.set(HttpHeaders.cacheControlHeader, 'no-store');

    if (request.method == 'HEAD') {
      await request.response.close();
      return;
    }

    final lowerPath = relativePath.toLowerCase();
    if (lowerPath.endsWith('.html')) {
      final html = await file.readAsString();
      final injected = _injectFlutterMarker(html);
      request.response.headers.contentType = ContentType(
        'text',
        'html',
        charset: 'utf-8',
      );
      request.response.write(injected);
      await request.response.close();
      return;
    }

    final bytes = await file.readAsBytes();
    request.response.add(bytes);
    await request.response.close();
  }

  String _injectFlutterMarker(String html) {
    const marker = '<script>window.__FIELD_APP_MODE = "flutter";</script>';
    if (html.contains('window.__FIELD_APP_MODE')) {
      return html;
    }
    if (html.contains('</head>')) {
      return html.replaceFirst('</head>', '$marker\n</head>');
    }
    return '$marker\n$html';
  }

  Future<void> _handleAppStateRequest(HttpRequest request) async {
    if (request.method == 'GET' || request.method == 'HEAD') {
      request.response.headers.contentType = ContentType(
        'application',
        'json',
        charset: 'utf-8',
      );
      request.response.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
      if (request.method == 'GET') {
        request.response.write(_appStateJson);
      }
      await request.response.close();
      return;
    }

    if (request.method == 'POST') {
      final rawBody = await utf8.decoder.bind(request).join();
      final normalized = _normalizeStateJson(rawBody);
      _appStateJson = normalized;
      await _persistAppStateToDisk();
      request.response.statusCode = HttpStatus.noContent;
      await request.response.close();
      return;
    }

    request.response.statusCode = HttpStatus.methodNotAllowed;
    await request.response.close();
  }

  Future<void> _loadAppStateFromDisk() async {
    final stateFile = _appStateFile;
    if (stateFile == null || !await stateFile.exists()) {
      _appStateJson = '{}';
      return;
    }
    try {
      final raw = await stateFile.readAsString();
      _appStateJson = _normalizeStateJson(raw);
    } catch (_) {
      _appStateJson = '{}';
    }
  }

  Future<void> _persistAppStateToDisk() async {
    final stateFile = _appStateFile;
    if (stateFile == null) return;
    try {
      await stateFile.writeAsString(_appStateJson, flush: true);
    } catch (_) {
      // Ignore disk persistence failures; in-memory state remains available.
    }
  }

  String _normalizeStateJson(String raw) {
    if (raw.trim().isEmpty) return '{}';
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return jsonEncode(decoded);
      }
      if (decoded is Map) {
        return jsonEncode(decoded);
      }
    } catch (_) {
      // Fallback below.
    }
    return '{}';
  }

  ContentType? _contentTypeFor(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.html')) {
      return ContentType('text', 'html', charset: 'utf-8');
    }
    if (lower.endsWith('.css')) {
      return ContentType('text', 'css', charset: 'utf-8');
    }
    if (lower.endsWith('.js')) {
      return ContentType('text', 'javascript', charset: 'utf-8');
    }
    if (lower.endsWith('.json')) {
      return ContentType('application', 'json', charset: 'utf-8');
    }
    if (lower.endsWith('.png')) {
      return ContentType('image', 'png');
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return ContentType('image', 'jpeg');
    }
    if (lower.endsWith('.svg')) {
      return ContentType('image', 'svg+xml');
    }
    if (lower.endsWith('.ico')) {
      return ContentType('image', 'x-icon');
    }
    return null;
  }
}
