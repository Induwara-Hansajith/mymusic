import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:dart_des/dart_des.dart';
import '../models/track.dart';

class SaavnStream {
  final String url;
  final int bitrate;

  const SaavnStream({required this.url, required this.bitrate});
}

class SaavnService {
  static final SaavnService _instance = SaavnService._internal();
  factory SaavnService() => _instance;
  SaavnService._internal();

  static const String _baseUrl = 'https://www.jiosaavn.com/api.php';
  static final List<int> _desKey = utf8.encode('38346591');

  final http.Client _http = http.Client();
  final Map<String, SaavnStream> _streamCache = {};

  static const Map<String, String> _headers = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  String _decryptUrl(String encryptedUrl) {
    if (encryptedUrl.trim().isEmpty) return '';
    try {
      final des = DES(key: _desKey, mode: DESMode.ECB, paddingType: DESPaddingType.PKCS5);
      final decodedBytes = base64Decode(encryptedUrl);
      final decrypted = des.decrypt(decodedBytes);
      return utf8.decode(decrypted).trim();
    } catch (e) {
      debugPrint('[SaavnService] Decrypt error: $e');
      return '';
    }
  }

  List<SaavnStream> _candidateStreams(String encryptedUrl, bool supports320) {
    final rawUrl = _decryptUrl(encryptedUrl);
    if (rawUrl.isEmpty) return const [];

    int bitrate = 96;
    final match = RegExp(r'_(48|96|160|320)\.(mp4|aac|mp3)', caseSensitive: false).firstMatch(rawUrl);
    if (match != null) {
      bitrate = int.tryParse(match.group(1) ?? '96') ?? 96;
    }

    final list = <SaavnStream>[];
    if (supports320) {
      final url320 = rawUrl.replaceAllMapped(
        RegExp(r'_(48|96|160)\.(mp4|aac|mp3)', caseSensitive: false),
        (m) => '_320.${m.group(2)}',
      );
      if (url320 != rawUrl) {
        list.add(SaavnStream(url: url320, bitrate: 320));
      }
    }
    list.add(SaavnStream(url: rawUrl, bitrate: bitrate));
    return list;
  }

  Future<bool> _probeUrl(String url) async {
    try {
      final res = await _http
          .get(Uri.parse(url), headers: const {'Range': 'bytes=0-1'})
          .timeout(const Duration(seconds: 3));
      return res.statusCode == 200 || res.statusCode == 206;
    } catch (_) {
      return false;
    }
  }

  Future<SaavnStream?> _pickVerifiedStream(List<SaavnStream> candidates) async {
    for (final c in candidates) {
      if (await _probeUrl(c.url)) return c;
    }
    return null;
  }

  Set<String> _tokens(String s) {
    return _unescapeHtml(s)
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
        .split(RegExp(r'\s+'))
        .where((w) => w.length >= 2)
        .toSet();
  }

  bool _isAccurateMatch(
    Map<String, dynamic> item,
    String targetTitle,
    String targetArtist,
  ) {
    final candTitle = item['title']?.toString() ?? '';
    final wantTitleTokens = _tokens(_cleanQuery(targetTitle));
    final gotTitleTokens = _tokens(_cleanQuery(candTitle));
    if (wantTitleTokens.isEmpty || gotTitleTokens.isEmpty) return false;

    final titleOverlap = wantTitleTokens.intersection(gotTitleTokens).length;
    if (titleOverlap == 0) return false;
    // Require strong title overlap for multi-word titles
    if (wantTitleTokens.length >= 2 && titleOverlap < (wantTitleTokens.length * 0.5).ceil()) {
      return false;
    }

    if (targetArtist.isNotEmpty) {
      final moreInfo = item['more_info'] as Map<String, dynamic>?;
      final primaryArtists = (moreInfo?['artistMap']?['primary_artists'] as List? ?? [])
          .map((a) => (a is Map ? a['name']?.toString() : '') ?? '')
          .join(' ');
      final singerStr = moreInfo?['music']?.toString() ?? '';
      final subtitle = item['subtitle']?.toString() ?? '';
      final candArtistTokens = _tokens('$primaryArtists $singerStr $subtitle');
      final wantArtistTokens = _tokens(_cleanQuery(targetArtist));
      if (wantArtistTokens.isNotEmpty &&
          candArtistTokens.isNotEmpty &&
          wantArtistTokens.intersection(candArtistTokens).isEmpty) {
        return false;
      }
    }
    return true;
  }

  Future<List<Track>> search(String query, {int limit = 20}) async {
    final q = query.trim();
    if (q.isEmpty) return [];

    try {
      final uri = Uri.parse(
        '$_baseUrl?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=android&q=${Uri.encodeComponent(q)}&p=1&n=$limit',
      );
      final res = await _http.get(uri, headers: _headers).timeout(const Duration(seconds: 5));
      if (res.statusCode != 200) return [];

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final results = data['results'] as List<dynamic>?;
      if (results == null || results.isEmpty) return [];

      final tracks = <Track>[];
      for (final item in results) {
        if (item is! Map<String, dynamic>) continue;

        final id = item['id']?.toString() ?? '';
        var title = item['title']?.toString() ?? '';
        title = _unescapeHtml(title);

        final moreInfo = item['more_info'] as Map<String, dynamic>?;
        final artistList = moreInfo?['artistMap']?['primary_artists'] as List<dynamic>?;
        String artist = 'Unknown Artist';
        if (artistList != null && artistList.isNotEmpty) {
          artist = artistList.map((a) => a['name']?.toString() ?? '').where((s) => s.isNotEmpty).join(', ');
        }

        var thumb = item['image']?.toString() ?? '';
        thumb = thumb.replaceAll(RegExp(r'150x150|50x50'), '500x500').replaceFirst('http://', 'https://');

        final durStr = moreInfo?['duration']?.toString();
        final durationSec = int.tryParse(durStr ?? '') ?? 180;
        final album = moreInfo?['album']?.toString();

        tracks.add(Track(
          id: 'saavn:$id',
          title: title,
          artist: artist,
          durationSec: durationSec,
          thumb: thumb,
          album: album,
        ));
      }
      return tracks;
    } catch (e) {
      debugPrint('[SaavnService] Search error: $e');
      return [];
    }
  }

  Future<SaavnStream?> resolveStream(String title, String artist, {String? directSongId}) async {
    final cacheKey = (directSongId != null && directSongId.isNotEmpty)
        ? directSongId
        : '$title - $artist'.toLowerCase();
    if (_streamCache.containsKey(cacheKey)) {
      return _streamCache[cacheKey];
    }

    try {
      if (directSongId != null && directSongId.isNotEmpty) {
        final stream = await _getSongDetails(directSongId.replaceFirst('saavn:', ''));
        if (stream != null) {
          _streamCache[cacheKey] = stream;
          return stream;
        }
      }

      final cleanTitle = _cleanQuery(title);
      final cleanArtist = _cleanQuery(artist);
      if (cleanTitle.isEmpty) return null;
      final query = cleanArtist.isNotEmpty ? '$cleanTitle $cleanArtist' : cleanTitle;

      final uri = Uri.parse(
        '$_baseUrl?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=android&q=${Uri.encodeComponent(query)}&p=1&n=5',
      );
      final res = await _http.get(uri, headers: _headers).timeout(const Duration(seconds: 4));
      if (res.statusCode != 200) return null;

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final results = data['results'] as List<dynamic>?;
      if (results == null || results.isEmpty) {
        return null;
      }

      for (final rawItem in results.whereType<Map<String, dynamic>>()) {
        if (!_isAccurateMatch(rawItem, title, artist)) continue;
        final moreInfo = rawItem['more_info'] as Map<String, dynamic>?;
        final encUrl = moreInfo?['encrypted_media_url']?.toString() ?? '';
        final has320 = moreInfo?['320kbps'] == 'true' || moreInfo?['320kbps'] == true;
        final candidates = _candidateStreams(encUrl, has320);
        final verified = await _pickVerifiedStream(candidates);
        if (verified != null) {
          _streamCache[cacheKey] = verified;
          return verified;
        }
      }
    } catch (e) {
      debugPrint('[SaavnService] resolveStream error: $e');
    }
    return null;
  }

  Future<SaavnStream?> _getSongDetails(String songId) async {
    try {
      final uri = Uri.parse(
        '$_baseUrl?__call=song.getDetails&_format=json&_marker=0&api_version=4&ctx=android&pids=$songId',
      );
      final res = await _http.get(uri, headers: _headers).timeout(const Duration(seconds: 4));
      if (res.statusCode != 200) return null;

      final data = jsonDecode(res.body);
      Map<String, dynamic>? songObj;
      if (data is Map<String, dynamic>) {
        if (data['songs'] is List && (data['songs'] as List).isNotEmpty) {
          songObj = (data['songs'] as List).first as Map<String, dynamic>?;
        } else if (data[songId] is Map<String, dynamic>) {
          songObj = data[songId] as Map<String, dynamic>?;
        } else {
          for (final val in data.values) {
            if (val is Map<String, dynamic>) {
              songObj = val;
              break;
            }
          }
        }
      }

      if (songObj == null) return null;
      final moreInfo = songObj['more_info'] as Map<String, dynamic>?;
      final encUrl = moreInfo?['encrypted_media_url']?.toString() ?? '';
      final has320 = moreInfo?['320kbps'] == 'true' || moreInfo?['320kbps'] == true;

      return await _pickVerifiedStream(_candidateStreams(encUrl, has320));
    } catch (e) {
      debugPrint('[SaavnService] _getSongDetails error: $e');
      return null;
    }
  }

  String _cleanQuery(String s) {
    return s
        .replaceAll(RegExp(r'\(.*?\)|\[.*?\]'), '')
        .replaceAll(RegExp(r'feat\..*|ft\..*|official.*', caseSensitive: false), '')
        .trim();
  }

  String _unescapeHtml(String s) {
    return s
        .replaceAll('&quot;', '"')
        .replaceAll('&amp;', '&')
        .replaceAll('&#039;', "'")
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>');
  }
}
