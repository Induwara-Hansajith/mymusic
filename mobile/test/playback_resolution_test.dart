import 'package:flutter_test/flutter_test.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:mymusic_mobile/services/audio_player_service.dart';
import 'package:mymusic_mobile/services/youtube_service.dart';

void main() {
  test('isLocalAudioPath distinguishes local files from remote stream URLs', () {
    expect(
      AudioPlayerService.isLocalAudioPath(
        'https://aac.saavncdn.com/077/0b02a92687d1ae3369b6859f44872e52_320.mp4',
      ),
      isFalse,
    );
    expect(
      AudioPlayerService.isLocalAudioPath(
        'https://rr1---sn-npoeenez.googlevideo.com/videoplayback?expire=1795&mime=video%2Fmp4',
      ),
      isFalse,
    );
    expect(
      AudioPlayerService.isLocalAudioPath('http://127.0.0.1:8080/track.mp4'),
      isFalse,
    );

    expect(
      AudioPlayerService.isLocalAudioPath('/data/user/0/com.induw.mymusic/app_flutter/downloads/t1.m4a'),
      isTrue,
    );
    expect(
      AudioPlayerService.isLocalAudioPath('C:\\Users\\induw\\Music\\song.mp3'),
      isTrue,
    );
    expect(
      AudioPlayerService.isLocalAudioPath('file:///data/user/0/com.induw.mymusic/files/song.m4a'),
      isTrue,
    );
  });

  test('buildAudioSource routes HTTPS streams to ProgressiveAudioSource with correct headers', () {
    final mediaItem = MediaItem(
      id: '4NRXx6U8ABQ',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
    );

    final saavnSource = AudioPlayerService.buildAudioSource(
      'https://aac.saavncdn.com/077/sample_320.mp4',
      mediaItem,
    ) as ProgressiveAudioSource;
    expect(saavnSource.uri.scheme, 'https');
    expect(saavnSource.headers, isNull);

    final ytSource = AudioPlayerService.buildAudioSource(
      'https://rr2---sn-foo.googlevideo.com/videoplayback?itag=18',
      mediaItem,
    ) as ProgressiveAudioSource;
    expect(ytSource.uri.scheme, 'https');
    expect(
      ytSource.headers?['User-Agent'],
      YoutubeService.androidClientUserAgent,
    );

    final fileSource = AudioPlayerService.buildAudioSource(
      '/data/user/0/com.induw.mymusic/downloads/track.m4a',
      mediaItem,
    ) as ProgressiveAudioSource;
    expect(fileSource.uri.scheme, 'file');
  });

  test('prioritizeDirectStreams places muxed mp4 ahead of adaptive audio', () {
    final ordered = YoutubeService.prioritizeDirectStreams<String>(
      mp4Muxed: ['tag18'],
      mp4Audio: ['tag140', 'tag139'],
      otherMuxed: ['tag22'],
      otherAudio: ['tag251'],
    );

    expect(ordered.first, 'tag18');
    expect(ordered, ['tag18', 'tag22', 'tag140', 'tag139', 'tag251']);
  });

  test('curated playlists contain valid non-empty IDs without dead placeholders', () {
    const deadIds = {
      'd5gx_qLp_i8',
      'K3QzzggA_-s',
      'jfKfPfyJRdk',
      '5yx6BWlEVcY',
      'DWcJFNfaw9c',
      '_7Pz8qE49vY',
    };
    final allCurated = [
      ...YoutubeService.getCuratedAfterHours(),
      ...YoutubeService.getCuratedDeepFocus(),
      ...YoutubeService.getCuratedSlowBurn(),
      ...YoutubeService.getCuratedTopHits(),
      ...YoutubeService.getCuratedLateNight(),
      ...YoutubeService.getCuratedChill(),
    ];
    expect(allCurated, isNotEmpty);
    for (final track in allCurated) {
      expect(track.id, isNotEmpty);
      expect(deadIds.contains(track.cleanId), isFalse,
          reason: 'Track ${track.title} uses stale dead videoId ${track.cleanId}');
    }
  });
}
