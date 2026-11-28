import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mymusic_mobile/main.dart';
import 'package:mymusic_mobile/models/track.dart';
import 'package:mymusic_mobile/models/ytm_models.dart';
import 'package:mymusic_mobile/services/app_update_service.dart';
import 'package:mymusic_mobile/services/storage_service.dart';
import 'package:mymusic_mobile/services/ytm_innertube_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await StorageService().init();
  });

  test('Track round-trips desktop and mobile duration fields', () {
    final track = Track.fromJson({
      'id': 'yt:abc123',
      'title': 'Neon Nights',
      'artist': 'Synth Wave',
      'artistId': 'UC123',
      'duration': 215,
      'thumb': 'https://example.com/art.jpg',
      'album': 'Midnight Drive',
      'albumId': 'MPREb_456',
      'type': 'song',
    });

    expect(track.cleanId, 'abc123');
    expect(track.durationSec, 215);
    expect(track.artistId, 'UC123');
    expect(track.albumId, 'MPREb_456');

    final json = track.toJson();
    expect(json['duration'], 215);
    expect(json['durationSec'], 215);
  });

  test('StorageService handles playlists, stats, cache, and sync', () async {
    final storage = StorageService();
    const track = Track(
      id: 'yt:t1',
      title: 'Test Track',
      artist: 'Test Artist',
      durationSec: 180,
      thumb: '',
    );

    final pl = await storage.createPlaylist('Roadtrip');
    await storage.addTrackToPlaylist(pl.id, track);
    await storage.renamePlaylist(pl.id, 'Late Night');
    await storage.recordListening(track, seconds: 120);

    final exported = storage.exportAllForSync();
    expect((exported['playlists'] as List).length, 1);
    expect((exported['playlists'] as List).first['name'], 'Late Night');
    expect((exported['playStats'] as Map)['totalPlays'], 1);
    expect((exported['playStats'] as Map)['totalSeconds'], 120);

    await storage.deletePlaylist(pl.id);
    expect(storage.getPlaylists(), isEmpty);

    await storage.applySyncedData({
      'settings': {'wallpaperDim': 0.5, 'lyricsStyle': 'karaoke'},
    });
    expect(storage.getSettingsMap()['wallpaperDim'], 50.0);
    expect(storage.getSettingsMap()['lyricsStyle'], 'karaoke');

    await storage.saveCachedHomeShelves([
      const YtmHomeShelf(
        title: 'Quick Picks',
        songs: [track],
        albums: [YtmAlbum(id: 'MPREb_1', title: 'Dawn FM', artist: 'The Weeknd')],
      ),
    ]);
    final cachedShelves = storage.getCachedHomeShelves();
    expect(cachedShelves.length, 1);
    expect(cachedShelves.first.title, 'Quick Picks');
    expect(cachedShelves.first.songs.first.id, 'yt:t1');
    expect(cachedShelves.first.albums.first.id, 'MPREb_1');
  });

  test('AppUpdateService compares versions and parses GitHub APK releases', () {
    expect(AppUpdateService.isNewerVersion('1.2.0', '1.1.9'), isTrue);
    expect(AppUpdateService.isNewerVersion('1.1.10', '1.1.9'), isTrue);
    expect(AppUpdateService.isNewerVersion('1.1.9.1', '1.1.9'), isTrue);
    expect(AppUpdateService.isNewerVersion('1.1.9', '1.1.9.1'), isFalse);
    expect(AppUpdateService.isNewerVersion('1.1.9', '1.1.9'), isFalse);
    expect(AppUpdateService.isNewerVersion('1.1.8', '1.1.9'), isFalse);

    final parsed = AppUpdateService.parseLatestMobileRelease([
      {
        'tag_name': 'draft_rel',
        'draft': true,
        'assets': [
          {
            'name': 'My.Music.Mobile.9.9.9.full.apk',
            'browser_download_url': 'https://example.com/draft.apk',
            'size': 70000000,
          }
        ],
      },
      {
        'tag_name': 'my_music_V9',
        'name': 'Build 1.1.9',
        'draft': false,
        'body': 'Release notes',
        'html_url': 'https://github.com/Induwara-Hansajith/mymusic/releases/tag/my_music_V9',
        'assets': [
          {
            'name': 'My.Music.Setup.1.1.9.exe',
            'browser_download_url': 'https://example.com/setup.exe',
            'size': 136000000,
          },
          {
            'name': 'My.Music.Mobile.1.1.9.full.apk',
            'browser_download_url': 'https://example.com/My.Music.Mobile.1.1.9.full.apk',
            'size': 67521742,
          },
        ],
      },
    ]);

    expect(parsed, isNotNull);
    expect(parsed!.version, '1.1.9');
    expect(parsed.assetName, 'My.Music.Mobile.1.1.9.full.apk');
    expect(parsed.sizeBytes, 67521742);

    final patchRelease = AppUpdateService.parseLatestMobileRelease([
      {
        'tag_name': 'my_music_V9_1',
        'name': 'Build 1.1.9.1',
        'assets': [
          {
            'name': 'My.Music.Mobile.1.1.9.1.full.apk',
            'browser_download_url': 'https://example.com/My.Music.Mobile.1.1.9.1.full.apk',
            'size': 68000000,
          }
        ],
      },
    ]);
    expect(patchRelease?.version, '1.1.9.1');
    expect(patchRelease?.assetName, 'My.Music.Mobile.1.1.9.1.full.apk');
  });

  test('YouTube image normalization selects a generally available thumbnail', () {
    expect(
      YtmInnertubeService.upgradeThumbUrl(
        'https://i.ytimg.com/vi/abc123/maxresdefault.jpg?sqp=test',
      ),
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    );
    expect(
      YtmInnertubeService.upgradeThumbUrl(
        'https://yt3.googleusercontent.com/avatar=w1024-h1024-l90-rj',
      ),
      'https://yt3.googleusercontent.com/avatar=w544-h544-l90-rj',
    );
  });

  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MyMusicApp());
    await tester.pump();
    expect(find.byType(MyMusicApp), findsOneWidget);
  });
}
