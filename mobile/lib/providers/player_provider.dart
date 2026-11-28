import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import '../models/track.dart';
import '../models/lyrics.dart';
import '../services/audio_player_service.dart';
import '../services/lyrics_service.dart';
import '../services/storage_service.dart';
import '../services/youtube_service.dart';
import '../services/auth_sync_service.dart';

class PlayerProvider extends ChangeNotifier {
  final AudioPlayerService _playerService = AudioPlayerService();
  final LyricsService _lyricsService = LyricsService();
  final StorageService _storage = StorageService();

  Track? _currentTrack = YoutubeService.trackVioletHour;
  LyricsData _lyrics = const LyricsData();
  bool _isLoading = false;
  Duration _position = Duration.zero;
  Duration _duration = const Duration(seconds: 222);
  Duration _bufferedPosition = Duration.zero;
  bool _isPlaying = false;
  LoopMode _loopMode = LoopMode.off;
  bool _shuffleEnabled = false;
  int _lyricOffsetMs = 0;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  StreamSubscription? _stateSub;
  StreamSubscription? _posSub;
  StreamSubscription? _durSub;
  StreamSubscription? _bufSub;
  StreamSubscription? _trackSub;
  StreamSubscription? _queueSub;
  StreamSubscription? _errSub;
  StreamSubscription? _dspSub;

  PlayerProvider() {
    _init();
  }

  Track? get currentTrack => _currentTrack;
  String get contextTitle => _playerService.contextTitle;
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
  int get lyricOffsetMs => _lyricOffsetMs;

  double get volume => _playerService.volume;
  bool get autoMixEnabled => _playerService.autoMixEnabled;
  String get autoMixMode => _playerService.autoMixMode;
  dynamic get autoMixDuration => _playerService.autoMixDuration;
  int get crossfadeDuration => _playerService.crossfadeDuration;
  bool get radioEnabled => _playerService.radioEnabled;
  bool get isMixing => _playerService.isMixing;
  double get speed => _playerService.speed;
  bool get pitchLock => _playerService.pitchLock;
  List<double> get eqBands => _playerService.eqBands;
  String get eqPreset => _playerService.eqPreset;
  String get dj8DMode => _playerService.dj8DMode;
  double get djStereoWidth => _playerService.djStereoWidth;
  double get djFilter => _playerService.djFilter;
  bool get djBassPunch => _playerService.djBassPunch;
  String get djReverbPreset => _playerService.djReverbPreset;
  double get djAzimuthRad => _playerService.djAzimuthRad;

  int get currentLyricIndex {
    if (_lyrics.synced.isEmpty) return -1;
    final posSec = (_position.inMilliseconds + _lyricOffsetMs) / 1000.0;
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
    _playerService.setInitialTrack(
      YoutubeService.trackVioletHour,
      YoutubeService.getCuratedAfterHours(),
    );

    _trackSub = _playerService.currentTrackStream.listen((track) {
      _currentTrack = track;
      _isLoading = _computeIsLoading();
      _lyricOffsetMs = track != null ? _storage.getLyricOffsetMs(track.id) : 0;
      _fetchLyricsForCurrentTrack();
      notifyListeners();
    });

    _queueSub = _playerService.queueStream.listen((_) => notifyListeners());
    _dspSub = _playerService.dspStateStream.listen((_) {
      _isLoading = _computeIsLoading();
      notifyListeners();
    });

    _stateSub = _playerService.player.playerStateStream.listen((state) {
      _isPlaying = state.playing;
      _isLoading = _playerService.isLoading ||
          state.processingState == ProcessingState.buffering ||
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

    _errSub = _playerService.errorStream.listen((err) {
      _errorMessage = err;
      _isLoading = false;
      notifyListeners();
    });
  }

  bool _computeIsLoading() {
    final state = _playerService.player.playerState;
    return _playerService.isLoading ||
        state.processingState == ProcessingState.buffering ||
        state.processingState == ProcessingState.loading;
  }

  void reloadSyncedSettings() {
    _playerService.reloadFromSyncedSettings();
    if (_currentTrack != null) {
      _lyricOffsetMs = _storage.getLyricOffsetMs(_currentTrack!.id);
    }
    notifyListeners();
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

  Future<void> adjustLyricOffset(int deltaMs) async {
    final track = _currentTrack;
    if (track == null) return;
    _lyricOffsetMs = (_lyricOffsetMs + deltaMs).clamp(-15000, 15000);
    await _storage.setLyricOffsetMs(track.id, _lyricOffsetMs);
    AuthSyncService().scheduleAutoPush();
    notifyListeners();
  }

  Future<void> resetLyricOffset() async {
    final track = _currentTrack;
    if (track == null) return;
    _lyricOffsetMs = 0;
    await _storage.setLyricOffsetMs(track.id, 0);
    AuthSyncService().scheduleAutoPush();
    notifyListeners();
  }

  Future<void> playTrack(
    Track track, {
    List<Track>? queue,
    int? index,
    String? contextTitle,
  }) async {
    _errorMessage = null;
    notifyListeners();
    await _playerService.playTrack(
      track,
      newQueue: queue,
      index: index,
      contextTitle: contextTitle,
    );
  }

  void playNextInQueue(Track track) {
    _playerService.playNextInQueue(track);
    notifyListeners();
  }

  void shuffleRemaining() {
    _playerService.shuffleRemaining();
    notifyListeners();
  }

  Future<void> togglePlay() async {
    if (_isPlaying) {
      await _playerService.pause();
    } else {
      await _playerService.resume();
    }
  }

  Future<void> setVolume(double v) => _playerService.setVolume(v);
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

  void toggleAutoMix() {
    _playerService.setAutoMix(!_playerService.autoMixEnabled);
    notifyListeners();
  }

  void setAutoMixConfig({
    bool? enabled,
    String? mode,
    dynamic duration,
    int? crossfadeDuration,
  }) {
    _playerService.setAutoMixConfig(
      enabled: enabled,
      mode: mode,
      duration: duration,
      crossfadeDuration: crossfadeDuration,
    );
    notifyListeners();
  }

  void toggleRadio() {
    _playerService.setRadioEnabled(!_playerService.radioEnabled);
    notifyListeners();
  }

  void setPlaybackSpeed(double speed) {
    _playerService.setPlaybackSpeed(speed);
    notifyListeners();
  }

  void togglePitchLock() {
    _playerService.setPitchLock(!_playerService.pitchLock);
    notifyListeners();
  }

  void setEqBand(int index, double gainDb) {
    _playerService.setEqBand(index, gainDb);
    notifyListeners();
  }

  void setEqPreset(String preset, List<double> gains) {
    _playerService.setEqPreset(preset, gains);
    notifyListeners();
  }

  void resetEq() {
    _playerService.resetEq();
    notifyListeners();
  }

  void setDj8DMode(String mode) => _playerService.setDj8DMode(mode);
  void setDjAzimuthManual(double angle) => _playerService.setDjAzimuthManual(angle);
  void setDjStereoWidth(double w) => _playerService.setDjStereoWidth(w);
  void setDjFilter(double f) => _playerService.setDjFilter(f);
  void setDjBassPunch(bool on) => _playerService.setDjBassPunch(on);
  void setDjReverbPreset(String r) => _playerService.setDjReverbPreset(r);
  void resetDjStudio() => _playerService.resetDjStudio();

  void reorderQueue(int oldIndex, int newIndex) {
    _playerService.reorderQueue(oldIndex, newIndex);
    notifyListeners();
  }

  void removeFromQueue(int index) {
    _playerService.removeFromQueue(index);
    notifyListeners();
  }

  @override
  void dispose() {
    _stateSub?.cancel();
    _posSub?.cancel();
    _durSub?.cancel();
    _bufSub?.cancel();
    _trackSub?.cancel();
    _queueSub?.cancel();
    _errSub?.cancel();
    _dspSub?.cancel();
    super.dispose();
  }
}
