import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/player_provider.dart';
import '../../models/track.dart';
import '../theme.dart';
import '../widgets/track_tile.dart';
import 'playlist_screen.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  int _activeTab = 5; // 0: Playlists, 1: Artists, 2: Albums, 3: Liked, 4: Downloaded, 5: History
  final List<String> _tabs = const ['Playlists', 'Artists', 'Albums', 'Liked', 'Downloaded', 'History'];

  void _showCreatePlaylistDialog(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.panel,
        title: const Text('New Playlist', style: TextStyle(color: AppTheme.text)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          style: const TextStyle(color: AppTheme.text),
          decoration: const InputDecoration(
            hintText: 'Playlist title',
            hintStyle: TextStyle(color: AppTheme.muted),
            enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppTheme.line)),
            focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppTheme.accent)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.muted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accent),
            onPressed: () {
              final name = ctrl.text.trim();
              if (name.isNotEmpty) {
                context.read<LibraryProvider>().createPlaylist(name);
              }
              Navigator.pop(ctx);
            },
            child: const Text('Create', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final library = context.watch<LibraryProvider>();
    final player = context.watch<PlayerProvider>();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Your collection, in one place.',
                            style: TextStyle(
                              color: AppTheme.subtitle,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.0,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Library',
                            style: TextStyle(
                              color: AppTheme.text,
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppTheme.panel,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.line),
                        ),
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          icon: const Icon(Icons.add, color: AppTheme.text, size: 22),
                          onPressed: () => _showCreatePlaylistDialog(context),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Filter Pills
                  SizedBox(
                    height: 36,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: _tabs.length,
                      itemBuilder: (ctx, i) {
                        final isSel = _activeTab == i;
                        return GestureDetector(
                          onTap: () => setState(() => _activeTab = i),
                          child: Container(
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSel ? AppTheme.accent : AppTheme.panel,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isSel ? AppTheme.accent : AppTheme.line,
                              ),
                            ),
                            child: Text(
                              _tabs[i],
                              style: TextStyle(
                                color: isSel ? Colors.white : AppTheme.muted,
                                fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // Tab Content
            Expanded(
              child: _buildTabBody(library, player),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabBody(LibraryProvider library, PlayerProvider player) {
    if (_activeTab == 0) {
      // Playlists
      return _buildPlaylistsList(library);
    } else if (_activeTab == 3) {
      // Liked songs
      return _buildTrackList(library.favorites, 'Liked Songs', null);
    } else if (_activeTab == 4) {
      // Downloaded
      final downloaded = library.favorites.where((t) => t.localPath != null).toList();
      return _buildTrackList(downloaded, 'Downloads', 'No downloaded songs yet');
    } else {
      // History (default)
      final history = library.recentTracks.isNotEmpty
          ? library.recentTracks
          : [
              Track(id: '1', title: 'Violet hour', artist: 'Luna Bay', durationSec: 222, thumb: ''),
              Track(id: '2', title: 'Moonstruck', artist: 'Solace', durationSec: 248, thumb: ''),
              Track(id: '3', title: 'Undertow', artist: 'Onda', durationSec: 236, thumb: ''),
              Track(id: '4', title: 'Sundown', artist: 'Daydream', durationSec: 201, thumb: ''),
              Track(id: '5', title: 'Satellite', artist: 'Luna Bay', durationSec: 252, thumb: ''),
            ];

      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Recently listened',
                style: TextStyle(
                  color: AppTheme.text,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              GestureDetector(
                onTap: () => library.clearHistory(),
                child: const Text(
                  'Clear history',
                  style: TextStyle(
                    color: AppTheme.muted,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...history.map((t) => _buildHistoryRow(t, player, history)),
          const SizedBox(height: 24),
          const Center(
            child: Text(
              'Your listening history is synced.',
              style: TextStyle(color: AppTheme.muted, fontSize: 13),
            ),
          ),
        ],
      );
    }
  }

  Widget _buildHistoryRow(Track t, PlayerProvider player, List<Track> queue) {
    final isCurrent = player.currentTrack?.id == t.id;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: InkWell(
        onTap: () => player.playTrack(t, queue: queue),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: isCurrent ? AppTheme.accent.withValues(alpha: 0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.music_note_rounded, color: AppTheme.accentLight, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isCurrent ? AppTheme.accentLight : AppTheme.text,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      isCurrent ? '${t.artist} · Playing now' : '${t.artist} · ${t.durationFormatted}',
                      style: TextStyle(
                        color: isCurrent ? AppTheme.accentLight : AppTheme.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (isCurrent)
                const Icon(Icons.equalizer_rounded, color: AppTheme.accentLight, size: 20)
              else
                IconButton(
                  icon: const Icon(Icons.more_horiz, color: AppTheme.muted, size: 20),
                  onPressed: () {},
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTrackList(List<Track> tracks, String title, String? emptyMsg) {
    if (tracks.isEmpty) {
      return Center(
        child: Text(emptyMsg ?? 'No tracks', style: const TextStyle(color: AppTheme.muted)),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
      itemCount: tracks.length,
      itemBuilder: (ctx, i) => TrackTile(track: tracks[i], queueContext: tracks),
    );
  }

  Widget _buildPlaylistsList(LibraryProvider library) {
    if (library.playlists.isEmpty) {
      return const Center(
        child: Text('No custom playlists yet', style: TextStyle(color: AppTheme.muted)),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
      itemCount: library.playlists.length,
      itemBuilder: (ctx, i) {
        final pl = library.playlists[i];
        return ListTile(
          leading: Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppTheme.panel,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.queue_music_rounded, color: AppTheme.accentLight),
          ),
          title: Text(pl.name, style: const TextStyle(color: AppTheme.text, fontWeight: FontWeight.bold)),
          subtitle: Text('${pl.tracks.length} tracks', style: const TextStyle(color: AppTheme.muted)),
          trailing: const Icon(Icons.chevron_right, color: AppTheme.muted),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => PlaylistScreen(playlist: pl)),
            );
          },
        );
      },
    );
  }
}
