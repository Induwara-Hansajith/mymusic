import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/track.dart';
import '../models/playlist.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  SharedPreferences? _prefs;

  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  SharedPreferences get prefs {
    if (_prefs == null) {
      throw StateError('StorageService not initialized. Call init() first.');
    }
    return _prefs!;
  }

  // ---------------- Favorites ----------------
  List<Track> getFavorites() {
    final list = prefs.getStringList('mymusic_favorites') ?? [];
    return list
        .map((str) {
          try {
            return Track.fromJson(jsonDecode(str) as Map<String, dynamic>);
          } catch (_) {
            return null;
          }
        })
        .whereType<Track>()
        .toList();
  }

  Future<void> saveFavorites(List<Track> tracks) async {
    final list = tracks.map((t) => jsonEncode(t.toJson())).toList();
    await prefs.setStringList('mymusic_favorites', list);
  }

  bool isFavorite(String trackId) => getFavorites().any((t) => t.id == trackId);

  Future<bool> toggleFavorite(Track track) async {
    final list = getFavorites();
    final index = list.indexWhere((t) => t.id == track.id);
    bool isNowFav;
    if (index >= 0) {
      list.removeAt(index);
      isNowFav = false;
    } else {
      list.insert(0, track);
      isNowFav = true;
    }
    await saveFavorites(list);
    return isNowFav;
  }

  // ---------------- Recents ----------------
  List<Track> getRecents() {
    final list = prefs.getStringList('mymusic_recent') ?? [];
    return list
        .map((str) {
          try {
            return Track.fromJson(jsonDecode(str) as Map<String, dynamic>);
          } catch (_) {
            return null;
          }
        })
        .whereType<Track>()
        .toList();
  }

  Future<void> addRecent(Track track) async {
    final list = getRecents();
    list.removeWhere((t) => t.id == track.id);
    list.insert(0, track);
    if (list.length > 80) list.removeRange(80, list.length);
    await prefs.setStringList(
      'mymusic_recent',
      list.map((t) => jsonEncode(t.toJson())).toList(),
    );
  }

  Future<void> clearRecents() async {
    await prefs.remove('mymusic_recent');
  }

  // ---------------- Playlists ----------------
  List<Playlist> getPlaylists() {
    final list = prefs.getStringList('mymusic_playlists') ?? [];
    return list
        .map((str) {
          try {
            return Playlist.fromJson(jsonDecode(str) as Map<String, dynamic>);
          } catch (_) {
            return null;
          }
        })
        .whereType<Playlist>()
        .toList();
  }

  Future<void> savePlaylists(List<Playlist> playlists) async {
    final list = playlists.map((p) => jsonEncode(p.toJson())).toList();
    await prefs.setStringList('mymusic_playlists', list);
  }

  Future<Playlist> createPlaylist(String name) async {
    final list = getPlaylists();
    final newPl = Playlist(
      id: 'pl_${DateTime.now().millisecondsSinceEpoch}',
      name: name.trim().isEmpty ? 'My Playlist' : name.trim(),
      tracks: [],
      createdAt: DateTime.now(),
    );
    list.insert(0, newPl);
    await savePlaylists(list);
    return newPl;
  }

  Future<void> renamePlaylist(String id, String newName) async {
    final clean = newName.trim();
    if (clean.isEmpty) return;
    final list = getPlaylists();
    final idx = list.indexWhere((p) => p.id == id);
    if (idx != -1) {
      final old = list[idx];
      list[idx] = Playlist(
        id: old.id,
        name: clean,
        tracks: old.tracks,
        createdAt: old.createdAt,
      );
      await savePlaylists(list);
    }
  }

  Future<void> deletePlaylist(String id) async {
    final list = getPlaylists();
    list.removeWhere((p) => p.id == id);
    await savePlaylists(list);
  }

  Future<void> addTrackToPlaylist(String playlistId, Track track) async {
    final list = getPlaylists();
    final idx = list.indexWhere((p) => p.id == playlistId);
    if (idx != -1) {
      final pl = list[idx];
      if (!pl.tracks.any((t) => t.id == track.id)) {
        pl.tracks.add(track);
        await savePlaylists(list);
      }
    }
  }

  Future<void> removeTrackFromPlaylist(String playlistId, String trackId) async {
    final list = getPlaylists();
    final idx = list.indexWhere((p) => p.id == playlistId);
    if (idx != -1) {
      list[idx].tracks.removeWhere((t) => t.id == trackId);
      await savePlaylists(list);
    }
  }

  // ---------------- Downloads / Offline ----------------
  List<Track> getDownloaded() {
    final list = prefs.getStringList('mymusic_downloaded') ?? [];
    return list
        .map((str) {
          try {
            return Track.fromJson(jsonDecode(str) as Map<String, dynamic>);
          } catch (_) {
            return null;
          }
        })
        .whereType<Track>()
        .toList();
  }

  Future<void> saveDownloaded(List<Track> tracks) async {
    final list = tracks.map((t) => jsonEncode(t.toJson())).toList();
    await prefs.setStringList('mymusic_downloaded', list);
  }

  bool isDownloaded(String trackId) => getDownloaded().any((t) => t.id == trackId);

  String? getDownloadedPath(String trackId) {
    final match = getDownloaded().where((t) => t.id == trackId);
    if (match.isNotEmpty) return match.first.localPath;
    return null;
  }

  Future<void> addDownloaded(Track track) async {
    final list = getDownloaded();
    list.removeWhere((t) => t.id == track.id);
    list.insert(0, track);
    await saveDownloaded(list);
  }

  Future<void> removeDownloaded(String trackId) async {
    final list = getDownloaded();
    list.removeWhere((t) => t.id == trackId);
    await saveDownloaded(list);
  }

  // ---------------- Play Stats ----------------
  Map<String, dynamic> getPlayStats() {
    final raw = prefs.getString('mymusic_play_stats');
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          return {
            'totalPlays': decoded['totalPlays'] ?? 0,
            'totalSeconds': decoded['totalSeconds'] ?? 0,
            'tracks': Map<String, dynamic>.from(decoded['tracks'] as Map? ?? {}),
            'artists': Map<String, dynamic>.from(decoded['artists'] as Map? ?? {}),
          };
        }
      } catch (_) {}
    }
    return {
      'totalPlays': 0,
      'totalSeconds': 0,
      'tracks': <String, dynamic>{},
      'artists': <String, dynamic>{},
    };
  }

  Future<void> savePlayStats(Map<String, dynamic> stats) async {
    await prefs.setString('mymusic_play_stats', jsonEncode(stats));
  }

  Future<void> recordListening(Track t, {int seconds = 30}) async {
    if (t.id.isEmpty) return;
    final stats = getPlayStats();
    stats['totalPlays'] = ((stats['totalPlays'] as num?)?.toInt() ?? 0) + 1;
    stats['totalSeconds'] = ((stats['totalSeconds'] as num?)?.toInt() ?? 0) + seconds;

    final tracks = Map<String, dynamic>.from(stats['tracks'] as Map? ?? {});
    final existingTrack = tracks[t.id] is Map
        ? Map<String, dynamic>.from(tracks[t.id] as Map)
        : <String, dynamic>{
            'id': t.id,
            'title': t.title,
            'artist': t.artist,
            if (t.artistId != null) 'artistId': t.artistId,
            'thumb': t.thumb,
            'duration': t.durationSec,
            'plays': 0,
          };
    existingTrack['plays'] = ((existingTrack['plays'] as num?)?.toInt() ?? 0) + 1;
    if (t.artistId != null && existingTrack['artistId'] == null) {
      existingTrack['artistId'] = t.artistId;
    }
    tracks[t.id] = existingTrack;
    stats['tracks'] = tracks;

    if (t.artist.isNotEmpty) {
      final artists = Map<String, dynamic>.from(stats['artists'] as Map? ?? {});
      final existingArtist = artists[t.artist] is Map
          ? Map<String, dynamic>.from(artists[t.artist] as Map)
          : <String, dynamic>{
              'name': t.artist,
              'plays': 0,
              'seconds': 0,
              if (t.artistId != null) 'id': t.artistId,
            };
      existingArtist['plays'] = ((existingArtist['plays'] as num?)?.toInt() ?? 0) + 1;
      existingArtist['seconds'] =
          ((existingArtist['seconds'] as num?)?.toInt() ?? 0) + seconds;
      if (t.artistId != null && existingArtist['id'] == null) {
        existingArtist['id'] = t.artistId;
      }
      artists[t.artist] = existingArtist;
      stats['artists'] = artists;
    }

    await savePlayStats(stats);
  }

  // ---------------- Lyrics Offsets ----------------
  Map<String, int> getLyricsOffsets() {
    final raw = prefs.getString('mymusic_lyrics_offsets');
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw) as Map<String, dynamic>;
        return decoded.map((k, v) => MapEntry(k, (v as num).toInt()));
      } catch (_) {}
    }
    return {};
  }

  Future<void> saveLyricsOffsets(Map<String, int> offsets) async {
    await prefs.setString('mymusic_lyrics_offsets', jsonEncode(offsets));
  }

  int getLyricOffsetMs(String trackId) => getLyricsOffsets()[trackId] ?? 0;

  Future<void> setLyricOffsetMs(String trackId, int offsetMs) async {
    final map = getLyricsOffsets();
    if (offsetMs == 0) {
      map.remove(trackId);
    } else {
      map[trackId] = offsetMs;
    }
    await saveLyricsOffsets(map);
  }

  // ---------------- Desktop-Parity Settings ----------------
  Map<String, dynamic> getSettingsMap() {
    final raw = prefs.getString('mymusic_settings_map');
    Map<String, dynamic> map = {};
    if (raw != null && raw.isNotEmpty) {
      try {
        map = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      } catch (_) {}
    }
    return {
      'volume': (map['volume'] as num?)?.toDouble() ?? 1.0,
      'repeat': map['repeat'] as String? ?? 'off',
      'shuffle': map['shuffle'] as bool? ?? false,
      'viz': map['viz'] as String? ?? 'liquid',
      'fsViz': map['fsViz'] as String? ?? 'stardust',
      'radio': map['radio'] as bool? ?? true,
      'speed': (map['speed'] as num?)?.toDouble() ??
          (prefs.getDouble('setting_speed') ?? 1.0),
      'pitchLock': map['pitchLock'] as bool? ?? true,
      'eq': (map['eq'] as List?)
              ?.map((e) => (e as num).toDouble())
              .toList() ??
          [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
      'eqPreset': map['eqPreset'] as String? ?? 'flat',
      'wallpaper': map['wallpaper'] as String? ?? '',
      'wallpaperDim': (map['wallpaperDim'] as num?)?.toDouble() ?? 60.0,
      'accentHue': map['accentHue'] ?? 'auto',
      'ambientColors': map['ambientColors'] as bool? ?? true,
      'automix': map['automix'] as bool? ?? true,
      'automixMode': map['automixMode'] as String? ?? 'smart',
      'automixDuration': map['automixDuration'] ?? 'auto',
      'crossfadeDuration': (map['crossfadeDuration'] as num?)?.toInt() ?? 6,
      'lyricsStyle': map['lyricsStyle'] as String? ?? 'random',
      'dj8DMode': map['dj8DMode'] as String? ?? 'off',
      'djStereoWidth': (map['djStereoWidth'] as num?)?.toDouble() ?? 1.0,
      'djFilter': (map['djFilter'] as num?)?.toDouble() ?? 0.0,
      'djBassPunch': map['djBassPunch'] as bool? ?? false,
      'djReverbPreset': map['djReverbPreset'] as String? ?? 'off',
      'lowResourceMode': map['lowResourceMode'] as bool? ??
          (prefs.getBool('setting_low_resource') ?? false),
      'discordPresence': map['discordPresence'] as bool? ?? true,
      'outputDeviceName':
          map['outputDeviceName'] as String? ?? 'Default output · Auto-route',
    };
  }

  Future<void> patchSettings(Map<String, dynamic> patch) async {
    final cur = getSettingsMap();
    cur.addAll(patch);
    await prefs.setString('mymusic_settings_map', jsonEncode(cur));
    if (patch.containsKey('lowResourceMode')) {
      await prefs.setBool(
        'setting_low_resource',
        patch['lowResourceMode'] == true,
      );
    }
    if (patch.containsKey('speed')) {
      await prefs.setDouble(
        'setting_speed',
        (patch['speed'] as num?)?.toDouble() ?? 1.0,
      );
    }
  }

  bool get lowResourceMode => getSettingsMap()['lowResourceMode'] == true;
  Future<void> setLowResourceMode(bool value) =>
      patchSettings({'lowResourceMode': value});

  double get playbackSpeed => (getSettingsMap()['speed'] as num).toDouble();
  Future<void> setPlaybackSpeed(double value) =>
      patchSettings({'speed': value});

  // ---------------- Sync Export / Import ----------------
  Map<String, dynamic> exportAllForSync() {
    final s = getSettingsMap();
    // Normalize wallpaperDim to desktop store schema (0..0.95) on push if stored 0..90
    final rawDim = (s['wallpaperDim'] as num?)?.toDouble() ?? 60.0;
    final normDim = rawDim > 1.0 ? (rawDim / 100.0).clamp(0.0, 0.95) : rawDim;
    s['wallpaperDim'] = normDim;

    return {
      'favorites': getFavorites().map((t) => t.toJson()).toList(),
      'playlists': getPlaylists().map((p) => p.toJson()).toList(),
      'settings': s,
      'playStats': getPlayStats(),
      'lyricsOffsets': getLyricsOffsets(),
    };
  }

  Future<void> applySyncedData(Map<String, dynamic> merged) async {
    if (merged['favorites'] is List) {
      final favs = (merged['favorites'] as List)
          .whereType<Map>()
          .map((m) => Track.fromJson(Map<String, dynamic>.from(m)))
          .where((t) => t.id.isNotEmpty)
          .toList();
      await saveFavorites(favs);
    }
    if (merged['playlists'] is List) {
      final pls = (merged['playlists'] as List)
          .whereType<Map>()
          .map((m) => Playlist.fromJson(Map<String, dynamic>.from(m)))
          .where((p) => p.id.isNotEmpty)
          .toList();
      await savePlaylists(pls);
    }
    if (merged['settings'] is Map) {
      final s = Map<String, dynamic>.from(merged['settings'] as Map);
      if (s['wallpaperDim'] is num) {
        final d = (s['wallpaperDim'] as num).toDouble();
        s['wallpaperDim'] = d <= 1.0 ? (d * 100.0).roundToDouble() : d;
      }
      await patchSettings(s);
    }
    if (merged['playStats'] is Map) {
      await savePlayStats(
        Map<String, dynamic>.from(merged['playStats'] as Map),
      );
    }
    if (merged['lyricsOffsets'] is Map) {
      final rawOff = Map<String, dynamic>.from(merged['lyricsOffsets'] as Map);
      await saveLyricsOffsets(
        rawOff.map((k, v) => MapEntry(k, (v as num?)?.toInt() ?? 0)),
      );
    }
  }
}
