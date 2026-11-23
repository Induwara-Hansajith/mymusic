import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:audio_session/audio_session.dart';
import '../models/track.dart';
import 'youtube_service.dart';
import 'storage_service.dart';

class AudioPlayerService {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;
  AudioPlayerService._internal();

  final AudioPlayer _player = AudioPlayer();
  final YoutubeService _yt = YoutubeService();

  List<Track> _queue = [];
  int _currentIndex = -1;
  Track? _currentTrack;
  bool _isLoading = false;
  String? _lastError;
  int _consecutiveErrors = 0;

  final _trackChangeController = StreamController<Track?>.broadcast();
  Stream<Track?> get currentTrackStream => _trackChangeController.stream;

  final _queueChangeController = StreamController<List<Track>>.broadcast();
  Stream<List<Track>> get queueStream => _queueChangeController.stream;

  final _errorController = StreamController<String?>.broadcast();
  Stream<String?> get errorStream => _errorController.stream;

  AudioPlayer get player => _player;
  Track? get currentTrack => _currentTrack;
  List<Track> get queue => List.unmodifiable(_queue);
  int get currentIndex => _currentIndex;
  bool get isLoading => _isLoading;
  String? get lastError => _lastError;

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
        next();
      }
    });
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
      String? streamUrl;
      if (track.localPath != null && track.localPath!.isNotEmpty) {
        streamUrl = track.localPath;
      } else {
        streamUrl = await _yt.resolveStreamUrl(track.id);
      }

      if (streamUrl == null || streamUrl.isEmpty) {
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

      final AudioSource audioSource;
      if (track.localPath != null && track.localPath!.isNotEmpty) {
        audioSource = AudioSource.file(
          track.localPath!,
          tag: mediaItem,
        );
      } else {
        audioSource = AudioSource.uri(
          Uri.parse(streamUrl),
          headers: const {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'identity;q=1, *;q=0',
            'Range': 'bytes=0-',
            'Referer': 'https://www.youtube.com/',
          },
          tag: mediaItem,
        );
      }

      await _player.setAudioSource(audioSource, preload: true);
      await _player.play();
      _isLoading = false;
      _consecutiveErrors = 0;

      StorageService().addRecent(track).catchError((_) {});
    } catch (e) {
      debugPrint('[AudioPlayerService] Play error: $e');
      _yt.invalidateStream(track.id);
      _isLoading = false;
      _lastError = e.toString();
      _errorController.add(_lastError);

      _consecutiveErrors++;
      if (_consecutiveErrors < 3 && _queue.length > 1) {
        await Future.delayed(const Duration(milliseconds: 600));
        next();
      } else {
        _consecutiveErrors = 0;
      }
    }
  }

  Future<void> resume() async => _player.play();
  Future<void> pause() async => _player.pause();
  Future<void> stop() async => _player.stop();

  Future<void> seek(Duration position) async => _player.seek(position);

  Future<void> next() async {
    if (_queue.isEmpty) return;
    if (_currentIndex + 1 < _queue.length) {
      _currentIndex++;
      await playTrack(_queue[_currentIndex]);
    } else if (_player.loopMode == LoopMode.all) {
      _currentIndex = 0;
      await playTrack(_queue[0]);
    } else {
      // Auto fetch radio/recommended tracks when approaching queue end
      if (_currentTrack != null) {
        final related = await _yt.getRelatedTracks(_currentTrack!.id, limit: 10);
        if (related.isNotEmpty) {
          _queue.addAll(related);
          _queueChangeController.add(_queue);
          _currentIndex++;
          await playTrack(_queue[_currentIndex]);
          return;
        }
      }
      await _player.stop();
    }
  }

  Future<void> previous() async {
    if (_queue.isEmpty) return;
    if (_player.position.inSeconds > 3) {
      await _player.seek(Duration.zero);
      return;
    }
    if (_currentIndex > 0) {
      _currentIndex--;
      await playTrack(_queue[_currentIndex]);
    } else {
      await _player.seek(Duration.zero);
    }
  }

  Future<void> cycleLoopMode() async {
    switch (_player.loopMode) {
      case LoopMode.off:
        await _player.setLoopMode(LoopMode.all);
        break;
      case LoopMode.all:
        await _player.setLoopMode(LoopMode.one);
        break;
      case LoopMode.one:
        await _player.setLoopMode(LoopMode.off);
        break;
    }
  }

  Future<void> toggleShuffle() async {
    final enable = !_player.shuffleModeEnabled;
    await _player.setShuffleModeEnabled(enable);
  }

  void dispose() {
    _player.dispose();
    _trackChangeController.close();
    _queueChangeController.close();
    _errorController.close();
  }
}
