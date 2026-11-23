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
    _prefs = await SharedPreferences.getInstance();
  }

  SharedPreferences get prefs {
    if (_prefs == null) {
      throw StateError('StorageService not initialized. Call init() first.');
    }
    return _prefs!;
  }

  // Favorites
  List<Track> getFavorites() {
    final list = prefs.getStringList('mymusic_favorites') ?? [];
    return list.map((str) {
      try {
        return Track.fromJson(jsonDecode(str) as Map<String, dynamic>);
      } catch (_) {
        return null;
      }
    }).whereType<Track>().toList();
  }

  Future<void> saveFavorites(List<Track> tracks) async {
    final list = tracks.map((t) => jsonEncode(t.toJson())).toList();
    await prefs.setStringList('mymusic_favorites', list);
  }

  bool isFavorite(String trackId) {
    return getFavorites().any((t) => t.id == trackId);
  }

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

  // Recents
  List<Track> getRecents() {
    final list = prefs.getStringList('mymusic_recent') ?? [];
    return list.map((str) {
      try {
        return Track.fromJson(jsonDecode(str) as Map<String, dynamic>);
      } catch (_) {
        return null;
      }
    }).whereType<Track>().toList();
  }

  Future<void> addRecent(Track track) async {
    final list = getRecents();
    list.removeWhere((t) => t.id == track.id);
    list.insert(0, track);
    if (list.length > 50) list.removeRange(50, list.length);
    final enc = list.map((t) => jsonEncode(t.toJson())).toList();
    await prefs.setStringList('mymusic_recent', enc);
  }

  // Playlists
  List<Playlist> getPlaylists() {
    final list = prefs.getStringList('mymusic_playlists') ?? [];
    return list.map((str) {
      try {
        return Playlist.fromJson(jsonDecode(str) as Map<String, dynamic>);
      } catch (_) {
        return null;
      }
    }).whereType<Playlist>().toList();
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

  // Settings
  bool get lowResourceMode => prefs.getBool('setting_low_resource') ?? false;
  Future<void> setLowResourceMode(bool value) async {
    await prefs.setBool('setting_low_resource', value);
  }

  double get playbackSpeed => prefs.getDouble('setting_speed') ?? 1.0;
  Future<void> setPlaybackSpeed(double value) async {
    await prefs.setDouble('setting_speed', value);
  }
}
