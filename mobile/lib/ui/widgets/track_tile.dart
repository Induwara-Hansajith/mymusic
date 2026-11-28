import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../models/track.dart';
import '../../providers/player_provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/theme_provider.dart';
import '../theme.dart';
import 'desktop_widgets.dart';

class TrackTile extends StatelessWidget {
  final Track track;
  final int? index;
  final VoidCallback onTap;
  final VoidCallback? onRemove;
  final String? playlistId;
  final void Function(String albumId)? onOpenAlbum;
  final void Function(String artistId, String artistName)? onOpenArtist;
  final bool showOfflineTag;

  const TrackTile({
    super.key,
    required this.track,
    this.index,
    required this.onTap,
    this.onRemove,
    this.playlistId,
    this.onOpenAlbum,
    this.onOpenArtist,
    this.showOfflineTag = false,
  });

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final library = context.watch<LibraryProvider>();
    final accent = context.watch<ThemeProvider>().accent;

    final isPlayingThis = player.currentTrack?.id == track.id;
    final isFav = library.isFavorite(track.id);
    final isDownloaded = showOfflineTag || library.isDownloaded(track.id);

    return InkWell(
      onTap: onTap,
      onLongPress: () => showTrackContextSheet(
        context,
        track,
        playlistId: playlistId,
        onRemoveFromPlaylist: onRemove,
        onOpenAlbum: onOpenAlbum,
        onOpenArtist: onOpenArtist,
      ),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: isPlayingThis ? accent.withValues(alpha: 0.11) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            if (index != null)
              SizedBox(
                width: 26,
                child: isPlayingThis && player.isPlaying
                    ? Icon(Icons.equalizer_rounded, color: accent, size: 17)
                    : Text(
                        '${index! + 1}',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: isPlayingThis ? accent : AppTheme.muted,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            if (index != null) const SizedBox(width: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(7),
              child: track.thumb.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: track.thumb,
                      width: 44,
                      height: 44,
                      fit: BoxFit.cover,
                      placeholder: (_, _) => Container(width: 44, height: 44, color: AppTheme.bg3),
                      errorWidget: (_, _, _) => Container(
                        width: 44,
                        height: 44,
                        color: AppTheme.bg3,
                        child: const Icon(Icons.music_note, color: AppTheme.muted, size: 20),
                      ),
                    )
                  : Container(
                      width: 44,
                      height: 44,
                      color: AppTheme.bg3,
                      child: const Icon(Icons.music_note, color: AppTheme.muted, size: 20),
                    ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          track.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: isPlayingThis ? accent : AppTheme.text,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      if (isDownloaded) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withValues(alpha: 0.16),
                            borderRadius: BorderRadius.circular(5),
                            border: Border.all(
                              color: const Color(0xFF10B981).withValues(alpha: 0.4),
                            ),
                          ),
                          child: const Text(
                            'Offline',
                            style: TextStyle(
                              color: Color(0xFF34D399),
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    track.album != null && track.album!.isNotEmpty
                        ? '${track.artist} · ${track.album}'
                        : track.artist,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppTheme.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            Text(
              track.durationFormatted,
              style: const TextStyle(
                color: AppTheme.muted,
                fontSize: 11.5,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
            IconButton(
              constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
              padding: EdgeInsets.zero,
              icon: Icon(
                isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                color: isFav ? accent : AppTheme.muted,
                size: 18,
              ),
              onPressed: () => library.toggleFavorite(track),
            ),
            IconButton(
              constraints: const BoxConstraints(minWidth: 32, minHeight: 34),
              padding: EdgeInsets.zero,
              icon: const Icon(Icons.more_horiz, color: AppTheme.muted, size: 19),
              onPressed: () => showTrackContextSheet(
                context,
                track,
                playlistId: playlistId,
                onRemoveFromPlaylist: onRemove,
                onOpenAlbum: onOpenAlbum,
                onOpenArtist: onOpenArtist,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
