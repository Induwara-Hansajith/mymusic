import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/search_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/app_update_service.dart';
import '../../services/audio_player_service.dart';
import '../../services/auth_sync_service.dart';
import '../theme.dart';
import '../widgets/aurora_backdrop.dart';
import '../widgets/auth_modal.dart';
import '../widgets/import_playlist_modal.dart';
import '../widgets/mini_player.dart';
import 'browse_screens.dart';
import 'collection_screens.dart';
import 'home_screen.dart';
import 'playlist_screen.dart';
import 'search_screen.dart';
import 'settings_screen.dart';
import 'wrapped_screen.dart';

class _NavRoute {
  final String view; // home, search, liked, recent, downloads, stats, settings, localpl, album, artist, ytplaylist
  final String? id;
  final String? extra;

  const _NavRoute(this.view, {this.id, this.extra});
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final TextEditingController _searchCtrl = TextEditingController();
  final FocusNode _searchFocus = FocusNode();
  final AuthSyncService _auth = AuthSyncService();
  final AppUpdateService _updater = AppUpdateService();

  final List<_NavRoute> _back = [];
  final List<_NavRoute> _fwd = [];
  _NavRoute _current = const _NavRoute('home');
  bool _showSuggestions = false;
  StreamSubscription<String?>? _errSub;
  bool _updateDialogOpen = false;

  @override
  void initState() {
    super.initState();
    _auth.addListener(_onAuthChanged);
    _updater.addListener(_onUpdateChanged);
    _errSub = AudioPlayerService().errorStream.listen((msg) {
      if (!mounted || msg == null || msg.isEmpty) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(msg, style: const TextStyle(color: Colors.white)),
            backgroundColor: const Color(0xFFB91C1C),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 4),
          ),
        );
    });
    _searchFocus.addListener(() {
      if (mounted) {
        setState(() => _showSuggestions = _searchFocus.hasFocus);
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _onUpdateChanged());
  }

  void _onAuthChanged() {
    if (mounted) setState(() {});
  }

  void _onUpdateChanged() {
    if (!mounted || _updateDialogOpen) return;
    final rel = _updater.availableRelease;
    if (_updater.status == UpdateStatus.downloaded &&
        rel != null &&
        _updater.consumeReadyPromptFlag()) {
      _showReadyToInstallDialog(rel);
    } else if (_updater.status == UpdateStatus.available &&
        rel != null &&
        _updater.lastCheckManual) {
      _showAvailableUpdateDialog(rel);
    }
  }

  Future<void> _handleInstallTap() async {
    final res = await _updater.installDownloadedApk();
    if (!mounted) return;
    if (res == 'permission_needed') {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF101420),
          title: const Text('Allow App Installs', style: TextStyle(color: AppTheme.text)),
          content: const Text(
            'Android requires enabling "Allow from this source" once for My Music to install APK updates.',
            style: TextStyle(color: AppTheme.muted),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Later', style: TextStyle(color: AppTheme.muted)),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await _updater.openInstallPermissionSettings();
              },
              child: const Text('Open Settings'),
            ),
          ],
        ),
      );
    } else if (res != 'ok') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res), behavior: SnackBarBehavior.floating),
      );
    }
  }

  void _showAvailableUpdateDialog(AndroidReleaseInfo rel) {
    _updateDialogOpen = true;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF101420),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AppTheme.glassBorder),
        ),
        title: const Text('A new version is available', style: TextStyle(color: AppTheme.text)),
        content: Text(
          'My Music v${rel.version} is available. Download quietly in the background without interrupting your music?',
          style: const TextStyle(color: AppTheme.muted, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () {
              _updater.deferUpdate(rel.version);
              Navigator.pop(ctx);
            },
            child: const Text('Later', style: TextStyle(color: AppTheme.muted)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _updater.startBackgroundDownload();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Downloading v${rel.version} in background…'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            child: const Text('Download & Update'),
          ),
        ],
      ),
    ).whenComplete(() => _updateDialogOpen = false);
  }

  void _showReadyToInstallDialog(AndroidReleaseInfo rel) {
    _updateDialogOpen = true;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF101420),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AppTheme.glassBorder),
        ),
        title: Text('Update v${rel.version} Ready', style: const TextStyle(color: AppTheme.text)),
        content: const Text(
          'Downloaded in background and verified. Install the update now?',
          style: TextStyle(color: AppTheme.muted, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () {
              _updater.deferUpdate(rel.version);
              Navigator.pop(ctx);
            },
            child: const Text('Later', style: TextStyle(color: AppTheme.muted)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _handleInstallTap();
            },
            child: const Text('Install now'),
          ),
        ],
      ),
    ).whenComplete(() => _updateDialogOpen = false);
  }

  @override
  void dispose() {
    _errSub?.cancel();
    _auth.removeListener(_onAuthChanged);
    _updater.removeListener(_onUpdateChanged);
    _searchCtrl.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _go(String view, {String? id, String? extra}) {
    if (_current.view == view && _current.id == id && _current.extra == extra) return;
    setState(() {
      _back.add(_current);
      if (_back.length > 40) _back.removeAt(0);
      _fwd.clear();
      _current = _NavRoute(view, id: id, extra: extra);
      _showSuggestions = false;
    });
    _searchFocus.unfocus();
  }

  void _navBack() {
    if (_back.isEmpty) return;
    setState(() {
      _fwd.add(_current);
      _current = _back.removeLast();
    });
  }

  void _navFwd() {
    if (_fwd.isEmpty) return;
    setState(() {
      _back.add(_current);
      _current = _fwd.removeLast();
    });
  }

  void _submitSearch(String q) {
    final trimmed = q.trim();
    if (trimmed.isEmpty) return;
    _searchCtrl.text = trimmed;
    context.read<SearchProvider>().executeSearch(trimmed);
    _go('search', extra: trimmed);
  }

  void _showCreatePlaylistDialog() {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF101420),
        title: const Text('New Playlist', style: TextStyle(color: AppTheme.text)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          style: const TextStyle(color: AppTheme.text),
          decoration: const InputDecoration(
            hintText: 'Playlist name',
            hintStyle: TextStyle(color: AppTheme.muted),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.muted)),
          ),
          ElevatedButton(
            onPressed: () async {
              final name = ctrl.text.trim();
              if (name.isNotEmpty) {
                final pl = await context.read<LibraryProvider>().createPlaylist(name);
                if (ctx.mounted) Navigator.pop(ctx);
                _go('localpl', id: pl.id);
              } else {
                Navigator.pop(ctx);
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveView() {
    switch (_current.view) {
      case 'home':
        return HomeScreen(
          onNavigate: (v) => _go(v),
          onOpenAlbum: (id) => _go('album', id: id),
          onOpenArtist: (id, name) => _go('artist', id: id, extra: name),
          onOpenYtPlaylist: (id) => _go('ytplaylist', id: id),
        );
      case 'search':
        return SearchScreen(
          onOpenAlbum: (id) => _go('album', id: id),
          onOpenArtist: (id, name) => _go('artist', id: id, extra: name),
          onOpenYtPlaylist: (id) => _go('ytplaylist', id: id),
        );
      case 'liked':
        return LikedSongsView(
          onOpenAlbum: (id) => _go('album', id: id),
          onOpenArtist: (id, name) => _go('artist', id: id, extra: name),
        );
      case 'recent':
        return RecentlyPlayedView(
          onOpenAlbum: (id) => _go('album', id: id),
          onOpenArtist: (id, name) => _go('artist', id: id, extra: name),
        );
      case 'downloads':
        return DownloadsView(
          onOpenAlbum: (id) => _go('album', id: id),
          onOpenArtist: (id, name) => _go('artist', id: id, extra: name),
        );
      case 'stats':
        return WrappedScreen(
          onOpenArtist: (id, name) => _go('artist', id: id, extra: name),
        );
      case 'settings':
        return const SettingsScreen();
      case 'album':
        return AlbumDetailView(
          albumId: _current.id ?? '',
          onOpenAlbum: (id) => _go('album', id: id),
          onOpenArtist: (id, name) => _go('artist', id: id, extra: name),
        );
      case 'artist':
        return ArtistDetailView(
          artistId: _current.id ?? '',
          fallbackName: _current.extra,
          onOpenAlbum: (id) => _go('album', id: id),
          onOpenArtist: (id, name) => _go('artist', id: id, extra: name),
          onOpenYtPlaylist: (id) => _go('ytplaylist', id: id),
        );
      case 'ytplaylist':
        return YtPlaylistDetailView(
          playlistId: _current.id ?? '',
          onOpenAlbum: (id) => _go('album', id: id),
          onOpenArtist: (id, name) => _go('artist', id: id, extra: name),
        );
      case 'localpl':
        final pls = context.watch<LibraryProvider>().playlists;
        final match = pls.where((p) => p.id == _current.id).toList();
        if (match.isEmpty) {
          return const Center(child: Text('Playlist not found.', style: TextStyle(color: AppTheme.muted)));
        }
        return PlaylistScreen(
          playlist: match.first,
          embedded: true,
          onDeleted: () => _go('home'),
          onOpenAlbum: (id) => _go('album', id: id),
          onOpenArtist: (id, name) => _go('artist', id: id, extra: name),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final search = context.watch<SearchProvider>();
    final theme = context.watch<ThemeProvider>();
    final accent = theme.accent;

    final Color syncDotColor;
    switch (_auth.syncStatus) {
      case CloudSyncStatus.synced:
        syncDotColor = const Color(0xFF34D399);
      case CloudSyncStatus.syncing:
        syncDotColor = const Color(0xFFFBBF24);
      case CloudSyncStatus.offline:
      case CloudSyncStatus.error:
        syncDotColor = const Color(0xFFF87171);
      case CloudSyncStatus.idle:
        syncDotColor = AppTheme.muted;
    }

    return PopScope(
      canPop: _back.isEmpty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _back.isNotEmpty) {
          _navBack();
        }
      },
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: AppTheme.bg,
        drawer: _buildDesktopSidebarDrawer(accent),
        body: AuroraBackdrop(
          child: SafeArea(
            bottom: false,
            child: Stack(
              children: [
                Column(
                  children: [
                    // Desktop Topbar (`#topbar`: Menu + Back/Fwd + Search Pill + Account/Sync Pill)
                    Container(
                      height: 58,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.menu_rounded, color: AppTheme.text, size: 22),
                            tooltip: 'Menu',
                            onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                          ),
                          IconButton(
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                            padding: EdgeInsets.zero,
                            icon: Icon(
                              Icons.chevron_left_rounded,
                              color: _back.isNotEmpty ? AppTheme.text : AppTheme.muted.withValues(alpha: 0.35),
                              size: 24,
                            ),
                            onPressed: _back.isNotEmpty ? _navBack : null,
                          ),
                          IconButton(
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                            padding: EdgeInsets.zero,
                            icon: Icon(
                              Icons.chevron_right_rounded,
                              color: _fwd.isNotEmpty ? AppTheme.text : AppTheme.muted.withValues(alpha: 0.35),
                              size: 24,
                            ),
                            onPressed: _fwd.isNotEmpty ? _navFwd : null,
                          ),
                          const SizedBox(width: 4),
                          // Search Pill (`#searchWrap`)
                          Expanded(
                            child: Container(
                              height: 38,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.06),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: _searchFocus.hasFocus ? accent : AppTheme.glassBorder,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _searchCtrl,
                                      focusNode: _searchFocus,
                                      style: const TextStyle(color: AppTheme.text, fontSize: 13.5),
                                      textInputAction: TextInputAction.search,
                                      onChanged: (v) {
                                        search.onQueryChanged(v);
                                        setState(() => _showSuggestions = v.trim().isNotEmpty);
                                      },
                                      onSubmitted: _submitSearch,
                                      decoration: const InputDecoration(
                                        hintText: 'Search songs, albums, artists…',
                                        hintStyle: TextStyle(color: AppTheme.muted, fontSize: 13),
                                        border: InputBorder.none,
                                        isDense: true,
                                        contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(Icons.search_rounded, color: AppTheme.muted, size: 18),
                                    onPressed: () => _submitSearch(_searchCtrl.text),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Account & Cloud Sync Pill (`#topbarAuthBtn`)
                          GestureDetector(
                            onTap: () => showDesktopAuthModal(context),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.06),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: AppTheme.glassBorder),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  CircleAvatar(
                                    radius: 12,
                                    backgroundColor: accent.withValues(alpha: 0.28),
                                    backgroundImage: _auth.avatarUrl.isNotEmpty
                                        ? NetworkImage(_auth.avatarUrl)
                                        : null,
                                    child: _auth.avatarUrl.isEmpty
                                        ? const Icon(Icons.person_outline_rounded, size: 15, color: AppTheme.text)
                                        : null,
                                  ),
                                  const SizedBox(width: 5),
                                  Container(
                                    width: 7,
                                    height: 7,
                                    decoration: BoxDecoration(
                                      color: syncDotColor,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Main Content Area
                    Expanded(child: _buildActiveView()),
                  ],
                ),

                // Autocomplete Suggestions Dropdown (`#sugg`)
                if (_showSuggestions && search.suggestions.isNotEmpty)
                  Positioned(
                    top: 56,
                    left: 52,
                    right: 52,
                    child: Material(
                      color: const Color(0xF0101520),
                      borderRadius: BorderRadius.circular(12),
                      elevation: 14,
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.glassBorder),
                        ),
                        constraints: const BoxConstraints(maxHeight: 260),
                        child: ListView.builder(
                          shrinkWrap: true,
                          padding: const EdgeInsets.all(6),
                          itemCount: search.suggestions.length,
                          itemBuilder: (_, i) {
                            final sug = search.suggestions[i];
                            return InkWell(
                              borderRadius: BorderRadius.circular(8),
                              onTap: () => _submitSearch(sug),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                                child: Row(
                                  children: [
                                    const Icon(Icons.search_rounded, color: AppTheme.muted, size: 15),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        sug,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(color: AppTheme.text, fontSize: 13.5),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                  ),

                // Docked Desktop Player Bar (`#playerbar`)
                const Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: MiniPlayer(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Exact Desktop `#sidebar` Drawer
  Widget _buildDesktopSidebarDrawer(Color accent) {
    final playlists = context.watch<LibraryProvider>().playlists;
    return Drawer(
      width: 264,
      backgroundColor: AppTheme.sidebarBg,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Brand Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(9),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [accent, AppTheme.accentDarkFromHue(context.read<ThemeProvider>().hue)],
                      ),
                    ),
                    child: const Icon(Icons.music_note_rounded, color: Colors.white, size: 17),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'My Music',
                    style: TextStyle(color: AppTheme.text, fontSize: 17, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),

            // 7 Desktop Nav Items
            _sidebarNavItem('home', Icons.home_rounded, 'Home'),
            _sidebarNavItem('search', Icons.search_rounded, 'Search'),
            _sidebarNavItem('liked', Icons.favorite_rounded, 'Liked Songs'),
            _sidebarNavItem('recent', Icons.history_rounded, 'Recently Played'),
            _sidebarNavItem('downloads', Icons.download_rounded, 'Downloads'),
            _sidebarNavItem('stats', Icons.bar_chart_rounded, 'Stats'),
            _sidebarNavItem('settings', Icons.settings_rounded, 'Settings'),

            // Playlists Header + Import & Create buttons
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 10, 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'PLAYLISTS',
                    style: TextStyle(
                      color: AppTheme.muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                        padding: EdgeInsets.zero,
                        tooltip: 'Import playlist (Spotify, YouTube, CSV)',
                        icon: const Icon(Icons.file_download_outlined, color: AppTheme.muted, size: 18),
                        onPressed: () {
                          Navigator.pop(context);
                          showImportPlaylistModal(
                            context,
                            onImported: (plId) => _go('localpl', id: plId),
                          );
                        },
                      ),
                      IconButton(
                        constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                        padding: EdgeInsets.zero,
                        tooltip: 'New playlist',
                        icon: const Icon(Icons.add_rounded, color: AppTheme.muted, size: 20),
                        onPressed: () {
                          Navigator.pop(context);
                          _showCreatePlaylistDialog();
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),

            Expanded(
              child: playlists.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                      child: Text('No playlists yet', style: TextStyle(color: AppTheme.muted, fontSize: 12.5)),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      itemCount: playlists.length,
                      itemBuilder: (_, i) {
                        final pl = playlists[i];
                        final active = _current.view == 'localpl' && _current.id == pl.id;
                        return ListTile(
                          dense: true,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          tileColor: active ? AppTheme.bg3 : Colors.transparent,
                          leading: Icon(Icons.music_note_rounded, color: active ? accent : AppTheme.muted, size: 17),
                          title: Text(
                            pl.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: active ? AppTheme.text : AppTheme.muted,
                              fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                              fontSize: 13.5,
                            ),
                          ),
                          onTap: () {
                            Navigator.pop(context);
                            _go('localpl', id: pl.id);
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sidebarNavItem(String view, IconData icon, String label) {
    final active = _current.view == view;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
      child: ListTile(
        dense: true,
        visualDensity: VisualDensity.compact,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        tileColor: active ? AppTheme.bg3 : Colors.transparent,
        leading: Icon(icon, color: active ? AppTheme.text : AppTheme.muted, size: 20),
        title: Text(
          label,
          style: TextStyle(
            color: active ? AppTheme.text : AppTheme.muted,
            fontWeight: active ? FontWeight.w600 : FontWeight.w500,
            fontSize: 14,
          ),
        ),
        onTap: () {
          Navigator.pop(context);
          _go(view);
        },
      ),
    );
  }
}
