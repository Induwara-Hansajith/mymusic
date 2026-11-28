import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:youtube_explode_dart/youtube_explode_dart.dart';
import '../models/track.dart';
import '../models/ytm_models.dart';
import 'saavn_service.dart';
import 'ytm_innertube_service.dart';

class _CachedStreamList {
  final List<String> urls;
  final DateTime expiresAt;

  const _CachedStreamList({required this.urls, required this.expiresAt});

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

class YoutubeService {
  static final YoutubeService _instance = YoutubeService._internal();
  factory YoutubeService() => _instance;
  YoutubeService._internal() {
    _probeClient.connectionTimeout = const Duration(seconds: 4);
  }

  static const String androidClientUserAgent =
      'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip';

  final YoutubeExplode _yt = YoutubeExplode();
  final YtmInnertubeService _innertube = YtmInnertubeService();
  final http.Client _http = http.Client();
  final HttpClient _probeClient = HttpClient();
  final Map<String, _CachedStreamList> _streamCache = {};

  static const Track trackVioletHour = Track(
    id: '4NRXx6U8ABQ',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    durationSec: 200,
    thumb: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
  );

  static const Track trackMoonstruck = Track(
    id: 'TUVcZfQe-Kw',
    title: 'Levitating',
    artist: 'Dua Lipa',
    durationSec: 203,
    thumb: 'https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg',
  );

  static const Track trackTidal = Track(
    id: 'GCdwKhTtNNw',
    title: 'Sweater Weather',
    artist: 'The Neighbourhood',
    durationSec: 240,
    thumb: 'https://i.ytimg.com/vi/GCdwKhTtNNw/hqdefault.jpg',
  );

  static const Track trackUndertow = Track(
    id: 'd5gx_qLp_i8',
    title: 'Birds of a Feather',
    artist: 'Billie Eilish',
    durationSec: 196,
    thumb: 'https://i.ytimg.com/vi/d5gx_qLp_i8/hqdefault.jpg',
  );

  static const Track trackSundown = Track(
    id: 'H5v3kku4y6Q',
    title: 'As It Was',
    artist: 'Harry Styles',
    durationSec: 167,
    thumb: 'https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg',
  );

  static const Track trackBlueRoom = Track(
    id: 'JGwWNGJdvx8',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    durationSec: 233,
    thumb: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
  );

  static const Track trackOrbit = Track(
    id: 'ApXoWvfEYVU',
    title: 'Sunflower',
    artist: 'Post Malone, Swae Lee',
    durationSec: 158,
    thumb: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg',
  );

  static const Track trackSatellite = Track(
    id: 'K3QzzggA_-s',
    title: 'Slow Dancing in the Dark',
    artist: 'Joji',
    durationSec: 209,
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

  static List<Track> getCuratedTopHits() => [
        trackVioletHour,
        trackMoonstruck,
        trackTidal,
        trackSundown,
        const Track(
          id: 'ic8j13piAhQ',
          title: 'Cruel Summer',
          artist: 'Taylor Swift',
          durationSec: 178,
          thumb: 'https://i.ytimg.com/vi/ic8j13piAhQ/hqdefault.jpg',
        ),
        trackOrbit,
        trackUndertow,
      ];

  static List<Track> getCuratedLateNight() => [
        trackVioletHour,
        trackTidal,
        trackSatellite,
        const Track(
          id: '34Na4j8AVgA',
          title: 'Starboy',
          artist: 'The Weeknd ft. Daft Punk',
          durationSec: 230,
          thumb: 'https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg',
        ),
        trackBlueRoom,
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

  Future<List<YtmHomeShelf>> getYtmHomeShelves() => _innertube.getHomeShelves();

  Future<YtmSearchResult> searchYtm(String query, String filter) async {
    final res = await _innertube.search(query, filter);
    if (filter == 'songs' && res.songs.isEmpty) {
      final fallback = await search(query, filter: 'songs', limit: 20);
      return YtmSearchResult(songs: fallback);
    }
    if (filter == 'videos' && res.videos.isEmpty) {
      final fallback = await search(query, filter: 'videos', limit: 20);
      return YtmSearchResult(videos: fallback);
    }
    return res;
  }

  Future<YtmAlbum?> getAlbum(String id) => _innertube.getAlbum(id);
  Future<YtmArtist?> getArtist(String id) => _innertube.getArtist(id);
  Future<YtmPlaylistRef?> getYtPlaylist(String id) => _innertube.getPlaylist(id);
  Future<String?> resolveArtistThumb(String name, {String? artistId}) =>
      _innertube.resolveArtistThumb(name, artistId: artistId);

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
      final searchResults = await _yt.search.search(effectiveQuery).timeout(const Duration(seconds: 7));
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
          type: f == 'videos' ? 'video' : 'song',
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
      final resp = await _http.get(url).timeout(const Duration(seconds: 4));
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
          return list.take(8).toList();
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
      final results = await Future.wait([
        saavn.search('top english songs hits 2026', limit: 12),
        saavn.search('trending viral hits', limit: 12),
        saavn.search('chill lofi beats', limit: 12),
        saavn.search('late night vibes', limit: 12),
        saavn.search('workout motivation edm', limit: 12),
      ]);

      return {
        'Quick Picks': results[0].isNotEmpty ? results[0] : getCuratedTopHits(),
        'Trending Now': results[1].isNotEmpty ? results[1] : getCuratedLateNight(),
        'Chill & Relax': results[2].isNotEmpty ? results[2] : getCuratedChill(),
        'Late Night': results[3].isNotEmpty ? results[3] : getCuratedAfterHours(),
        'Workout Energy': results[4].isNotEmpty ? results[4] : getCuratedDeepFocus(),
      };
    } catch (_) {
      return {
        'Quick Picks': getCuratedTopHits(),
        'Trending Now': getCuratedLateNight(),
        'Chill & Relax': getCuratedChill(),
        'Late Night': getCuratedAfterHours(),
        'Workout Energy': getCuratedDeepFocus(),
      };
    }
  }

  /// Resolves verified playable stream URLs for a YouTube video ID.
  /// Probes adaptive audio and muxed mp4 (`itag=18`) concurrently so 403/SABR
  /// adaptive URLs never stall ExoPlayer, while returning playback-ready URLs.
  Future<List<String>> resolveStreamCandidates(String trackId) async {
    final cleanId = trackId.replaceFirst('yt:', '');
    if (cleanId.isEmpty || cleanId.startsWith('saavn:')) return const [];

    if (_streamCache.containsKey(cleanId)) {
      final cached = _streamCache[cleanId]!;
      if (!cached.isExpired && cached.urls.isNotEmpty) {
        return cached.urls;
      }
      _streamCache.remove(cleanId);
    }

    try {
      final manifest = await _yt.videos.streamsClient
          .getManifest(
            cleanId,
            ytClients: [YoutubeApiClient.androidSdkless],
            requireWatchPage: false,
          )
          .timeout(const Duration(seconds: 7));

      final mp4Audio = manifest.audioOnly
          .where((s) => s.container.name.toLowerCase() == 'mp4')
          .toList()
        ..sort((a, b) => b.bitrate.bitsPerSecond.compareTo(a.bitrate.bitsPerSecond));

      final otherAudio = manifest.audioOnly
          .where((s) => s.container.name.toLowerCase() != 'mp4')
          .toList()
        ..sort((a, b) => b.bitrate.bitsPerSecond.compareTo(a.bitrate.bitsPerSecond));

      final mp4Muxed = manifest.muxed
          .where((s) => s.container.name.toLowerCase() == 'mp4')
          .toList()
        ..sort((a, b) => b.bitrate.bitsPerSecond.compareTo(a.bitrate.bitsPerSecond));

      final ordered = <StreamInfo>[
        if (mp4Audio.isNotEmpty) mp4Audio.first,
        if (mp4Muxed.isNotEmpty) mp4Muxed.first,
        if (mp4Audio.length > 1) mp4Audio[1],
        if (otherAudio.isNotEmpty) otherAudio.first,
        ...manifest.muxed.where((s) => !mp4Muxed.contains(s)).take(1),
      ];

      if (ordered.isEmpty) return const [];

      // Probe top candidates concurrently with Range 0-1023 to drop 403/dead URLs before ExoPlayer
      final probeResults = await Future.wait(
        ordered.map((s) async {
          final raw = s.url.toString();
          final ok = await _probeStreamUrl(raw);
          return ok ? raw : null;
        }),
      );

      final verified = probeResults.whereType<String>().toList();
      if (verified.isEmpty) return const [];

      _streamCache[cleanId] = _CachedStreamList(
        urls: verified,
        expiresAt: DateTime.now().add(const Duration(hours: 4, minutes: 30)),
      );
      _pruneCache();
      return verified;
    } catch (e) {
      debugPrint('[YoutubeService] resolveStreamCandidates error for $cleanId: $e');
      return const [];
    }
  }

  Future<String?> resolveStreamUrl(String trackId) async {
    final list = await resolveStreamCandidates(trackId);
    return list.isNotEmpty ? list.first : null;
  }

  Future<bool> _probeStreamUrl(String url) async {
    try {
      final req = await _probeClient
          .getUrl(Uri.parse(url))
          .timeout(const Duration(seconds: 3));
      req.headers.set('User-Agent', androidClientUserAgent);
      req.headers.set('Range', 'bytes=0-1023');
      final resp = await req.close().timeout(const Duration(seconds: 3));
      await resp.drain<void>();
      return resp.statusCode == 200 || resp.statusCode == 206;
    } catch (_) {
      return false;
    }
  }

  void invalidateStream(String trackId) {
    _streamCache.remove(trackId.replaceFirst('yt:', ''));
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

  Future<List<Track>> getRadio(
    String videoId, {
    String? title,
    String? artist,
    int limit = 20,
  }) async {
    final cleanId = videoId.replaceFirst('yt:', '');
    final tracks = <Track>[];

    try {
      final related = await getRelatedTracks(cleanId, limit: limit);
      tracks.addAll(related);
    } catch (_) {}

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
      } catch (_) {}
    }

    return tracks.take(limit).toList();
  }

  Future<List<Track>> getRelatedTracks(String videoId, {int limit = 15}) async {
    final cleanId = videoId.replaceFirst('yt:', '');
    try {
      final video = await _yt.videos.get(cleanId).timeout(const Duration(seconds: 5));
      final related = await _yt.videos.getRelatedVideos(video).timeout(const Duration(seconds: 6));
      if (related != null && related.isNotEmpty) {
        return related
            .take(limit)
            .map((item) => Track(
                  id: item.id.value,
                  title: item.title,
                  artist: item.author,
                  durationSec: item.duration?.inSeconds ?? 180,
                  thumb: item.thumbnails.highResUrl.isNotEmpty
                      ? item.thumbnails.highResUrl
                      : 'https://i.ytimg.com/vi/${item.id.value}/hqdefault.jpg',
                ))
            .toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<Track>> getPlaylistTracks(String playlistIdOrUrl) async {
    try {
      final playlist = await _yt.playlists.get(playlistIdOrUrl);
      final videos = await _yt.playlists.getVideos(playlist.id).take(80).toList();
      return videos
          .map((v) => Track(
                id: v.id.value,
                title: v.title,
                artist: v.author,
                durationSec: v.duration?.inSeconds ?? 180,
                thumb: v.thumbnails.highResUrl.isNotEmpty
                    ? v.thumbnails.highResUrl
                    : 'https://i.ytimg.com/vi/${v.id.value}/hqdefault.jpg',
                album: playlist.title,
              ))
          .toList();
    } catch (e) {
      debugPrint('[YoutubeService] getPlaylistTracks error: $e');
      return [];
    }
  }

  void dispose() {
    _probeClient.close(force: true);
    _http.close();
    _yt.close();
  }
}
