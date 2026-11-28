import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import '../models/track.dart';
import 'storage_service.dart';
import 'saavn_service.dart';
import 'youtube_service.dart';

class _PendingTrackDl {
  final Track track;
  final int downloadId;
  final String tempDestPath;
  final List<String> candidates;
  final int candidateIndex;

  const _PendingTrackDl({
    required this.track,
    required this.downloadId,
    required this.tempDestPath,
    required this.candidates,
    required this.candidateIndex,
  });

  Map<String, dynamic> toJson() => {
        'track': track.toJson(),
        'downloadId': downloadId,
        'tempDestPath': tempDestPath,
        'candidates': candidates,
        'candidateIndex': candidateIndex,
      };

  factory _PendingTrackDl.fromJson(Map<String, dynamic> json) => _PendingTrackDl(
        track: Track.fromJson(Map<String, dynamic>.from(json['track'] as Map)),
        downloadId: (json['downloadId'] as num).toInt(),
        tempDestPath: json['tempDestPath'] as String? ?? '',
        candidates: (json['candidates'] as List? ?? []).map((e) => e.toString()).toList(),
        candidateIndex: (json['candidateIndex'] as num?)?.toInt() ?? 0,
      );
}

class DownloadService extends ChangeNotifier {
  static final DownloadService _instance = DownloadService._internal();
  factory DownloadService() => _instance;
  DownloadService._internal();

  static const MethodChannel _native = MethodChannel('com.induw.mymusic/native');
  static const String _pendingStoreKey = 'mymusic_pending_track_dls';

  final StorageService _storage = StorageService();
  final SaavnService _saavn = SaavnService();
  final YoutubeService _yt = YoutubeService();
  final http.Client _http = http.Client();

  final Set<String> _downloadingIds = {};
  final Map<String, double> _progressMap = {};
  final Map<String, _PendingTrackDl> _nativePending = {};
  final List<Track> _batchQueue = [];
  int _activeWorkers = 0;
  static const int _maxConcurrent = 2;

  Timer? _pollTimer;
  bool _initialized = false;
  VoidCallback? onDownloadCompleted;

  final _downloadStateController = StreamController<String>.broadcast();
  Stream<String> get downloadStateStream => _downloadStateController.stream;

  bool isDownloading(String trackId) =>
      _downloadingIds.contains(trackId) ||
      _batchQueue.any((t) => t.id == trackId) ||
      _nativePending.containsKey(trackId);

  bool isDownloaded(String trackId) => _storage.isDownloaded(trackId);

  double progressFor(String trackId) => _progressMap[trackId] ?? 0.0;

  List<Track> get activeTracks {
    final map = <String, Track>{};
    for (final p in _nativePending.values) {
      map[p.track.id] = p.track;
    }
    for (final t in _batchQueue) {
      map[t.id] = t;
    }
    return map.values.toList();
  }

  int get activeCount => activeTracks.length;

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    await _reconcilePending();
  }

  Future<void> _savePending() async {
    try {
      final list = _nativePending.values.map((p) => p.toJson()).toList();
      await _storage.prefs.setString(_pendingStoreKey, jsonEncode(list));
    } catch (_) {}
  }

  Future<void> _reconcilePending() async {
    try {
      final raw = _storage.prefs.getString(_pendingStoreKey);
      if (raw == null || raw.isEmpty) return;
      final list = jsonDecode(raw);
      if (list is! List) return;
      for (final item in list.whereType<Map>()) {
        final pending = _PendingTrackDl.fromJson(Map<String, dynamic>.from(item));
        if (pending.track.id.isNotEmpty) {
          _nativePending[pending.track.id] = pending;
          _downloadingIds.add(pending.track.id);
        }
      }
      if (_nativePending.isNotEmpty) {
        notifyListeners();
        await _pollNativeDownloadsOnce();
        _ensurePolling();
      }
    } catch (_) {}
  }

  Future<String> _finalOfflinePath(String trackId) async {
    final appDir = await getApplicationDocumentsDirectory();
    final downloadsDir = Directory('${appDir.path}/downloads');
    if (!await downloadsDir.exists()) {
      await downloadsDir.create(recursive: true);
    }
    final sanitizedId = trackId.replaceAll(RegExp(r'[^\w\-]'), '_');
    return '${downloadsDir.path}/$sanitizedId.m4a';
  }

  Future<List<String>> _resolveCandidates(Track track) async {
    final candidates = <String>[];

    if (track.id.startsWith('saavn:')) {
      final s = await _saavn
          .resolveStream(track.title, track.artist, directSongId: track.id)
          .timeout(const Duration(seconds: 5), onTimeout: () => null);
      if (s != null && s.url.isNotEmpty) candidates.add(s.url);
    } else {
      final ytFuture = _yt.resolveStreamCandidates(track.cleanId);
      final s = await _saavn
          .resolveStream(track.title, track.artist)
          .timeout(const Duration(milliseconds: 2800), onTimeout: () => null);
      if (s != null && s.url.isNotEmpty) candidates.add(s.url);
      final ytList = await ytFuture;
      for (final u in ytList) {
        if (!candidates.contains(u)) candidates.add(u);
      }
    }

    if (candidates.isEmpty) {
      try {
        final searchCandidates = await _yt
            .search('${track.title} ${track.artist}', limit: 2)
            .timeout(const Duration(seconds: 6), onTimeout: () => const []);
        for (final sc in searchCandidates) {
          final urls = await _yt.resolveStreamCandidates(sc.cleanId);
          for (final u in urls) {
            if (!candidates.contains(u)) candidates.add(u);
          }
          if (candidates.isNotEmpty) break;
        }
      } catch (_) {}
    }

    return candidates;
  }

  Future<void> enqueueTracks(List<Track> tracks) async {
    for (final t in tracks) {
      if (isDownloaded(t.id) || isDownloading(t.id)) continue;
      _batchQueue.add(t);
    }
    notifyListeners();
    _pumpBatchQueue();
  }

  void _pumpBatchQueue() {
    while (_activeWorkers < _maxConcurrent && _batchQueue.isNotEmpty) {
      final nextTrack = _batchQueue.removeAt(0);
      if (isDownloaded(nextTrack.id) || _downloadingIds.contains(nextTrack.id)) {
        continue;
      }
      _activeWorkers++;
      unawaited(downloadTrack(nextTrack).whenComplete(() {
        _activeWorkers = (_activeWorkers - 1).clamp(0, _maxConcurrent);
        _pumpBatchQueue();
      }));
    }
  }

  Future<String?> downloadTrack(Track track) async {
    if (_downloadingIds.contains(track.id) || _nativePending.containsKey(track.id)) {
      return null;
    }
    if (_storage.isDownloaded(track.id)) {
      final existing = _storage.getDownloadedPath(track.id);
      if (existing != null && File(existing).existsSync()) {
        return existing;
      }
    }

    _downloadingIds.add(track.id);
    _progressMap[track.id] = 0.02;
    _downloadStateController.add(track.id);
    notifyListeners();

    try {
      final candidates = await _resolveCandidates(track);
      if (candidates.isEmpty) {
        throw Exception('No playable stream candidate available to download');
      }

      // Enqueue via Android DownloadManager so transfer finishes reliably even if app is backgrounded/locked.
      final enqueued = await _enqueueCandidateNative(track, candidates, 0);
      if (enqueued != null) {
        _nativePending[track.id] = enqueued;
        await _savePending();
        _ensurePolling();
        notifyListeners();
        return await _waitForNativeTrackCompletion(track.id);
      }

      // Non-Android / unit test fallback using HTTP streaming directly to internal file
      return await _downloadFallbackHttp(track, candidates);
    } catch (e) {
      debugPrint('[DownloadService] Download error for "${track.title}": $e');
      _downloadingIds.remove(track.id);
      _progressMap.remove(track.id);
      _downloadStateController.add(track.id);
      notifyListeners();
      return null;
    }
  }

  Future<_PendingTrackDl?> _enqueueCandidateNative(
    Track track,
    List<String> candidates,
    int index,
  ) async {
    if (index < 0 || index >= candidates.length) return null;
    final url = candidates[index];
    final sanitizedId = track.id.replaceAll(RegExp(r'[^\w\-]'), '_');
    final fileName = 'track_${sanitizedId}_$index.m4a';
    final headers = url.contains('googlevideo.com')
        ? <String, String>{'User-Agent': YoutubeService.androidClientUserAgent}
        : <String, String>{};

    try {
      final res = await _native.invokeMapMethod<String, dynamic>(
        'enqueueDownload',
        {
          'url': url,
          'fileName': fileName,
          'title': '${track.title} — ${track.artist}',
          'description': 'Saving for offline playback',
          'mimeType': 'audio/mp4',
          'notifyCompleted': true,
          if (headers.isNotEmpty) 'headers': headers,
        },
      );
      final dlId = (res?['downloadId'] as num?)?.toInt();
      final destPath = res?['destPath']?.toString() ?? '';
      if (dlId == null || destPath.isEmpty) return null;

      return _PendingTrackDl(
        track: track,
        downloadId: dlId,
        tempDestPath: destPath,
        candidates: candidates,
        candidateIndex: index,
      );
    } on MissingPluginException {
      return null;
    } catch (e) {
      debugPrint('[DownloadService] Native enqueue failed: $e');
      return null;
    }
  }

  final Map<String, Completer<String?>> _nativeCompleters = {};

  Future<String?> _waitForNativeTrackCompletion(String trackId) {
    final comp = Completer<String?>();
    _nativeCompleters[trackId] = comp;
    return comp.future;
  }

  void _ensurePolling() {
    if (_pollTimer != null && _pollTimer!.isActive) return;
    _pollTimer = Timer.periodic(const Duration(milliseconds: 700), (_) {
      _pollNativeDownloadsOnce();
    });
  }

  Future<void> _pollNativeDownloadsOnce() async {
    if (_nativePending.isEmpty) {
      _pollTimer?.cancel();
      return;
    }

    final keys = _nativePending.keys.toList();
    bool changed = false;

    for (final trackId in keys) {
      final p = _nativePending[trackId];
      if (p == null) continue;
      try {
        final q = await _native.invokeMapMethod<String, dynamic>(
          'queryDownload',
          {'downloadId': p.downloadId},
        );
        final status = q?['status']?.toString() ?? 'unknown';
        final got = (q?['bytesDownloaded'] as num?)?.toInt() ?? 0;
        final total = (q?['bytesTotal'] as num?)?.toInt() ?? 0;
        if (total > 0) {
          _progressMap[trackId] = (got / total).clamp(0.02, 0.99);
          changed = true;
        }

        if (status == 'successful') {
          final tempFile = File(p.tempDestPath);
          if (await tempFile.exists() && await tempFile.length() > 1024) {
            final finalPath = await _finalOfflinePath(trackId);
            final outFile = File(finalPath);
            if (await outFile.exists()) await outFile.delete();
            await tempFile.copy(finalPath);
            await tempFile.delete().catchError((_) => tempFile);

            final saved = p.track.copyWith(localPath: finalPath);
            await _storage.addDownloaded(saved);

            _nativePending.remove(trackId);
            _downloadingIds.remove(trackId);
            _progressMap.remove(trackId);
            await _savePending();
            _downloadStateController.add(trackId);
            onDownloadCompleted?.call();
            _nativeCompleters.remove(trackId)?.complete(finalPath);
            changed = true;
            continue;
          }
        }

        if (status == 'failed' || status == 'unknown' || status == 'successful') {
          // Try next candidate if available
          final nextIdx = p.candidateIndex + 1;
          if (nextIdx < p.candidates.length) {
            final retry = await _enqueueCandidateNative(p.track, p.candidates, nextIdx);
            if (retry != null) {
              _nativePending[trackId] = retry;
              await _savePending();
              changed = true;
              continue;
            }
          }
          _nativePending.remove(trackId);
          _downloadingIds.remove(trackId);
          _progressMap.remove(trackId);
          await _savePending();
          _downloadStateController.add(trackId);
          _nativeCompleters.remove(trackId)?.complete(null);
          changed = true;
        }
      } catch (_) {}
    }

    if (changed) notifyListeners();
    if (_nativePending.isEmpty) _pollTimer?.cancel();
  }

  Future<String?> _downloadFallbackHttp(Track track, List<String> candidates) async {
    final finalPath = await _finalOfflinePath(track.id);
    final targetFile = File(finalPath);
    bool downloaded = false;

    for (final streamUrl in candidates) {
      try {
        final request = http.Request('GET', Uri.parse(streamUrl));
        if (streamUrl.contains('googlevideo.com')) {
          request.headers['User-Agent'] = YoutubeService.androidClientUserAgent;
        }
        final response = await _http.send(request).timeout(const Duration(seconds: 15));
        if (response.statusCode >= 200 && response.statusCode < 300) {
          final total = response.contentLength ?? 0;
          int received = 0;
          final sink = targetFile.openWrite();
          await for (final chunk in response.stream) {
            sink.add(chunk);
            received += chunk.length;
            if (total > 0) {
              _progressMap[track.id] = (received / total).clamp(0.02, 0.99);
              notifyListeners();
            }
          }
          await sink.flush();
          await sink.close();
          downloaded = true;
          break;
        }
      } catch (_) {}
    }

    _downloadingIds.remove(track.id);
    _progressMap.remove(track.id);

    if (!downloaded || !await targetFile.exists() || await targetFile.length() == 0) {
      _downloadStateController.add(track.id);
      notifyListeners();
      return null;
    }

    await _storage.addDownloaded(track.copyWith(localPath: targetFile.path));
    _downloadStateController.add(track.id);
    onDownloadCompleted?.call();
    notifyListeners();
    return targetFile.path;
  }

  Future<void> cancelDownload(String trackId) async {
    _batchQueue.removeWhere((t) => t.id == trackId);
    final pending = _nativePending.remove(trackId);
    if (pending != null) {
      try {
        await _native.invokeMethod('cancelDownload', {'downloadId': pending.downloadId});
      } catch (_) {}
      await _savePending();
    }
    _downloadingIds.remove(trackId);
    _progressMap.remove(trackId);
    _nativeCompleters.remove(trackId)?.complete(null);
    _downloadStateController.add(trackId);
    notifyListeners();
  }

  Future<void> deleteDownload(String trackId) async {
    try {
      final path = _storage.getDownloadedPath(trackId);
      if (path != null) {
        final f = File(path);
        if (await f.exists()) {
          await f.delete();
        }
      }
      await _storage.removeDownloaded(trackId);
      _downloadStateController.add(trackId);
      notifyListeners();
    } catch (e) {
      debugPrint('[DownloadService] Delete download error: $e');
    }
  }
}
