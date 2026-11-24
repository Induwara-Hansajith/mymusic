import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/track.dart';
import '../services/youtube_service.dart';
import '../services/saavn_service.dart';

class SearchProvider extends ChangeNotifier {
  final YoutubeService _yt = YoutubeService();
  final SaavnService _saavn = SaavnService();

  String _query = '';
  String _activeFilter = 'all';
  List<Track> _results = [];
  List<String> _suggestions = [];
  bool _isSearching = false;
  Timer? _debounceTimer;

  String get query => _query;
  String get activeFilter => _activeFilter;
  List<Track> get results => List.unmodifiable(_results);
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
      _results = [];
      _isSearching = false;
      notifyListeners();
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 300), () async {
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
    _isSearching = true;
    notifyListeners();

    try {
      final ytFuture = _yt.search(_query, filter: targetFilter, limit: 20);
      final saavnFuture = (targetFilter == 'all' || targetFilter == 'songs')
          ? _saavn.search(_query, limit: 15)
          : Future.value(<Track>[]);

      final results = await Future.wait([saavnFuture, ytFuture]);
      final saavnResults = results[0];
      final ytResults = results[1];

      final combined = <Track>[];
      if (targetFilter == 'all' || targetFilter == 'songs') {
        combined.addAll(saavnResults);
        for (final ytTrack in ytResults) {
          if (!combined.any((t) => t.title.toLowerCase() == ytTrack.title.toLowerCase())) {
            combined.add(ytTrack);
          }
        }
        _results = combined.isNotEmpty ? combined : ytResults;
      } else {
        _results = ytResults;
      }
    } catch (_) {
      _results = await _yt.search(_query, filter: targetFilter);
    }

    _isSearching = false;
    notifyListeners();
  }

  void clear() {
    _query = '';
    _suggestions = [];
    _results = [];
    _isSearching = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }
}
