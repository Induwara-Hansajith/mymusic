import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'storage_service.dart';

enum UpdateStatus {
  idle,
  checking,
  available,
  downloading,
  downloaded,
  upToDate,
  error,
}

class AndroidReleaseInfo {
  final String version;
  final String tagName;
  final String releaseName;
  final String downloadUrl;
  final String assetName;
  final int sizeBytes;
  final String notes;
  final String htmlUrl;

  const AndroidReleaseInfo({
    required this.version,
    required this.tagName,
    required this.releaseName,
    required this.downloadUrl,
    required this.assetName,
    required this.sizeBytes,
    required this.notes,
    required this.htmlUrl,
  });
}

class AppUpdateService extends ChangeNotifier {
  static final AppUpdateService _instance = AppUpdateService._internal();
  factory AppUpdateService() => _instance;
  AppUpdateService._internal();

  static const MethodChannel _native = MethodChannel('com.induw.mymusic/native');
  static const String releasesApi =
      'https://api.github.com/repos/Induwara-Hansajith/mymusic/releases?per_page=10';
  static const String _pendingKey = 'mymusic_pending_apk_dl';

  final http.Client _http = http.Client();
  final StorageService _storage = StorageService();

  String _currentVersion = '1.1.9';
  int _currentVersionCode = 120;
  UpdateStatus _status = UpdateStatus.idle;
  AndroidReleaseInfo? _availableRelease;
  double _progress = 0.0;
  int _bytesDownloaded = 0;
  int _bytesTotal = 0;
  String? _downloadedApkPath;
  String? _errorMessage;
  bool _lastCheckManual = false;
  bool _promptShownForReady = false;
  int? _activeDownloadId;

  Timer? _pollTimer;
  Timer? _periodicTimer;
  bool _initialized = false;

  String get currentVersion => _currentVersion;
  int get currentVersionCode => _currentVersionCode;
  UpdateStatus get status => _status;
  AndroidReleaseInfo? get availableRelease => _availableRelease;
  double get progress => _progress;
  int get bytesDownloaded => _bytesDownloaded;
  int get bytesTotal => _bytesTotal;
  String? get downloadedApkPath => _downloadedApkPath;
  String? get errorMessage => _errorMessage;
  bool get lastCheckManual => _lastCheckManual;
  bool get autoUpdateEnabled => _storage.getSettingsMap()['autoUpdate'] != false;

  static bool isNewerVersion(String remote, String local) {
    final pRemote = remote
        .replaceAll(RegExp(r'^[^\d]*'), '')
        .split('+')
        .first
        .split('.')
        .map((n) => int.tryParse(n) ?? 0)
        .toList();
    final pLocal = local
        .replaceAll(RegExp(r'^[^\d]*'), '')
        .split('+')
        .first
        .split('.')
        .map((n) => int.tryParse(n) ?? 0)
        .toList();
    final len = pRemote.length > pLocal.length ? pRemote.length : pLocal.length;
    for (int i = 0; i < len; i++) {
      final r = i < pRemote.length ? pRemote[i] : 0;
      final l = i < pLocal.length ? pLocal[i] : 0;
      if (r > l) return true;
      if (r < l) return false;
    }
    return false;
  }

  static AndroidReleaseInfo? parseLatestMobileRelease(List<dynamic> releases) {
    for (final raw in releases) {
      if (raw is! Map) continue;
      if (raw['draft'] == true) continue;
      final assets = raw['assets'] as List? ?? [];
      for (final assetRaw in assets) {
        if (assetRaw is! Map) continue;
        final name = assetRaw['name']?.toString() ?? '';
        if (!name.toLowerCase().endsWith('.apk')) continue;
        final m = RegExp(r'([0-9]+\.[0-9]+\.[0-9]+)').firstMatch(name) ??
            RegExp(r'([0-9]+\.[0-9]+\.[0-9]+)')
                .firstMatch(raw['name']?.toString() ?? '');
        if (m == null) continue;
        final url = assetRaw['browser_download_url']?.toString() ?? '';
        if (url.isEmpty) continue;
        return AndroidReleaseInfo(
          version: m.group(1)!,
          tagName: raw['tag_name']?.toString() ?? '',
          releaseName: raw['name']?.toString() ?? 'Build ${m.group(1)!}',
          downloadUrl: url,
          assetName: name,
          sizeBytes: (assetRaw['size'] as num?)?.toInt() ?? 0,
          notes: raw['body']?.toString() ?? '',
          htmlUrl: raw['html_url']?.toString() ?? '',
        );
      }
    }
    return null;
  }

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    try {
      final info = await _native.invokeMapMethod<String, dynamic>('getAppVersion');
      if (info != null) {
        final v = info['versionName']?.toString() ?? '';
        if (v.isNotEmpty) _currentVersion = v.split('+').first;
        _currentVersionCode = (info['versionCode'] as num?)?.toInt() ?? _currentVersionCode;
      }
    } catch (_) {}

    await _reconcilePendingDownload();

    _periodicTimer?.cancel();
    _periodicTimer = Timer.periodic(const Duration(hours: 6), (_) {
      if (autoUpdateEnabled) {
        checkForUpdate(manual: false);
      }
    });

    if (autoUpdateEnabled) {
      Future.delayed(const Duration(seconds: 5), () {
        if (autoUpdateEnabled && _status == UpdateStatus.idle) {
          checkForUpdate(manual: false);
        }
      });
    }
  }

  Future<void> setAutoUpdate(bool enabled) async {
    await _storage.patchSettings({'autoUpdate': enabled});
    notifyListeners();
    if (enabled && _status == UpdateStatus.idle) {
      await checkForUpdate(manual: false);
    }
  }

  Future<void> deferUpdate(String version) async {
    await _storage.patchSettings({'updateDeferredVersion': version});
    _promptShownForReady = true;
    notifyListeners();
  }

  bool consumeReadyPromptFlag() {
    if (_promptShownForReady) return false;
    _promptShownForReady = true;
    return true;
  }

  Future<void> _reconcilePendingDownload() async {
    try {
      final raw = _storage.prefs.getString(_pendingKey);
      if (raw == null || raw.isEmpty) return;
      final map = jsonDecode(raw) as Map<String, dynamic>;
      final dlId = (map['downloadId'] as num?)?.toInt();
      final ver = map['version']?.toString() ?? '';
      final destPath = map['destPath']?.toString() ?? '';
      final sizeBytes = (map['sizeBytes'] as num?)?.toInt() ?? 0;

      if (dlId == null || ver.isEmpty || !isNewerVersion(ver, _currentVersion)) {
        await _storage.prefs.remove(_pendingKey);
        return;
      }

      final q = await _native.invokeMapMethod<String, dynamic>(
        'queryDownload',
        {'downloadId': dlId},
      );
      final st = q?['status']?.toString() ?? 'unknown';
      if (st == 'successful' && await _isValidApkFile(destPath, minExpectedSize: sizeBytes)) {
        _downloadedApkPath = destPath;
        _availableRelease = AndroidReleaseInfo(
          version: ver,
          tagName: map['tagName']?.toString() ?? '',
          releaseName: 'Build $ver',
          downloadUrl: map['downloadUrl']?.toString() ?? '',
          assetName: map['assetName']?.toString() ?? 'My.Music.Mobile.$ver.full.apk',
          sizeBytes: sizeBytes,
          notes: '',
          htmlUrl: '',
        );
        _progress = 1.0;
        _status = UpdateStatus.downloaded;
        notifyListeners();
      } else if (st == 'pending' || st == 'running' || st == 'paused') {
        _activeDownloadId = dlId;
        _downloadedApkPath = destPath;
        _availableRelease = AndroidReleaseInfo(
          version: ver,
          tagName: map['tagName']?.toString() ?? '',
          releaseName: 'Build $ver',
          downloadUrl: map['downloadUrl']?.toString() ?? '',
          assetName: map['assetName']?.toString() ?? 'My.Music.Mobile.$ver.full.apk',
          sizeBytes: sizeBytes,
          notes: '',
          htmlUrl: '',
        );
        _status = UpdateStatus.downloading;
        _startDownloadPolling(dlId, destPath, sizeBytes, ver);
        notifyListeners();
      } else {
        await _storage.prefs.remove(_pendingKey);
      }
    } catch (_) {}
  }

  Future<bool> _isValidApkFile(String path, {int minExpectedSize = 0}) async {
    if (path.isEmpty) return false;
    final f = File(path);
    if (!await f.exists()) return false;
    final len = await f.length();
    if (len < 1024 * 1024) return false;
    if (minExpectedSize > 0 && len != minExpectedSize) return false;
    // Verify ZIP/APK header magic bytes ('PK')
    final raf = await f.open();
    try {
      final header = await raf.read(2);
      return header.length == 2 && header[0] == 0x50 && header[1] == 0x4B;
    } finally {
      await raf.close();
    }
  }

  Future<void> checkForUpdate({bool manual = true}) async {
    if (_status == UpdateStatus.checking || _status == UpdateStatus.downloading) {
      return;
    }

    _lastCheckManual = manual;
    if (manual) {
      await _storage.patchSettings({'updateDeferredVersion': ''});
      _promptShownForReady = false;
    }

    _status = UpdateStatus.checking;
    _errorMessage = null;
    notifyListeners();

    try {
      final resp = await _http.get(
        Uri.parse(releasesApi),
        headers: const {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'MyMusic-Android-Updater',
        },
      ).timeout(const Duration(seconds: 10));

      if (resp.statusCode != 200) {
        throw Exception('GitHub API HTTP ${resp.statusCode}');
      }

      final decoded = jsonDecode(resp.body);
      if (decoded is! List) {
        throw Exception('Unexpected GitHub releases payload');
      }

      final latest = parseLatestMobileRelease(decoded);
      if (latest == null || !isNewerVersion(latest.version, _currentVersion)) {
        _availableRelease = null;
        _status = UpdateStatus.upToDate;
        notifyListeners();
        return;
      }

      final deferred = _storage.getSettingsMap()['updateDeferredVersion'] as String? ?? '';
      if (!manual && deferred.isNotEmpty && deferred == latest.version) {
        _availableRelease = latest;
        _status = UpdateStatus.idle;
        notifyListeners();
        return;
      }

      // Already downloaded and verified on disk?
      if (_downloadedApkPath != null &&
          _availableRelease?.version == latest.version &&
          await _isValidApkFile(_downloadedApkPath!, minExpectedSize: latest.sizeBytes)) {
        _status = UpdateStatus.downloaded;
        _progress = 1.0;
        notifyListeners();
        return;
      }

      _availableRelease = latest;
      _status = UpdateStatus.available;
      notifyListeners();

      if (!manual && autoUpdateEnabled) {
        await startBackgroundDownload();
      }
    } catch (e) {
      debugPrint('[AppUpdateService] Check error: $e');
      _errorMessage = manual ? 'Update check failed: $e' : null;
      _status = manual ? UpdateStatus.error : UpdateStatus.idle;
      notifyListeners();
    }
  }

  Future<void> startBackgroundDownload() async {
    final rel = _availableRelease;
    if (rel == null || _status == UpdateStatus.downloading) return;

    _status = UpdateStatus.downloading;
    _progress = 0.0;
    _bytesDownloaded = 0;
    _bytesTotal = rel.sizeBytes;
    _errorMessage = null;
    notifyListeners();

    try {
      final enqueued = await _native.invokeMapMethod<String, dynamic>(
        'enqueueDownload',
        {
          'url': rel.downloadUrl,
          'fileName': rel.assetName,
          'title': 'My Music v${rel.version}',
          'description': 'Downloading update in background…',
          'mimeType': 'application/vnd.android.package-archive',
          'notifyCompleted': true,
        },
      );

      final dlId = (enqueued?['downloadId'] as num?)?.toInt();
      final destPath = enqueued?['destPath']?.toString() ?? '';
      if (dlId == null || destPath.isEmpty) {
        throw Exception('Android DownloadManager did not return a download ID');
      }

      _activeDownloadId = dlId;
      _downloadedApkPath = destPath;
      await _storage.prefs.setString(
        _pendingKey,
        jsonEncode({
          'downloadId': dlId,
          'version': rel.version,
          'tagName': rel.tagName,
          'downloadUrl': rel.downloadUrl,
          'assetName': rel.assetName,
          'sizeBytes': rel.sizeBytes,
          'destPath': destPath,
        }),
      );

      _startDownloadPolling(dlId, destPath, rel.sizeBytes, rel.version);
    } catch (e) {
      debugPrint('[AppUpdateService] Download start failed: $e');
      _status = UpdateStatus.error;
      _errorMessage = 'Could not start background APK download: $e';
      notifyListeners();
    }
  }

  void _startDownloadPolling(int dlId, String destPath, int expectedBytes, String version) {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(milliseconds: 500), (timer) async {
      try {
        final q = await _native.invokeMapMethod<String, dynamic>(
          'queryDownload',
          {'downloadId': dlId},
        );
        final st = q?['status']?.toString() ?? 'unknown';
        final got = (q?['bytesDownloaded'] as num?)?.toInt() ?? 0;
        final total = (q?['bytesTotal'] as num?)?.toInt() ?? expectedBytes;

        _bytesDownloaded = got;
        _bytesTotal = total > 0 ? total : expectedBytes;
        if (_bytesTotal > 0) {
          _progress = (got / _bytesTotal).clamp(0.0, 1.0);
        }

        if (st == 'successful') {
          timer.cancel();
          _activeDownloadId = null;
          if (await _isValidApkFile(destPath, minExpectedSize: expectedBytes)) {
            _downloadedApkPath = destPath;
            _progress = 1.0;
            _status = UpdateStatus.downloaded;
            _promptShownForReady = false;
            await _storage.prefs.remove(_pendingKey);
          } else {
            _status = UpdateStatus.error;
            _errorMessage = 'Downloaded update package verification failed.';
            await _storage.prefs.remove(_pendingKey);
          }
          notifyListeners();
          return;
        }

        if (st == 'failed' || st == 'unknown') {
          timer.cancel();
          _activeDownloadId = null;
          await _storage.prefs.remove(_pendingKey);
          final reason = q?['reason'] ?? '';
          _status = UpdateStatus.error;
          _errorMessage = 'Update download failed (code $reason).';
          notifyListeners();
          return;
        }

        notifyListeners();
      } catch (_) {}
    });
  }

  Future<void> cancelDownload() async {
    _pollTimer?.cancel();
    if (_activeDownloadId != null) {
      try {
        await _native.invokeMethod('cancelDownload', {'downloadId': _activeDownloadId});
      } catch (_) {}
      _activeDownloadId = null;
    }
    await _storage.prefs.remove(_pendingKey);
    _status = _availableRelease != null ? UpdateStatus.available : UpdateStatus.idle;
    _progress = 0.0;
    notifyListeners();
  }

  /// Launches Android APK installer for the downloaded update.
  /// Returns `'ok'`, `'permission_needed'`, or an error message.
  Future<String> installDownloadedApk() async {
    final path = _downloadedApkPath;
    if (path == null || path.isEmpty) {
      return 'No downloaded update file available.';
    }
    final expected = _availableRelease?.sizeBytes ?? 0;
    if (!await _isValidApkFile(path, minExpectedSize: expected)) {
      _status = UpdateStatus.available;
      notifyListeners();
      return 'Downloaded APK file is incomplete. Tap Download again.';
    }

    try {
      final allowed = await _native.invokeMethod<bool>('canRequestPackageInstalls') ?? true;
      if (!allowed) {
        return 'permission_needed';
      }
      await _native.invokeMethod('installApk', {'filePath': path});
      return 'ok';
    } catch (e) {
      return 'Could not launch installer: $e';
    }
  }

  Future<void> openInstallPermissionSettings() async {
    try {
      await _native.invokeMethod('openUnknownSourcesSettings');
    } catch (_) {}
  }
}
