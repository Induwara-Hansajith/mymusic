import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mymusic_mobile/main.dart';
import 'package:mymusic_mobile/models/track.dart';
import 'package:mymusic_mobile/models/ytm_models.dart';
import 'package:mymusic_mobile/services/storage_service.dart';

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

  test('StorageService handles playlists, stats, and sync export/import', () async {
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

  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MyMusicApp());
    await tester.pump();
    expect(find.byType(MyMusicApp), findsOneWidget);
  });
}
