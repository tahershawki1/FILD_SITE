import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import '../app_config.dart';
import 'session_store.dart';

class UpdateCheckResult {
  const UpdateCheckResult({
    required this.hasUpdate,
    this.localVersion,
    this.remoteVersion,
  });

  final bool hasUpdate;
  final String? localVersion;
  final String? remoteVersion;
}

class OfflineSiteService {
  OfflineSiteService({
    Uri? siteUri,
    SessionStore? sessionStore,
  })  : _siteUri = siteUri ?? Uri.parse(AppConfig.siteUrl),
        _sessionStore = sessionStore ?? SessionStore();

  final Uri _siteUri;
  final SessionStore _sessionStore;

  Future<Directory> ensureBundleReady() async {
    final dir = await _bundleDir();
    final indexFile = _fileFor(dir, 'index.html');
    if (await indexFile.exists()) {
      return dir;
    }

    await _seedFromBundledAssets(dir);
    final seededVersion = await readLocalVersion();
    if (seededVersion != null && seededVersion.isNotEmpty) {
      await _sessionStore.setLocalVersion(seededVersion);
    }
    return dir;
  }

  Future<String?> readLocalVersion() async {
    final dir = await _bundleDir();
    final versionFile = _fileFor(dir, 'version.json');
    if (await versionFile.exists()) {
      try {
        final text = await versionFile.readAsString();
        final decoded = jsonDecode(text);
        if (decoded is Map<String, dynamic>) {
          final version = decoded['version']?.toString().trim();
          if (version != null && version.isNotEmpty) return version;
        }
      } catch (_) {
        // Fall back to shared preferences key.
      }
    }
    return _sessionStore.localVersion();
  }

  Future<String?> fetchRemoteVersion() async {
    try {
      final url = _siteUri.replace(path: '/version.json');
      final response = await http.get(url, headers: const <String, String>{
        'Cache-Control': 'no-store',
      });
      if (response.statusCode != 200) return null;
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is! Map<String, dynamic>) return null;
      final version = decoded['version']?.toString().trim();
      if (version == null || version.isEmpty) return null;
      return version;
    } catch (_) {
      return null;
    }
  }

  Future<UpdateCheckResult> checkForUpdate() async {
    final local = await readLocalVersion();
    final remote = await fetchRemoteVersion();
    if (remote == null || remote.isEmpty) {
      return UpdateCheckResult(
        hasUpdate: false,
        localVersion: local,
        remoteVersion: remote,
      );
    }

    if (local == null || local.isEmpty) {
      return UpdateCheckResult(
        hasUpdate: true,
        localVersion: local,
        remoteVersion: remote,
      );
    }

    return UpdateCheckResult(
      hasUpdate: local != remote,
      localVersion: local,
      remoteVersion: remote,
    );
  }

  Future<String?> downloadAndApplyRemoteUpdate() async {
    final dir = await _bundleDir();
    final staging = Directory('${dir.path}_staging');
    if (await staging.exists()) {
      await staging.delete(recursive: true);
    }
    await staging.create(recursive: true);

    final client = http.Client();
    String? remoteVersion;
    try {
      for (final relativePath in AppConfig.syncedFiles) {
        final uri = _siteUri.replace(path: '/$relativePath');
        final response = await client.get(uri, headers: const <String, String>{
          'Cache-Control': 'no-store',
        });

        if (response.statusCode != 200) {
          throw HttpException('Failed to download $relativePath (${response.statusCode})');
        }

        final target = _fileFor(staging, relativePath);
        await target.parent.create(recursive: true);
        await target.writeAsBytes(response.bodyBytes, flush: true);

        if (relativePath == 'version.json') {
          try {
            final decoded = jsonDecode(utf8.decode(response.bodyBytes));
            if (decoded is Map<String, dynamic>) {
              remoteVersion = decoded['version']?.toString();
            }
          } catch (_) {
            remoteVersion = null;
          }
        }
      }

      for (final relativePath in AppConfig.syncedFiles) {
        final source = _fileFor(staging, relativePath);
        final target = _fileFor(dir, relativePath);
        await target.parent.create(recursive: true);
        await source.copy(target.path);
      }

      final trimmedRemoteVersion = remoteVersion?.trim();
      if (trimmedRemoteVersion != null && trimmedRemoteVersion.isNotEmpty) {
        await _sessionStore.setLocalVersion(trimmedRemoteVersion);
      }
      return trimmedRemoteVersion;
    } finally {
      client.close();
      if (await staging.exists()) {
        await staging.delete(recursive: true);
      }
    }
  }

  Future<Directory> _bundleDir() async {
    final root = await getApplicationSupportDirectory();
    final dir = Directory('${root.path}${Platform.pathSeparator}${AppConfig.localSiteDirName}');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  Future<void> _seedFromBundledAssets(Directory targetDir) async {
    for (final relativePath in AppConfig.syncedFiles) {
      final assetPath = '${AppConfig.bundledSiteAssetPrefix}/$relativePath';
      final bytes = await rootBundle.load(assetPath);
      final target = _fileFor(targetDir, relativePath);
      await target.parent.create(recursive: true);
      await target.writeAsBytes(bytes.buffer.asUint8List(), flush: true);
    }
  }

  File _fileFor(Directory root, String relativePath) {
    final normalized = relativePath.replaceAll('/', Platform.pathSeparator);
    return File('${root.path}${Platform.pathSeparator}$normalized');
  }
}
