import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'services/storage_service.dart';
import 'services/auth_sync_service.dart';
import 'providers/player_provider.dart';
import 'providers/library_provider.dart';
import 'providers/search_provider.dart';
import 'providers/theme_provider.dart';
import 'ui/theme.dart';
import 'ui/screens/main_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: AppTheme.bg,
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  try {
    await JustAudioBackground.init(
      androidNotificationChannelId: 'com.induw.mymusic.channel.audio',
      androidNotificationChannelName: 'My Music Playback',
      androidNotificationOngoing: true,
      androidNotificationIcon: 'mipmap/ic_launcher',
    );
  } catch (e) {
    debugPrint('[main] JustAudioBackground init warning: $e');
  }

  await StorageService().init();
  await AuthSyncService().init();

  runApp(const MyMusicApp());
}

class MyMusicApp extends StatefulWidget {
  const MyMusicApp({super.key});

  @override
  State<MyMusicApp> createState() => _MyMusicAppState();
}

class _MyMusicAppState extends State<MyMusicApp> {
  final ThemeProvider _themeProvider = ThemeProvider();
  final LibraryProvider _libraryProvider = LibraryProvider();
  final PlayerProvider _playerProvider = PlayerProvider();
  final SearchProvider _searchProvider = SearchProvider();
  String? _lastAccentedTrackId;

  @override
  void initState() {
    super.initState();
    AuthSyncService().onLibrarySynced = () {
      _libraryProvider.load();
      _playerProvider.reloadSyncedSettings();
      _themeProvider.load();
    };
    _playerProvider.addListener(_onPlayerChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _onPlayerChanged();
    });
  }

  void _onPlayerChanged() {
    final t = _playerProvider.currentTrack;
    if (t != null && t.id != _lastAccentedTrackId) {
      _lastAccentedTrackId = t.id;
      _themeProvider.applyAccentFromThumb(t.thumb);
    }
  }

  @override
  void dispose() {
    _playerProvider.removeListener(_onPlayerChanged);
    _themeProvider.dispose();
    _libraryProvider.dispose();
    _playerProvider.dispose();
    _searchProvider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: _themeProvider),
        ChangeNotifierProvider.value(value: _libraryProvider),
        ChangeNotifierProvider.value(value: _playerProvider),
        ChangeNotifierProvider.value(value: _searchProvider),
      ],
      child: Consumer<ThemeProvider>(
        builder: (_, theme, _) => MaterialApp(
          title: 'My Music',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.buildTheme(theme.hue),
          home: const MainScreen(),
        ),
      ),
    );
  }
}
