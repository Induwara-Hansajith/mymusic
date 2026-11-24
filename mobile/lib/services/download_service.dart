import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import '../models/track.dart';
import 'storage_service.dart';
import 'saavn_service.dart';
import 'youtube_service.dart';

class DownloadService {
  static final DownloadService _instance = DownloadService._internal();
  factory DownloadService() => _instance;
  DownloadService._internal();

  final StorageService _storage = StorageService();
  final SaavnService _saavn = SaavnService();
  final YoutubeService _yt = YoutubeService();

  final Set<String> _downloadingIds = {};
  final _downloadStateController = StreamController<String>.broadcast();
  Stream<String> get downloadStateStream => _downloadStateController.stream;

  bool isDownloading(String trackId) => _downloadingIds.contains(trackId);
  bool isDownloaded(String trackId) => _storage.isDownloaded(trackId);

  Future<String?> downloadTrack(Track track) async {
    if (_downloadingIds.contains(track.id)) return null;
    if (_storage.isDownloaded(track.id)) {
      return _storage.getDownloadedPath(track.id);
    }

    _downloadingIds.add(track.id);
    _downloadStateController.add(track.id);

    try {
      // 1. Resolve stream URL
      String? streamUrl;
      try {
        final saavnStream = await _saavn.resolveStream(
          track.title,
          track.artist,
          directSongId: track.id.startsWith('saavn:') ? track.id : null,
        );
        if (saavnStream != null && saavnStream.url.isNotEmpty) {
          streamUrl = saavnStream.url;
        }
      } catch (_) {}

      if (streamUrl == null || streamUrl.isEmpty) {
        streamUrl = await _yt.resolveStreamUrl(track.cleanId);
      }

      if (streamUrl == null || streamUrl.isEmpty) {
        final candidates = await _yt.search('${track.title} ${track.artist}', limit: 2);
        if (candidates.isNotEmpty) {
          streamUrl = await _yt.resolveStreamUrl(candidates.first.cleanId);
        }
      }

      if (streamUrl == null || streamUrl.isEmpty) {
        throw Exception('Stream URL could not be resolved for download');
      }

      // 2. Prepare directory
      final appDir = await getApplicationDocumentsDirectory();
      final downloadsDir = Directory('${appDir.path}/downloads');
      if (!await downloadsDir.exists()) {
        await downloadsDir.create(recursive: true);
      }

      final sanitizedId = track.id.replaceAll(RegExp(r'[^\w\-]'), '_');
      final targetFile = File('${downloadsDir.path}/$sanitizedId.mp3');

      // 3. Download bytes
      final client = http.Client();
      try {
        final request = http.Request('GET', Uri.parse(streamUrl));
        if (streamUrl.contains('googlevideo.com')) {
          request.headers['User-Agent'] =
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
          request.headers['Referer'] = 'https://www.youtube.com/';
        }
        final response = await client.send(request);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          final sink = targetFile.openWrite();
          await response.stream.pipe(sink);
          await sink.flush();
          await sink.close();
        } else {
          throw Exception('Download HTTP error: ${response.statusCode}');
        }
      } finally {
        client.close();
      }

      // 4. Save to StorageService
      final downloadedTrack = Track(
        id: track.id,
        title: track.title,
        artist: track.artist,
        durationSec: track.durationSec,
        thumb: track.thumb,
        album: track.album,
        localPath: targetFile.path,
      );
      await _storage.addDownloaded(downloadedTrack);

      debugPrint('[DownloadService] Successfully downloaded: ${track.title} -> ${targetFile.path}');
      return targetFile.path;
    } catch (e) {
      debugPrint('[DownloadService] Download error for "${track.title}": $e');
      return null;
    } finally {
      _downloadingIds.remove(track.id);
      _downloadStateController.add(track.id);
    }
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
    } catch (e) {
      debugPrint('[DownloadService] Delete download error: $e');
    }
  }
}
