import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:just_audio/just_audio.dart';
import '../../models/track.dart';
import '../../providers/player_provider.dart';
import '../../providers/library_provider.dart';
import '../../services/download_service.dart';
import '../theme.dart';
import '../screens/equalizer_screen.dart';

class NowPlayingSheet extends StatefulWidget {
  const NowPlayingSheet({super.key});

  @override
  State<NowPlayingSheet> createState() => _NowPlayingSheetState();
}

class _NowPlayingSheetState extends State<NowPlayingSheet>
    with SingleTickerProviderStateMixin {
  // 0: Full Now Playing view, 1: Queue & Lyrics view ("Mini player - queue.png")
  int _viewMode = 0;
  int _selectedVisualizer = 0; // 0: Liquid, 1: Orbit, 2: Bars, 3: Wave, 4: Silk
  final List<String> _visualizers = const ['Liquid', 'Orbit', 'Bars', 'Wave', 'Silk'];
  double _lyricOffsetSec = 0.0;
  final ScrollController _lyricsScrollCtrl = ScrollController();
  late AnimationController _animCtrl;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _lyricsScrollCtrl.dispose();
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
    final isLiked = library.isFavorite(track.id);

    return Container(
      height: MediaQuery.of(context).size.height * 0.94,
      decoration: const BoxDecoration(
        color: AppTheme.bg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: _viewMode == 0
              ? _buildNowPlayingView(context, player, library, track, sliderVal, durMs, isLiked)
              : _buildQueueLyricsView(context, player, library, track),
        ),
      ),
    );
  }

  // View 1: Now playing.png
  Widget _buildNowPlayingView(
    BuildContext context,
    PlayerProvider player,
    LibraryProvider library,
    dynamic track,
    double sliderVal,
    double durMs,
    bool isLiked,
  ) {
    return Column(
      children: [
        // Top Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 32, color: AppTheme.text),
                onPressed: () => Navigator.pop(context),
              ),
              Column(
                children: const [
                  Text(
                    'PLAYING FROM PLAYLIST',
                    style: TextStyle(
                      color: AppTheme.muted,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.0,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'After hours',
                    style: TextStyle(
                      color: AppTheme.text,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.more_horiz, color: AppTheme.text),
                onPressed: () {},
              ),
            ],
          ),
        ),

        const SizedBox(height: 8),

        // Big Album Art with subtle violet glow
        Expanded(
          child: Center(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 32),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(26),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.accent.withValues(alpha: 0.35),
                    blurRadius: 36,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(26),
                child: track.thumb.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: track.thumb,
                        width: 280,
                        height: 280,
                        fit: BoxFit.cover,
                        placeholder: (_, _) => Container(
                          width: 280,
                          height: 280,
                          color: AppTheme.panel,
                          child: const Icon(Icons.music_note, color: AppTheme.muted, size: 60),
                        ),
                        errorWidget: (_, _, _) => Container(
                          width: 280,
                          height: 280,
                          color: AppTheme.panel,
                          child: const Icon(Icons.music_note, color: AppTheme.muted, size: 60),
                        ),
                      )
                    : Container(
                        width: 280,
                        height: 280,
                        color: const Color(0xFF3B1D54),
                        child: const Icon(Icons.music_note, color: Colors.white60, size: 60),
                      ),
              ),
            ),
          ),
        ),

        const SizedBox(height: 16),

        // Title, Artist, Like Button
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      track.artist,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppTheme.subtitle,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(
                  isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: isLiked ? AppTheme.accent : AppTheme.muted,
                  size: 26,
                ),
                onPressed: () => library.toggleFavorite(track),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // Progress Slider & Timestamps
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 3.5,
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                  activeTrackColor: AppTheme.accent,
                  inactiveTrackColor: AppTheme.line,
                  thumbColor: Colors.white,
                  overlayShape: SliderComponentShape.noOverlay,
                ),
                child: Slider(
                  value: sliderVal,
                  min: 0.0,
                  max: durMs > 0 ? durMs : 1.0,
                  onChanged: (val) {
                    player.seek(Duration(milliseconds: val.toInt()));
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _formatDuration(player.position),
                      style: const TextStyle(color: AppTheme.muted, fontSize: 12),
                    ),
                    Text(
                      _formatDuration(player.duration),
                      style: const TextStyle(color: AppTheme.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 8),

        // Controls Row
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: Icon(
                  Icons.shuffle_rounded,
                  color: player.shuffleEnabled ? AppTheme.accentLight : AppTheme.muted,
                  size: 24,
                ),
                onPressed: () => player.toggleShuffle(),
              ),
              IconButton(
                icon: const Icon(Icons.skip_previous_rounded, color: AppTheme.text, size: 36),
                onPressed: () => player.previous(),
              ),
              // Big Violet Play/Pause Button
              GestureDetector(
                onTap: () => player.togglePlay(),
                child: Container(
                  width: 68,
                  height: 68,
                  decoration: BoxDecoration(
                    color: AppTheme.accent,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.accent.withValues(alpha: 0.5),
                        blurRadius: 20,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Center(
                    child: player.isLoading
                        ? const SizedBox(
                            width: 26,
                            height: 26,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                          )
                        : Icon(
                            player.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 38,
                          ),
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.skip_next_rounded, color: AppTheme.text, size: 36),
                onPressed: () => player.next(),
              ),
              IconButton(
                icon: Icon(
                  player.loopMode == LoopMode.one
                      ? Icons.repeat_one_rounded
                      : Icons.repeat_rounded,
                  color: player.loopMode != LoopMode.off ? AppTheme.accentLight : AppTheme.muted,
                  size: 24,
                ),
                onPressed: () => player.cycleLoopMode(),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Docked Lyrics Preview Card
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: InkWell(
            onTap: () => setState(() => _viewMode = 1),
            borderRadius: BorderRadius.circular(18),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppTheme.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: const [
                      Text(
                        'LYRICS',
                        style: TextStyle(
                          color: AppTheme.muted,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                        ),
                      ),
                      Icon(Icons.notes_rounded, color: AppTheme.muted, size: 18),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    player.lyrics.synced.isNotEmpty && player.currentLyricIndex >= 0
                        ? player.lyrics.synced[player.currentLyricIndex].text
                        : (player.lyrics.plain != null && player.lyrics.plain!.isNotEmpty
                            ? player.lyrics.plain!.split('\n').first
                            : 'In the violet hour'),
                    style: const TextStyle(
                      color: AppTheme.text,
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Tap for synced lyrics',
                    style: TextStyle(
                      color: AppTheme.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        const SizedBox(height: 14),

        // Bottom Action Bar: Equalizer | Download | ✦ AutoMix | Queue
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.tune_rounded, color: AppTheme.text, size: 22),
                tooltip: '10-Band Equalizer',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const EqualizerScreen()),
                  );
                },
              ),
              IconButton(
                icon: Icon(
                  library.isDownloaded(track.id) ? Icons.download_done_rounded : Icons.download_rounded,
                  color: library.isDownloaded(track.id) ? Colors.greenAccent : AppTheme.text,
                  size: 22,
                ),
                tooltip: library.isDownloaded(track.id) ? 'Downloaded offline' : 'Download for offline playback',
                onPressed: () async {
                  if (!library.isDownloaded(track.id)) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Downloading "${track.title}" for offline playback...'),
                        duration: const Duration(seconds: 2),
                        backgroundColor: AppTheme.panel,
                      ),
                    );
                    await DownloadService().downloadTrack(track);
                    if (context.mounted) {
                      library.refreshDownloaded();
                    }
                  }
                },
              ),
              InkWell(
                onTap: () => player.toggleAutoMix(),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: player.autoMixEnabled ? const Color(0xFF2E2248) : AppTheme.panel,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: player.autoMixEnabled ? AppTheme.accent : AppTheme.line,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.auto_awesome,
                        size: 14,
                        color: player.autoMixEnabled ? AppTheme.accentLight : AppTheme.muted,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'AutoMix',
                        style: TextStyle(
                          color: player.autoMixEnabled ? AppTheme.accentLight : AppTheme.muted,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.playlist_play_rounded, color: AppTheme.text, size: 26),
                tooltip: 'Lyrics & Queue',
                onPressed: () => setState(() => _viewMode = 1),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }

  // View 2: Mini player - queue.png
  Widget _buildQueueLyricsView(
    BuildContext context,
    PlayerProvider player,
    LibraryProvider library,
    dynamic track,
  ) {
    final synced = player.lyrics.synced;
    final activeIdx = player.currentLyricIndex;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Top Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: AppTheme.text),
                onPressed: () => setState(() => _viewMode = 0),
              ),
              Column(
                children: const [
                  Text(
                    'YOUR SOUNDTRACK',
                    style: TextStyle(
                      color: AppTheme.subtitle,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.0,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Stay in the moment.',
                    style: TextStyle(
                      color: AppTheme.text,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 40),
            ],
          ),
        ),

        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            children: [
              // Synced Lyrics Card
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppTheme.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'LYRICS',
                          style: TextStyle(
                            color: AppTheme.muted,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.8,
                          ),
                        ),
                        InkWell(
                          onTap: () {},
                          child: const Text(
                            'Translate',
                            style: TextStyle(
                              color: AppTheme.subtitle,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // Lyrics scrolling display
                    SizedBox(
                      height: 120,
                      child: synced.isNotEmpty
                          ? ListView.builder(
                              controller: _lyricsScrollCtrl,
                              itemCount: synced.length,
                              itemBuilder: (ctx, i) {
                                final isCurrent = i == activeIdx;
                                return GestureDetector(
                                  onTap: () {
                                    final seekMs = ((synced[i].timeSec + _lyricOffsetSec) * 1000).toInt();
                                    if (seekMs >= 0) {
                                      player.seek(Duration(milliseconds: seekMs));
                                    }
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 4),
                                    child: Text(
                                      synced[i].text,
                                      style: TextStyle(
                                        color: isCurrent ? AppTheme.accentLight : AppTheme.muted,
                                        fontSize: isCurrent ? 18 : 14,
                                        fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            )
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: const [
                                Text(
                                  'We let the city disappear',
                                  style: TextStyle(color: AppTheme.muted, fontSize: 15),
                                ),
                                SizedBox(height: 6),
                                Text(
                                  'In the violet hour',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                SizedBox(height: 6),
                                Text(
                                  'There is nothing left to fear',
                                  style: TextStyle(color: AppTheme.muted, fontSize: 15),
                                ),
                              ],
                            ),
                    ),
                    const SizedBox(height: 14),
                    // Offset controls
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        InkWell(
                          onTap: () => setState(() => _lyricOffsetSec -= 0.5),
                          child: const Text(
                            '–0.5s',
                            style: TextStyle(color: AppTheme.muted, fontSize: 12),
                          ),
                        ),
                        Text(
                          'Offset ${_lyricOffsetSec >= 0 ? "+" : ""}${_lyricOffsetSec.toStringAsFixed(1)}s',
                          style: const TextStyle(
                            color: AppTheme.text,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        InkWell(
                          onTap: () => setState(() => _lyricOffsetSec += 0.5),
                          child: const Text(
                            '+0.5s',
                            style: TextStyle(color: AppTheme.muted, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Visualizer Section
              const Text(
                'Visualizer',
                style: TextStyle(
                  color: AppTheme.text,
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 10),

              // Animated Visualizer Canvas
              Container(
                height: 80,
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.line),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AnimatedBuilder(
                    animation: _animCtrl,
                    builder: (ctx, _) {
                      return CustomPaint(
                        size: const Size(double.infinity, 80),
                        painter: _VisualizerPainter(
                          mode: _selectedVisualizer,
                          progress: _animCtrl.value,
                          isPlaying: player.isPlaying,
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 10),

              SizedBox(
                height: 38,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: _visualizers.length,
                  itemBuilder: (ctx, i) {
                    final isSel = _selectedVisualizer == i;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedVisualizer = i),
                      child: Container(
                        margin: const EdgeInsets.only(right: 10),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSel ? AppTheme.accent : AppTheme.panel,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isSel ? AppTheme.accent : AppTheme.line,
                          ),
                        ),
                        child: Text(
                          _visualizers[i],
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

              const SizedBox(height: 22),

              // Up Next Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Up next',
                    style: TextStyle(
                      color: AppTheme.text,
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (player.autoMixEnabled)
                    const Text(
                      'AutoMix on',
                      style: TextStyle(
                        color: AppTheme.subtitle,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),

              if (player.queue.isNotEmpty)
                ...player.queue.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final qTrack = entry.value;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: InkWell(
                      onTap: () => player.playTrack(qTrack, index: idx),
                      borderRadius: BorderRadius.circular(10),
                      child: Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: qTrack.thumb.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: qTrack.thumb,
                                    width: 44,
                                    height: 44,
                                    fit: BoxFit.cover,
                                  )
                                : Container(
                                    width: 44,
                                    height: 44,
                                    color: AppTheme.panel,
                                    child: const Icon(Icons.music_note, color: AppTheme.muted),
                                  ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  qTrack.title,
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
                                  idx == 0 && player.autoMixEnabled
                                      ? '${qTrack.artist} · Crossfade in 6s'
                                      : '${qTrack.artist} · ${qTrack.durationFormatted}',
                                  style: TextStyle(
                                    color: idx == 0 && player.autoMixEnabled
                                        ? AppTheme.accentLight
                                        : AppTheme.muted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.more_horiz, color: AppTheme.muted, size: 20),
                            onPressed: () {},
                          ),
                        ],
                      ),
                    ),
                  );
                })
              else ...[
                _buildMockQueueItem(
                  'Moonstruck',
                  'Solace · Crossfade in 6s',
                  onTap: () => player.playTrack(
                    const Track(
                      id: 'TUVcZfQe-Kw',
                      title: 'Moonstruck',
                      artist: 'Solace',
                      durationSec: 248,
                      thumb: 'https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg',
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                _buildMockQueueItem(
                  'Undertow',
                  'Onda · 3:56',
                  onTap: () => player.playTrack(
                    const Track(
                      id: 'd5gx_qLp_i8',
                      title: 'Undertow',
                      artist: 'Onda',
                      durationSec: 236,
                      thumb: 'https://i.ytimg.com/vi/d5gx_qLp_i8/hqdefault.jpg',
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'Playing from After hours',
                  style: TextStyle(
                    color: AppTheme.muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Mini player bar at the bottom of queue
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: AppTheme.panel,
            border: const Border(top: BorderSide(color: AppTheme.line)),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFF3B1D54),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.music_note, color: Colors.white, size: 20),
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
                    Text(
                      track.artist,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppTheme.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(
                  player.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: AppTheme.text,
                  size: 26,
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
    );
  }

  Widget _buildMockQueueItem(String title, String subtitle, {VoidCallback? onTap}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.music_note, color: AppTheme.accentLight),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: AppTheme.text,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(color: AppTheme.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.more_horiz, color: AppTheme.muted, size: 20),
              onPressed: () {},
            ),
          ],
        ),
      ),
    );
  }
}

class _VisualizerPainter extends CustomPainter {
  final int mode;
  final double progress;
  final bool isPlaying;

  _VisualizerPainter({
    required this.mode,
    required this.progress,
    required this.isPlaying,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    if (w <= 0 || h <= 0) return;

    final baseAlpha = isPlaying ? 1.0 : 0.4;
    final speed = isPlaying ? progress * 2 * math.pi : 0.0;

    if (mode == 0) {
      // 1. Liquid (Sine wave with gradient fill)
      final path = Path();
      path.moveTo(0, h);
      for (double x = 0; x <= w; x += 4) {
        final y = h * 0.55 +
            math.sin(speed + (x / w) * 3 * math.pi) * (h * 0.22) +
            math.cos(speed * 0.8 + (x / w) * 2 * math.pi) * (h * 0.1);
        path.lineTo(x, y);
      }
      path.lineTo(w, h);
      path.close();

      final paint = Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF8B5CF6).withValues(alpha: 0.7 * baseAlpha),
            const Color(0xFF6366F1).withValues(alpha: 0.15 * baseAlpha),
          ],
        ).createShader(Rect.fromLTWH(0, 0, w, h));
      canvas.drawPath(path, paint);

      // Line stroke
      final strokePaint = Paint()
        ..color = const Color(0xFFC084FC).withValues(alpha: baseAlpha)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5;
      final strokePath = Path();
      for (double x = 0; x <= w; x += 4) {
        final y = h * 0.55 +
            math.sin(speed + (x / w) * 3 * math.pi) * (h * 0.22) +
            math.cos(speed * 0.8 + (x / w) * 2 * math.pi) * (h * 0.1);
        if (x == 0) {
          strokePath.moveTo(x, y);
        } else {
          strokePath.lineTo(x, y);
        }
      }
      canvas.drawPath(strokePath, strokePaint);
    } else if (mode == 1) {
      // 2. Orbit (Circular frequency orbit)
      final center = Offset(w / 2, h / 2);
      final radius = math.min(w, h) * 0.35;
      final dotPaint = Paint()..color = const Color(0xFF8B5CF6).withValues(alpha: baseAlpha);

      const count = 16;
      for (int i = 0; i < count; i++) {
        final angle = speed + (i * 2 * math.pi / count);
        final pulsate = isPlaying ? math.sin(speed * 2 + i) * 6 : 0.0;
        final r = radius + pulsate;
        final x = center.dx + math.cos(angle) * r;
        final y = center.dy + math.sin(angle) * r;
        final dotSize = 3.0 + (math.sin(speed + i) + 1.0) * 1.5;
        canvas.drawCircle(Offset(x, y), dotSize, dotPaint);
      }
    } else if (mode == 2) {
      // 3. Bars (Equalizer frequency bars with peak caps)
      const numBars = 24;
      final barWidth = (w - (numBars - 1) * 4) / numBars;
      final barPaint = Paint()
        ..shader = const LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [Color(0xFF6366F1), Color(0xFFD946EF)],
        ).createShader(Rect.fromLTWH(0, 0, w, h));
      final capPaint = Paint()..color = const Color(0xFFF472B6).withValues(alpha: baseAlpha);

      for (int i = 0; i < numBars; i++) {
        final norm = i / numBars;
        final factor = isPlaying
            ? (math.sin(speed * 1.5 + norm * 4 * math.pi).abs() * 0.7 +
                math.cos(speed * 0.7 + i * 0.5).abs() * 0.3)
            : 0.15;
        final barHeight = math.max(6.0, h * 0.75 * factor);
        final x = i * (barWidth + 4);
        final y = h - barHeight;

        canvas.drawRRect(
          RRect.fromRectAndRadius(Rect.fromLTWH(x, y, barWidth, barHeight), const Radius.circular(3)),
          barPaint,
        );
        // Peak cap
        canvas.drawRRect(
          RRect.fromRectAndRadius(Rect.fromLTWH(x, math.max(0, y - 4), barWidth, 2), const Radius.circular(1)),
          capPaint,
        );
      }
    } else if (mode == 3) {
      // 4. Wave (Oscilloscope neon line)
      final wavePaint = Paint()
        ..color = const Color(0xFF38BDF8).withValues(alpha: baseAlpha)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round;

      final path = Path();
      for (double x = 0; x <= w; x += 3) {
        final norm = x / w;
        final envelope = math.sin(norm * math.pi); // Taper at edges
        final y = h / 2 + (math.sin(speed * 2.5 + norm * 8 * math.pi) * (h * 0.38) * envelope);
        if (x == 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
      }
      canvas.drawPath(path, wavePaint);
    } else {
      // 5. Silk (Smooth floating ribbon)
      final silkPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0;

      for (int layer = 0; layer < 3; layer++) {
        silkPaint.color = (layer == 0
                ? const Color(0xFFC084FC)
                : (layer == 1 ? const Color(0xFF818CF8) : const Color(0xFF38BDF8)))
            .withValues(alpha: (0.7 - layer * 0.2) * baseAlpha);

        final path = Path();
        for (double x = 0; x <= w; x += 4) {
          final norm = x / w;
          final y = h * 0.5 +
              math.sin(speed * (0.8 + layer * 0.2) + norm * 2.5 * math.pi + layer) * (h * 0.28);
          if (x == 0) {
            path.moveTo(x, y);
          } else {
            path.lineTo(x, y);
          }
        }
        canvas.drawPath(path, silkPaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _VisualizerPainter oldDelegate) {
    return oldDelegate.mode != mode ||
        oldDelegate.progress != progress ||
        oldDelegate.isPlaying != isPlaying;
  }
}
