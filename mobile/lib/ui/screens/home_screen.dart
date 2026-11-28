import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/track.dart';
import '../../models/ytm_models.dart';
import '../../services/youtube_service.dart';
import '../../providers/player_provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/theme_provider.dart';
import '../theme.dart';
import '../widgets/desktop_widgets.dart';
import '../widgets/track_tile.dart';

class HomeScreen extends StatefulWidget {
  final void Function(String view) onNavigate;
  final void Function(String albumId) onOpenAlbum;
  final void Function(String artistId, String artistName) onOpenArtist;
  final void Function(String playlistId) onOpenYtPlaylist;

  const HomeScreen({
    super.key,
    required this.onNavigate,
    required this.onOpenAlbum,
    required this.onOpenArtist,
    required this.onOpenYtPlaylist,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final YoutubeService _yt = YoutubeService();
  List<YtmHomeShelf> _ytmShelves = [];
  Map<String, List<Track>> _fallbackFeed = {};
  final Map<String, String> _resolvedArtistThumbs = {};
  bool _loadingFeed = true;

  @override
  void initState() {
    super.initState();
    _loadFeed();
  }

  Future<void> _loadFeed() async {
    setState(() => _loadingFeed = true);
    final shelves = await _yt.getYtmHomeShelves();
    Map<String, List<Track>> fallback = {};
    if (shelves.isEmpty) {
      fallback = await _yt.getHomeFeed();
    }
    if (mounted) {
      setState(() {
        _ytmShelves = shelves;
        _fallbackFeed = fallback;
        _loadingFeed = false;
      });
    }
    _resolveTopArtistThumbs();
  }

  Future<void> _resolveTopArtistThumbs() async {
    final stats = context.read<LibraryProvider>().playStats;
    final artists = Map<String, dynamic>.from(stats['artists'] as Map? ?? {});
    final sorted = artists.entries.toList()
      ..sort((a, b) => (((b.value as Map)['plays'] as num?)?.toInt() ?? 0)
          .compareTo(((a.value as Map)['plays'] as num?)?.toInt() ?? 0));
    for (final entry in sorted.take(6)) {
      final info = Map<String, dynamic>.from(entry.value as Map);
      final existing = info['thumb'] as String?;
      if (existing != null && existing.isNotEmpty) {
        _resolvedArtistThumbs[entry.key] = existing;
        continue;
      }
      if (_resolvedArtistThumbs.containsKey(entry.key)) continue;
      final thumb = await _yt.resolveArtistThumb(
        entry.key,
        artistId: info['id'] as String?,
      );
      if (thumb != null && thumb.isNotEmpty && mounted) {
        setState(() => _resolvedArtistThumbs[entry.key] = thumb);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = context.read<PlayerProvider>();
    final library = context.watch<LibraryProvider>();
    final theme = context.watch<ThemeProvider>();

    final rec = library.recentTracks.take(8).toList();
    final fav = library.favorites.take(8).toList();
    final stats = library.playStats;

    final rawArtists = Map<String, dynamic>.from(stats['artists'] as Map? ?? {});
    final topArtists = rawArtists.entries.toList()
      ..sort((a, b) => (((b.value as Map)['plays'] as num?)?.toInt() ?? 0)
          .compareTo(((a.value as Map)['plays'] as num?)?.toInt() ?? 0));

    final rawTracks = Map<String, dynamic>.from(stats['tracks'] as Map? ?? {});
    final topTracksEntries = rawTracks.entries.toList()
      ..sort((a, b) => (((b.value as Map)['plays'] as num?)?.toInt() ?? 0)
          .compareTo(((a.value as Map)['plays'] as num?)?.toInt() ?? 0));
    final topTracks = topTracksEntries.take(6).map((e) {
      final m = Map<String, dynamic>.from(e.value as Map);
      return Track.fromJson({...m, 'id': e.key});
    }).toList();

    return RefreshIndicator(
      color: theme.accent,
      backgroundColor: AppTheme.panelOpaque,
      onRefresh: _loadFeed,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 120),
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 6, bottom: 12),
            child: Text(
              'Home',
              style: TextStyle(
                color: AppTheme.text,
                fontSize: 26,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
              ),
            ),
          ),

          // Desktop .home-hero or .empty-hero
          if (topArtists.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(18),
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.glassBorder),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    theme.accent.withValues(alpha: 0.20),
                    theme.accent2.withValues(alpha: 0.12),
                    AppTheme.panelCard,
                  ],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'MADE FOR YOU',
                    style: TextStyle(
                      color: theme.accentLight,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.1,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Welcome back',
                    style: TextStyle(
                      color: AppTheme.text,
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Your top artist is ${topArtists.first.key} — here are mixes, recommendations and more to keep the music going.',
                    style: const TextStyle(color: AppTheme.muted, fontSize: 13, height: 1.4),
                  ),
                ],
              ),
            )
          else if (rec.isEmpty && fav.isEmpty)
            Container(
              padding: const EdgeInsets.all(22),
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.glassBorder),
                color: AppTheme.panelCard,
              ),
              child: const Column(
                children: [
                  Text(
                    'Welcome to My Music',
                    style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Type in the search bar above to find any song, album, artist or playlist from YouTube Music.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppTheme.muted, fontSize: 13),
                  ),
                ],
              ),
            ),

          // Recently played
          if (rec.isNotEmpty) ...[
            _sectionHeader('Recently played', actionLabel: 'Show all', onAction: () => widget.onNavigate('recent')),
            ...rec.asMap().entries.map((e) => TrackTile(
                  track: e.value,
                  index: e.key,
                  onOpenAlbum: widget.onOpenAlbum,
                  onOpenArtist: widget.onOpenArtist,
                  onTap: () => player.playTrack(
                    e.value,
                    queue: library.recentTracks,
                    index: e.key,
                    contextTitle: 'Recently Played',
                  ),
                )),
          ],

          // Liked songs
          if (fav.isNotEmpty) ...[
            _sectionHeader('Liked songs', actionLabel: 'Show all', onAction: () => widget.onNavigate('liked')),
            ...fav.asMap().entries.map((e) => TrackTile(
                  track: e.value,
                  index: e.key,
                  onOpenAlbum: widget.onOpenAlbum,
                  onOpenArtist: widget.onOpenArtist,
                  onTap: () => player.playTrack(
                    e.value,
                    queue: library.favorites,
                    index: e.key,
                    contextTitle: 'Liked Songs',
                  ),
                )),
          ],

          // Your top tracks
          if (topTracks.isNotEmpty) ...[
            _sectionHeader('Your top tracks', actionLabel: 'See stats', onAction: () => widget.onNavigate('stats')),
            ...topTracks.asMap().entries.map((e) => TrackTile(
                  track: e.value,
                  index: e.key,
                  onOpenAlbum: widget.onOpenAlbum,
                  onOpenArtist: widget.onOpenArtist,
                  onTap: () => player.playTrack(
                    e.value,
                    queue: topTracks,
                    index: e.key,
                    contextTitle: 'Top Tracks',
                  ),
                )),
          ],

          // Your top artists
          if (topArtists.isNotEmpty) ...[
            _sectionHeader('Your top artists'),
            SizedBox(
              height: 196,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: topArtists.take(6).length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (_, i) {
                  final entry = topArtists[i];
                  final name = entry.key;
                  final info = Map<String, dynamic>.from(entry.value as Map);
                  final thumb = _resolvedArtistThumbs[name] ?? (info['thumb'] as String? ?? '');
                  final plays = (info['plays'] as num?)?.toInt() ?? 0;
                  final artistId = info['id'] as String? ?? '';
                  return DesktopMediaCard(
                    title: name,
                    subtitle: '$plays plays',
                    thumb: thumb,
                    round: true,
                    onTap: () => widget.onOpenArtist(artistId, name),
                  );
                },
              ),
            ),
          ],

          // YouTube Music Live Home Shelves
          if (_loadingFeed)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_ytmShelves.isNotEmpty)
            ..._ytmShelves.map((sh) {
              final hasCards = sh.albums.isNotEmpty || sh.playlists.isNotEmpty || sh.artists.isNotEmpty;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _sectionHeader(sh.title),
                  if (hasCards)
                    SizedBox(
                      height: 204,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          ...sh.albums.map((al) => Padding(
                                padding: const EdgeInsets.only(right: 12),
                                child: DesktopMediaCard(
                                  title: al.title,
                                  subtitle: al.artist.isNotEmpty ? al.artist : 'Album',
                                  thumb: al.thumb,
                                  onTap: () => widget.onOpenAlbum(al.id),
                                ),
                              )),
                          ...sh.playlists.map((pl) => Padding(
                                padding: const EdgeInsets.only(right: 12),
                                child: DesktopMediaCard(
                                  title: pl.title,
                                  subtitle: pl.owner.isNotEmpty ? pl.owner : 'Playlist',
                                  thumb: pl.thumb,
                                  onTap: () => widget.onOpenYtPlaylist(pl.id),
                                ),
                              )),
                          ...sh.artists.map((ar) => Padding(
                                padding: const EdgeInsets.only(right: 12),
                                child: DesktopMediaCard(
                                  title: ar.name,
                                  subtitle: 'Artist',
                                  thumb: ar.thumb,
                                  round: true,
                                  onTap: () => widget.onOpenArtist(ar.id, ar.name),
                                ),
                              )),
                        ],
                      ),
                    )
                  else
                    ...sh.songs.take(8).toList().asMap().entries.map((e) => TrackTile(
                          track: e.value,
                          index: e.key,
                          onOpenAlbum: widget.onOpenAlbum,
                          onOpenArtist: widget.onOpenArtist,
                          onTap: () => player.playTrack(
                            e.value,
                            queue: sh.songs,
                            index: e.key,
                            contextTitle: sh.title,
                          ),
                        )),
                ],
              );
            })
          else
            ..._fallbackFeed.entries.map((entry) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionHeader(entry.key),
                    ...entry.value.take(6).toList().asMap().entries.map((e) => TrackTile(
                          track: e.value,
                          index: e.key,
                          onOpenAlbum: widget.onOpenAlbum,
                          onOpenArtist: widget.onOpenArtist,
                          onTap: () => player.playTrack(
                            e.value,
                            queue: entry.value,
                            index: e.key,
                            contextTitle: entry.key,
                          ),
                        )),
                  ],
                )),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title, {String? actionLabel, VoidCallback? onAction}) {
    return Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppTheme.text,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              onPressed: onAction,
              child: Text(
                actionLabel,
                style: const TextStyle(
                  color: AppTheme.muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
