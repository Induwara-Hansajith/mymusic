import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../models/track.dart';
import '../../providers/player_provider.dart';
import '../../providers/library_provider.dart';
import '../theme.dart';

class TrackTile extends StatelessWidget {
  final Track track;
  final List<Track>? queueContext;
  final int? indexInQueue;
  final VoidCallback? onRemove;

  const TrackTile({
    super.key,
    required this.track,
    this.queueContext,
    this.indexInQueue,
    this.onRemove,
  });

  String _formatDuration(int sec) {
    final m = sec ~/ 60;
    final s = sec % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final library = context.watch<LibraryProvider>();
    final isCurrent = player.currentTrack?.id == track.id;
    final isFav = library.isFavorite(track);

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
      onTap: () {
        player.playTrack(track, queue: queueContext, index: indexInQueue);
      },
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          alignment: Alignment.center,
          children: [
            track.thumb.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: track.thumb,
                    width: 48,
                    height: 48,
                    fit: BoxFit.cover,
                    placeholder: (_, _) => Container(
                      width: 48,
                      height: 48,
                      color: AppTheme.panel,
                      child: const Icon(Icons.music_note, color: AppTheme.muted, size: 20),
                    ),
                    errorWidget: (_, _, _) => Container(
                      width: 48,
                      height: 48,
                      color: AppTheme.panel,
                      child: const Icon(Icons.music_note, color: AppTheme.muted, size: 20),
                    ),
                  )
                : Container(
                    width: 48,
                    height: 48,
                    color: AppTheme.panel,
                    child: const Icon(Icons.music_note, color: AppTheme.muted, size: 20),
                  ),
            if (isCurrent)
              Container(
                width: 48,
                height: 48,
                color: Colors.black54,
                child: Icon(
                  player.isPlaying ? Icons.equalizer : Icons.play_arrow,
                  color: AppTheme.accent,
                  size: 24,
                ),
              ),
          ],
        ),
      ),
      title: Text(
        track.title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: isCurrent ? AppTheme.accent : AppTheme.text,
          fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
          fontSize: 14.5,
        ),
      ),
      subtitle: Text(
        '${track.artist} • ${_formatDuration(track.durationSec)}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          color: AppTheme.muted,
          fontSize: 12.5,
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: Icon(
              isFav ? Icons.favorite : Icons.favorite_border,
              color: isFav ? AppTheme.accentPink : AppTheme.muted,
              size: 20,
            ),
            onPressed: () => library.toggleFavorite(track),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: AppTheme.muted, size: 20),
            color: AppTheme.panel,
            onSelected: (val) {
              if (val == 'playlist') {
                _showAddToPlaylistDialog(context, track);
              } else if (val == 'remove' && onRemove != null) {
                onRemove!();
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'playlist',
                child: Row(
                  children: [
                    Icon(Icons.playlist_add, color: AppTheme.text, size: 18),
                    SizedBox(width: 10),
                    Text('Add to playlist', style: TextStyle(color: AppTheme.text)),
                  ],
                ),
              ),
              if (onRemove != null)
                const PopupMenuItem(
                  value: 'remove',
                  child: Row(
                    children: [
                      Icon(Icons.delete_outline, color: Colors.redAccent, size: 18),
                      SizedBox(width: 10),
                      Text('Remove from playlist', style: TextStyle(color: Colors.redAccent)),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  void _showAddToPlaylistDialog(BuildContext context, Track track) {
    final library = context.read<LibraryProvider>();
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.panel,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Add to Playlist',
                style: TextStyle(
                  color: AppTheme.text,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              if (library.playlists.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text('No playlists created yet.', style: TextStyle(color: AppTheme.muted)),
                )
              else
                ...library.playlists.map(
                  (pl) => ListTile(
                    leading: const Icon(Icons.queue_music, color: AppTheme.accent),
                    title: Text(pl.name, style: const TextStyle(color: AppTheme.text)),
                    subtitle: Text('${pl.tracks.length} songs', style: const TextStyle(color: AppTheme.muted)),
                    onTap: () {
                      library.addTrackToPlaylist(pl.id, track);
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Added to "${pl.name}"')),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
