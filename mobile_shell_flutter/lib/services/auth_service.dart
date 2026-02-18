import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';

import '../app_config.dart';

enum AuthLoginStatus {
  successUser,
  adminAccount,
  invalidCredentials,
  offline,
  failed,
}

class AuthLoginResult {
  const AuthLoginResult({
    required this.status,
    this.message,
  });

  final AuthLoginStatus status;
  final String? message;

  bool get isSuccessUser => status == AuthLoginStatus.successUser;
}

class AuthService {
  AuthService({Uri? siteUri}) : _siteUri = siteUri ?? Uri.parse(AppConfig.siteUrl);

  final Uri _siteUri;

  Future<bool> hasInternet() async {
    final raw = await Connectivity().checkConnectivity();
    final hasConnectivity = _hasConnectivity(raw);
    if (!hasConnectivity) return false;

    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final request = await client.getUrl(_siteUri.replace(path: '/version.json'));
      request.followRedirects = false;
      final response = await request.close();
      await response.drain<void>();
      return response.statusCode >= 200 && response.statusCode < 500;
    } catch (_) {
      return false;
    } finally {
      client.close(force: true);
    }
  }

  Future<AuthLoginResult> login({
    required String username,
    required String password,
  }) async {
    final trimmedUsername = username.trim();
    if (trimmedUsername.isEmpty || password.isEmpty) {
      return const AuthLoginResult(
        status: AuthLoginStatus.failed,
        message: 'ادخل اسم المستخدم وكلمة المرور.',
      );
    }

    if (!await hasInternet()) {
      return const AuthLoginResult(status: AuthLoginStatus.offline);
    }

    final client = HttpClient()..connectionTimeout = const Duration(seconds: 12);
    try {
      final csrfToken = await _fetchLoginCsrfToken(client);
      if (csrfToken == null) {
        return const AuthLoginResult(
          status: AuthLoginStatus.failed,
          message: 'تعذر قراءة رمز الأمان من الخادم.',
        );
      }

      final loginResponse = await _submitLogin(
        client: client,
        username: trimmedUsername,
        password: password,
        csrfToken: csrfToken,
      );

      final statusCode = loginResponse.statusCode;
      final location = loginResponse.headers.value(HttpHeaders.locationHeader) ?? '';
      final appCookie = _extractCookie(
        loginResponse.headers[HttpHeaders.setCookieHeader] ?? const <String>[],
        AppConfig.appSessionCookie,
      );
      await loginResponse.drain<void>();

      if (statusCode != 302 || appCookie == null || location.startsWith('/login')) {
        return const AuthLoginResult(status: AuthLoginStatus.invalidCredentials);
      }

      final isAdmin = await _isAdminSession(client, appCookie);
      if (isAdmin) {
        return const AuthLoginResult(status: AuthLoginStatus.adminAccount);
      }

      return const AuthLoginResult(status: AuthLoginStatus.successUser);
    } on SocketException {
      return const AuthLoginResult(status: AuthLoginStatus.offline);
    } catch (_) {
      return const AuthLoginResult(
        status: AuthLoginStatus.failed,
        message: 'حدث خطأ أثناء تسجيل الدخول.',
      );
    } finally {
      client.close(force: true);
    }
  }

  Future<String?> _fetchLoginCsrfToken(HttpClient client) async {
    final request = await client.getUrl(_siteUri.replace(path: '/login'));
    request.followRedirects = false;
    final response = await request.close();
    final body = await utf8.decodeStream(response);

    final token = _matchCsrfToken(body);
    if (token != null && token.isNotEmpty) return token;
    return null;
  }

  Future<HttpClientResponse> _submitLogin({
    required HttpClient client,
    required String username,
    required String password,
    required String csrfToken,
  }) async {
    final request = await client.postUrl(_siteUri.replace(path: '/login'));
    request.followRedirects = false;
    request.headers.set(
      HttpHeaders.contentTypeHeader,
      'application/x-www-form-urlencoded; charset=UTF-8',
    );

    final body = <String, String>{
      '_csrf': csrfToken,
      'next': '/',
      'username': username,
      'password': password,
    }.entries.map((entry) {
      return '${Uri.encodeQueryComponent(entry.key)}=${Uri.encodeQueryComponent(entry.value)}';
    }).join('&');

    request.write(body);
    return request.close();
  }

  Future<bool> _isAdminSession(HttpClient client, Cookie appCookie) async {
    final request = await client.getUrl(_siteUri.replace(path: '/admin'));
    request.followRedirects = false;
    request.headers.set(HttpHeaders.cookieHeader, '${appCookie.name}=${appCookie.value}');
    final response = await request.close();
    final location = response.headers.value(HttpHeaders.locationHeader) ?? '';
    await response.drain<void>();

    if (response.statusCode == 200) return true;
    if (response.statusCode == 302 && location.startsWith('/admin/login')) return false;
    return false;
  }

  Cookie? _extractCookie(List<String> rawSetCookies, String targetName) {
    for (final raw in rawSetCookies) {
      try {
        final cookie = Cookie.fromSetCookieValue(raw);
        if (cookie.name == targetName) return cookie;
      } catch (_) {
        continue;
      }
    }
    return null;
  }

  String? _matchCsrfToken(String html) {
    final patterns = <RegExp>[
      RegExp(r'name="_csrf"\s+value="([^"]+)"'),
      RegExp(r'value="([^"]+)"\s+name="_csrf"'),
      RegExp(r"name='_csrf'\s+value='([^']+)'"),
      RegExp(r"value='([^']+)'\s+name='_csrf'"),
    ];
    for (final pattern in patterns) {
      final match = pattern.firstMatch(html);
      if (match == null) continue;
      for (var i = 1; i <= match.groupCount; i++) {
        final token = match.group(i);
        if (token != null && token.isNotEmpty) return token;
      }
    }
    return null;
  }

  bool _hasConnectivity(Object connectivityState) {
    if (connectivityState is ConnectivityResult) {
      return connectivityState != ConnectivityResult.none;
    }
    if (connectivityState is List<ConnectivityResult>) {
      if (connectivityState.isEmpty) return false;
      return connectivityState.any((result) => result != ConnectivityResult.none);
    }
    return false;
  }
}
