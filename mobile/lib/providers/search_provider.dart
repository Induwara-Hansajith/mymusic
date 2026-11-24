import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/track.dart';
import '../services/youtube_service.dart';

class SearchProvider extends ChangeNotifier {
  final YoutubeService _yt = YoutubeService();

  String _query = '';
  List<Track> _results = [];
  List<String> _suggestions = [];
  bool _isSearching = false;
  Timer? _debounceTimer;

  String get query => _query;
  List<Track> get results => List.unmodifiable(_results);
  List<String> get suggestions => List.unmodifiable(_suggestions);
  bool get isSearching => _isSearching;
  bool get isLoading => _isSearching;

  Future<void> search(String queryToSearch) => executeSearch(queryToSearch);

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

  Future<void> executeSearch(String queryToSearch) async {
    _query = queryToSearch.trim();
    if (_query.isEmpty) return;

    _debounceTimer?.cancel();
    _suggestions = [];
    _isSearching = true;
    notifyListeners();

    _results = await _yt.search(_query);
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
