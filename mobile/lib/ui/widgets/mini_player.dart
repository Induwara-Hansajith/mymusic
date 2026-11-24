import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../providers/player_provider.dart';
import '../theme.dart';
import 'now_playing_sheet.dart';

class MiniPlayer extends StatelessWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final track = player.currentTrack;

    if (track == null) return const SizedBox.shrink();

    final durMs = player.duration.inMilliseconds;
    final posMs = player.position.inMilliseconds;
    final progress = durMs > 0 ? (posMs / durMs).clamp(0.0, 1.0) : 0.0;

    return GestureDetector(
      onTap: () {
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => const NowPlayingSheet(),
        );
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF161626),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppTheme.line),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.5),
              blurRadius: 18,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Subtle Progress Bar
              LinearProgressIndicator(
                value: progress,
                minHeight: 2.0,
                backgroundColor: Colors.transparent,
                valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.accent),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: track.thumb.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: track.thumb,
                              width: 44,
                              height: 44,
                              fit: BoxFit.cover,
                              placeholder: (_, _) => Container(
                                width: 44,
                                height: 44,
                                color: AppTheme.panel,
                                child: const Icon(Icons.music_note, color: AppTheme.muted, size: 20),
                              ),
                              errorWidget: (_, _, _) => Container(
                                width: 44,
                                height: 44,
                                color: AppTheme.panel,
                                child: const Icon(Icons.music_note, color: AppTheme.muted, size: 20),
                              ),
                            )
                          : Container(
                              width: 44,
                              height: 44,
                              color: const Color(0xFF3B1D54),
                              child: const Icon(Icons.music_note, color: Colors.white60, size: 20),
                            ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            track.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppTheme.text,
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            track.artist,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppTheme.subtitle,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: player.isLoading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(color: AppTheme.accent, strokeWidth: 2),
                            )
                          : Icon(
                              player.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                              color: AppTheme.text,
                              size: 28,
                            ),
                      onPressed: () => player.togglePlay(),
                    ),
                    IconButton(
                      icon: const Icon(Icons.skip_next_rounded, color: AppTheme.text, size: 26),
                      onPressed: () => player.next(),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
