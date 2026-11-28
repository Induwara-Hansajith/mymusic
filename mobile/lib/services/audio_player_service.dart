import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:audio_session/audio_session.dart';
import '../models/track.dart';
import 'youtube_service.dart';
import 'saavn_service.dart';
import 'storage_service.dart';
import 'auth_sync_service.dart';

class AudioPlayerService {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;

  final AndroidEqualizer _equalizer = AndroidEqualizer();
  final AndroidLoudnessEnhancer _loudness = AndroidLoudnessEnhancer();
  late final AudioPlayer _player;

  AudioPlayerService._internal() {
    _player = AudioPlayer(
      useProxyForRequestHeaders: false,
      audioPipeline: AudioPipeline(
        androidAudioEffects: [_equalizer, _loudness],
      ),
    );
  }

  /// Returns true only for local filesystem paths and `file://` URIs.
  /// Network URLs (`http://`, `https://`) must never match `:/` as a drive path.
  @visibleForTesting
  static bool isLocalAudioPath(String source) {
    final trimmed = source.trim();
    if (trimmed.isEmpty) return false;
    final uri = Uri.tryParse(trimmed);
    if (uri != null && (uri.scheme == 'http' || uri.scheme == 'https')) {
      return false;
    }
    if (uri != null && uri.scheme == 'file') {
      return true;
    }
    return trimmed.startsWith('/') ||
        RegExp(r'^[A-Za-z]:[/\\]').hasMatch(trimmed);
  }

  /// Builds the appropriate [AudioSource] for a local file path or network stream URL.
  @visibleForTesting
  static AudioSource buildAudioSource(String streamUrl, MediaItem mediaItem) {
    if (isLocalAudioPath(streamUrl)) {
      final parsed = Uri.tryParse(streamUrl.trim());
      if (parsed != null && parsed.scheme == 'file') {
        return AudioSource.uri(parsed, tag: mediaItem);
      }
      return AudioSource.file(streamUrl.trim(), tag: mediaItem);
    }
    final Map<String, String>? headers = streamUrl.contains('googlevideo.com')
        ? const {'User-Agent': YoutubeService.androidClientUserAgent}
        : null;
    return AudioSource.uri(
      Uri.parse(streamUrl),
      headers: headers,
      tag: mediaItem,
    );
  }

  final YoutubeService _yt = YoutubeService();
  final SaavnService _saavn = SaavnService();
  final StorageService _storage = StorageService();

  static const List<double> eqFreqs = [
    31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
  ];

  static const Map<String, List<double>> eqPresets = {
    'flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'warm': [4, 6, 3, -1, -3, 0, 3, 5, 4, 2],
    'bass': [0, 2, 4, 1.8, -1.5, 0, 0, 0, 0.5, 0.8],
    'treble': [0, 0, 0, 0, 0, 1, 2.5, 4, 5, 6],
    'pop': [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
    'rock': [4, 3, 1.5, -1, -2, 0, 2, 3.5, 4, 4],
    'vocal': [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1],
    'acoustic': [0, 1.5, 1, 1, 1, 1, 2, 2, 2.5, 2.5],
    'electronic': [0, 2.2, 3.8, 1.2, -1.2, 1.0, 1.5, 2.5, 3.0, 3.0],
    'club': [0, 2.0, 3.5, 1.5, -1.0, 0, 1.0, 1.5, 2.0, 2.0],
    'classical': [0, 2.5, 2, 1.5, -1, -1, 0, 2, 2.5, 2.5],
  };

  List<Track> _queue = [];
  int _currentIndex = -1;
  Track? _currentTrack;
  String _contextTitle = 'Queue';
  bool _isLoading = false;
  String? _lastError;
  double _volume = 1.0;

  // AutoMix & Transition settings (parity with desktop)
  bool _autoMixEnabled = true;
  String _autoMixMode = 'smart'; // 'smart' | 'crossfade'
  dynamic _autoMixDuration = 'auto'; // 'auto' | int (1..15)
  int _crossfadeDuration = 6;
  bool _radioEnabled = true;
  bool _isMixing = false;
  bool _autoMixTriggeredForTrack = false;
  Timer? _mixTimer;

  // Speed & Pitch Lock
  double _speed = 1.0;
  bool _pitchLock = true;
  int _consecutiveErrors = 0;

  // EQ & Live DJ Studio state
  List<double> _eqBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  String _eqPreset = 'flat';
  String _dj8DMode = 'off'; // 'off' | 'slow' | 'club' | 'fast'
  double _djStereoWidth = 1.0; // 0..2
  double _djFilter = 0.0; // -1..1
  bool _djBassPunch = false;
  String _djReverbPreset = 'off'; // 'off' | 'studio' | 'club' | 'arena'
  double _djAzimuthRad = 0.0;
  Timer? _orbitTimer;

  // Listening stats recording per track play
  String? _statsRecordedForTrackId;

  final _trackChangeController = StreamController<Track?>.broadcast();
  Stream<Track?> get currentTrackStream => _trackChangeController.stream;

  final _queueChangeController = StreamController<List<Track>>.broadcast();
  Stream<List<Track>> get queueStream => _queueChangeController.stream;

  final _errorController = StreamController<String?>.broadcast();
  Stream<String?> get errorStream => _errorController.stream;

  final _dspStateController = StreamController<void>.broadcast();
  Stream<void> get dspStateStream => _dspStateController.stream;

  AudioPlayer get player => _player;
  Track? get currentTrack => _currentTrack;
  String get contextTitle => _contextTitle;
  List<Track> get queue => List.unmodifiable(_queue);
  int get currentIndex => _currentIndex;
  bool get isLoading => _isLoading;
  String? get lastError => _lastError;
  double get volume => _volume;
  bool get autoMixEnabled => _autoMixEnabled;
  String get autoMixMode => _autoMixMode;
  dynamic get autoMixDuration => _autoMixDuration;
  int get crossfadeDuration => _crossfadeDuration;
  bool get radioEnabled => _radioEnabled;
  bool get isMixing => _isMixing;
  double get speed => _speed;
  bool get pitchLock => _pitchLock;
  List<double> get eqBands => List.unmodifiable(_eqBands);
  String get eqPreset => _eqPreset;
  String get dj8DMode => _dj8DMode;
  double get djStereoWidth => _djStereoWidth;
  double get djFilter => _djFilter;
  bool get djBassPunch => _djBassPunch;
  String get djReverbPreset => _djReverbPreset;
  double get djAzimuthRad => _djAzimuthRad;

  Future<void> init() async {
    _loadSettingsFromStorage();

    try {
      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.music());
    } catch (e) {
      debugPrint('[AudioPlayerService] AudioSession init warning: $e');
    }

    try {
      await _player.setVolume(_volume);
      if (_speed != 1.0 || !_pitchLock) {
        await _applySpeedAndPitch();
      }
    } catch (e) {
      debugPrint('[AudioPlayerService] Initial player setup warning: $e');
    }

    _startOrbitLoopIfNeeded();

    _player.positionStream.listen((pos) {
      _handlePositionTick(pos);
    });

    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        final pos = _player.position;
        final dur = _player.duration;
        if (dur != null &&
            dur.inSeconds > 5 &&
            pos.inSeconds >= dur.inSeconds - 3) {
          next(auto: true);
        }
      }
    });

    _player.playbackEventStream.listen(
      (_) {},
      onError: (Object e, StackTrace st) {
        debugPrint('[AudioPlayerService] Playback event error: $e');
        _lastError = 'Playback error: $e';
        _errorController.add(_lastError);
        _isLoading = false;
      },
    );
  }

  void _loadSettingsFromStorage() {
    try {
      final s = _storage.getSettingsMap();
      _volume = (s['volume'] as num?)?.toDouble().clamp(0.0, 1.0) ?? 1.0;
      _autoMixEnabled = s['automix'] != false;
      _autoMixMode = s['automixMode'] as String? ?? 'smart';
      _autoMixDuration = s['automixDuration'] ?? 'auto';
      _crossfadeDuration = (s['crossfadeDuration'] as num?)?.toInt() ?? 6;
      _radioEnabled = s['radio'] != false;
      _speed = (s['speed'] as num?)?.toDouble().clamp(0.5, 2.0) ?? 1.0;
      _pitchLock = s['pitchLock'] != false;
      final eqList = s['eq'] as List?;
      if (eqList != null && eqList.length == 10) {
        _eqBands = eqList.map((e) => (e as num).toDouble()).toList();
      }
      _eqPreset = s['eqPreset'] as String? ?? 'flat';
      _dj8DMode = s['dj8DMode'] as String? ?? 'off';
      _djStereoWidth = (s['djStereoWidth'] as num?)?.toDouble() ?? 1.0;
      _djFilter = (s['djFilter'] as num?)?.toDouble() ?? 0.0;
      _djBassPunch = s['djBassPunch'] == true;
      _djReverbPreset = s['djReverbPreset'] as String? ?? 'off';
    } catch (_) {}
  }

  void reloadFromSyncedSettings() {
    _loadSettingsFromStorage();
    _player.setVolume(_volume).catchError((_) {});
    _applySpeedAndPitch();
    _applyHardwareDsp();
    _startOrbitLoopIfNeeded();
    _dspStateController.add(null);
  }

  void _handlePositionTick(Duration pos) {
    final track = _currentTrack;
    final dur = _player.duration;
    if (track == null) return;

    final sec = pos.inSeconds;
    if (sec >= 25 && _statsRecordedForTrackId != track.id && _player.playing) {
      _statsRecordedForTrackId = track.id;
      final listenSec = dur != null && dur.inSeconds > 0 ? dur.inSeconds : track.durationSec;
      _storage.recordListening(track, seconds: listenSec > 0 ? listenSec : 30);
      AuthSyncService().scheduleAutoPush();
    }

    // AutoMix smart transition trigger near end of track
    if (_autoMixEnabled &&
        !_autoMixTriggeredForTrack &&
        _player.playing &&
        dur != null &&
        dur.inSeconds > 20 &&
        _player.loopMode != LoopMode.one &&
        (_currentIndex + 1 < _queue.length || _radioEnabled)) {
      final mixSec = _effectiveMixDurationSec(dur.inSeconds);
      final remaining = dur.inMilliseconds - pos.inMilliseconds;
      if (remaining > 0 && remaining <= mixSec * 1000) {
        _autoMixTriggeredForTrack = true;
        _performSmoothAutoMixFade(mixSec);
      }
    }
  }

  int _effectiveMixDurationSec(int trackDurSec) {
    if (_autoMixDuration is int) {
      return _autoMixDuration.clamp(1, 15);
    }
    if (_autoMixMode == 'smart') {
      return trackDurSec < 150 ? 4 : 6;
    }
    return _crossfadeDuration.clamp(1, 15);
  }

  void _performSmoothAutoMixFade(int mixSec) {
    _mixTimer?.cancel();
    _isMixing = true;
    _dspStateController.add(null);

    const steps = 16;
    final stepMs = math.max(80, (mixSec * 1000 / 2 / steps).round());
    int i = 0;

    _mixTimer = Timer.periodic(Duration(milliseconds: stepMs), (timer) async {
      i++;
      final frac = (i / steps).clamp(0.0, 1.0);
      // Cosine fade out for smooth DJ transition curve
      final vol = _volume * math.cos(frac * math.pi / 2);
      try {
        await _player.setVolume(vol.clamp(0.05, 1.0));
      } catch (_) {}

      if (i >= steps) {
        timer.cancel();
        await next(auto: true, fadeInAfter: true);
      }
    });
  }

  Future<void> _fadeInPlayer() async {
    const steps = 12;
    for (int i = 1; i <= steps; i++) {
      final vol = _volume * math.sin((i / steps) * math.pi / 2);
      try {
        await _player.setVolume(vol.clamp(0.0, 1.0));
      } catch (_) {}
      await Future.delayed(const Duration(milliseconds: 70));
    }
    try {
      await _player.setVolume(_volume);
    } catch (_) {}
    _isMixing = false;
    _dspStateController.add(null);
  }

  void setInitialTrack(Track track, List<Track> queue, {String context = 'Queue'}) {
    _currentTrack = track;
    _contextTitle = context;
    _queue = List.from(queue);
    _currentIndex = _queue.indexOf(track);
    if (_currentIndex == -1) _currentIndex = 0;
    _trackChangeController.add(_currentTrack);
    _queueChangeController.add(_queue);
  }

  Future<void> setVolume(double v) async {
    _volume = v.clamp(0.0, 1.0);
    try {
      await _player.setVolume(_volume);
    } catch (_) {}
    await _storage.patchSettings({'volume': _volume});
    _dspStateController.add(null);
  }

  Future<void> setAutoMix(bool enabled) async {
    _autoMixEnabled = enabled;
    await _storage.patchSettings({'automix': enabled});
    _dspStateController.add(null);
    AuthSyncService().scheduleAutoPush();
  }

  Future<void> setAutoMixConfig({
    bool? enabled,
    String? mode,
    dynamic duration,
    int? crossfadeDuration,
  }) async {
    if (enabled != null) _autoMixEnabled = enabled;
    if (mode != null) _autoMixMode = mode;
    if (duration != null) _autoMixDuration = duration;
    if (crossfadeDuration != null) _crossfadeDuration = crossfadeDuration.clamp(1, 15);
    await _storage.patchSettings({
      'automix': _autoMixEnabled,
      'automixMode': _autoMixMode,
      'automixDuration': _autoMixDuration,
      'crossfadeDuration': _crossfadeDuration,
    });
    _dspStateController.add(null);
    AuthSyncService().scheduleAutoPush();
  }

  Future<void> setRadioEnabled(bool enabled) async {
    _radioEnabled = enabled;
    await _storage.patchSettings({'radio': enabled});
    _dspStateController.add(null);
  }

  Future<void> setPlaybackSpeed(double speed) async {
    _speed = speed.clamp(0.5, 2.0);
    await _applySpeedAndPitch();
    await _storage.patchSettings({'speed': _speed});
    _dspStateController.add(null);
  }

  Future<void> setPitchLock(bool lock) async {
    _pitchLock = lock;
    await _applySpeedAndPitch();
    await _storage.patchSettings({'pitchLock': _pitchLock});
    _dspStateController.add(null);
  }

  Future<void> _applySpeedAndPitch() async {
    try {
      await _player.setSpeed(_speed);
      await _player.setPitch(_pitchLock ? 1.0 : _speed);
    } catch (e) {
      debugPrint('[AudioPlayerService] speed/pitch warning: $e');
    }
  }

  Future<void> setEqBand(int index, double gainDb) async {
    if (index >= 0 && index < _eqBands.length) {
      _eqBands[index] = gainDb.clamp(-12.0, 12.0);
      _eqPreset = 'custom';
      await _applyHardwareDsp();
      await _storage.patchSettings({'eq': _eqBands, 'eqPreset': 'custom'});
      _dspStateController.add(null);
      AuthSyncService().scheduleAutoPush();
    }
  }

  Future<void> setEqPreset(String preset, List<double> gains) async {
    _eqPreset = preset;
    for (int i = 0; i < _eqBands.length && i < gains.length; i++) {
      _eqBands[i] = gains[i].clamp(-12.0, 12.0);
    }
    await _applyHardwareDsp();
    await _storage.patchSettings({'eq': _eqBands, 'eqPreset': preset});
    _dspStateController.add(null);
    AuthSyncService().scheduleAutoPush();
  }

  Future<void> resetEq() async {
    await setEqPreset('flat', eqPresets['flat']!);
  }

  // ---------------- Live DJ & 8D Studio Controls ----------------
  Future<void> setDj8DMode(String mode) async {
    _dj8DMode = mode;
    _startOrbitLoopIfNeeded();
    await _applyHardwareDsp();
    await _storage.patchSettings({'dj8DMode': mode});
    _dspStateController.add(null);
  }

  void setDjAzimuthManual(double angleRad) {
    _djAzimuthRad = angleRad % (2 * math.pi);
    _dspStateController.add(null);
  }

  Future<void> setDjStereoWidth(double width) async {
    _djStereoWidth = width.clamp(0.0, 2.0);
    await _applyHardwareDsp();
    await _storage.patchSettings({'djStereoWidth': _djStereoWidth});
    _dspStateController.add(null);
  }

  Future<void> setDjFilter(double val) async {
    _djFilter = val.clamp(-1.0, 1.0);
    await _applyHardwareDsp();
    await _storage.patchSettings({'djFilter': _djFilter});
    _dspStateController.add(null);
  }

  Future<void> setDjBassPunch(bool on) async {
    _djBassPunch = on;
    await _applyHardwareDsp();
    await _storage.patchSettings({'djBassPunch': on});
    _dspStateController.add(null);
  }

  Future<void> setDjReverbPreset(String preset) async {
    _djReverbPreset = preset;
    await _applyHardwareDsp();
    await _storage.patchSettings({'djReverbPreset': preset});
    _dspStateController.add(null);
  }

  Future<void> resetDjStudio() async {
    _dj8DMode = 'off';
    _djAzimuthRad = 0.0;
    _djStereoWidth = 1.0;
    _djFilter = 0.0;
    _djBassPunch = false;
    _djReverbPreset = 'off';
    _startOrbitLoopIfNeeded();
    await _applyHardwareDsp();
    await _storage.patchSettings({
      'dj8DMode': 'off',
      'djStereoWidth': 1.0,
      'djFilter': 0.0,
      'djBassPunch': false,
      'djReverbPreset': 'off',
    });
    _dspStateController.add(null);
  }

  void _startOrbitLoopIfNeeded() {
    _orbitTimer?.cancel();
    if (_dj8DMode == 'off') {
      _djAzimuthRad = 0.0;
      return;
    }
    final periodSec = _dj8DMode == 'fast'
        ? 5.0
        : (_dj8DMode == 'club' ? 10.0 : 16.0);
    const tickMs = 50;
    final step = (2 * math.pi) / (periodSec * 1000 / tickMs);
    _orbitTimer = Timer.periodic(const Duration(milliseconds: tickMs), (_) {
      _djAzimuthRad = (_djAzimuthRad + step) % (2 * math.pi);
      _dspStateController.add(null);
    });
  }

  /// Applies real hardware EQ + Bass Punch + DJ Filter + LoudnessEnhancer to Android AudioPipeline.
  Future<void> _applyHardwareDsp() async {
    try {
      final anyEq = _eqBands.any((g) => g.abs() > 0.05) ||
          _djBassPunch ||
          _djFilter.abs() > 0.05 ||
          _dj8DMode != 'off';
      await _equalizer.setEnabled(anyEq);

      if (anyEq) {
        final params = await _equalizer.parameters;
        final minDb = params.minDecibels;
        final maxDb = params.maxDecibels;
        for (final band in params.bands) {
          final freq = band.centerFrequency;
          double targetDb = _interpolate10BandGain(freq);

          if (_djBassPunch && freq <= 150) {
            targetDb += 4.5;
          }
          if (_djFilter < -0.05 && freq > 600) {
            // Low-pass DJ sweep: attenuate high frequencies
            final factor = math.min(1.0, (freq - 600) / 8000);
            targetDb += _djFilter * 11.0 * factor;
          } else if (_djFilter > 0.05 && freq < 900) {
            // High-pass DJ sweep: attenuate low frequencies
            final factor = math.min(1.0, (900 - freq) / 850);
            targetDb -= _djFilter * 11.0 * factor;
          }
          if (_djStereoWidth > 1.15 && freq >= 2000) {
            targetDb += (_djStereoWidth - 1.0) * 1.8;
          }

          await band.setGain(targetDb.clamp(minDb, maxDb));
        }
      }

      // LoudnessEnhancer expects decibels (Java multiplies by 100 for milliBels).
      double targetGainDb = 0.0;
      if (_djReverbPreset == 'studio') targetGainDb = 1.2;
      if (_djReverbPreset == 'club') targetGainDb = 2.6;
      if (_djReverbPreset == 'arena') targetGainDb = 3.8;
      if (_djBassPunch) targetGainDb += 1.4;

      await _loudness.setEnabled(targetGainDb > 0);
      if (targetGainDb > 0) {
        await _loudness.setTargetGain(targetGainDb);
      }
    } catch (e) {
      debugPrint('[AudioPlayerService] Hardware DSP apply note: $e');
    }
  }

  double _interpolate10BandGain(double freqHz) {
    if (freqHz <= eqFreqs.first) return _eqBands.first;
    if (freqHz >= eqFreqs.last) return _eqBands.last;
    for (int i = 0; i < eqFreqs.length - 1; i++) {
      final f1 = eqFreqs[i];
      final f2 = eqFreqs[i + 1];
      if (freqHz >= f1 && freqHz <= f2) {
        final t = (math.log(freqHz) - math.log(f1)) / (math.log(f2) - math.log(f1));
        return _eqBands[i] * (1 - t) + _eqBands[i + 1] * t;
      }
    }
    return 0.0;
  }

  int _playRequestId = 0;

  Future<bool> _startAudioSource(
    Track track,
    AudioSource audioSource,
    bool fadeIn,
    int reqId,
    String debugLabel,
  ) async {
    if (reqId != _playRequestId) return false;
    try {
      await _player.setVolume(fadeIn ? 0.05 : _volume);
      await _player
          .setAudioSource(audioSource, preload: true)
          .timeout(const Duration(seconds: 12));
      if (reqId != _playRequestId) return false;

      if (_speed != 1.0 || !_pitchLock) {
        await _applySpeedAndPitch();
      }
      _isLoading = false;
      _consecutiveErrors = 0;
      _dspStateController.add(null);

      // just_audio's play() Future resolves only on completion, pause, or stop.
      unawaited(
        _player.play().catchError((Object e, StackTrace st) {
          debugPrint('[AudioPlayerService] Playback error ($debugLabel): $e');
        }),
      );

      unawaited(_applyHardwareDsp());
      if (fadeIn) {
        unawaited(_fadeInPlayer());
      }
      _storage.addRecent(track).catchError((_) {});
      return true;
    } catch (err) {
      debugPrint('[AudioPlayerService] Candidate failed ($err): $debugLabel');
      if (reqId == _playRequestId) {
        try {
          await _player.stop();
        } catch (_) {}
      }
      return false;
    }
  }

  Future<bool> _tryStartCandidate(
    Track track,
    String streamUrl,
    MediaItem mediaItem,
    bool fadeIn,
    int reqId,
  ) async {
    if (reqId != _playRequestId) return false;
    return _startAudioSource(
      track,
      buildAudioSource(streamUrl, mediaItem),
      fadeIn,
      reqId,
      streamUrl,
    );
  }

  Future<void> playTrack(
    Track track, {
    List<Track>? newQueue,
    int? index,
    String? contextTitle,
    bool fadeIn = false,
    bool isAutoAdvance = false,
  }) async {
    final reqId = ++_playRequestId;
    _mixTimer?.cancel();
    _autoMixTriggeredForTrack = false;
    _statsRecordedForTrackId = null;
    if (!isAutoAdvance) {
      _consecutiveErrors = 0;
    }
    if (!fadeIn) {
      _isMixing = false;
    }
    if (contextTitle != null && contextTitle.isNotEmpty) {
      _contextTitle = contextTitle;
    }

    if (newQueue != null && newQueue.isNotEmpty) {
      _queue = List.from(newQueue);
      _currentIndex = index ?? _queue.indexOf(track);
      if (_currentIndex == -1) {
        _queue.insert(0, track);
        _currentIndex = 0;
      }
      _queueChangeController.add(_queue);
    } else if (!_queue.contains(track)) {
      _queue.add(track);
      _currentIndex = _queue.length - 1;
      _queueChangeController.add(_queue);
    } else {
      _currentIndex = index ?? _queue.indexOf(track);
    }

    _currentTrack = track;
    _isLoading = true;
    _lastError = null;
    _errorController.add(null);
    _trackChangeController.add(_currentTrack);

    try {
      final mediaItem = MediaItem(
        id: track.id,
        album: track.album ?? 'My Music',
        title: track.title,
        artist: track.artist,
        artUri: track.thumb.isNotEmpty ? Uri.tryParse(track.thumb) : null,
        duration: Duration(seconds: track.durationSec),
      );

      // 1. Instant offline downloaded playback if present
      final offlinePath = track.localPath ?? _storage.getDownloadedPath(track.id);
      if (offlinePath != null && offlinePath.isNotEmpty && File(offlinePath).existsSync()) {
        if (await _tryStartCandidate(track, offlinePath, mediaItem, fadeIn, reqId)) {
          return;
        }
      }

      if (reqId != _playRequestId) return;

      final tried = <String>{};

      if (track.id.startsWith('saavn:')) {
        final saavnStream = await _saavn
            .resolveStream(track.title, track.artist, directSongId: track.id)
            .timeout(const Duration(seconds: 5), onTimeout: () => null);
        if (reqId != _playRequestId) return;
        if (saavnStream != null && saavnStream.url.isNotEmpty) {
          tried.add(saavnStream.url);
          if (await _tryStartCandidate(track, saavnStream.url, mediaItem, fadeIn, reqId)) {
            return;
          }
        }
      } else {
        // Resolve Saavn (strict match) & YouTube (verified 200/206 candidates) concurrently
        final ytFuture = _yt.resolveStreamCandidates(track.cleanId);
        final saavnStream = await _saavn
            .resolveStream(track.title, track.artist)
            .timeout(const Duration(milliseconds: 2600), onTimeout: () => null);
        if (reqId != _playRequestId) return;

        if (saavnStream != null && saavnStream.url.isNotEmpty) {
          tried.add(saavnStream.url);
          if (await _tryStartCandidate(track, saavnStream.url, mediaItem, fadeIn, reqId)) {
            return;
          }
        }

        final ytCandidates = await ytFuture;
        if (reqId != _playRequestId) return;
        for (final url in ytCandidates) {
          if (tried.contains(url)) continue;
          tried.add(url);
          if (await _tryStartCandidate(track, url, mediaItem, fadeIn, reqId)) {
            return;
          }
        }
        if (ytCandidates.isNotEmpty) {
          _yt.invalidateStream(track.id);
        }


      }

      // Final fallback: search alternate YouTube video by title + artist
      if (reqId != _playRequestId) return;
      final searchCandidates = await _yt
          .search('${track.title} ${track.artist}', limit: 3)
          .timeout(const Duration(seconds: 6), onTimeout: () => const []);
      for (final sc in searchCandidates) {
        if (reqId != _playRequestId) return;
        if (sc.cleanId == track.cleanId) continue;
        final urls = await _yt.resolveStreamCandidates(sc.cleanId);
        for (final u in urls) {
          if (tried.contains(u)) continue;
          tried.add(u);
          if (await _tryStartCandidate(track, u, mediaItem, fadeIn, reqId)) {
            return;
          }
        }
      }

      throw Exception('No playable audio stream available for "${track.title}"');
    } catch (e) {
      if (reqId != _playRequestId) return;
      debugPrint('[AudioPlayerService] Play error: $e');
      _yt.invalidateStream(track.id);
      try {
        await _player.stop();
      } catch (_) {}
      _isLoading = false;
      _isMixing = false;
      _consecutiveErrors++;
      _lastError = 'Could not play "${track.title}". Check network or try another track.';
      _errorController.add(_lastError);
    }
  }

  void playNextInQueue(Track track) {
    if (_queue.isEmpty) {
      _queue = [track];
      _currentIndex = 0;
      _queueChangeController.add(_queue);
      playTrack(track);
      return;
    }
    final insertAt = (_currentIndex + 1).clamp(0, _queue.length);
    _queue.insert(insertAt, track);
    _queueChangeController.add(_queue);
  }

  void shuffleRemaining() {
    if (_currentIndex >= _queue.length - 1) return;
    final head = _queue.sublist(0, _currentIndex + 1);
    final tail = _queue.sublist(_currentIndex + 1)..shuffle();
    _queue = [...head, ...tail];
    _queueChangeController.add(_queue);
  }

  Future<void> cycleLoopMode() async {
    final current = _player.loopMode;
    final next = current == LoopMode.off
        ? LoopMode.all
        : (current == LoopMode.all ? LoopMode.one : LoopMode.off);
    await _player.setLoopMode(next);
    await _storage.patchSettings({
      'repeat': next == LoopMode.all ? 'all' : (next == LoopMode.one ? 'one' : 'off'),
    });
  }

  Future<void> toggleShuffle() async {
    final next = !_player.shuffleModeEnabled;
    await _player.setShuffleModeEnabled(next);
    await _storage.patchSettings({'shuffle': next});
  }

  Future<void> resume() async {
    if (_player.audioSource == null && _currentTrack != null) {
      await playTrack(_currentTrack!);
    } else {
      unawaited(
        _player.play().catchError((Object e) {
          debugPrint('[AudioPlayerService] resume play error: $e');
        }),
      );
    }
  }

  Future<void> pause() async => _player.pause();
  Future<void> stop() async => _player.stop();
  Future<void> seek(Duration position) async => _player.seek(position);

  Future<void> next({bool auto = false, bool fadeInAfter = false}) async {
    if (_queue.isEmpty) return;
    if (auto && _consecutiveErrors >= 3) {
      _isMixing = false;
      try {
        await _player.setVolume(_volume);
      } catch (_) {}
      _lastError = 'Stopped auto-advance after repeated stream failures.';
      _errorController.add(_lastError);
      _dspStateController.add(null);
      return;
    }
    if (!auto) {
      _consecutiveErrors = 0;
    }
    int nextIdx = _currentIndex + 1;
    if (nextIdx >= _queue.length) {
      if (_radioEnabled && _currentTrack != null) {
        try {
          final radioTracks = await _yt.getRadio(
            _currentTrack!.cleanId,
            title: _currentTrack!.title,
            artist: _currentTrack!.artist,
          );
          final newTracks = radioTracks
              .where((r) => !_queue.any((q) => q.cleanId == r.cleanId))
              .toList();
          if (newTracks.isNotEmpty) {
            _queue.addAll(newTracks);
            _queueChangeController.add(_queue);
          }
        } catch (_) {}
      }
      if (nextIdx >= _queue.length) {
        if (auto && _player.loopMode == LoopMode.off) {
          _isMixing = false;
          _dspStateController.add(null);
          return;
        }
        nextIdx = 0;
      }
    }
    await playTrack(
      _queue[nextIdx],
      index: nextIdx,
      fadeIn: fadeInAfter,
      isAutoAdvance: auto,
    );
  }

  Future<void> previous() async {
    if (_queue.isEmpty) return;
    if (_player.position.inSeconds > 3) {
      await seek(Duration.zero);
      return;
    }
    int prevIdx = _currentIndex - 1;
    if (prevIdx < 0) prevIdx = _queue.length - 1;
    await playTrack(_queue[prevIdx], index: prevIdx);
  }

  void reorderQueue(int oldIndex, int newIndex) {
    if (oldIndex < 0 || oldIndex >= _queue.length || newIndex < 0 || newIndex > _queue.length) {
      return;
    }
    if (oldIndex < newIndex) newIndex -= 1;
    final item = _queue.removeAt(oldIndex);
    _queue.insert(newIndex, item);
    if (_currentTrack != null) {
      _currentIndex = _queue.indexOf(_currentTrack!);
    }
    _queueChangeController.add(_queue);
  }

  void removeFromQueue(int index) {
    if (index < 0 || index >= _queue.length) return;
    _queue.removeAt(index);
    if (_currentTrack != null) {
      _currentIndex = _queue.indexOf(_currentTrack!);
    }
    _queueChangeController.add(_queue);
  }

  void clearQueue() {
    _queue.clear();
    _currentIndex = -1;
    _queueChangeController.add(_queue);
  }
}
