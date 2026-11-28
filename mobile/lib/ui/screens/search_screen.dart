import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/search_provider.dart';
import '../../providers/player_provider.dart';
import '../../providers/theme_provider.dart';
import '../theme.dart';
import '../widgets/desktop_widgets.dart';
import '../widgets/track_tile.dart';

class SearchScreen extends StatelessWidget {
  final void Function(String albumId) onOpenAlbum;
  final void Function(String artistId, String artistName) onOpenArtist;
  final void Function(String playlistId) onOpenYtPlaylist;

  const SearchScreen({
    super.key,
    required this.onOpenAlbum,
    required this.onOpenArtist,
    required this.onOpenYtPlaylist,
  });

  static const List<List<String>> _tabs = [
    ['songs', 'Songs'],
    ['videos', 'Videos'],
    ['albums', 'Albums'],
    ['artists', 'Artists'],
    ['playlists', 'Playlists'],
  ];

  @override
  Widget build(BuildContext context) {
    final search = context.watch<SearchProvider>();
    final player = context.read<PlayerProvider>();
    final accent = context.watch<ThemeProvider>().accent;
    final q = search.query;
    final filter = search.activeFilter;
    final res = search.ytmResult;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 120),
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 12),
          child: Text(
            q.isNotEmpty ? 'Results for “$q”' : 'Search',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppTheme.text,
              fontSize: 25,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
            ),
          ),
        ),

        // Desktop `.tabs` filter pills
        SizedBox(
          height: 36,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _tabs.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final k = _tabs[i][0];
              final label = _tabs[i][1];
              final isOn = filter == k;
              return GestureDetector(
                onTap: () => search.setFilter(k),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 7),
                  decoration: BoxDecoration(
                    color: isOn ? accent : Colors.white.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: isOn ? Colors.transparent : AppTheme.glassBorder,
                    ),
                    boxShadow: isOn
                        ? [BoxShadow(color: accent.withValues(alpha: 0.45), blurRadius: 14)]
                        : null,
                  ),
                  child: Text(
                    label,
                    style: TextStyle(
                      color: isOn ? Colors.white : AppTheme.muted,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
              );
            },
          ),
        ),

        const SizedBox(height: 16),

        if (q.isEmpty) ...[
          const Text(
            'Type in the search bar above to search YouTube Music songs, videos, albums, artists, and playlists.',
            style: TextStyle(color: AppTheme.muted, fontSize: 13.5),
          ),
          const SizedBox(height: 20),
          const Text(
            'Quick Discover',
            style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: const [
              'The Weeknd',
              'Taylor Swift',
              'Lofi Hip Hop',
              'Synthwave Mix',
              'Billie Eilish',
              'EDM Workout',
            ].map((term) {
              return ActionChip(
                backgroundColor: AppTheme.panelCard,
                side: const BorderSide(color: AppTheme.glassBorder),
                label: Text(term, style: const TextStyle(color: AppTheme.text, fontSize: 12.5)),
                onPressed: () => search.executeSearch(term),
              );
            }).toList(),
          ),
        ] else if (search.isSearching) ...[
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: Center(child: CircularProgressIndicator()),
          ),
        ] else if (filter == 'songs' || filter == 'videos') ...[
          if ((filter == 'videos' ? res.videos : res.songs).isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Text('Nothing found.', style: TextStyle(color: AppTheme.muted)),
            )
          else
            ...(filter == 'videos' ? res.videos : res.songs).asMap().entries.map((e) {
              final list = filter == 'videos' ? res.videos : res.songs;
              return TrackTile(
                track: e.value,
                index: e.key,
                onOpenAlbum: onOpenAlbum,
                onOpenArtist: onOpenArtist,
                onTap: () => player.playTrack(
                  e.value,
                  queue: list,
                  index: e.key,
                  contextTitle: 'Search: $q',
                ),
              );
            }),
        ] else if (filter == 'albums') ...[
          if (res.albums.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Text('No albums found.', style: TextStyle(color: AppTheme.muted)),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.78,
              ),
              itemCount: res.albums.length,
              itemBuilder: (_, i) {
                final al = res.albums[i];
                return DesktopMediaCard(
                  title: al.title,
                  subtitle: [al.artist, al.year].where((s) => s.isNotEmpty).join(' • '),
                  thumb: al.thumb,
                  onTap: () => onOpenAlbum(al.id),
                );
              },
            ),
        ] else if (filter == 'artists') ...[
          if (res.artists.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Text('No artists found.', style: TextStyle(color: AppTheme.muted)),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.80,
              ),
              itemCount: res.artists.length,
              itemBuilder: (_, i) {
                final ar = res.artists[i];
                return DesktopMediaCard(
                  title: ar.name,
                  subtitle: 'Artist',
                  thumb: ar.thumb,
                  round: true,
                  onTap: () => onOpenArtist(ar.id, ar.name),
                );
              },
            ),
        ] else ...[
          if (res.playlists.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Text('No playlists found.', style: TextStyle(color: AppTheme.muted)),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.78,
              ),
              itemCount: res.playlists.length,
              itemBuilder: (_, i) {
                final pl = res.playlists[i];
                return DesktopMediaCard(
                  title: pl.title,
                  subtitle: pl.owner.isNotEmpty ? pl.owner : 'Playlist',
                  thumb: pl.thumb,
                  onTap: () => onOpenYtPlaylist(pl.id),
                );
              },
            ),
        ],
      ],
    );
  }
}
