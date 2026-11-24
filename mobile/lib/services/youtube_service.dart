import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:youtube_explode_dart/youtube_explode_dart.dart';
import '../models/track.dart';

class YoutubeService {
  static final YoutubeService _instance = YoutubeService._internal();
  factory YoutubeService() => _instance;
  YoutubeService._internal();

  final YoutubeExplode _yt = YoutubeExplode();
  final Map<String, String> _streamCache = {};

  Future<List<Track>> search(String query, {int limit = 25}) async {
    final q = query.trim();
    if (q.isEmpty) return [];

    try {
      final searchResults = await _yt.search.search(q);
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
      debugPrint('[YoutubeService] Search error: $e');
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
    try {
      final quickPicksFuture = search('top hits songs 2026', limit: 12);
      final trendingFuture = search('popular music trending', limit: 12);
      final chillFuture = search('lofi hip hop relax chill', limit: 10);

      final results = await Future.wait([quickPicksFuture, trendingFuture, chillFuture]);

      return {
        'Quick Picks': results[0],
        'Trending Now': results[1],
        'Chill & Relax': results[2],
      };
    } catch (e) {
      debugPrint('[YoutubeService] Home feed error: $e');
      return {
        'Quick Picks': [],
        'Trending Now': [],
        'Chill & Relax': [],
      };
    }
  }

  Future<String?> resolveStreamUrl(String trackId) async {
    final cleanId = trackId.replaceFirst('yt:', '');
    if (_streamCache.containsKey(cleanId)) {
      final cached = _streamCache[cleanId];
      if (cached != null && cached.isNotEmpty) return cached;
    }

    try {
      final manifest = await _yt.videos.streamsClient.getManifest(cleanId);
      final audioStreams = manifest.audioOnly;
      String rawUrl = '';

      if (audioStreams.isNotEmpty) {
        // Prioritize AAC / MP4 (itag 140) first for universal Android hardware decode
        AudioStreamInfo? selected;
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

      // Resolve any 302 redirects beforehand so ExoPlayer connects directly to destination CDN node
      final resolvedUrl = await _resolveRedirect(rawUrl);
      _streamCache[cleanId] = resolvedUrl;
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
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      );
      req.headers.set('Referer', 'https://www.youtube.com/');
      final resp = await req.close();
      final finalUrl = req.uri.toString();
      if (resp.statusCode == 200 || resp.statusCode == 206) {
        return finalUrl;
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
}
