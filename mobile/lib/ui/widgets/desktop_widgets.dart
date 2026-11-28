import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../models/track.dart';
import '../../providers/library_provider.dart';
import '../../providers/player_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/download_service.dart';
import '../theme.dart';

/// Frosted glass container matching Desktop `.card` and `.settings-card`.
class GlassContainer extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final Color? borderColor;
  final Color? backgroundColor;

  const GlassContainer({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.borderRadius = 14,
    this.borderColor,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? AppTheme.panelCard,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: borderColor ?? AppTheme.glassBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.24),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}

/// Desktop-styled `.ctx-head` header for Album / Artist / Playlist / Liked / Recent views.
class DesktopContextHeader extends StatelessWidget {
  final String type;
  final String title;
  final String subtitle;
  final String? thumb;
  final bool roundThumb;
  final VoidCallback? onPlayAll;
  final List<Widget> extraActions;

  const DesktopContextHeader({
    super.key,
    required this.type,
    required this.title,
    required this.subtitle,
    this.thumb,
    this.roundThumb = false,
    this.onPlayAll,
    this.extraActions = const [],
  });

  @override
  Widget build(BuildContext context) {
    final accent = context.watch<ThemeProvider>().accent;

    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (thumb != null && thumb!.isNotEmpty) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(roundThumb ? 56 : 12),
              child: CachedNetworkImage(
                imageUrl: thumb!,
                width: 108,
                height: 108,
                fit: BoxFit.cover,
                errorWidget: (_, _, _) => Container(
                  width: 108,
                  height: 108,
                  color: AppTheme.bg3,
                  child: Icon(
                    roundThumb ? Icons.person_rounded : Icons.album_rounded,
                    color: AppTheme.muted,
                    size: 38,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  type.toUpperCase(),
                  style: const TextStyle(
                    color: AppTheme.muted,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppTheme.text,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                  ),
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppTheme.muted, fontSize: 12.5),
                  ),
                ],
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (onPlayAll != null)
                      GestureDetector(
                        onTap: onPlayAll,
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: accent,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: accent.withValues(alpha: 0.45),
                                blurRadius: 16,
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 26,
                          ),
                        ),
                      ),
                    ...extraActions,
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Desktop-styled `.card` item for Albums, Artists, and Playlists.
class DesktopMediaCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String thumb;
  final bool round;
  final VoidCallback onTap;

  const DesktopMediaCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.thumb,
    this.round = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 146,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppTheme.panelCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.glassBorder),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.22),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(round ? 90 : 9),
                child: thumb.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: thumb,
                        fit: BoxFit.cover,
                        placeholder: (_, _) => Container(color: AppTheme.bg3),
                        errorWidget: (_, _, _) => Container(
                          color: AppTheme.bg3,
                          child: Icon(
                            round ? Icons.person_rounded : Icons.music_note_rounded,
                            color: AppTheme.muted,
                            size: 32,
                          ),
                        ),
                      )
                    : Container(
                        color: AppTheme.bg3,
                        child: Center(
                          child: round
                              ? Text(
                                  title.isNotEmpty ? title[0].toUpperCase() : 'A',
                                  style: const TextStyle(
                                    color: AppTheme.text,
                                    fontSize: 28,
                                    fontWeight: FontWeight.w800,
                                  ),
                                )
                              : const Icon(Icons.music_note_rounded, color: AppTheme.muted, size: 32),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppTheme.text,
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppTheme.muted, fontSize: 11.5),
            ),
          ],
        ),
      ),
    );
  }
}

/// Full Desktop `.ctxmenu` song actions bottom sheet (Play, Play Next, Fav, Playlists, Go to Album, Go to Artist, Download, Remove).
Future<void> showTrackContextSheet(
  BuildContext context,
  Track track, {
  String? playlistId,
  VoidCallback? onRemoveFromPlaylist,
  void Function(String albumId)? onOpenAlbum,
  void Function(String artistId, String artistName)? onOpenArtist,
}) async {
  final player = context.read<PlayerProvider>();
  final library = context.read<LibraryProvider>();
  final accent = context.read<ThemeProvider>().accent;
  final isFav = library.isFavorite(track.id);
  final isDl = library.isDownloaded(track.id);

  await showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (ctx) => Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(ctx).size.height * 0.78,
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      decoration: const BoxDecoration(
        color: Color(0xFF101420),
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        border: Border(top: BorderSide(color: AppTheme.glassBorder)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: AppTheme.glassBorderHover,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: track.thumb.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: track.thumb,
                          width: 46,
                          height: 46,
                          fit: BoxFit.cover,
                        )
                      : Container(
                          width: 46,
                          height: 46,
                          color: AppTheme.bg3,
                          child: const Icon(Icons.music_note, color: AppTheme.muted),
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        track.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppTheme.text,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        track.artist,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppTheme.muted, fontSize: 12.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(color: AppTheme.line, height: 22),
            _menuTile(
              icon: Icons.play_arrow_rounded,
              label: 'Play',
              onTap: () {
                Navigator.pop(ctx);
                player.playTrack(track, queue: [track], index: 0);
              },
            ),
            _menuTile(
              icon: Icons.queue_play_next_rounded,
              label: 'Play next',
              onTap: () {
                Navigator.pop(ctx);
                player.playNextInQueue(track);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Playing next: ${track.title}')),
                );
              },
            ),
            _menuTile(
              icon: isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
              iconColor: isFav ? accent : AppTheme.text,
              label: isFav ? 'Remove from Liked' : 'Add to Liked',
              onTap: () {
                Navigator.pop(ctx);
                library.toggleFavorite(track);
              },
            ),
            const Divider(color: AppTheme.line, height: 14),
            ...library.playlists.map(
              (pl) => _menuTile(
                icon: Icons.playlist_add_rounded,
                label: 'Add to ${pl.name}',
                onTap: () {
                  Navigator.pop(ctx);
                  library.addTrackToPlaylist(pl.id, track);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Added to "${pl.name}"')),
                  );
                },
              ),
            ),
            _menuTile(
              icon: Icons.add_box_outlined,
              label: 'New playlist…',
              onTap: () {
                Navigator.pop(ctx);
                _showQuickCreateAndAdd(context, track);
              },
            ),
            const Divider(color: AppTheme.line, height: 14),
            if (track.albumId != null && track.albumId!.isNotEmpty && onOpenAlbum != null)
              _menuTile(
                icon: Icons.album_outlined,
                label: 'Go to album',
                onTap: () {
                  Navigator.pop(ctx);
                  onOpenAlbum(track.albumId!);
                },
              ),
            if (onOpenArtist != null && ((track.artistId != null && track.artistId!.isNotEmpty) || track.artist.isNotEmpty))
              _menuTile(
                icon: Icons.person_outline_rounded,
                label: 'Go to artist',
                onTap: () {
                  Navigator.pop(ctx);
                  onOpenArtist(track.artistId ?? '', track.artist);
                },
              ),
            _menuTile(
              icon: isDl ? Icons.download_done_rounded : Icons.download_rounded,
              iconColor: isDl ? const Color(0xFF34D399) : AppTheme.text,
              label: isDl ? 'Remove offline download' : 'Download offline',
              onTap: () async {
                Navigator.pop(ctx);
                if (isDl) {
                  await DownloadService().deleteDownload(track.id);
                  if (context.mounted) library.refreshDownloaded();
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Downloading "${track.title}"…')),
                  );
                  await DownloadService().downloadTrack(track);
                  if (context.mounted) {
                    library.refreshDownloaded();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Downloaded "${track.title}"')),
                    );
                  }
                }
              },
            ),
            if (playlistId != null && onRemoveFromPlaylist != null)
              _menuTile(
                icon: Icons.delete_outline_rounded,
                iconColor: const Color(0xFFFF6B6B),
                textColor: const Color(0xFFFF6B6B),
                label: 'Remove from this playlist',
                onTap: () {
                  Navigator.pop(ctx);
                  onRemoveFromPlaylist();
                },
              ),
          ],
        ),
      ),
    ),
  );
}

Widget _menuTile({
  required IconData icon,
  required String label,
  required VoidCallback onTap,
  Color iconColor = AppTheme.text,
  Color textColor = AppTheme.text,
}) {
  return ListTile(
    dense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 6),
    leading: Icon(icon, color: iconColor, size: 20),
    title: Text(label, style: TextStyle(color: textColor, fontSize: 14)),
    onTap: onTap,
  );
}

void _showQuickCreateAndAdd(BuildContext context, Track track) {
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
              final lib = context.read<LibraryProvider>();
              final pl = await lib.createPlaylist(name);
              await lib.addTrackToPlaylist(pl.id, track);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Added to "${pl.name}"')),
                );
              }
            }
            if (ctx.mounted) Navigator.pop(ctx);
          },
          child: const Text('Create'),
        ),
      ],
    ),
  );
}
