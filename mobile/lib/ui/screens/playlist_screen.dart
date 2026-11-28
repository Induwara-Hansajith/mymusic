import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/playlist.dart';
import '../../providers/library_provider.dart';
import '../../providers/player_provider.dart';
import '../theme.dart';
import '../widgets/desktop_widgets.dart';
import '../widgets/track_tile.dart';

class PlaylistScreen extends StatelessWidget {
  final Playlist playlist;
  final bool embedded;
  final VoidCallback? onDeleted;
  final void Function(String albumId)? onOpenAlbum;
  final void Function(String artistId, String artistName)? onOpenArtist;

  const PlaylistScreen({
    super.key,
    required this.playlist,
    this.embedded = false,
    this.onDeleted,
    this.onOpenAlbum,
    this.onOpenArtist,
  });

  void _showRenameDialog(BuildContext context, Playlist currentPl) {
    final ctrl = TextEditingController(text: currentPl.name);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF101420),
        title: const Text('Rename Playlist', style: TextStyle(color: AppTheme.text)),
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
              if (ctrl.text.trim().isNotEmpty) {
                await context.read<LibraryProvider>().renamePlaylist(currentPl.id, ctrl.text);
              }
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Rename'),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context, Playlist currentPl) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF101420),
        title: const Text('Delete Playlist?', style: TextStyle(color: AppTheme.text)),
        content: Text(
          'Delete "${currentPl.name}"? Songs remain in your liked/recent lists.',
          style: const TextStyle(color: AppTheme.muted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.muted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              await context.read<LibraryProvider>().deletePlaylist(currentPl.id);
              if (ctx.mounted) Navigator.pop(ctx);
              onDeleted?.call();
              if (!embedded && context.mounted) Navigator.pop(context);
            },
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final library = context.watch<LibraryProvider>();
    final player = context.read<PlayerProvider>();

    final currentPl = library.playlists.firstWhere(
      (p) => p.id == playlist.id,
      orElse: () => playlist,
    );
    final n = currentPl.tracks.length;

    final body = ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 120),
      children: [
        DesktopContextHeader(
          type: 'Playlist',
          title: currentPl.name,
          subtitle: '$n song${n == 1 ? '' : 's'} • your playlist',
          thumb: currentPl.tracks.isNotEmpty ? currentPl.tracks.first.thumb : null,
          onPlayAll: currentPl.tracks.isEmpty
              ? null
              : () => player.playTrack(
                    currentPl.tracks.first,
                    queue: currentPl.tracks,
                    index: 0,
                    contextTitle: currentPl.name,
                  ),
          extraActions: [
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppTheme.glassBorder),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              icon: const Icon(Icons.edit_outlined, size: 15, color: AppTheme.muted),
              label: const Text('Rename', style: TextStyle(color: AppTheme.muted, fontSize: 12.5)),
              onPressed: () => _showRenameDialog(context, currentPl),
            ),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Colors.redAccent.withValues(alpha: 0.4)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              icon: const Icon(Icons.delete_outline, size: 15, color: Colors.redAccent),
              label: const Text('Delete', style: TextStyle(color: Colors.redAccent, fontSize: 12.5)),
              onPressed: () => _confirmDelete(context, currentPl),
            ),
          ],
        ),
        if (currentPl.tracks.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 28),
            child: Text(
              'Use the (⋯) menu on any song to add it here.',
              style: TextStyle(color: AppTheme.muted, fontSize: 13.5),
            ),
          )
        else
          ...currentPl.tracks.asMap().entries.map((e) => TrackTile(
                track: e.value,
                index: e.key,
                playlistId: currentPl.id,
                onOpenAlbum: onOpenAlbum,
                onOpenArtist: onOpenArtist,
                onRemove: () => library.removeTrackFromPlaylist(currentPl.id, e.value.id),
                onTap: () => player.playTrack(
                  e.value,
                  queue: currentPl.tracks,
                  index: e.key,
                  contextTitle: currentPl.name,
                ),
              )),
      ],
    );

    if (embedded) return body;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(currentPl.name),
      ),
      body: body,
    );
  }
}
