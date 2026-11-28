import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:just_audio/just_audio.dart';
import '../../models/track.dart';
import '../../providers/player_provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/download_service.dart';
import '../../services/lyrics_service.dart';
import '../../services/storage_service.dart';
import '../theme.dart';
import '../screens/equalizer_screen.dart';
import '../screens/settings_screen.dart';
import 'desktop_widgets.dart';

/// Complete Desktop `#nowPlayingOverlay` Stage with 3 tabs (`Now Playing`, `Lyrics`, `Up Next`),
/// 4 ambient visualizers (`bokeh`, `stardust`, `bubbles`, `waves`), 11 lyrics animation styles,
/// timing offset sync, lyrics translation, Live DJ / Output Device triggers, and interactive queue.
class NowPlayingSheet extends StatefulWidget {
  const NowPlayingSheet({super.key});

  @override
  State<NowPlayingSheet> createState() => _NowPlayingSheetState();
}

class _NowPlayingSheetState extends State<NowPlayingSheet>
    with SingleTickerProviderStateMixin {
  int _tab = 0; // 0: Now Playing, 1: Lyrics, 2: Up Next
  late AnimationController _animCtrl;
  final ScrollController _lyricsCtrl = ScrollController();

  bool _translated = false;
  bool _translating = false;
  final Map<int, String> _translatedLines = {};
  String? _translatedForTrackId;

  static const List<Map<String, String>> _fsVizOptions = [
    {'id': 'bokeh', 'name': 'Petals & Bokeh'},
    {'id': 'stardust', 'name': 'Stardust & Aurora'},
    {'id': 'bubbles', 'name': 'Floating Bubbles'},
    {'id': 'waves', 'name': 'Ambient Waves'},
    {'id': 'off', 'name': 'Visualizer Off'},
  ];

  static const Map<String, String> _lyricEmojis = {
    'love': '💖', 'heart': '❤️', 'kiss': '💋', 'sun': '☀️', 'night': '🌙',
    'moon': '🌕', 'star': '✨', 'stars': '✨', 'sky': '🌌', 'rain': '🌧️',
    'tear': '💧', 'tears': '💧', 'cry': '😢', 'ocean': '🌊', 'fire': '🔥',
    'burn': '🔥', 'car': '🏎️', 'drive': '🚘', 'money': '💵', 'diamond': '💎',
    'time': '⏳', 'eye': '👁️', 'eyes': '👀', 'home': '🏠', 'music': '🎵',
    'dance': '💃', 'rose': '🌹', 'fly': '🦋', 'wings': '🪽', 'dream': '💭',
  };

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _lyricsCtrl.dispose();
    super.dispose();
  }

  String _fmt(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _toggleTranslate(PlayerProvider player, Track track) async {
    if (_translatedForTrackId != track.id) {
      _translatedLines.clear();
      _translated = false;
      _translatedForTrackId = track.id;
    }
    if (_translated) {
      setState(() => _translated = false);
      return;
    }
    if (_translatedLines.isNotEmpty) {
      setState(() => _translated = true);
      return;
    }
    final synced = player.lyrics.synced;
    if (synced.isEmpty && (player.lyrics.plain == null || player.lyrics.plain!.isEmpty)) {
      return;
    }
    setState(() => _translating = true);
    try {
      final svc = LyricsService();
      if (synced.isNotEmpty) {
        final combined = synced.map((l) => l.text).join('\n');
        final res = await svc.translateText(combined);
        final parts = res.split('\n');
        for (int i = 0; i < synced.length; i++) {
          _translatedLines[i] = i < parts.length ? parts[i] : synced[i].text;
        }
      } else if (player.lyrics.plain != null) {
        final res = await svc.translateText(player.lyrics.plain!);
        _translatedLines[0] = res;
      }
      if (mounted) {
        setState(() {
          _translated = true;
          _translating = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _translating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final library = context.watch<LibraryProvider>();
    final theme = context.watch<ThemeProvider>();
    final track = player.currentTrack;
    if (track == null) return const SizedBox.shrink();

    if (_translatedForTrackId != null && _translatedForTrackId != track.id) {
      _translated = false;
      _translatedLines.clear();
      _translatedForTrackId = track.id;
    }

    final accent = theme.accent;
    final lowRes = library.lowResourceMode;
    if (lowRes && _animCtrl.isAnimating) _animCtrl.stop();
    if (!lowRes && !_animCtrl.isAnimating) _animCtrl.repeat();

    return Container(
      height: MediaQuery.of(context).size.height * 0.96,
      decoration: const BoxDecoration(
        color: AppTheme.bg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Blurred / Gradient Backdrop + Fullscreen Canvas Visualizer
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, -0.4),
                  radius: 1.15,
                  colors: [
                    accent.withValues(alpha: 0.28),
                    theme.accent2.withValues(alpha: 0.14),
                    AppTheme.bg,
                  ],
                ),
              ),
            ),
          ),
          if (!lowRes && theme.fsViz != 'off')
            Positioned.fill(
              child: IgnorePointer(
                child: AnimatedBuilder(
                  animation: _animCtrl,
                  builder: (_, _) => CustomPaint(
                    painter: _FsVisualizerPainter(
                      mode: theme.fsViz,
                      t: _animCtrl.value * 2 * math.pi,
                      accent: accent,
                      accent2: theme.accent2,
                      isPlaying: player.isPlaying,
                    ),
                  ),
                ),
              ),
            ),

          SafeArea(
            child: Column(
              children: [
                // Desktop `.fs-header`
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
                  child: Row(
                    children: [
                      IconButton(
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.08),
                        ),
                        icon: const Icon(Icons.keyboard_arrow_down_rounded, color: AppTheme.text, size: 26),
                        onPressed: () => Navigator.pop(context),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'PLAYING FROM',
                              style: TextStyle(
                                color: AppTheme.muted,
                                fontSize: 9.5,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.0,
                              ),
                            ),
                            Text(
                              player.contextTitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: AppTheme.text, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      // Fullscreen Background Visualizer Picker
                      PopupMenuButton<String>(
                        color: const Color(0xFF101420),
                        tooltip: 'Background Visualizer',
                        icon: Icon(Icons.auto_awesome_mosaic_outlined, color: theme.accentLight, size: 21),
                        onSelected: (v) => theme.setFsViz(v),
                        itemBuilder: (_) => _fsVizOptions
                            .map((o) => PopupMenuItem(
                                  value: o['id'],
                                  child: Row(
                                    children: [
                                      if (theme.fsViz == o['id'])
                                        Icon(Icons.check, color: accent, size: 16)
                                      else
                                        const SizedBox(width: 16),
                                      const SizedBox(width: 8),
                                      Text(o['name']!, style: const TextStyle(color: AppTheme.text, fontSize: 13)),
                                    ],
                                  ),
                                ))
                            .toList(),
                      ),
                    ],
                  ),
                ),

                // Desktop `.fs-view-tabs` (Now Playing | Lyrics | Up Next)
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppTheme.glassBorder),
                  ),
                  child: Row(
                    children: [
                      _fsTabBtn(0, 'Now Playing', accent),
                      _fsTabBtn(1, 'Lyrics', accent),
                      _fsTabBtn(2, 'Up Next', accent),
                    ],
                  ),
                ),

                Expanded(
                  child: _tab == 0
                      ? _buildStageTab(context, player, library, theme, track)
                      : (_tab == 1
                          ? _buildLyricsTab(context, player, theme, track)
                          : _buildQueueTab(context, player, theme)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _fsTabBtn(int idx, String label, Color accent) {
    final active = _tab == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = idx),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 7),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? accent : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: active ? Colors.white : AppTheme.muted,
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }

  // ---------------- TAB 1: NOW PLAYING STAGE ----------------
  Widget _buildStageTab(
    BuildContext context,
    PlayerProvider player,
    LibraryProvider library,
    ThemeProvider theme,
    Track track,
  ) {
    final accent = theme.accent;
    final posMs = player.position.inMilliseconds.toDouble();
    final durMs = player.duration.inMilliseconds.toDouble();
    final sliderVal = durMs > 0 ? posMs.clamp(0.0, durMs) : 0.0;
    final isFav = library.isFavorite(track.id);
    final isDl = library.isDownloaded(track.id);

    final previewLine = player.lyrics.synced.isNotEmpty && player.currentLyricIndex >= 0
        ? player.lyrics.synced[player.currentLyricIndex].text
        : (player.lyrics.plain != null && player.lyrics.plain!.isNotEmpty
            ? player.lyrics.plain!.split('\n').first
            : 'No lyrics for this one yet');

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(22, 10, 22, 18),
      child: Column(
        children: [
          // Artwork with MIXING badge
          Stack(
            children: [
              Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.35),
                      blurRadius: 36,
                      offset: const Offset(0, 14),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: track.thumb.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: track.thumb,
                          fit: BoxFit.cover,
                          errorWidget: (_, _, _) => Container(
                            color: AppTheme.panel,
                            child: const Icon(Icons.music_note, color: AppTheme.muted, size: 64),
                          ),
                        )
                      : Container(
                          color: AppTheme.panel,
                          child: const Icon(Icons.music_note, color: AppTheme.muted, size: 64),
                        ),
                ),
              ),
              if (player.isMixing)
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      'MIXING',
                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 18),

          // Title, Artist & Favorite
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
                      style: const TextStyle(color: AppTheme.text, fontSize: 20, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      track.artist,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppTheme.muted, fontSize: 14),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(
                  isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: isFav ? accent : AppTheme.muted,
                  size: 26,
                ),
                onPressed: () => library.toggleFavorite(track),
              ),
            ],
          ),

          const SizedBox(height: 8),

          // Seek Slider
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 4,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
              overlayShape: SliderComponentShape.noOverlay,
            ),
            child: Slider(
              value: sliderVal,
              min: 0,
              max: durMs > 0 ? durMs : 1.0,
              activeColor: accent,
              inactiveColor: AppTheme.line,
              onChanged: (v) => player.seek(Duration(milliseconds: v.round())),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_fmt(player.position), style: const TextStyle(color: AppTheme.muted, fontSize: 11.5)),
                Text(_fmt(player.duration), style: const TextStyle(color: AppTheme.muted, fontSize: 11.5)),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Transport Controls
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: Icon(
                  Icons.shuffle_rounded,
                  color: player.shuffleEnabled ? accent : AppTheme.muted,
                  size: 22,
                ),
                onPressed: () => player.toggleShuffle(),
              ),
              IconButton(
                icon: const Icon(Icons.skip_previous_rounded, color: AppTheme.text, size: 34),
                onPressed: () => player.previous(),
              ),
              GestureDetector(
                onTap: () => player.togglePlay(),
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: accent,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: accent.withValues(alpha: 0.5), blurRadius: 22)],
                  ),
                  child: Center(
                    child: player.isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                          )
                        : Icon(
                            player.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 36,
                          ),
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.skip_next_rounded, color: AppTheme.text, size: 34),
                onPressed: () => player.next(),
              ),
              IconButton(
                icon: Icon(
                  player.loopMode == LoopMode.one ? Icons.repeat_one_rounded : Icons.repeat_rounded,
                  color: player.loopMode != LoopMode.off ? accent : AppTheme.muted,
                  size: 22,
                ),
                onPressed: () => player.cycleLoopMode(),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Lyrics Preview Card (taps to Lyrics tab)
          InkWell(
            onTap: () => setState(() => _tab = 1),
            borderRadius: BorderRadius.circular(14),
            child: GlassContainer(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'LYRICS PREVIEW',
                        style: TextStyle(color: theme.accentLight, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.9),
                      ),
                      const Icon(Icons.open_in_full_rounded, color: AppTheme.muted, size: 15),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    previewLine,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppTheme.text, fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // Volume Slider
          Row(
            children: [
              const Icon(Icons.volume_down_rounded, color: AppTheme.muted, size: 19),
              Expanded(
                child: Slider(
                  value: player.volume.clamp(0.0, 1.0),
                  min: 0.0,
                  max: 1.0,
                  activeColor: accent,
                  inactiveColor: AppTheme.line,
                  onChanged: (v) => player.setVolume(v),
                ),
              ),
              const Icon(Icons.volume_up_rounded, color: AppTheme.muted, size: 19),
            ],
          ),

          // Desktop Bottom Actions: Output Device | Live DJ / EQ | AutoMix | Download | Radio
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              _chipBtn(
                icon: Icons.headphones_rounded,
                label: 'Output',
                active: false,
                accent: accent,
                onTap: () {
                  final cur = StorageService().getSettingsMap()['outputDeviceName'] as String? ?? 'Default output · Auto-route';
                  showAudioOutputDeviceSheet(
                    context,
                    selectedName: cur,
                    onSelected: (name) => StorageService().patchSettings({'outputDeviceName': name}),
                  );
                },
              ),
              _chipBtn(
                icon: Icons.tune_rounded,
                label: 'Live DJ & EQ',
                active: player.dj8DMode != 'off' || player.eqPreset != 'flat',
                accent: accent,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const EqualizerScreen()),
                ),
              ),
              _chipBtn(
                icon: Icons.auto_awesome_rounded,
                label: 'AutoMix',
                active: player.autoMixEnabled,
                accent: accent,
                onTap: () => player.toggleAutoMix(),
              ),
              _chipBtn(
                icon: Icons.radio_rounded,
                label: 'Autoplay',
                active: player.radioEnabled,
                accent: accent,
                onTap: () => player.toggleRadio(),
              ),
              _chipBtn(
                icon: isDl ? Icons.download_done_rounded : Icons.download_rounded,
                label: isDl ? 'Offline' : 'Save',
                active: isDl,
                accent: accent,
                onTap: () async {
                  if (!isDl) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Downloading "${track.title}"…')),
                    );
                    await DownloadService().downloadTrack(track);
                    if (context.mounted) library.refreshDownloaded();
                  }
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _chipBtn({
    required IconData icon,
    required String label,
    required bool active,
    required Color accent,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: active ? accent.withValues(alpha: 0.2) : AppTheme.bg3,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? accent : AppTheme.glassBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: active ? accent : AppTheme.muted),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                color: active ? AppTheme.text : AppTheme.muted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------- TAB 2: LYRICS (11 STYLES + OFFSET + TRANSLATION) ----------------
  Widget _buildLyricsTab(
    BuildContext context,
    PlayerProvider player,
    ThemeProvider theme,
    Track track,
  ) {
    final accent = theme.accent;
    final synced = player.lyrics.synced;
    final activeIdx = player.currentLyricIndex;
    final style = theme.lyricsStyle == 'random' ? 'cinematic' : theme.lyricsStyle;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Column(
        children: [
          // Style Picker + Translate + Timing Offset Controls
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: theme.lyricsStyle,
                  isDense: true,
                  dropdownColor: const Color(0xFF101420),
                  style: const TextStyle(color: AppTheme.text, fontSize: 12.5),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: AppTheme.bg3,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppTheme.glassBorder),
                    ),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'random', child: Text('🔀 Auto-Randomize')),
                    DropdownMenuItem(value: 'cinematic', child: Text('✨ SONARA Cinematic')),
                    DropdownMenuItem(value: 'apple-music', child: Text('🎵 Apple Music Blur')),
                    DropdownMenuItem(value: 'verci-visual', child: Text('✨ Verci Visual')),
                    DropdownMenuItem(value: 'verci-chat', child: Text('💬 Verci iMessage')),
                    DropdownMenuItem(value: 'verci-notifications', child: Text('📱 Lock-Screen')),
                    DropdownMenuItem(value: 'verci-fisheye', child: Text('👁️ 3D Fisheye')),
                    DropdownMenuItem(value: 'verci-code', child: Text('💻 Code Terminal')),
                    DropdownMenuItem(value: 'verci-constellation', child: Text('🌌 Constellation')),
                    DropdownMenuItem(value: 'karaoke', child: Text('🎤 Classic Karaoke')),
                    DropdownMenuItem(value: 'minimal', child: Text('📄 Minimalist')),
                  ],
                  onChanged: (v) {
                    if (v != null) theme.setLyricsStyle(v);
                  },
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  backgroundColor: _translated ? accent.withValues(alpha: 0.22) : AppTheme.bg3,
                  side: BorderSide(color: _translated ? accent : AppTheme.glassBorder),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                ),
                icon: _translating
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                    : Icon(Icons.translate_rounded, size: 15, color: _translated ? Colors.white : AppTheme.text),
                label: Text(_translated ? 'Original' : 'Translate', style: const TextStyle(color: AppTheme.text, fontSize: 12)),
                onPressed: _translating ? null : () => _toggleTranslate(player, track),
              ),
            ],
          ),

          const SizedBox(height: 8),

          // Sync Offset Bar (-0.25s, +0.25s, Reset)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.bg3,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppTheme.glassBorder),
            ),
            child: Row(
              children: [
                const Text('Sync', style: TextStyle(color: AppTheme.muted, fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(width: 10),
                _offsetBtn('-0.25s', () => player.adjustLyricOffset(-250)),
                const SizedBox(width: 6),
                Text(
                  '${player.lyricOffsetMs >= 0 ? '+' : ''}${(player.lyricOffsetMs / 1000).toStringAsFixed(2)}s',
                  style: TextStyle(color: accent, fontWeight: FontWeight.bold, fontSize: 12),
                ),
                const SizedBox(width: 6),
                _offsetBtn('+0.25s', () => player.adjustLyricOffset(250)),
                const Spacer(),
                if (player.lyricOffsetMs != 0)
                  TextButton(
                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(40, 24)),
                    onPressed: () => player.resetLyricOffset(),
                    child: const Text('Reset', style: TextStyle(color: AppTheme.muted, fontSize: 11.5)),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Lyrics Display styled according to selected Desktop Lyrics Style
          Expanded(
            child: synced.isNotEmpty
                ? ListView.builder(
                    controller: _lyricsCtrl,
                    itemCount: synced.length,
                    itemBuilder: (ctx, i) {
                      final line = synced[i];
                      final isCur = i == activeIdx;
                      final displayText = (_translated && _translatedLines[i] != null)
                          ? _translatedLines[i]!
                          : line.text;

                      return GestureDetector(
                        onTap: () {
                          final ms = (line.timeSec * 1000 - player.lyricOffsetMs).round();
                          if (ms >= 0) player.seek(Duration(milliseconds: ms));
                        },
                        child: _buildStyledLyricRow(
                          style: style,
                          text: displayText,
                          isCur: isCur,
                          distance: (i - activeIdx).abs(),
                          index: i,
                          accent: accent,
                        ),
                      );
                    },
                  )
                : (player.lyrics.plain != null && player.lyrics.plain!.isNotEmpty
                    ? SingleChildScrollView(
                        child: Text(
                          (_translated && _translatedLines[0] != null)
                              ? _translatedLines[0]!
                              : player.lyrics.plain!,
                          style: const TextStyle(color: AppTheme.text, fontSize: 15.5, height: 1.7),
                        ),
                      )
                    : const Center(
                        child: Text('No lyrics found for this track.', style: TextStyle(color: AppTheme.muted)),
                      )),
          ),
        ],
      ),
    );
  }

  Widget _buildStyledLyricRow({
    required String style,
    required String text,
    required bool isCur,
    required int distance,
    required int index,
    required Color accent,
  }) {
    if (style == 'verci-chat') {
      final isRight = index.isOdd;
      return Align(
        alignment: isRight ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 5),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          constraints: const BoxConstraints(maxWidth: 280),
          decoration: BoxDecoration(
            color: isCur
                ? (isRight ? accent : const Color(0xFF262A38))
                : Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isCur ? Colors.white.withValues(alpha: 0.25) : Colors.transparent,
            ),
          ),
          child: Text(
            text,
            style: TextStyle(
              color: isCur ? Colors.white : AppTheme.muted,
              fontSize: isCur ? 16 : 13.5,
              fontWeight: isCur ? FontWeight.bold : FontWeight.w500,
            ),
          ),
        ),
      );
    }

    if (style == 'verci-notifications') {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 5),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isCur ? accent.withValues(alpha: 0.22) : AppTheme.panelCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: isCur ? accent : AppTheme.glassBorder),
        ),
        child: Row(
          children: [
            Icon(Icons.notifications_active_rounded, size: 16, color: isCur ? accent : AppTheme.muted),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  color: isCur ? Colors.white : AppTheme.muted,
                  fontSize: isCur ? 16 : 13.5,
                  fontWeight: isCur ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (style == 'verci-code') {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(
          '${isCur ? '> ' : '  '}$text${isCur ? ' _' : ''}',
          style: TextStyle(
            fontFamily: 'monospace',
            color: isCur ? const Color(0xFF34D399) : AppTheme.muted,
            fontSize: isCur ? 15.5 : 13,
            fontWeight: isCur ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      );
    }

    String decorated = text;
    if (style == 'verci-visual') {
      for (final entry in _lyricEmojis.entries) {
        if (text.toLowerCase().contains(entry.key)) {
          decorated = '${entry.value} $text';
          break;
        }
      }
    }

    final double opacity = style == 'apple-music'
        ? (isCur ? 1.0 : math.max(0.22, 1.0 - distance * 0.22))
        : (isCur ? 1.0 : 0.45);
    final double scaleSize = style == 'verci-fisheye'
        ? (isCur ? 22 : math.max(12, 19 - distance * 2).toDouble())
        : (isCur ? 20 : 15);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Opacity(
        opacity: opacity,
        child: Text(
          decorated,
          style: TextStyle(
            color: isCur
                ? (style == 'karaoke' ? accent : Colors.white)
                : AppTheme.text,
            fontSize: scaleSize,
            fontWeight: isCur ? FontWeight.w800 : FontWeight.w600,
            shadows: isCur
                ? [Shadow(color: accent.withValues(alpha: 0.65), blurRadius: 18)]
                : null,
          ),
        ),
      ),
    );
  }

  Widget _offsetBtn(String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(label, style: const TextStyle(color: AppTheme.text, fontSize: 11.5, fontWeight: FontWeight.w600)),
      ),
    );
  }

  // ---------------- TAB 3: UP NEXT QUEUE ----------------
  Widget _buildQueueTab(BuildContext context, PlayerProvider player, ThemeProvider theme) {
    final accent = theme.accent;
    final q = player.queue;
    final curIdx = player.currentIndex;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Column(
        children: [
          Row(
            children: [
              _chipBtn(
                icon: Icons.auto_awesome_rounded,
                label: 'AutoMix',
                active: player.autoMixEnabled,
                accent: accent,
                onTap: () => player.toggleAutoMix(),
              ),
              const SizedBox(width: 8),
              _chipBtn(
                icon: Icons.radio_rounded,
                label: 'Autoplay',
                active: player.radioEnabled,
                accent: accent,
                onTap: () => player.toggleRadio(),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: () => player.shuffleRemaining(),
                icon: Icon(Icons.shuffle_rounded, size: 16, color: accent),
                label: Text('Shuffle Up Next', style: TextStyle(color: accent, fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: q.isEmpty
                ? const Center(child: Text('Queue is empty.', style: TextStyle(color: AppTheme.muted)))
                : ListView.builder(
                    itemCount: q.length,
                    itemBuilder: (_, i) {
                      final t = q[i];
                      final isCur = i == curIdx;
                      return ListTile(
                        dense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        leading: ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: t.thumb.isNotEmpty
                              ? CachedNetworkImage(imageUrl: t.thumb, width: 40, height: 40, fit: BoxFit.cover)
                              : Container(width: 40, height: 40, color: AppTheme.bg3),
                        ),
                        title: Text(
                          t.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: isCur ? accent : AppTheme.text,
                            fontWeight: isCur ? FontWeight.bold : FontWeight.w500,
                            fontSize: 13.5,
                          ),
                        ),
                        subtitle: Text(
                          t.artist,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppTheme.muted, fontSize: 11.5),
                        ),
                        trailing: isCur
                            ? Icon(Icons.equalizer_rounded, color: accent, size: 18)
                            : IconButton(
                                icon: const Icon(Icons.close_rounded, color: AppTheme.muted, size: 18),
                                onPressed: () => player.removeFromQueue(i),
                              ),
                        onTap: () => player.playTrack(t, index: i),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _FsVisualizerPainter extends CustomPainter {
  final String mode;
  final double t;
  final Color accent;
  final Color accent2;
  final bool isPlaying;

  const _FsVisualizerPainter({
    required this.mode,
    required this.t,
    required this.accent,
    required this.accent2,
    required this.isPlaying,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    if (w <= 0 || h <= 0) return;
    final alpha = isPlaying ? 0.25 : 0.12;

    if (mode == 'waves') {
      final path = Path()..moveTo(0, h);
      for (double x = 0; x <= w; x += 6) {
        final y = h * 0.72 + math.sin(x * 0.015 + t) * 26 + math.cos(x * 0.009 - t) * 14;
        path.lineTo(x, y);
      }
      path
        ..lineTo(w, h)
        ..close();
      canvas.drawPath(
        path,
        Paint()..color = accent.withValues(alpha: alpha),
      );
      return;
    }

    final count = mode == 'stardust' ? 28 : 14;
    for (int i = 0; i < count; i++) {
      final seed = i * 1.73;
      final x = (w * ((math.sin(seed * 3.1 + t * 0.15) + 1) / 2));
      final y = (h * ((math.cos(seed * 2.4 - t * 0.12) + 1) / 2));
      final r = mode == 'stardust'
          ? (2.0 + (i % 4))
          : (16.0 + (i % 5) * 8);
      final paint = Paint()
        ..color = (i.isEven ? accent : accent2).withValues(
          alpha: mode == 'stardust' ? alpha * 1.6 : alpha * 0.45,
        );
      if (mode == 'bubbles') {
        paint
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5;
      }
      canvas.drawCircle(Offset(x, y), r, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _FsVisualizerPainter old) =>
      old.t != t || old.mode != mode || old.accent != accent || old.isPlaying != isPlaying;
}
