import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:just_audio/just_audio.dart';
import '../../providers/player_provider.dart';
import '../../providers/library_provider.dart';
import '../theme.dart';

class NowPlayingSheet extends StatefulWidget {
  const NowPlayingSheet({super.key});

  @override
  State<NowPlayingSheet> createState() => _NowPlayingSheetState();
}

class _NowPlayingSheetState extends State<NowPlayingSheet> {
  int _activeTab = 0; // 0: Player, 1: Lyrics, 2: Queue
  final ScrollController _lyricsScrollController = ScrollController();

  String _formatDuration(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _lyricsScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final library = context.watch<LibraryProvider>();
    final track = player.currentTrack;

    if (track == null) {
      return const SizedBox.shrink();
    }

    final posMs = player.position.inMilliseconds.toDouble();
    final durMs = player.duration.inMilliseconds.toDouble();
    final sliderVal = durMs > 0 ? posMs.clamp(0.0, durMs) : 0.0;

    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.bg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Column(
            children: [
              // Header Drag Handle & Back
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.keyboard_arrow_down, size: 30, color: AppTheme.text),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildTabButton('Track', 0),
                      const SizedBox(width: 8),
                      _buildTabButton('Lyrics', 1),
                      const SizedBox(width: 8),
                      _buildTabButton('Queue', 2),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.more_horiz, color: AppTheme.text),
                    onPressed: () {},
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // Main Body depending on active tab
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 250),
                  child: _buildTabContent(player, library),
                ),
              ),

              const SizedBox(height: 12),

              // Progress Slider & Timestamps
              Column(
                children: [
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      trackHeight: 3.5,
                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                      activeTrackColor: AppTheme.accent,
                      inactiveTrackColor: AppTheme.line,
                      thumbColor: AppTheme.text,
                      overlayColor: AppTheme.accent.withValues(alpha: 0.2),
                    ),
                    child: Slider(
                      value: sliderVal,
                      max: durMs > 0 ? durMs : 1.0,
                      onChanged: (val) {
                        player.seek(Duration(milliseconds: val.toInt()));
                      },
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_formatDuration(player.position),
                            style: const TextStyle(color: AppTheme.muted, fontSize: 12)),
                        Text(_formatDuration(player.duration),
                            style: const TextStyle(color: AppTheme.muted, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 8),

              // Control Buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  IconButton(
                    icon: Icon(
                      Icons.shuffle,
                      color: player.shuffleEnabled ? AppTheme.accent : AppTheme.muted,
                      size: 24,
                    ),
                    onPressed: player.toggleShuffle,
                  ),
                  IconButton(
                    icon: const Icon(Icons.skip_previous, color: AppTheme.text, size: 36),
                    onPressed: player.previous,
                  ),
                  GestureDetector(
                    onTap: player.togglePlay,
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [AppTheme.accent, AppTheme.accent2],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Color(0x668B5CF6),
                            blurRadius: 20,
                            offset: Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Center(
                        child: player.isLoading
                            ? const SizedBox(
                                width: 28,
                                height: 28,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : Icon(
                                player.isPlaying ? Icons.pause : Icons.play_arrow,
                                color: Colors.white,
                                size: 36,
                              ),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.skip_next, color: AppTheme.text, size: 36),
                    onPressed: player.next,
                  ),
                  IconButton(
                    icon: Icon(
                      player.loopMode == LoopMode.one
                          ? Icons.repeat_one
                          : (player.loopMode == LoopMode.all ? Icons.repeat : Icons.repeat),
                      color: player.loopMode != LoopMode.off ? AppTheme.accent : AppTheme.muted,
                      size: 24,
                    ),
                    onPressed: player.cycleLoopMode,
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabButton(String label, int index) {
    final active = _activeTab == index;
    return GestureDetector(
      onTap: () => setState(() => _activeTab = index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppTheme.panel : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? AppTheme.accent : Colors.transparent,
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? AppTheme.text : AppTheme.muted,
            fontWeight: active ? FontWeight.bold : FontWeight.normal,
            fontSize: 12.5,
          ),
        ),
      ),
    );
  }

  Widget _buildTabContent(PlayerProvider player, LibraryProvider library) {
    final track = player.currentTrack!;
    final isFav = library.isFavorite(track);

    if (_activeTab == 1) {
      // Lyrics Tab
      final lyrics = player.lyrics;
      if (lyrics.isEmpty) {
        return const Center(
          child: Text(
            'No lyrics found for this song.',
            style: TextStyle(color: AppTheme.muted, fontSize: 15),
          ),
        );
      }

      if (lyrics.synced.isNotEmpty) {
        final activeIdx = player.currentLyricIndex;
        return ListView.builder(
          controller: _lyricsScrollController,
          itemCount: lyrics.synced.length,
          itemBuilder: (ctx, i) {
            final line = lyrics.synced[i];
            final isActive = i == activeIdx;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
              child: Text(
                line.text,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: isActive ? Colors.white : AppTheme.muted.withValues(alpha: 0.5),
                  fontSize: isActive ? 20 : 16,
                  fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                  shadows: isActive
                      ? [
                          const Shadow(color: AppTheme.accent, blurRadius: 16),
                        ]
                      : null,
                ),
              ),
            );
          },
        );
      }

      return SingleChildScrollView(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(
          lyrics.plain ?? '',
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AppTheme.text,
            fontSize: 16,
            height: 1.6,
          ),
        ),
      );
    }

    if (_activeTab == 2) {
      // Queue Tab
      final queue = player.queue;
      return ListView.builder(
        itemCount: queue.length,
        itemBuilder: (ctx, i) {
          final t = queue[i];
          final isPlaying = t.id == track.id;
          return ListTile(
            leading: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.network(
                t.thumb,
                width: 42,
                height: 42,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  width: 42,
                  height: 42,
                  color: AppTheme.panel,
                  child: const Icon(Icons.music_note, color: AppTheme.muted),
                ),
              ),
            ),
            title: Text(
              t.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: isPlaying ? AppTheme.accent : AppTheme.text,
                fontWeight: isPlaying ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            subtitle: Text(
              t.artist,
              maxLines: 1,
              style: const TextStyle(color: AppTheme.muted),
            ),
            trailing: isPlaying
                ? const Icon(Icons.volume_up, color: AppTheme.accent, size: 20)
                : null,
            onTap: () => player.playTrack(t, index: i),
          );
        },
      );
    }

    // Default Player View (Cover Art + Title + Heart)
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Expanded(
          child: AspectRatio(
            aspectRatio: 1.0,
            child: Container(
              margin: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black54,
                    blurRadius: 28,
                    offset: Offset(0, 10),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: track.thumb.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: track.thumb,
                        fit: BoxFit.cover,
                        placeholder: (_, _) => Container(
                          color: AppTheme.panel,
                          child: const Icon(Icons.music_note, size: 80, color: AppTheme.muted),
                        ),
                        errorWidget: (_, _, _) => Container(
                          color: AppTheme.panel,
                          child: const Icon(Icons.music_note, size: 80, color: AppTheme.muted),
                        ),
                      )
                    : Container(
                        color: AppTheme.panel,
                        child: const Icon(Icons.music_note, size: 80, color: AppTheme.muted),
                      ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
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
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    track.artist,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppTheme.muted,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: Icon(
                isFav ? Icons.favorite : Icons.favorite_border,
                color: isFav ? AppTheme.accentPink : AppTheme.muted,
                size: 28,
              ),
              onPressed: () => library.toggleFavorite(track),
            ),
          ],
        ),
      ],
    );
  }
}
