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

  SaavnStream? _bestStream(String encryptedUrl, bool supports320) {
    var rawUrl = _decryptUrl(encryptedUrl);
    if (rawUrl.isEmpty) return null;

    int bitrate = 96;
    final match = RegExp(r'_(48|96|160|320)\.(mp4|aac|mp3)', caseSensitive: false).firstMatch(rawUrl);
    if (match != null) {
      bitrate = int.tryParse(match.group(1) ?? '96') ?? 96;
    }

    if (supports320) {
      rawUrl = rawUrl.replaceAllMapped(
        RegExp(r'_(48|96|160)\.(mp4|aac|mp3)', caseSensitive: false),
        (m) => '_320.${m.group(2)}',
      );
      bitrate = 320;
    }

    return SaavnStream(url: rawUrl, bitrate: bitrate);
  }

  Future<List<Track>> search(String query, {int limit = 20}) async {
    final q = query.trim();
    if (q.isEmpty) return [];

    try {
      final uri = Uri.parse(
        '$_baseUrl?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=android&q=${Uri.encodeComponent(q)}&p=1&n=$limit',
      );
      final res = await http.get(uri, headers: _headers);
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
    final cacheKey = '$title - $artist'.toLowerCase();
    if (_streamCache.containsKey(cacheKey)) {
      return _streamCache[cacheKey];
    }

    try {
      // 1. If direct song ID is provided, query song details directly
      if (directSongId != null && directSongId.isNotEmpty) {
        final stream = await _getSongDetails(directSongId.replaceFirst('saavn:', ''));
        if (stream != null) {
          _streamCache[cacheKey] = stream;
          return stream;
        }
      }

      // 2. Search for the track by title and artist
      final cleanTitle = _cleanQuery(title);
      final cleanArtist = _cleanQuery(artist);
      final query = cleanArtist.isNotEmpty ? '$cleanTitle $cleanArtist' : cleanTitle;

      final uri = Uri.parse(
        '$_baseUrl?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=android&q=${Uri.encodeComponent(query)}&p=1&n=5',
      );
      final res = await http.get(uri, headers: _headers);
      if (res.statusCode != 200) return null;

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final results = data['results'] as List<dynamic>?;
      if (results == null || results.isEmpty) {
        // Fallback search with title only
        if (cleanArtist.isNotEmpty) {
          return await resolveStream(cleanTitle, '');
        }
        return null;
      }

      // Pick best matching result
      final first = results.first as Map<String, dynamic>;
      final moreInfo = first['more_info'] as Map<String, dynamic>?;
      final encUrl = moreInfo?['encrypted_media_url']?.toString() ?? '';
      final has320 = moreInfo?['320kbps'] == 'true' || moreInfo?['320kbps'] == true;

      final stream = _bestStream(encUrl, has320);
      if (stream != null) {
        _streamCache[cacheKey] = stream;
        return stream;
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
      final res = await http.get(uri, headers: _headers);
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

      return _bestStream(encUrl, has320);
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
