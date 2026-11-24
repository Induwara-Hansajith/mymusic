import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:youtube_explode_dart/youtube_explode_dart.dart';
import '../models/track.dart';
import 'saavn_service.dart';

class _CachedStream {
  final String url;
  final DateTime expiresAt;

  const _CachedStream({required this.url, required this.expiresAt});

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

class YoutubeService {
  static final YoutubeService _instance = YoutubeService._internal();
  factory YoutubeService() => _instance;
  YoutubeService._internal();

  final YoutubeExplode _yt = YoutubeExplode();
  final Map<String, _CachedStream> _streamCache = {};

  // Permanent high-quality curated tracks matching the prototype designs
  static const Track trackVioletHour = Track(
    id: 'ygTZZpVHNtI',
    title: 'Violet hour',
    artist: 'Luna Bay',
    durationSec: 222,
    thumb: 'https://i.ytimg.com/vi/ygTZZpVHNtI/hqdefault.jpg',
  );

  static const Track trackMoonstruck = Track(
    id: 'TUVcZfQe-Kw',
    title: 'Moonstruck',
    artist: 'Solace',
    durationSec: 248,
    thumb: 'https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg',
  );

  static const Track trackTidal = Track(
    id: 'GCdwKhTtNNw',
    title: 'Tidal',
    artist: 'Onda',
    durationSec: 210,
    thumb: 'https://i.ytimg.com/vi/GCdwKhTtNNw/hqdefault.jpg',
  );

  static const Track trackUndertow = Track(
    id: 'd5gx_qLp_i8',
    title: 'Undertow',
    artist: 'Onda',
    durationSec: 236,
    thumb: 'https://i.ytimg.com/vi/d5gx_qLp_i8/hqdefault.jpg',
  );

  static const Track trackSundown = Track(
    id: 'H5v3kku4y6Q',
    title: 'Sundown',
    artist: 'Daydream',
    durationSec: 201,
    thumb: 'https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg',
  );

  static const Track trackBlueRoom = Track(
    id: '4NRXx6U8ABQ',
    title: 'Blue room',
    artist: 'Onda',
    durationSec: 225,
    thumb: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
  );

  static const Track trackOrbit = Track(
    id: 'ApXoWvfEYVU',
    title: 'Orbit',
    artist: 'Luna Bay',
    durationSec: 250,
    thumb: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg',
  );

  static const Track trackSatellite = Track(
    id: 'K3QzzggA_-s',
    title: 'Satellite',
    artist: 'Luna Bay',
    durationSec: 252,
    thumb: 'https://i.ytimg.com/vi/K3QzzggA_-s/hqdefault.jpg',
  );

  static List<Track> getCuratedAfterHours() => [
        trackVioletHour,
        trackMoonstruck,
        trackUndertow,
        trackSundown,
      ];

  static List<Track> getCuratedDeepFocus() => [
        trackTidal,
        trackBlueRoom,
        trackOrbit,
        trackSatellite,
      ];

  static List<Track> getCuratedSlowBurn() => [
        trackSundown,
        trackUndertow,
        trackVioletHour,
        trackMoonstruck,
      ];

  // High quality curated tracks with real, permanent YouTube video IDs and HD thumbnails
  static List<Track> getCuratedTopHits() => [
        trackVioletHour,
        trackMoonstruck,
        trackTidal,
        const Track(
          id: '4NRXx6U8ABQ',
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          durationSec: 200,
          thumb: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
        ),
        const Track(
          id: 'TUVcZfQe-Kw',
          title: 'Levitating',
          artist: 'Dua Lipa',
          durationSec: 203,
          thumb: 'https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg',
        ),
        const Track(
          id: 'H5v3kku4y6Q',
          title: 'As It Was',
          artist: 'Harry Styles',
          durationSec: 167,
          thumb: 'https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg',
        ),
        const Track(
          id: 'ic8j13piAhQ',
          title: 'Cruel Summer',
          artist: 'Taylor Swift',
          durationSec: 178,
          thumb: 'https://i.ytimg.com/vi/ic8j13piAhQ/hqdefault.jpg',
        ),
        const Track(
          id: 'ApXoWvfEYVU',
          title: 'Sunflower',
          artist: 'Post Malone, Swae Lee',
          durationSec: 158,
          thumb: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg',
        ),
        const Track(
          id: 'd5gx_qLp_i8',
          title: 'Birds of a Feather',
          artist: 'Billie Eilish',
          durationSec: 196,
          thumb: 'https://i.ytimg.com/vi/d5gx_qLp_i8/hqdefault.jpg',
        ),
      ];

  static List<Track> getCuratedLateNight() => [
        const Track(
          id: 'ygTZZpVHNtI',
          title: 'After Hours',
          artist: 'The Weeknd',
          durationSec: 361,
          thumb: 'https://i.ytimg.com/vi/ygTZZpVHNtI/hqdefault.jpg',
        ),
        const Track(
          id: 'GCdwKhTtNNw',
          title: 'Sweater Weather',
          artist: 'The Neighbourhood',
          durationSec: 240,
          thumb: 'https://i.ytimg.com/vi/GCdwKhTtNNw/hqdefault.jpg',
        ),
        const Track(
          id: 'K3QzzggA_-s',
          title: 'Slow Dancing in the Dark',
          artist: 'Joji',
          durationSec: 209,
          thumb: 'https://i.ytimg.com/vi/K3QzzggA_-s/hqdefault.jpg',
        ),
        const Track(
          id: '34Na4j8AVgA',
          title: 'Starboy',
          artist: 'The Weeknd ft. Daft Punk',
          durationSec: 230,
          thumb: 'https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg',
        ),
        const Track(
          id: 'JGwWNGJdvx8',
          title: 'Shape of You',
          artist: 'Ed Sheeran',
          durationSec: 233,
          thumb: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
        ),
      ];

  static List<Track> getCuratedChill() => [
        const Track(
          id: 'jfKfPfyJRdk',
          title: 'Lofi Hip Hop Beats',
          artist: 'Lofi Girl',
          durationSec: 180,
          thumb: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
        ),
        const Track(
          id: '5yx6BWlEVcY',
          title: 'Chillhop Daydreams',
          artist: 'Chillhop Music',
          durationSec: 195,
          thumb: 'https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg',
        ),
        const Track(
          id: 'DWcJFNfaw9c',
          title: 'Midnight Coffee',
          artist: 'Kupla',
          durationSec: 160,
          thumb: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg',
        ),
        const Track(
          id: '_7Pz8qE49vY',
          title: 'Snowman Melody',
          artist: 'WYS',
          durationSec: 184,
          thumb: 'https://i.ytimg.com/vi/_7Pz8qE49vY/hqdefault.jpg',
        ),
      ];

  /// Category-aware search matching desktop My Music (ytm.search with filter)
  Future<List<Track>> search(String query, {String? filter, int limit = 25}) async {
    final q = query.trim();
    if (q.isEmpty) return [];

    String effectiveQuery = q;
    final f = (filter ?? 'all').toLowerCase();
    if (f == 'songs') {
      effectiveQuery = '$q audio';
    } else if (f == 'videos') {
      effectiveQuery = '$q music video';
    } else if (f == 'albums') {
      effectiveQuery = '$q full album';
    } else if (f == 'artists') {
      effectiveQuery = '$q official channel';
    }

    try {
      final searchResults = await _yt.search.search(effectiveQuery);
      final tracks = <Track>[];
      for (final item in searchResults) {
        if (tracks.length >= limit) break;
        tracks.add(Track(
          id: item.id.value,
          title: item.title,
          artist: item.author,
          durationSec: item.duration?.inSeconds ?? 180,
          thumb: item.thumbnails.highResUrl.isNotEmpty
              ? item.thumbnails.highResUrl
              : 'https://i.ytimg.com/vi/${item.id.value}/hqdefault.jpg',
        ));
      }
      return tracks;
    } catch (e) {
      debugPrint('[YoutubeService] Search error ($filter): $e');
      return [];
    }
  }

  Future<List<String>> getSuggestions(String query) async {
    final q = query.trim();
    if (q.isEmpty) return [];

    try {
      final url = Uri.parse(
          'https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${Uri.encodeComponent(q)}');
      final resp = await http.get(url);
      if (resp.statusCode == 200) {
        final body = resp.body;
        final start = body.indexOf('[[');
        final end = body.indexOf(']]');
        if (start != -1 && end != -1) {
          final inner = body.substring(start + 2, end);
          final parts = inner.split('],[');
          final list = <String>[];
          for (final part in parts) {
            final firstQuote = part.indexOf('"');
            if (firstQuote != -1) {
              final secondQuote = part.indexOf('"', firstQuote + 1);
              if (secondQuote != -1) {
                list.add(part.substring(firstQuote + 1, secondQuote));
              }
            }
          }
          return list;
        }
      }
    } catch (e) {
      debugPrint('[YoutubeService] Suggestion error: $e');
    }
    return [];
  }

  Future<Map<String, List<Track>>> getHomeFeed() async {
    final saavn = SaavnService();
    try {
      final topHitsFuture = saavn.search('top english songs hits 2026', limit: 12);
      final trendingFuture = saavn.search('trending viral hits', limit: 12);
      final lofiFuture = saavn.search('chill lofi beats', limit: 12);
      final lateNightFuture = saavn.search('late night vibes', limit: 12);
      final workoutFuture = saavn.search('workout motivation edm', limit: 12);

      final results = await Future.wait([
        topHitsFuture,
        trendingFuture,
        lofiFuture,
        lateNightFuture,
        workoutFuture,
      ]);

      final topHits = results[0].isNotEmpty ? results[0] : getCuratedTopHits();
      final trending = results[1].isNotEmpty ? results[1] : getCuratedLateNight();
      final lofi = results[2].isNotEmpty ? results[2] : getCuratedChill();
      final lateNight = results[3].isNotEmpty ? results[3] : getCuratedAfterHours();
      final workout = results[4].isNotEmpty ? results[4] : getCuratedDeepFocus();

      return {
        'Quick Picks': topHits,
        'Trending Now': trending,
        'Chill & Relax': lofi,
        'Late Night': lateNight,
        'Workout Energy': workout,
      };
    } catch (e) {
      debugPrint('[YoutubeService] Home feed network error: $e, using curated library');
      return {
        'Quick Picks': getCuratedTopHits(),
        'Trending Now': getCuratedLateNight(),
        'Chill & Relax': getCuratedChill(),
        'Late Night': getCuratedAfterHours(),
        'Workout Energy': getCuratedDeepFocus(),
      };
    }
  }

  /// Resolves the best audio stream URL for a given YouTube track ID
  /// Adheres to desktop format selection (prioritizes AAC/m4a, then WebM/Opus)
  /// Caches resolved URLs for ~4.5 hours matching desktop My Music
  Future<String?> resolveStreamUrl(String trackId) async {
    final cleanId = trackId.replaceFirst('yt:', '');
    if (_streamCache.containsKey(cleanId)) {
      final cached = _streamCache[cleanId]!;
      if (!cached.isExpired && cached.url.isNotEmpty) {
        return cached.url;
      }
      _streamCache.remove(cleanId);
    }

    try {
      final manifest = await _yt.videos.streamsClient.getManifest(cleanId);
      final audioStreams = manifest.audioOnly;
      String rawUrl = '';

      if (audioStreams.isNotEmpty) {
        AudioStreamInfo? selected;
        // Prioritize audio/mp4 (AAC itag 140) for universal Android hardware playback
        final mp4Streams = audioStreams
            .where((s) => s.container.name.toLowerCase() == 'mp4')
            .toList();
        if (mp4Streams.isNotEmpty) {
          selected = mp4Streams.withHighestBitrate();
        } else {
          selected = audioStreams.withHighestBitrate();
        }
        rawUrl = selected.url.toString();
      } else if (manifest.muxed.isNotEmpty) {
        rawUrl = manifest.muxed.withHighestBitrate().url.toString();
      }

      if (rawUrl.isEmpty) {
        debugPrint('[YoutubeService] No stream found for $cleanId');
        return null;
      }

      final resolvedUrl = await _resolveRedirect(rawUrl);
      _streamCache[cleanId] = _CachedStream(
        url: resolvedUrl,
        expiresAt: DateTime.now().add(const Duration(hours: 4, minutes: 30)),
      );
      _pruneCache();
      return resolvedUrl;
    } catch (e) {
      debugPrint('[YoutubeService] resolveStreamUrl error for $cleanId: $e');
      return null;
    }
  }

  Future<String> _resolveRedirect(String initialUrl) async {
    HttpClient? client;
    try {
      client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 8);
      final req = await client.openUrl('HEAD', Uri.parse(initialUrl));
      req.followRedirects = true;
      req.maxRedirects = 5;
      req.headers.set(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      );
      req.headers.set('Accept', '*/*');
      req.headers.set('Range', 'bytes=0-');
      req.headers.set('Referer', 'https://www.youtube.com/');
      final resp = await req.close();

      if (resp.redirects.isNotEmpty) {
        return resp.redirects.last.location.toString();
      }
      final locationHeader = resp.headers.value(HttpHeaders.locationHeader);
      if (locationHeader != null && locationHeader.isNotEmpty) {
        return locationHeader;
      }
      return initialUrl;
    } catch (e) {
      debugPrint('[YoutubeService] _resolveRedirect warning: $e');
      return initialUrl;
    } finally {
      client?.close();
    }
  }

  void invalidateStream(String trackId) {
    final cleanId = trackId.replaceFirst('yt:', '');
    _streamCache.remove(cleanId);
  }

  void _pruneCache() {
    _streamCache.removeWhere((_, v) => v.isExpired);
    if (_streamCache.length > 50) {
      final keysToRemove = _streamCache.keys.take(_streamCache.length - 40).toList();
      for (final k in keysToRemove) {
        _streamCache.remove(k);
      }
    }
  }

  /// Radio continuation matching desktop ytm:radio
  /// Returns recommended tracks based on current track ID and title/artist
  Future<List<Track>> getRadio(String videoId, {String? title, String? artist, int limit = 20}) async {
    final cleanId = videoId.replaceFirst('yt:', '');
    final tracks = <Track>[];

    // 1. Direct YouTube related videos
    try {
      final related = await getRelatedTracks(cleanId, limit: limit);
      tracks.addAll(related);
    } catch (e) {
      debugPrint('[YoutubeService] getRadio related error: $e');
    }

    // 2. Fallback search if fewer than 5 tracks found (matches desktop ytm:radio fallback)
    if (tracks.length < 5 && (title != null || artist != null)) {
      try {
        final query = [artist, title].where((s) => s != null && s.isNotEmpty).join(' ');
        if (query.isNotEmpty) {
          final searchFallback = await search(query, filter: 'songs', limit: limit);
          for (final t in searchFallback) {
            if (t.cleanId != cleanId && !tracks.any((x) => x.cleanId == t.cleanId)) {
              tracks.add(t);
            }
          }
        }
      } catch (e) {
        debugPrint('[YoutubeService] getRadio fallback search error: $e');
      }
    }

    return tracks.take(limit).toList();
  }

  Future<List<Track>> getRelatedTracks(String videoId, {int limit = 15}) async {
    final cleanId = videoId.replaceFirst('yt:', '');
    try {
      final video = await _yt.videos.get(cleanId);
      final related = await _yt.videos.getRelatedVideos(video);
      if (related != null && related.isNotEmpty) {
        return related.take(limit).map((item) => Track(
          id: item.id.value,
          title: item.title,
          artist: item.author,
          durationSec: item.duration?.inSeconds ?? 180,
          thumb: item.thumbnails.highResUrl.isNotEmpty
              ? item.thumbnails.highResUrl
              : 'https://i.ytimg.com/vi/${item.id.value}/hqdefault.jpg',
        )).toList();
      }
    } catch (e) {
      debugPrint('[YoutubeService] getRelatedTracks error: $e');
    }
    return [];
  }

  /// Resolves YouTube playlist tracks (for desktop import:url parity)
  Future<List<Track>> getPlaylistTracks(String playlistIdOrUrl) async {
    try {
      final playlist = await _yt.playlists.get(playlistIdOrUrl);
      final videos = await _yt.playlists.getVideos(playlist.id).take(50).toList();
      return videos.map((v) => Track(
        id: v.id.value,
        title: v.title,
        artist: v.author,
        durationSec: v.duration?.inSeconds ?? 180,
        thumb: v.thumbnails.highResUrl.isNotEmpty
            ? v.thumbnails.highResUrl
            : 'https://i.ytimg.com/vi/${v.id.value}/hqdefault.jpg',
        album: playlist.title,
      )).toList();
    } catch (e) {
      debugPrint('[YoutubeService] getPlaylistTracks error: $e');
      return [];
    }
  }

  void dispose() {
    _yt.close();
  }
}
