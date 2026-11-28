import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/lyrics.dart';

class LyricsService {
  static final LyricsService _instance = LyricsService._internal();
  factory LyricsService() => _instance;
  LyricsService._internal();

  final http.Client _http = http.Client();
  final Map<String, LyricsData> _cache = {};
  final Map<String, String> _transCache = {};

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

      // Single fast LRCLIB search request (returns synced + plain candidates scored by match)
      final searchUri = Uri.https('lrclib.net', '/api/search', {
        'q': '$cleanTitle $cleanArtist'.trim(),
      });
      final searchResp = await _http
          .get(searchUri, headers: const {'User-Agent': 'MyMusic/1.1.9 (Android)'})
          .timeout(const Duration(seconds: 6));
      if (searchResp.statusCode == 200) {
        final list = jsonDecode(searchResp.body);
        if (list is List && list.isNotEmpty) {
          final items = list.whereType<Map<String, dynamic>>().toList();
          items.sort((a, b) => _scoreItem(b, cleanTitle, cleanArtist, durationSec)
              .compareTo(_scoreItem(a, cleanTitle, cleanArtist, durationSec)));
          final best = items.first;
          final data = _parseLrcPayload(
            best['syncedLyrics'] as String?,
            best['plainLyrics'] as String?,
          );
          if (!data.isEmpty) {
            _cache[trackId] = data;
            return data;
          }
        }
      }

      // Direct /api/get fallback if search returned empty
      final uri = Uri.https('lrclib.net', '/api/get', {
        'track_name': cleanTitle,
        'artist_name': cleanArtist,
        if (durationSec != null && durationSec > 0)
          'duration': durationSec.toString(),
      });
      final resp = await _http
          .get(uri, headers: const {'User-Agent': 'MyMusic/1.1.9 (Android)'})
          .timeout(const Duration(seconds: 5));
      if (resp.statusCode == 200) {
        final json = jsonDecode(resp.body) as Map<String, dynamic>;
        final data = _parseLrcPayload(
          json['syncedLyrics'] as String?,
          json['plainLyrics'] as String?,
        );
        if (!data.isEmpty) {
          _cache[trackId] = data;
          return data;
        }
      }
    } catch (e) {
      debugPrint('[LyricsService] Error fetching lyrics: $e');
    }

    const empty = LyricsData(synced: [], plain: null);
    _cache[trackId] = empty;
    return empty;
  }

  int _scoreItem(Map<String, dynamic> x, String title, String artist, int? durSec) {
    int s = 0;
    final aName = (x['artistName'] as String? ?? '').toLowerCase();
    final tName = (x['trackName'] as String? ?? '').toLowerCase();
    if (artist.isNotEmpty && aName.contains(artist.toLowerCase())) s += 3;
    if (title.isNotEmpty && tName.contains(title.toLowerCase())) s += 3;
    if ((x['syncedLyrics'] as String? ?? '').isNotEmpty) s += 2;
    if (durSec != null && durSec > 0 && x['duration'] is num) {
      final diff = ((x['duration'] as num).round() - durSec).abs();
      if (diff <= 4) s += 2;
    }
    return s;
  }

  LyricsData _parseLrcPayload(String? syncedStr, String? plainStr) {
    final syncedLines = <LyricLine>[];
    if (syncedStr != null && syncedStr.isNotEmpty) {
      for (final line in syncedStr.split('\n')) {
        final trimmed = line.trim();
        if (trimmed.isEmpty) continue;
        final match =
            RegExp(r'^\[(\d+):(\d+(?:\.\d+)?)\](.*)$').firstMatch(trimmed);
        if (match != null) {
          final min = int.tryParse(match.group(1)!) ?? 0;
          final sec = double.tryParse(match.group(2)!) ?? 0.0;
          final text = match.group(3)!.trim();
          if (text.isNotEmpty) {
            syncedLines.add(LyricLine(timeSec: (min * 60) + sec, text: text));
          }
        }
      }
    }
    return LyricsData(synced: syncedLines, plain: plainStr);
  }

  Future<String> translateText(String text, {String targetLang = 'en'}) async {
    final clean = text.trim();
    if (clean.isEmpty) return '';
    final key = '$targetLang:$clean';
    if (_transCache.containsKey(key)) return _transCache[key]!;

    try {
      final uri = Uri.https('translate.googleapis.com', '/translate_a/single', {
        'client': 'gtx',
        'sl': 'auto',
        'tl': targetLang,
        'dt': 't',
        'q': clean.length > 4000 ? clean.substring(0, 4000) : clean,
      });
      final resp = await _http.get(uri).timeout(const Duration(seconds: 7));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        if (data is List && data.isNotEmpty && data[0] is List) {
          final translated = (data[0] as List)
              .map((item) => (item is List && item.isNotEmpty) ? (item[0]?.toString() ?? '') : '')
              .join('');
          if (translated.isNotEmpty) {
            _transCache[key] = translated;
            return translated;
          }
        }
      }
    } catch (e) {
      debugPrint('[LyricsService] translateText error: $e');
    }
    return clean;
  }

  String _cleanSongTitle(String raw) {
    return raw
        .replaceAll(
          RegExp(
            r'\s*[\(\[](official\s*(music\s*)?video|audio|lyric\s*video|hd|4k|visualizer|remix)[\)\]]',
            caseSensitive: false,
          ),
          '',
        )
        .replaceAll(RegExp(r'\s*ft\.?.*', caseSensitive: false), '')
        .replaceAll(RegExp(r'\s*feat\.?.*', caseSensitive: false), '')
        .trim();
  }

  String _cleanArtistName(String raw) {
    return raw
        .split(RegExp(r'[,&]|feat\.|ft\.', caseSensitive: false))
        .first
        .trim();
  }
}
