import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../providers/player_provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/storage_service.dart';
import '../theme.dart';
import '../screens/equalizer_screen.dart';
import '../screens/settings_screen.dart';
import 'now_playing_sheet.dart';

class MiniPlayer extends StatelessWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final library = context.watch<LibraryProvider>();
    final theme = context.watch<ThemeProvider>();
    final track = player.currentTrack;
    if (track == null) return const SizedBox.shrink();

    final accent = theme.accent;
    final posMs = player.position.inMilliseconds.toDouble();
    final durMs = player.duration.inMilliseconds.toDouble();
    final progress = durMs > 0 ? (posMs / durMs).clamp(0.0, 1.0) : 0.0;
    final isFav = library.isFavorite(track.id);

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
        decoration: BoxDecoration(
          color: AppTheme.playerbarBg,
          border: const Border(top: BorderSide(color: AppTheme.glassBorder)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.55),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Desktop top edge scrubbable seek bar
              SizedBox(
                height: 6,
                child: SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 2.5,
                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 4),
                    overlayShape: SliderComponentShape.noOverlay,
                    activeTrackColor: accent,
                    inactiveTrackColor: Colors.white.withValues(alpha: 0.12),
                    thumbColor: Colors.white,
                  ),
                  child: Slider(
                    value: durMs > 0 ? posMs.clamp(0.0, durMs) : progress,
                    min: 0,
                    max: durMs > 0 ? durMs : 1.0,
                    onChanged: (v) {
                      if (durMs > 0) player.seek(Duration(milliseconds: v.round()));
                    },
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 8, 8),
                child: Row(
                  children: [
                    // Artwork + MIXING badge
                    Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
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
                                    child: const Icon(Icons.music_note, color: AppTheme.muted),
                                  ),
                                )
                              : Container(
                                  width: 44,
                                  height: 44,
                                  color: AppTheme.bg3,
                                  child: const Icon(Icons.music_note, color: AppTheme.muted),
                                ),
                        ),
                        if (player.isMixing)
                          Positioned(
                            bottom: 2,
                            left: 2,
                            right: 2,
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 1.5),
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              alignment: Alignment.center,
                              child: const Text(
                                'MIXING',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 7.5,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: 10),
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
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            track.artist,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: AppTheme.muted, fontSize: 11.5),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                      padding: EdgeInsets.zero,
                      icon: Icon(
                        isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        color: isFav ? accent : AppTheme.muted,
                        size: 19,
                      ),
                      onPressed: () => library.toggleFavorite(track),
                    ),
                    IconButton(
                      constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                      padding: EdgeInsets.zero,
                      tooltip: 'Audio Output Device',
                      icon: const Icon(Icons.headphones_rounded, color: AppTheme.muted, size: 19),
                      onPressed: () {
                        final cur = StorageService().getSettingsMap()['outputDeviceName'] as String? ?? 'Default output · Auto-route';
                        showAudioOutputDeviceSheet(
                          context,
                          selectedName: cur,
                          onSelected: (name) => StorageService().patchSettings({'outputDeviceName': name}),
                        );
                      },
                    ),
                    IconButton(
                      constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                      padding: EdgeInsets.zero,
                      tooltip: 'Live DJ & EQ',
                      icon: const Icon(Icons.tune_rounded, color: AppTheme.muted, size: 19),
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const EqualizerScreen()),
                      ),
                    ),
                    const SizedBox(width: 2),
                    GestureDetector(
                      onTap: () => player.togglePlay(),
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: accent.withValues(alpha: 0.35),
                              blurRadius: 12,
                            ),
                          ],
                        ),
                        child: Center(
                          child: player.isLoading
                              ? SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(color: accent, strokeWidth: 2),
                                )
                              : Icon(
                                  player.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                                  color: AppTheme.bg,
                                  size: 24,
                                ),
                        ),
                      ),
                    ),
                    IconButton(
                      constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                      padding: EdgeInsets.zero,
                      icon: const Icon(Icons.skip_next_rounded, color: AppTheme.text, size: 24),
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
