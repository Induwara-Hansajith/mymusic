import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/track.dart';
import '../models/ytm_models.dart';
import '../services/youtube_service.dart';
import '../services/saavn_service.dart';

class SearchProvider extends ChangeNotifier {
  final YoutubeService _yt = YoutubeService();
  final SaavnService _saavn = SaavnService();

  String _query = '';
  String _activeFilter = 'songs'; // 'songs' | 'videos' | 'albums' | 'artists' | 'playlists'
  YtmSearchResult _ytmResult = const YtmSearchResult();
  final Map<String, YtmSearchResult> _cache = {};
  List<String> _suggestions = [];
  bool _isSearching = false;
  Timer? _debounceTimer;

  String get query => _query;
  String get activeFilter => _activeFilter;
  YtmSearchResult get ytmResult => _ytmResult;
  List<Track> get results =>
      _activeFilter == 'videos' ? _ytmResult.videos : _ytmResult.songs;
  List<String> get suggestions => List.unmodifiable(_suggestions);
  bool get isSearching => _isSearching;
  bool get isLoading => _isSearching;

  Future<void> search(String queryToSearch, {String? filter}) =>
      executeSearch(queryToSearch, filter: filter);

  void setFilter(String filter) {
    final lower = filter.toLowerCase();
    if (_activeFilter != lower) {
      _activeFilter = lower;
      if (_query.trim().isNotEmpty) {
        executeSearch(_query, filter: _activeFilter);
      } else {
        notifyListeners();
      }
    }
  }

  void onQueryChanged(String newQuery) {
    _query = newQuery;
    _debounceTimer?.cancel();

    if (_query.trim().isEmpty) {
      _suggestions = [];
      _ytmResult = const YtmSearchResult();
      _isSearching = false;
      notifyListeners();
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 260), () async {
      final sugs = await _yt.getSuggestions(_query);
      if (_query.trim().isNotEmpty) {
        _suggestions = sugs;
        notifyListeners();
      }
    });
  }

  Future<void> executeSearch(String queryToSearch, {String? filter}) async {
    _query = queryToSearch.trim();
    if (_query.isEmpty) return;

    final targetFilter = (filter ?? _activeFilter).toLowerCase();
    _activeFilter = targetFilter;
    _debounceTimer?.cancel();
    _suggestions = [];

    final cacheKey = '$targetFilter:${_query.toLowerCase()}';
    if (_cache.containsKey(cacheKey)) {
      _ytmResult = _cache[cacheKey]!;
      _isSearching = false;
      notifyListeners();
      return;
    }

    _isSearching = true;
    notifyListeners();

    try {
      final ytmRes = await _yt.searchYtm(_query, targetFilter);
      if (targetFilter == 'songs') {
        final saavn = await _saavn.search(_query, limit: 10);
        final mergedSongs = <Track>[...ytmRes.songs];
        for (final s in saavn) {
          if (!mergedSongs.any((t) =>
              t.title.toLowerCase() == s.title.toLowerCase() &&
              t.artist.toLowerCase() == s.artist.toLowerCase())) {
            mergedSongs.add(s);
          }
        }
        _ytmResult = YtmSearchResult(songs: mergedSongs);
      } else {
        _ytmResult = ytmRes;
      }
      _cache[cacheKey] = _ytmResult;
    } catch (_) {
      final fallback = await _yt.search(_query, filter: targetFilter);
      _ytmResult = targetFilter == 'videos'
          ? YtmSearchResult(videos: fallback)
          : YtmSearchResult(songs: fallback);
    }

    _isSearching = false;
    notifyListeners();
  }

  void clear() {
    _query = '';
    _suggestions = [];
    _ytmResult = const YtmSearchResult();
    _isSearching = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }
}
