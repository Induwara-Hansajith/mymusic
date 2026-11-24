import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:audio_session/audio_session.dart';
import '../models/track.dart';
import 'youtube_service.dart';
import 'saavn_service.dart';
import 'storage_service.dart';

class AudioPlayerService {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;
  AudioPlayerService._internal();

  final AudioPlayer _player = AudioPlayer();
  final YoutubeService _yt = YoutubeService();
  final SaavnService _saavn = SaavnService();

  List<Track> _queue = [];
  int _currentIndex = -1;
  Track? _currentTrack;
  bool _isLoading = false;
  String? _lastError;
  bool _autoMixEnabled = true;
  double _speed = 1.0;
  bool _pitchLock = true;
  int _consecutiveErrors = 0;

  // 10-band EQ gains in dB (-12 to +12)
  final List<double> _eqBands = [4.0, 6.0, 3.0, -1.0, -3.0, 0.0, 3.0, 5.0, 4.0, 2.0];
  String _eqPreset = 'Warm & spacious';

  final _trackChangeController = StreamController<Track?>.broadcast();
  Stream<Track?> get currentTrackStream => _trackChangeController.stream;

  final _queueChangeController = StreamController<List<Track>>.broadcast();
  Stream<List<Track>> get queueStream => _queueChangeController.stream;

  final _errorController = StreamController<String?>.broadcast();
  Stream<String?> get errorStream => _errorController.stream;

  final _autoMixController = StreamController<bool>.broadcast();
  Stream<bool> get autoMixStream => _autoMixController.stream;

  AudioPlayer get player => _player;
  Track? get currentTrack => _currentTrack;
  List<Track> get queue => List.unmodifiable(_queue);
  int get currentIndex => _currentIndex;
  bool get isLoading => _isLoading;
  String? get lastError => _lastError;
  bool get autoMixEnabled => _autoMixEnabled;
  double get speed => _speed;
  bool get pitchLock => _pitchLock;
  List<double> get eqBands => List.unmodifiable(_eqBands);
  String get eqPreset => _eqPreset;

  Future<void> init() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.music());
    } catch (e) {
      debugPrint('[AudioPlayerService] AudioSession init warning: $e');
    }

    try {
      await _player.setVolume(1.0);
    } catch (_) {}

    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        final pos = _player.position;
        final dur = _player.duration;
        // Only advance to next track if track actually played to near completion
        if (dur != null && dur.inSeconds > 5 && pos.inSeconds >= dur.inSeconds - 3) {
          next();
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

  void setInitialTrack(Track track, List<Track> queue) {
    _currentTrack = track;
    _queue = List.from(queue);
    _currentIndex = _queue.indexOf(track);
    if (_currentIndex == -1) _currentIndex = 0;
    _trackChangeController.add(_currentTrack);
    _queueChangeController.add(_queue);
  }

  void setAutoMix(bool enabled) {
    _autoMixEnabled = enabled;
    _autoMixController.add(_autoMixEnabled);
  }

  Future<void> setPlaybackSpeed(double speed) async {
    _speed = speed.clamp(0.5, 2.0);
    try {
      await _player.setSpeed(_speed);
    } catch (e) {
      debugPrint('[AudioPlayerService] setPlaybackSpeed error: $e');
    }
  }

  void setPitchLock(bool lock) {
    _pitchLock = lock;
  }

  void setEqBand(int index, double gainDb) {
    if (index >= 0 && index < _eqBands.length) {
      _eqBands[index] = gainDb.clamp(-12.0, 12.0);
    }
  }

  void setEqPreset(String preset, List<double> gains) {
    _eqPreset = preset;
    for (int i = 0; i < _eqBands.length && i < gains.length; i++) {
      _eqBands[i] = gains[i].clamp(-12.0, 12.0);
    }
  }

  void resetEq() {
    _eqPreset = 'Flat';
    for (int i = 0; i < _eqBands.length; i++) {
      _eqBands[i] = 0.0;
    }
  }

  Future<void> playTrack(Track track, {List<Track>? newQueue, int? index}) async {
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
      _currentIndex = _queue.indexOf(track);
    }

    _currentTrack = track;
    _trackChangeController.add(_currentTrack);
    _isLoading = true;
    _lastError = null;
    _errorController.add(null);

    try {
      final candidates = <String>[];

      // 1. Local path if available and exists on disk
      if (track.localPath != null && track.localPath!.isNotEmpty) {
        final f = File(track.localPath!);
        if (f.existsSync()) {
          candidates.add(track.localPath!);
        }
      }

      // 2. High-Fidelity 320kbps CDN Stream (JioSaavn Akamai CDN)
      // Instant playback, zero 403 blocks, universal seeking, works globally
      try {
        final saavnStream = await _saavn.resolveStream(
          track.title,
          track.artist,
          directSongId: track.id.startsWith('saavn:') ? track.id : null,
        );
        if (saavnStream != null && saavnStream.url.isNotEmpty) {
          candidates.add(saavnStream.url);
          debugPrint('[AudioPlayerService] Added 320kbps CDN candidate: ${saavnStream.url}');
        }
      } catch (e) {
        debugPrint('[AudioPlayerService] Saavn candidate note: $e');
      }

      // 3. YouTube Direct Stream URL
      try {
        final ytUrl = await _yt.resolveStreamUrl(track.cleanId);
        if (ytUrl != null && ytUrl.isNotEmpty && !candidates.contains(ytUrl)) {
          candidates.add(ytUrl);
          debugPrint('[AudioPlayerService] Added YouTube candidate: $ytUrl');
        }
      } catch (e) {
        debugPrint('[AudioPlayerService] YouTube candidate note: $e');
      }

      // 4. YouTube Search fallback
      if (candidates.isEmpty) {
        try {
          final searchCandidates = await _yt.search('${track.title} ${track.artist}', limit: 3);
          for (final sc in searchCandidates) {
            if (sc.cleanId != track.cleanId) {
              final searchUrl = await _yt.resolveStreamUrl(sc.cleanId);
              if (searchUrl != null && searchUrl.isNotEmpty && !candidates.contains(searchUrl)) {
                candidates.add(searchUrl);
                break;
              }
            }
          }
        } catch (e) {
          debugPrint('[AudioPlayerService] Search candidate note: $e');
        }
      }

      if (candidates.isEmpty) {
        throw Exception('Stream URL could not be resolved for "${track.title}"');
      }

      final mediaItem = MediaItem(
        id: track.id,
        album: track.album ?? 'My Music',
        title: track.title,
        artist: track.artist,
        artUri: track.thumb.isNotEmpty ? Uri.tryParse(track.thumb) : null,
        duration: Duration(seconds: track.durationSec),
      );

      // Cascading multi-candidate playback: if candidate 1 fails setAudioSource, try candidate 2!
      bool played = false;
      dynamic lastCandidateErr;

      for (final streamUrl in candidates) {
        try {
          final AudioSource audioSource;
          if (streamUrl.startsWith('/') || streamUrl.contains(':\\') || streamUrl.contains(':/')) {
            audioSource = AudioSource.file(
              streamUrl,
              tag: mediaItem,
            );
          } else {
            final Map<String, String>? headers;
            if (streamUrl.contains('googlevideo.com')) {
              headers = const {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Referer': 'https://www.youtube.com/',
              };
            } else {
              headers = null;
            }

            audioSource = AudioSource.uri(
              Uri.parse(streamUrl),
              headers: headers,
              tag: mediaItem,
            );
          }

          await _player.setAudioSource(audioSource, preload: true);
          await _player.play();
          played = true;
          _isLoading = false;
          _consecutiveErrors = 0;
          StorageService().addRecent(track).catchError((_) {});
          debugPrint('[AudioPlayerService] Successfully started playback for "${track.title}" via: $streamUrl');
          break;
        } catch (err) {
          debugPrint('[AudioPlayerService] Candidate $streamUrl failed: $err, trying next...');
          lastCandidateErr = err;
          _yt.invalidateStream(track.id);
        }
      }

      if (!played) {
        throw lastCandidateErr ?? Exception('Playback failed across all candidates for "${track.title}"');
      }
    } catch (e) {
      debugPrint('[AudioPlayerService] Play error: $e');
      _yt.invalidateStream(track.id);
      _isLoading = false;
      _consecutiveErrors++;
      _lastError = 'Playback failed for "${track.title}": $e';
      _errorController.add(_lastError);
      if (_consecutiveErrors >= 3) {
        debugPrint('[AudioPlayerService] Halted auto-skip after $_consecutiveErrors consecutive errors.');
      }
    }
  }

  Future<void> cycleLoopMode() async {
    final current = _player.loopMode;
    final next = current == LoopMode.off
        ? LoopMode.all
        : (current == LoopMode.all ? LoopMode.one : LoopMode.off);
    await _player.setLoopMode(next);
  }

  Future<void> toggleShuffle() async {
    final next = !_player.shuffleModeEnabled;
    await _player.setShuffleModeEnabled(next);
  }

  Future<void> resume() async {
    if (_player.audioSource == null && _currentTrack != null) {
      await playTrack(_currentTrack!);
    } else {
      await _player.play();
    }
  }
  Future<void> pause() async => _player.pause();
  Future<void> stop() async => _player.stop();

  Future<void> seek(Duration position) async => _player.seek(position);

  Future<void> next() async {
    if (_queue.isEmpty) return;
    int nextIdx = _currentIndex + 1;
    if (nextIdx >= _queue.length) {
      if (_autoMixEnabled && _currentTrack != null) {
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
        } catch (e) {
          debugPrint('[AudioPlayerService] AutoMix radio replenishment note: $e');
        }
      }
      if (nextIdx >= _queue.length) {
        nextIdx = 0;
      }
    }
    await playTrack(_queue[nextIdx], index: nextIdx);
  }

  Future<void> previous() async {
    if (_queue.isEmpty) return;
    if (_player.position.inSeconds > 3) {
      await seek(Duration.zero);
      return;
    }
    int prevIdx = _currentIndex - 1;
    if (prevIdx < 0) {
      prevIdx = _queue.length - 1;
    }
    await playTrack(_queue[prevIdx], index: prevIdx);
  }

  void reorderQueue(int oldIndex, int newIndex) {
    if (oldIndex < 0 || oldIndex >= _queue.length || newIndex < 0 || newIndex > _queue.length) {
      return;
    }
    if (oldIndex < newIndex) {
      newIndex -= 1;
    }
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
