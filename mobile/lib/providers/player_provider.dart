import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import '../models/track.dart';
import '../models/lyrics.dart';
import '../services/audio_player_service.dart';
import '../services/lyrics_service.dart';

class PlayerProvider extends ChangeNotifier {
  final AudioPlayerService _playerService = AudioPlayerService();
  final LyricsService _lyricsService = LyricsService();

  Track? _currentTrack;
  LyricsData _lyrics = const LyricsData();
  bool _isLoading = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  Duration _bufferedPosition = Duration.zero;
  bool _isPlaying = false;
  LoopMode _loopMode = LoopMode.off;
  bool _shuffleEnabled = false;

  StreamSubscription? _stateSub;
  StreamSubscription? _posSub;
  StreamSubscription? _durSub;
  StreamSubscription? _bufSub;
  StreamSubscription? _trackSub;

  PlayerProvider() {
    _init();
  }

  Track? get currentTrack => _currentTrack;
  LyricsData get lyrics => _lyrics;
  bool get isLoading => _isLoading;
  Duration get position => _position;
  Duration get duration => _duration;
  Duration get bufferedPosition => _bufferedPosition;
  bool get isPlaying => _isPlaying;
  LoopMode get loopMode => _loopMode;
  bool get shuffleEnabled => _shuffleEnabled;
  List<Track> get queue => _playerService.queue;
  int get currentIndex => _playerService.currentIndex;

  int get currentLyricIndex {
    if (_lyrics.synced.isEmpty) return -1;
    final posSec = _position.inMilliseconds / 1000.0;
    int activeIdx = -1;
    for (int i = 0; i < _lyrics.synced.length; i++) {
      if (_lyrics.synced[i].timeSec <= posSec) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }

  void _init() {
    _playerService.init();

    _trackSub = _playerService.currentTrackStream.listen((track) {
      _currentTrack = track;
      _isLoading = _playerService.isLoading;
      _fetchLyricsForCurrentTrack();
      notifyListeners();
    });

    _stateSub = _playerService.player.playerStateStream.listen((state) {
      _isPlaying = state.playing;
      _isLoading = state.processingState == ProcessingState.buffering ||
          state.processingState == ProcessingState.loading;
      notifyListeners();
    });

    _posSub = _playerService.player.positionStream.listen((pos) {
      _position = pos;
      notifyListeners();
    });

    _durSub = _playerService.player.durationStream.listen((dur) {
      _duration = dur ?? Duration.zero;
      notifyListeners();
    });

    _bufSub = _playerService.player.bufferedPositionStream.listen((buf) {
      _bufferedPosition = buf;
      notifyListeners();
    });
  }

  Future<void> _fetchLyricsForCurrentTrack() async {
    final track = _currentTrack;
    if (track == null) {
      _lyrics = const LyricsData();
      notifyListeners();
      return;
    }

    _lyrics = await _lyricsService.fetchLyrics(
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      durationSec: track.durationSec,
    );
    notifyListeners();
  }

  Future<void> playTrack(Track track, {List<Track>? queue, int? index}) async {
    await _playerService.playTrack(track, newQueue: queue, index: index);
  }

  Future<void> togglePlay() async {
    if (_isPlaying) {
      await _playerService.pause();
    } else {
      await _playerService.resume();
    }
  }

  Future<void> next() async => _playerService.next();
  Future<void> previous() async => _playerService.previous();

  Future<void> seek(Duration pos) async => _playerService.seek(pos);

  Future<void> cycleLoopMode() async {
    await _playerService.cycleLoopMode();
    _loopMode = _playerService.player.loopMode;
    notifyListeners();
  }

  Future<void> toggleShuffle() async {
    await _playerService.toggleShuffle();
    _shuffleEnabled = _playerService.player.shuffleModeEnabled;
    notifyListeners();
  }

  @override
  void dispose() {
    _stateSub?.cancel();
    _posSub?.cancel();
    _durSub?.cancel();
    _bufSub?.cancel();
    _trackSub?.cancel();
    super.dispose();
  }
}
