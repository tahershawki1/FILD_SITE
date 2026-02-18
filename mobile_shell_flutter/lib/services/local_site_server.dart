import 'dart:io';

class LocalSiteServer {
  HttpServer? _server;
  Directory? _rootDirectory;

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
    _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0, shared: true);
    _server!.listen(_handleRequest, onError: (_, __) {});
  }

  Future<void> stop() async {
    final server = _server;
    _server = null;
    _rootDirectory = null;
    await server?.close(force: true);
  }

  Future<void> _handleRequest(HttpRequest request) async {
    final root = _rootDirectory;
    if (root == null) {
      request.response.statusCode = HttpStatus.serviceUnavailable;
      await request.response.close();
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

    final bytes = await file.readAsBytes();
    request.response.add(bytes);
    await request.response.close();
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
