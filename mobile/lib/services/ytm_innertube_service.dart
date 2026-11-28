import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/track.dart';
import '../models/ytm_models.dart';

class YtmInnertubeService {
  static final YtmInnertubeService _instance = YtmInnertubeService._internal();
  factory YtmInnertubeService() => _instance;
  YtmInnertubeService._internal();

  static const _endpoint = 'https://music.youtube.com/youtubei/v1';
  static const _context = {
    'client': {
      'clientName': 'WEB_REMIX',
      'clientVersion': '1.20241106.01.00',
      'hl': 'en',
      'gl': 'US',
    }
  };

  static const Map<String, String> _searchParams = {
    'songs': 'EgWKAQIIAWoMEAMQBBAJEAoQBRAV',
    'videos': 'EgWKAQIQAWoMEAMQBBAJEAoQBRAV',
    'albums': 'EgWKAQIYAWoMEAMQBBAJEAoQBRAV',
    'artists': 'EgWKAQIgAWoMEAMQBBAJEAoQBRAV',
    'playlists': 'EgWKAQIoAWoMEAMQBBAJEAoQBRAV',
  };

  final http.Client _http = http.Client();
  final Map<String, YtmAlbum> _albumCache = {};
  final Map<String, YtmArtist> _artistCache = {};
  final Map<String, String> _artistThumbCache = {};

  Future<Map<String, dynamic>?> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final resp = await _http
          .post(
            Uri.parse('$_endpoint/$path?prettyPrint=false'),
            headers: const {
              'Content-Type': 'application/json',
              'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            },
            body: jsonEncode({'context': _context, ...body}),
          )
          .timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final decoded = jsonDecode(resp.body);
        if (decoded is Map<String, dynamic>) return decoded;
      }
    } catch (e) {
      debugPrint('[YtmInnertube] $path error: $e');
    }
    return null;
  }

  static String upgradeThumbUrl(String url, {bool highRes = true}) {
    if (url.isEmpty) return '';
    if (url.contains('googleusercontent.com') || url.contains('ggpht.com')) {
      // Use w544 (not w1024) – Android CDN rate-limits very large crops with 403s.
      if (RegExp(r'=w\d+-h\d+', caseSensitive: false).hasMatch(url)) {
        return url.replaceAll(
          RegExp(r'=w\d+-h\d+[^?]*', caseSensitive: false),
          highRes ? '=w544-h544-l90-rj' : '=w226-h226-l90-rj',
        );
      }
      if (RegExp(r'=s\d+', caseSensitive: false).hasMatch(url)) {
        return url.replaceAll(
          RegExp(r'=s\d+[^?]*', caseSensitive: false),
          highRes ? '=s544-l90-rj' : '=s226-l90-rj',
        );
      }
      return url;
    }
    if (url.contains('ytimg.com') || url.contains('youtube.com/vi')) {
      final clean = url.split('?').first;
      // Use hqdefault because max-resolution thumbnails are not available for every video.
      return clean.replaceAll(
        RegExp(
          r'/(?:default|mqdefault|sddefault|maxresdefault)\.jpg$',
          caseSensitive: false,
        ),
        '/hqdefault.jpg',
      );
    }
    return url;
  }

  static String _runsText(dynamic obj) {
    if (obj == null) return '';
    if (obj is String) return obj;
    if (obj is Map) {
      if (obj['simpleText'] is String) return obj['simpleText'] as String;
      final runs = obj['runs'];
      if (runs is List) {
        return runs.map((r) => (r is Map ? r['text'] : '') ?? '').join('');
      }
    }
    return '';
  }

  static String _extractThumb(dynamic renderer) {
    if (renderer is! Map) return '';
    final thumbObj = renderer['thumbnail'];
    List? thumbs;
    if (thumbObj is Map) {
      if (thumbObj['musicThumbnailRenderer'] is Map) {
        thumbs = (thumbObj['musicThumbnailRenderer']['thumbnail'] as Map?)?['thumbnails'] as List?;
      } else if (thumbObj['croppedSquareThumbnailRenderer'] is Map) {
        thumbs = (thumbObj['croppedSquareThumbnailRenderer']['thumbnail'] as Map?)?['thumbnails'] as List?;
      } else if (thumbObj['thumbnails'] is List) {
        thumbs = thumbObj['thumbnails'] as List?;
      }
    }
    if (thumbs != null && thumbs.isNotEmpty) {
      final last = thumbs.last;
      if (last is Map && last['url'] is String) {
        return upgradeThumbUrl(last['url'] as String);
      }
    }
    return '';
  }

  static int _parseDuration(String text) {
    final parts = text.trim().split(':');
    if (parts.length < 2 || parts.length > 3) return 0;
    int total = 0;
    for (final p in parts) {
      final n = int.tryParse(p);
      if (n == null) return 0;
      total = total * 60 + n;
    }
    return total;
  }

  static final _timeRe = RegExp(r'^(?:\d+:)?\d{1,2}:\d{2}$');
  static final _kindRe = RegExp(
    r'^(?:song|video|album|ep|single|playlist|artist|featured on|profile|podcast|episode|top result)$',
    caseSensitive: false,
  );
  static final _metricRe = RegExp(
    r'^\d+(?:[.,]\d+)?\s*[KMB]?\s*(?:plays|views|subscribers|songs|videos)$',
    caseSensitive: false,
  );

  Track? _parseListItemAsTrack(Map<String, dynamic> item, {String forceType = ''}) {
    final playlistItemData = item['playlistItemData'] as Map?;
    final overlayEp = ((item['overlay'] as Map?)?['musicItemThumbnailOverlayRenderer']
            ?['content']?['musicPlayButtonRenderer']?['playNavigationEndpoint'] as Map?);
    final videoId = (playlistItemData?['videoId'] as String?) ??
        (overlayEp?['watchEndpoint']?['videoId'] as String?) ??
        (item['navigationEndpoint']?['watchEndpoint']?['videoId'] as String?);
    if (videoId == null || videoId.isEmpty) return null;

    final flexCols = item['flexColumns'] as List? ?? [];
    String title = '';
    if (flexCols.isNotEmpty) {
      title = _runsText((flexCols[0] as Map?)?['musicResponsiveListItemFlexColumnRenderer']?['text']);
    }
    if (title.isEmpty) title = 'Unknown title';

    String artist = '';
    String? artistId;
    String album = '';
    String? albumId;
    int dur = 0;

    for (int i = 1; i < flexCols.length; i++) {
      final textObj = (flexCols[i] as Map?)?['musicResponsiveListItemFlexColumnRenderer']?['text'];
      final runs = (textObj is Map ? textObj['runs'] : null) as List? ?? [];
      for (final r in runs) {
        if (r is! Map) continue;
        final txt = (r['text'] as String? ?? '').trim();
        if (txt.isEmpty || txt == '•' || _kindRe.hasMatch(txt) || _metricRe.hasMatch(txt)) {
          continue;
        }
        if (_timeRe.hasMatch(txt)) {
          dur = _parseDuration(txt);
          continue;
        }
        final browseId = (r['navigationEndpoint']?['browseEndpoint']?['browseId'] as String?);
        final pageType = (r['navigationEndpoint']?['browseEndpoint']
                ?['browseEndpointContextSupportedConfigs']
                ?['browseEndpointContextMusicConfig']?['pageType'] as String?) ??
            '';
        if (browseId != null && (browseId.startsWith('MPRE') || pageType.contains('ALBUM'))) {
          album = txt;
          albumId = browseId;
        } else if (browseId != null && (browseId.startsWith('UC') || pageType.contains('ARTIST'))) {
          artist = artist.isEmpty ? txt : '$artist, $txt';
          artistId ??= browseId;
        } else if (!RegExp(r'^\d{4}$').hasMatch(txt)) {
          if (artist.isEmpty) {
            artist = txt;
          } else if (album.isEmpty && i > 1) {
            album = txt;
          }
        }
      }
    }

    final fixedCols = item['fixedColumns'] as List? ?? [];
    if (dur == 0 && fixedCols.isNotEmpty) {
      final t = _runsText((fixedCols[0] as Map?)?['musicResponsiveListItemFixedColumnRenderer']?['text']);
      dur = _parseDuration(t);
    }

    var thumb = _extractThumb(item);
    if (thumb.isEmpty && RegExp(r'^[A-Za-z0-9_-]{11}$').hasMatch(videoId)) {
      thumb = 'https://i.ytimg.com/vi/$videoId/hqdefault.jpg';
    }

    final isVideo = forceType == 'video';
    return Track(
      id: videoId,
      title: title,
      artist: artist.isEmpty ? 'Unknown' : artist,
      artistId: artistId,
      album: album.isEmpty ? null : album,
      albumId: albumId,
      durationSec: dur > 0 ? dur : 180,
      thumb: thumb,
      type: isVideo ? 'video' : 'song',
    );
  }

  YtmAlbum? _parseListItemAsAlbum(Map<String, dynamic> item) {
    final browseId = item['navigationEndpoint']?['browseEndpoint']?['browseId'] as String?;
    if (browseId == null || browseId.isEmpty) return null;
    final flexCols = item['flexColumns'] as List? ?? [];
    final title = flexCols.isNotEmpty
        ? _runsText((flexCols[0] as Map?)?['musicResponsiveListItemFlexColumnRenderer']?['text'])
        : 'Album';
    String artist = '';
    String? artistId;
    String year = '';
    for (int i = 1; i < flexCols.length; i++) {
      final runs = ((flexCols[i] as Map?)?['musicResponsiveListItemFlexColumnRenderer']?['text']?['runs']) as List? ?? [];
      for (final r in runs) {
        if (r is! Map) continue;
        final txt = (r['text'] as String? ?? '').trim();
        if (txt.isEmpty || txt == '•' || _kindRe.hasMatch(txt)) continue;
        if (RegExp(r'^\d{4}$').hasMatch(txt)) {
          year = txt;
          continue;
        }
        final bid = r['navigationEndpoint']?['browseEndpoint']?['browseId'] as String?;
        if (artist.isEmpty) {
          artist = txt;
          artistId = bid;
        }
      }
    }
    return YtmAlbum(
      id: browseId,
      title: title.isEmpty ? 'Album' : title,
      artist: artist,
      artistId: artistId,
      year: year,
      thumb: _extractThumb(item),
    );
  }

  YtmArtist? _parseListItemAsArtist(Map<String, dynamic> item) {
    final browseId = item['navigationEndpoint']?['browseEndpoint']?['browseId'] as String?;
    if (browseId == null || browseId.isEmpty) return null;
    final flexCols = item['flexColumns'] as List? ?? [];
    final name = flexCols.isNotEmpty
        ? _runsText((flexCols[0] as Map?)?['musicResponsiveListItemFlexColumnRenderer']?['text'])
        : 'Artist';
    return YtmArtist(
      id: browseId,
      name: name.isEmpty ? 'Artist' : name,
      thumb: _extractThumb(item),
    );
  }

  YtmPlaylistRef? _parseListItemAsPlaylist(Map<String, dynamic> item) {
    final browseId = item['navigationEndpoint']?['browseEndpoint']?['browseId'] as String?;
    if (browseId == null || browseId.isEmpty) return null;
    final flexCols = item['flexColumns'] as List? ?? [];
    final title = flexCols.isNotEmpty
        ? _runsText((flexCols[0] as Map?)?['musicResponsiveListItemFlexColumnRenderer']?['text'])
        : 'Playlist';
    final owner = flexCols.length > 1
        ? _runsText((flexCols[1] as Map?)?['musicResponsiveListItemFlexColumnRenderer']?['text'])
        : '';
    return YtmPlaylistRef(
      id: browseId,
      title: title.isEmpty ? 'Playlist' : title,
      owner: owner,
      thumb: _extractThumb(item),
    );
  }

  dynamic _parseTwoRowItem(Map<String, dynamic> item) {
    final nav = item['navigationEndpoint'] as Map?;
    final browseId = nav?['browseEndpoint']?['browseId'] as String?;
    final videoId = nav?['watchEndpoint']?['videoId'] as String?;
    final pageType = (nav?['browseEndpoint']?['browseEndpointContextSupportedConfigs']
            ?['browseEndpointContextMusicConfig']?['pageType'] as String?) ??
        '';
    final title = _runsText(item['title']);
    final sub = _runsText(item['subtitle']);
    final subParts = sub
        .split('•')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty && !_kindRe.hasMatch(s) && !_metricRe.hasMatch(s))
        .toList();
    final thumb = _extractThumb(item);

    if (browseId != null && (browseId.startsWith('MPRE') || pageType.contains('ALBUM'))) {
      return YtmAlbum(
        id: browseId,
        title: title,
        artist: subParts.isNotEmpty ? subParts.first : '',
        thumb: thumb,
      );
    }
    if (browseId != null && (browseId.startsWith('UC') || pageType == 'MUSIC_PAGE_TYPE_ARTIST')) {
      return YtmArtist(id: browseId, name: title, thumb: thumb);
    }
    if (browseId != null &&
        (browseId.startsWith('VL') || browseId.startsWith('PL') || pageType.contains('PLAYLIST'))) {
      return YtmPlaylistRef(
        id: browseId,
        title: title,
        owner: subParts.isNotEmpty ? subParts.last : '',
        thumb: thumb,
      );
    }
    if (videoId != null && videoId.isNotEmpty) {
      return Track(
        id: videoId,
        title: title,
        artist: subParts.isNotEmpty ? subParts.first : 'Unknown',
        durationSec: 180,
        thumb: thumb.isNotEmpty ? thumb : 'https://i.ytimg.com/vi/$videoId/hqdefault.jpg',
      );
    }
    return null;
  }

  Future<List<YtmHomeShelf>> getHomeShelves() async {
    final data = await _post('browse', {'browseId': 'FEmusic_home'});
    if (data == null) return [];

    final tabs = data['contents']?['singleColumnBrowseResultsRenderer']?['tabs'] as List? ?? [];
    if (tabs.isEmpty) return [];
    final sections = (tabs[0] as Map?)?['tabRenderer']?['content']
            ?['sectionListRenderer']?['contents'] as List? ??
        [];

    final shelves = <YtmHomeShelf>[];
    for (final sec in sections) {
      if (sec is! Map) continue;
      final carousel = sec['musicCarouselShelfRenderer'] as Map?;
      final listShelf = sec['musicShelfRenderer'] as Map?;
      final shelf = carousel ?? listShelf;
      if (shelf == null) continue;

      final title = carousel != null
          ? _runsText(carousel['header']?['musicCarouselShelfBasicHeaderRenderer']?['title'])
          : _runsText(listShelf?['title']);
      final contents = shelf['contents'] as List? ?? [];

      final songs = <Track>[];
      final videos = <Track>[];
      final albums = <YtmAlbum>[];
      final artists = <YtmArtist>[];
      final playlists = <YtmPlaylistRef>[];

      for (final node in contents) {
        if (node is! Map) continue;
        if (node['musicResponsiveListItemRenderer'] is Map) {
          final t = _parseListItemAsTrack(
            Map<String, dynamic>.from(node['musicResponsiveListItemRenderer'] as Map),
          );
          if (t != null) songs.add(t);
        } else if (node['musicTwoRowItemRenderer'] is Map) {
          final parsed = _parseTwoRowItem(
            Map<String, dynamic>.from(node['musicTwoRowItemRenderer'] as Map),
          );
          if (parsed is Track) {
            songs.add(parsed);
          } else if (parsed is YtmAlbum) {
            albums.add(parsed);
          } else if (parsed is YtmArtist) {
            artists.add(parsed);
          } else if (parsed is YtmPlaylistRef) {
            playlists.add(parsed);
          }
        }
      }

      final out = YtmHomeShelf(
        title: title.isEmpty ? 'For you' : title,
        songs: songs,
        videos: videos,
        albums: albums,
        artists: artists,
        playlists: playlists,
      );
      if (!out.isEmpty) shelves.add(out);
    }
    return shelves.take(6).toList();
  }

  Future<YtmSearchResult> search(String query, String filter) async {
    final q = query.trim();
    if (q.isEmpty) return const YtmSearchResult();

    final f = filter.toLowerCase();
    final params = _searchParams[f];
    final body = <String, dynamic>{'query': q};
    if (params != null) body['params'] = params;

    final data = await _post('search', body);
    if (data == null) return const YtmSearchResult();

    final tabs = data['contents']?['tabbedSearchResultsRenderer']?['tabs'] as List? ?? [];
    if (tabs.isEmpty) return const YtmSearchResult();
    final sections = (tabs[0] as Map?)?['tabRenderer']?['content']
            ?['sectionListRenderer']?['contents'] as List? ??
        [];

    final songs = <Track>[];
    final videos = <Track>[];
    final albums = <YtmAlbum>[];
    final artists = <YtmArtist>[];
    final playlists = <YtmPlaylistRef>[];

    for (final sec in sections) {
      if (sec is! Map) continue;
      final shelf = sec['musicShelfRenderer'] as Map?;
      if (shelf == null) continue;
      for (final node in (shelf['contents'] as List? ?? [])) {
        if (node is! Map || node['musicResponsiveListItemRenderer'] is! Map) continue;
        final item = Map<String, dynamic>.from(node['musicResponsiveListItemRenderer'] as Map);
        if (f == 'albums') {
          final a = _parseListItemAsAlbum(item);
          if (a != null) albums.add(a);
        } else if (f == 'artists') {
          final a = _parseListItemAsArtist(item);
          if (a != null) artists.add(a);
        } else if (f == 'playlists') {
          final p = _parseListItemAsPlaylist(item);
          if (p != null) playlists.add(p);
        } else if (f == 'videos') {
          final v = _parseListItemAsTrack(item, forceType: 'video');
          if (v != null) videos.add(v);
        } else {
          final t = _parseListItemAsTrack(item);
          if (t != null) songs.add(t);
        }
      }
    }

    return YtmSearchResult(
      songs: songs,
      videos: videos,
      albums: albums,
      artists: artists,
      playlists: playlists,
    );
  }

  Future<YtmAlbum?> getAlbum(String id) async {
    if (id.isEmpty) return null;
    if (_albumCache.containsKey(id)) return _albumCache[id];
    final data = await _post('browse', {'browseId': id});
    if (data == null) return null;

    final twoCol = data['contents']?['twoColumnBrowseResultsRenderer'] as Map?;
    final header = twoCol?['tabs']?[0]?['tabRenderer']?['content']
            ?['sectionListRenderer']?['contents']?[0]?['musicResponsiveHeaderRenderer']
        as Map?;
    final title = _runsText(header?['title']);
    final sub = _runsText(header?['subtitle']);
    final thumb = _extractThumb(header);
    final parts = sub
        .split('•')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty && !_kindRe.hasMatch(s))
        .toList();
    final yearMatch = RegExp(r'\d{4}').firstMatch(sub);
    final albumArtist = _runsText(header?['straplineTextOne']);

    final tracksShelf = twoCol?['secondaryContents']?['sectionListRenderer']?['contents']?[0]
        ?['musicShelfRenderer']?['contents'] as List? ??
        [];
    final tracks = <Track>[];
    for (final node in tracksShelf) {
      if (node is! Map || node['musicResponsiveListItemRenderer'] is! Map) continue;
      final t = _parseListItemAsTrack(
        Map<String, dynamic>.from(node['musicResponsiveListItemRenderer'] as Map),
      );
      if (t != null) {
        tracks.add(t.copyWith(
          thumb: t.thumb.isEmpty || t.thumb.contains('hqdefault') && thumb.isNotEmpty ? (thumb.isNotEmpty ? thumb : t.thumb) : t.thumb,
          album: t.album ?? (title.isNotEmpty ? title : 'Album'),
          albumId: t.albumId ?? id,
          artist: (t.artist == 'Unknown' && albumArtist.isNotEmpty) ? albumArtist : t.artist,
        ));
      }
    }

    final result = YtmAlbum(
      id: id,
      title: title.isNotEmpty ? title : 'Album',
      artist: albumArtist.isNotEmpty ? albumArtist : (parts.isNotEmpty ? parts.first : ''),
      year: yearMatch?.group(0) ?? '',
      thumb: thumb,
      tracks: tracks,
    );
    _albumCache[id] = result;
    return result;
  }

  Future<YtmPlaylistRef?> getPlaylist(String id) async {
    if (id.isEmpty) return null;
    final browseId = id.startsWith('VL') || id.startsWith('PL') ? (id.startsWith('PL') ? 'VL$id' : id) : id;
    final data = await _post('browse', {'browseId': browseId});
    if (data == null) return null;

    final twoCol = data['contents']?['twoColumnBrowseResultsRenderer'] as Map?;
    final header = twoCol?['tabs']?[0]?['tabRenderer']?['content']
            ?['sectionListRenderer']?['contents']?[0]?['musicResponsiveHeaderRenderer']
        as Map?;
    final title = _runsText(header?['title']);
    final sub = _runsText(header?['subtitle']);
    final owner = _runsText(header?['straplineTextOne']);
    final thumb = _extractThumb(header);

    final secList = twoCol?['secondaryContents']?['sectionListRenderer']?['contents'] as List? ?? [];
    final plShelf = secList.isNotEmpty
        ? ((secList[0] as Map?)?['musicPlaylistShelfRenderer']?['contents'] ??
            (secList[0] as Map?)?['musicShelfRenderer']?['contents']) as List? ??
            []
        : [];
    final tracks = <Track>[];
    for (final node in plShelf) {
      if (node is! Map || node['musicResponsiveListItemRenderer'] is! Map) continue;
      final t = _parseListItemAsTrack(
        Map<String, dynamic>.from(node['musicResponsiveListItemRenderer'] as Map),
      );
      if (t != null) tracks.add(t);
    }

    return YtmPlaylistRef(
      id: id,
      title: title.isNotEmpty ? title : 'Playlist',
      owner: owner.isNotEmpty ? owner : sub,
      thumb: thumb,
      tracks: tracks,
    );
  }

  Future<YtmArtist?> getArtist(String id) async {
    if (id.isEmpty) return null;
    if (_artistCache.containsKey(id)) return _artistCache[id];
    final data = await _post('browse', {'browseId': id});
    if (data == null) return null;

    final header = data['header']?['musicImmersiveHeaderRenderer'] as Map? ??
        data['header']?['musicVisualHeaderRenderer'] as Map?;
    final name = _runsText(header?['title']);
    final thumb = _extractThumb(header);

    final tabs = data['contents']?['singleColumnBrowseResultsRenderer']?['tabs'] as List? ?? [];
    final sections = tabs.isNotEmpty
        ? ((tabs[0] as Map?)?['tabRenderer']?['content']?['sectionListRenderer']?['contents']
                as List? ??
            [])
        : [];

    final songs = <Track>[];
    final albums = <YtmAlbum>[];
    final singles = <YtmAlbum>[];
    final videos = <Track>[];
    final playlists = <YtmPlaylistRef>[];

    for (final sec in sections) {
      if (sec is! Map) continue;
      final shelf = sec['musicShelfRenderer'] as Map?;
      final carousel = sec['musicCarouselShelfRenderer'] as Map?;
      final shelfTitle = carousel != null
          ? _runsText(carousel['header']?['musicCarouselShelfBasicHeaderRenderer']?['title'])
              .toLowerCase()
          : _runsText(shelf?['title']).toLowerCase();
      final contents = (carousel ?? shelf)?['contents'] as List? ?? [];

      for (final node in contents) {
        if (node is! Map) continue;
        if (node['musicResponsiveListItemRenderer'] is Map) {
          final t = _parseListItemAsTrack(
            Map<String, dynamic>.from(node['musicResponsiveListItemRenderer'] as Map),
          );
          if (t != null) songs.add(t);
        } else if (node['musicTwoRowItemRenderer'] is Map) {
          final parsed = _parseTwoRowItem(
            Map<String, dynamic>.from(node['musicTwoRowItemRenderer'] as Map),
          );
          if (parsed is YtmAlbum) {
            if (shelfTitle.contains('single')) {
              singles.add(parsed);
            } else {
              albums.add(parsed);
            }
          } else if (parsed is YtmPlaylistRef) {
            playlists.add(parsed);
          } else if (parsed is Track) {
            videos.add(parsed);
          }
        }
      }
    }

    final result = YtmArtist(
      id: id,
      name: name.isNotEmpty ? name : 'Artist',
      thumb: thumb,
      songs: songs.take(10).toList(),
      albums: albums.take(12).toList(),
      singles: singles.take(12).toList(),
      videos: videos.take(12).toList(),
      playlists: playlists.take(6).toList(),
    );
    _artistCache[id] = result;
    return result;
  }

  Future<String?> resolveArtistThumb(String artistName, {String? artistId}) async {
    final key = (artistId ?? artistName).trim().toLowerCase();
    if (key.isEmpty) return null;
    if (_artistThumbCache.containsKey(key)) return _artistThumbCache[key];

    if (artistId != null && artistId.startsWith('UC')) {
      final a = await getArtist(artistId);
      if (a != null && a.thumb.isNotEmpty) {
        _artistThumbCache[key] = a.thumb;
        return a.thumb;
      }
    }
    if (artistName.isNotEmpty) {
      final res = await search(artistName, 'artists');
      if (res.artists.isNotEmpty && res.artists.first.thumb.isNotEmpty) {
        _artistThumbCache[key] = res.artists.first.thumb;
        return res.artists.first.thumb;
      }
    }
    return null;
  }
}
