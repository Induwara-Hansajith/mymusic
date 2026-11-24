import 'package:flutter/foundation.dart';
import '../models/track.dart';
import '../models/playlist.dart';
import '../services/storage_service.dart';

class LibraryProvider extends ChangeNotifier {
  final StorageService _storage = StorageService();

  List<Track> _favorites = [];
  List<Track> _recents = [];
  List<Playlist> _playlists = [];
  bool _lowResourceMode = false;

  LibraryProvider() {
    load();
  }

  List<Track> get favorites => List.unmodifiable(_favorites);
  List<Track> get recents => List.unmodifiable(_recents);
  List<Track> get recentTracks => List.unmodifiable(_recents);
  List<Playlist> get playlists => List.unmodifiable(_playlists);
  bool get lowResourceMode => _lowResourceMode;

  void load() {
    _favorites = _storage.getFavorites();
    _recents = _storage.getRecents();
    _playlists = _storage.getPlaylists();
    _lowResourceMode = _storage.lowResourceMode;
    notifyListeners();
  }

  bool isFavorite(dynamic trackOrId) {
    if (trackOrId is Track) return _favorites.any((t) => t.id == trackOrId.id);
    if (trackOrId is String) return _favorites.any((t) => t.id == trackOrId);
    return false;
  }

  Future<void> clearHistory() async {
    await _storage.clearRecents();
    _recents = [];
    notifyListeners();
  }

  Future<void> toggleFavorite(Track track) async {
    await _storage.toggleFavorite(track);
    _favorites = _storage.getFavorites();
    notifyListeners();
  }

  Future<Playlist> createPlaylist(String name) async {
    final pl = await _storage.createPlaylist(name);
    _playlists = _storage.getPlaylists();
    notifyListeners();
    return pl;
  }

  Future<void> addTrackToPlaylist(String playlistId, Track track) async {
    await _storage.addTrackToPlaylist(playlistId, track);
    _playlists = _storage.getPlaylists();
    notifyListeners();
  }

  Future<void> setLowResourceMode(bool value) async {
    _lowResourceMode = value;
    await _storage.setLowResourceMode(value);
    notifyListeners();
  }
}
