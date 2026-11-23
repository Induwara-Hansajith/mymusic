import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/lyrics.dart';

class LyricsService {
  static final LyricsService _instance = LyricsService._internal();
  factory LyricsService() => _instance;
  LyricsService._internal();

  final Map<String, LyricsData> _cache = {};

  Future<LyricsData> fetchLyrics({
    required String trackId,
    required String title,
    required String artist,
    int? durationSec,
  }) async {
    if (_cache.containsKey(trackId)) {
      return _cache[trackId]!;
    }

    try {
      final cleanTitle = _cleanSongTitle(title);
      final cleanArtist = _cleanArtistName(artist);

      final uri = Uri.https('lrclib.net', '/api/get', {
        'track_name': cleanTitle,
        'artist_name': cleanArtist,
        if (durationSec != null && durationSec > 0)
          'duration': durationSec.toString(),
      });

      final resp = await http.get(uri).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) {
        final json = jsonDecode(resp.body) as Map<String, dynamic>;
        final syncedStr = json['syncedLyrics'] as String?;
        final plainStr = json['plainLyrics'] as String?;

        final syncedLines = <LyricLine>[];
        if (syncedStr != null && syncedStr.isNotEmpty) {
          final rawLines = syncedStr.split('\n');
          for (final line in rawLines) {
            final trimmed = line.trim();
            if (trimmed.isEmpty) continue;
            final match = RegExp(r'^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$').firstMatch(trimmed);
            if (match != null) {
              final min = int.tryParse(match.group(1)!) ?? 0;
              final sec = int.tryParse(match.group(2)!) ?? 0;
              final msStr = match.group(3)!;
              final ms = int.tryParse(msStr) ?? 0;
              final frac = msStr.length == 2 ? ms / 100.0 : ms / 1000.0;
              final totalSec = (min * 60) + sec + frac;
              final text = match.group(4)!.trim();
              syncedLines.add(LyricLine(timeSec: totalSec, text: text));
            }
          }
        }

        final data = LyricsData(
          synced: syncedLines,
          plain: plainStr,
        );
        _cache[trackId] = data;
        return data;
      }
    } catch (e) {
      debugPrint('[LyricsService] Error fetching lyrics: $e');
    }

    const empty = LyricsData(synced: [], plain: null);
    _cache[trackId] = empty;
    return empty;
  }

  String _cleanSongTitle(String raw) {
    return raw
        .replaceAll(RegExp(r'\s*[\(\[](official\s*(music\s*)?video|audio|lyric\s*video|hd|4k|visualizer|remix)[\)\]]', caseSensitive: false), '')
        .replaceAll(RegExp(r'\s*ft\.?.*', caseSensitive: false), '')
        .replaceAll(RegExp(r'\s*feat\.?.*', caseSensitive: false), '')
        .trim();
  }

  String _cleanArtistName(String raw) {
    return raw
        .replaceAll(RegExp(r' - Topic$', caseSensitive: false), '')
        .replaceAll(RegExp(r'VEVO$', caseSensitive: false), '')
        .trim();
  }
}
