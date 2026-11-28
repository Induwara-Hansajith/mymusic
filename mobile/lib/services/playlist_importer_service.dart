import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/track.dart';
import 'youtube_service.dart';
import 'saavn_service.dart';

class ImportRow {
  final String title;
  final String artist;
  const ImportRow({required this.title, required this.artist});
}

class ImportedPlaylistResult {
  final String title;
  final List<Track> tracks;
  const ImportedPlaylistResult({required this.title, required this.tracks});
}

class PlaylistImporterService {
  static final PlaylistImporterService _instance =
      PlaylistImporterService._internal();
  factory PlaylistImporterService() => _instance;
  PlaylistImporterService._internal();

  final YoutubeService _yt = YoutubeService();
  final SaavnService _saavn = SaavnService();

  /// Mirrors desktop `parseCsv` in src/lib/importer.js
  List<ImportRow> parseCsvOrLines(String text) {
    final lines = text
        .split(RegExp(r'\r?\n'))
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    if (lines.isEmpty) return [];

    final first = lines.first;
    final delim = first.contains('\t')
        ? '\t'
        : (first.contains(';') ? ';' : ',');

    List<String> splitLine(String l) {
      final res = <String>[];
      final cur = StringBuffer();
      bool inQuotes = false;
      for (int i = 0; i < l.length; i++) {
        final c = l[i];
        if (c == '"') {
          inQuotes = !inQuotes;
        } else if (c == delim && !inQuotes) {
          res.add(cur.toString().trim());
          cur.clear();
        } else {
          cur.write(c);
        }
      }
      res.add(cur.toString().trim());
      return res
          .map((s) => s.replaceAll(RegExp(r'^"|"$'), '').trim())
          .toList();
    }

    final header = splitLine(lines.first).map((h) => h.toLowerCase()).toList();
    int titleIdx = header.indexWhere(
      (h) => RegExp(r'track|title|name|song', caseSensitive: false).hasMatch(h),
    );
    int artistIdx = header.indexWhere(
      (h) => RegExp(r'artist|author|singer|creator', caseSensitive: false)
          .hasMatch(h),
    );

    final hasHeader = titleIdx >= 0 || artistIdx >= 0;
    final startLine = hasHeader ? 1 : 0;
    if (titleIdx < 0) titleIdx = 0;
    if (artistIdx < 0) artistIdx = 1;

    final rows = <ImportRow>[];
    for (int i = startLine; i < lines.length && rows.length < 100; i++) {
      final cols = splitLine(lines[i]);
      String title = titleIdx < cols.length ? cols[titleIdx] : '';
      String artist = artistIdx < cols.length ? cols[artistIdx] : '';
      if (artist.isEmpty && title.contains(' - ')) {
        final parts = title.split(' - ');
        artist = parts.first.trim();
        title = parts.sublist(1).join(' - ').trim();
      }
      if (title.isNotEmpty) {
        rows.add(ImportRow(title: title, artist: artist));
      }
    }
    return rows;
  }

  Future<ImportedPlaylistResult> importFromUrl(String rawUrl) async {
    final url = rawUrl.trim();
    final uri = Uri.tryParse(url);
    if (uri == null || !(uri.isScheme('http') || uri.isScheme('https'))) {
      throw Exception('Please enter a valid YouTube or Spotify playlist URL.');
    }

    // 1. YouTube / YouTube Music playlist URL
    if (url.contains('youtube.com') || url.contains('youtu.be')) {
      final listId = uri.queryParameters['list'];
      if (listId != null && listId.isNotEmpty) {
        final ytmPl = await _yt.getYtPlaylist(listId);
        if (ytmPl != null && ytmPl.tracks.isNotEmpty) {
          return ImportedPlaylistResult(
            title: ytmPl.title,
            tracks: ytmPl.tracks,
          );
        }
      }
      final tracks = await _yt.getPlaylistTracks(url);
      if (tracks.isNotEmpty) {
        return ImportedPlaylistResult(
          title: tracks.first.album ?? 'Imported YouTube Playlist',
          tracks: tracks,
        );
      }
      throw Exception('Could not extract tracks from YouTube URL.');
    }

    // 2. Spotify public playlist URL
    if (url.contains('spotify.com')) {
      final match = RegExp(r'playlist/([A-Za-z0-9]+)').firstMatch(url);
      if (match != null) {
        final spId = match.group(1)!;
        final embedUrl = Uri.parse('https://open.spotify.com/embed/playlist/$spId');
        final resp = await http.get(embedUrl, headers: const {
          'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }).timeout(const Duration(seconds: 12));

        if (resp.statusCode == 200) {
          final rows = <ImportRow>[];
          String plTitle = 'Imported Spotify Mix';

          // Extract __NEXT_DATA__ script JSON embedded by Spotify
          final nextMatch = RegExp(
            r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
            dotAll: true,
          ).firstMatch(resp.body);
          if (nextMatch != null) {
            try {
              final data = jsonDecode(nextMatch.group(1)!);
              final entity = data?['props']?['pageProps']?['state']?['data']
                  ?['entity'];
              if (entity is Map) {
                plTitle = (entity['name'] ?? entity['title'] ?? plTitle).toString();
                final trackList = entity['trackList'] as List? ?? [];
                for (final t in trackList) {
                  if (t is Map) {
                    final title = (t['title'] ?? '').toString();
                    final subtitle = (t['subtitle'] ?? '').toString();
                    if (title.isNotEmpty) {
                      rows.add(ImportRow(title: title, artist: subtitle));
                    }
                  }
                }
              }
            } catch (e) {
              debugPrint('[Importer] Spotify JSON parse note: $e');
            }
          }

          if (rows.isNotEmpty) {
            final matched = await matchRows(rows);
            if (matched.isNotEmpty) {
              return ImportedPlaylistResult(title: plTitle, tracks: matched);
            }
          }
        }
      }
      throw Exception('Could not read public Spotify playlist tracks.');
    }

    throw Exception('Only YouTube, YouTube Music, and public Spotify playlist links are supported.');
  }

  Future<List<Track>> matchRows(List<ImportRow> rows) async {
    final matched = <Track>[];
    for (final r in rows.take(50)) {
      final q = '${r.title} ${r.artist}'.trim();
      try {
        final ytm = await _yt.searchYtm(q, 'songs');
        if (ytm.songs.isNotEmpty) {
          matched.add(ytm.songs.first);
          continue;
        }
      } catch (_) {}
      try {
        final sv = await _saavn.search(q, limit: 1);
        if (sv.isNotEmpty) {
          matched.add(sv.first);
        }
      } catch (_) {}
    }
    return matched;
  }
}
