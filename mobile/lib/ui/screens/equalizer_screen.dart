import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/player_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/audio_player_service.dart';
import '../theme.dart';
import '../widgets/desktop_widgets.dart';

/// Complete Desktop `openEqModal` parity:
/// Tab 1: Live DJ & 8D Studio (Interactive 360° HRTF Orbit Radar, Stereo Width, DJ Filter, Bass Punch, Room Reverb)
/// Tab 2: 10-Band EQ & Speed (11 presets, 31..16k hardware EQ sliders, Speed 0.5x..2.0x, Pitch Lock)
/// Tab 3: Song Transitions (Smart AutoMix / Crossfade / Off + Duration slider)
class EqualizerScreen extends StatefulWidget {
  final int initialTab;
  const EqualizerScreen({super.key, this.initialTab = 0});

  @override
  State<EqualizerScreen> createState() => _EqualizerScreenState();
}

class _EqualizerScreenState extends State<EqualizerScreen> {
  late int _tab; // 0: Live DJ & 8D, 1: 10-Band EQ & Speed, 2: Song Transitions

  static const List<String> bandLabels = [
    '31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'
  ];

  static const Map<String, String> presetTitles = {
    'flat': 'Flat',
    'warm': 'Warm & Spacious',
    'bass': 'Bass Boost',
    'treble': 'Treble Boost',
    'pop': 'Pop',
    'rock': 'Rock',
    'vocal': 'Vocal',
    'acoustic': 'Acoustic',
    'electronic': 'Electronic',
    'club': 'Club',
    'classical': 'Classical',
  };

  @override
  void initState() {
    super.initState();
    _tab = widget.initialTab;
  }

  String _formatAzimuth(double angleRad, String mode) {
    if (mode == 'off') return 'FRONT • 0° (CENTER)';
    final deg = ((angleRad * 180 / math.pi).round()) % 360;
    if (deg == 0 || deg == 360) return 'FRONT • 0°';
    if (deg == 90) return 'RIGHT • +90°';
    if (deg == 180) return 'REAR • 180°';
    if (deg == 270) return 'LEFT • -90°';
    if (deg < 180) return 'RIGHT • +$deg°';
    return 'LEFT • -${360 - deg}°';
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final theme = context.watch<ThemeProvider>();
    final accent = theme.accent;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: AppTheme.text),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'LIVE DJ STUDIO',
              style: TextStyle(
                color: theme.accentLight,
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.1,
              ),
            ),
            const Text(
              'Spatial 8D Audio, Equalizer & Mix Deck',
              style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              if (_tab == 0) {
                player.resetDjStudio();
              } else if (_tab == 1) {
                player.resetEq();
                player.setPlaybackSpeed(1.0);
              } else {
                player.setAutoMixConfig(enabled: true, mode: 'smart', duration: 'auto');
              }
            },
            child: Text('Reset', style: TextStyle(color: theme.accentLight, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Column(
        children: [
          // 3 Desktop Tabs
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            child: Row(
              children: [
                _tabPill(0, 'Live DJ & 8D', Icons.headphones_rounded, accent),
                const SizedBox(width: 8),
                _tabPill(1, '10-Band EQ', Icons.tune_rounded, accent),
                const SizedBox(width: 8),
                _tabPill(2, 'Transitions', Icons.auto_awesome_rounded, accent),
              ],
            ),
          ),
          Expanded(
            child: _tab == 0
                ? _buildDjTab(player, theme)
                : (_tab == 1 ? _buildEqTab(player, theme) : _buildTransitionsTab(player, theme)),
          ),
        ],
      ),
    );
  }

  Widget _tabPill(int idx, String label, IconData icon, Color accent) {
    final active = _tab == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = idx),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: active ? accent.withValues(alpha: 0.22) : AppTheme.bg3,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: active ? accent : AppTheme.glassBorder),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 15, color: active ? AppTheme.text : AppTheme.muted),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  color: active ? AppTheme.text : AppTheme.muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ---------------- TAB 1: LIVE DJ & 8D STUDIO ----------------
  Widget _buildDjTab(PlayerProvider player, ThemeProvider theme) {
    final accent = theme.accent;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 36),
      children: [
        // Top Status Bar
        GlassContainer(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: player.isPlaying ? const Color(0xFF34D399) : AppTheme.muted,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'MASTER DECK DSP',
                    style: TextStyle(color: AppTheme.text, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.8),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  _formatAzimuth(player.djAzimuthRad, player.dj8DMode),
                  style: TextStyle(color: theme.accentLight, fontSize: 11, fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 360° Interactive Radar Canvas
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              const Text(
                '360° BINAURAL HRTF ORBIT',
                style: TextStyle(color: AppTheme.text, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.0),
              ),
              const SizedBox(height: 3),
              const Text(
                'Drag satellite or choose orbit speed',
                style: TextStyle(color: AppTheme.muted, fontSize: 11.5),
              ),
              const SizedBox(height: 14),
              GestureDetector(
                onPanUpdate: (details) {
                  const center = Offset(105, 105);
                  final pos = details.localPosition - center;
                  final angle = math.atan2(pos.dx, -pos.dy);
                  player.setDjAzimuthManual(angle < 0 ? angle + 2 * math.pi : angle);
                },
                child: SizedBox(
                  width: 210,
                  height: 210,
                  child: CustomPaint(
                    painter: _DjRadarPainter(
                      angleRad: player.djAzimuthRad,
                      isActive: player.dj8DMode != 'off',
                      accent: accent,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: [
                  for (final m in const [
                    ['off', 'Center (Off)'],
                    ['slow', 'Slow 16s'],
                    ['club', 'Club 10s'],
                    ['fast', 'Hyperspace 5s'],
                  ])
                    ChoiceChip(
                      label: Text(m[1]),
                      selected: player.dj8DMode == m[0],
                      selectedColor: accent,
                      backgroundColor: AppTheme.bg3,
                      labelStyle: TextStyle(
                        color: player.dj8DMode == m[0] ? Colors.white : AppTheme.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                      onSelected: (_) => player.setDj8DMode(m[0]),
                    ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // Stereo Width & DJ Filter Sweep & Bass Punch & Reverb
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Stereo Soundstage Width', style: TextStyle(color: AppTheme.text, fontWeight: FontWeight.w600, fontSize: 13.5)),
                  Text('${(player.djStereoWidth * 100).round()}%', style: TextStyle(color: theme.accentLight, fontWeight: FontWeight.bold)),
                ],
              ),
              Slider(
                value: player.djStereoWidth.clamp(0.0, 2.0),
                min: 0.0,
                max: 2.0,
                activeColor: accent,
                inactiveColor: AppTheme.line,
                onChanged: (v) => player.setDjStereoWidth(v),
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('DJ Filter Sweep (LPF / HPF)', style: TextStyle(color: AppTheme.text, fontWeight: FontWeight.w600, fontSize: 13.5)),
                  Text(
                    player.djFilter.abs() < 0.05
                        ? 'FLAT'
                        : (player.djFilter < 0
                            ? 'LPF ${(player.djFilter * 100).round()}%'
                            : 'HPF +${(player.djFilter * 100).round()}%'),
                    style: TextStyle(color: theme.accentLight, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),
              Slider(
                value: player.djFilter.clamp(-1.0, 1.0),
                min: -1.0,
                max: 1.0,
                activeColor: accent,
                inactiveColor: AppTheme.line,
                onChanged: (v) => player.setDjFilter(v),
              ),
              const Divider(color: AppTheme.line, height: 18),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Club Sub-Bass Punch (+4.5 dB)', style: TextStyle(color: AppTheme.text, fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: const Text('Hardware low-frequency punch & loudness enhancer', style: TextStyle(color: AppTheme.muted, fontSize: 12)),
                value: player.djBassPunch,
                activeThumbColor: Colors.white,
                activeTrackColor: accent,
                onChanged: (v) => player.setDjBassPunch(v),
              ),
              const SizedBox(height: 8),
              const Text('Acoustic Room Presence', style: TextStyle(color: AppTheme.text, fontWeight: FontWeight.w600, fontSize: 13.5)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final r in const [
                    ['off', 'Off'],
                    ['studio', 'Studio'],
                    ['club', 'Club'],
                    ['arena', 'Arena'],
                  ])
                    ChoiceChip(
                      label: Text(r[1]),
                      selected: player.djReverbPreset == r[0],
                      selectedColor: accent,
                      backgroundColor: AppTheme.bg3,
                      labelStyle: TextStyle(
                        color: player.djReverbPreset == r[0] ? Colors.white : AppTheme.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                      onSelected: (_) => player.setDjReverbPreset(r[0]),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ---------------- TAB 2: 10-BAND EQ & SPEED ----------------
  Widget _buildEqTab(PlayerProvider player, ThemeProvider theme) {
    final accent = theme.accent;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 36),
      children: [
        // Preset Chips
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: AudioPlayerService.eqPresets.entries.map((e) {
            final isSel = player.eqPreset == e.key;
            return ChoiceChip(
              label: Text(presetTitles[e.key] ?? e.key),
              selected: isSel,
              selectedColor: accent,
              backgroundColor: AppTheme.bg3,
              labelStyle: TextStyle(
                color: isSel ? Colors.white : AppTheme.muted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
              onSelected: (_) => player.setEqPreset(e.key, e.value),
            );
          }).toList(),
        ),
        const SizedBox(height: 14),

        // 10-Band Vertical Hardware EQ Sliders
        GlassContainer(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 16),
          child: SizedBox(
            height: 230,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(10, (i) {
                final val = player.eqBands[i];
                return Expanded(
                  child: Column(
                    children: [
                      Text(
                        '${val > 0 ? '+' : ''}${val.toStringAsFixed(0)}',
                        style: TextStyle(
                          color: val != 0 ? theme.accentLight : AppTheme.muted,
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Expanded(
                        child: RotatedBox(
                          quarterTurns: 3,
                          child: SliderTheme(
                            data: SliderTheme.of(context).copyWith(
                              trackHeight: 4,
                              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                              overlayShape: SliderComponentShape.noOverlay,
                            ),
                            child: Slider(
                              value: val.clamp(-12.0, 12.0),
                              min: -12.0,
                              max: 12.0,
                              activeColor: accent,
                              inactiveColor: AppTheme.line,
                              onChanged: (v) => player.setEqBand(i, v),
                            ),
                          ),
                        ),
                      ),
                      Text(
                        bandLabels[i],
                        style: const TextStyle(color: AppTheme.muted, fontSize: 10.5, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),
        ),

        const SizedBox(height: 14),

        // Playback Speed & Pitch Lock
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Playback Speed', style: TextStyle(color: AppTheme.text, fontWeight: FontWeight.bold, fontSize: 14.5)),
                  Text('${player.speed.toStringAsFixed(2)}x', style: TextStyle(color: theme.accentLight, fontWeight: FontWeight.bold)),
                ],
              ),
              Slider(
                value: player.speed.clamp(0.5, 2.0),
                min: 0.5,
                max: 2.0,
                divisions: 30,
                activeColor: accent,
                inactiveColor: AppTheme.line,
                onChanged: (v) => player.setPlaybackSpeed(v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Pitch Lock', style: TextStyle(color: AppTheme.text, fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: const Text('Preserve original vocal pitch when speeding up or slowing down', style: TextStyle(color: AppTheme.muted, fontSize: 12)),
                value: player.pitchLock,
                activeThumbColor: Colors.white,
                activeTrackColor: accent,
                onChanged: (_) => player.togglePitchLock(),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ---------------- TAB 3: SONG TRANSITIONS ----------------
  Widget _buildTransitionsTab(PlayerProvider player, ThemeProvider theme) {
    final accent = theme.accent;
    final activeMode = !player.autoMixEnabled ? 'off' : player.autoMixMode;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 36),
      children: [
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Transition Mode',
                style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  for (final m in const [
                    ['smart', 'Smart AutoMix'],
                    ['crossfade', 'Crossfade'],
                    ['off', 'Off'],
                  ])
                    ChoiceChip(
                      label: Text(m[1]),
                      selected: activeMode == m[0],
                      selectedColor: accent,
                      backgroundColor: AppTheme.bg3,
                      labelStyle: TextStyle(
                        color: activeMode == m[0] ? Colors.white : AppTheme.muted,
                        fontWeight: FontWeight.w600,
                      ),
                      onSelected: (_) {
                        if (m[0] == 'off') {
                          player.setAutoMixConfig(enabled: false);
                        } else {
                          player.setAutoMixConfig(enabled: true, mode: m[0]);
                        }
                      },
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                activeMode == 'off'
                    ? 'Standard playback: each song plays cleanly to completion before the next starts.'
                    : (player.autoMixDuration == 'auto'
                        ? 'Dynamic Apple Music mix: automatically blends outro curves (4s–6s) with zero dead-air.'
                        : 'Blends tracks using smooth DJ fade curves over ${player.crossfadeDuration}s.'),
                style: const TextStyle(color: AppTheme.muted, fontSize: 12.5, height: 1.4),
              ),
              if (activeMode != 'off') ...[
                const Divider(color: AppTheme.line, height: 22),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Transition Length', style: TextStyle(color: AppTheme.text, fontWeight: FontWeight.w600)),
                    Text(
                      player.autoMixDuration == 'auto' ? 'Auto' : '${player.crossfadeDuration}s',
                      style: TextStyle(color: theme.accentLight, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Slider(
                  value: (player.autoMixDuration == 'auto' ? 6 : player.crossfadeDuration).toDouble().clamp(1, 15),
                  min: 1,
                  max: 15,
                  divisions: 14,
                  activeColor: accent,
                  inactiveColor: AppTheme.line,
                  onChanged: (v) => player.setAutoMixConfig(
                    duration: v.round(),
                    crossfadeDuration: v.round(),
                  ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => player.setAutoMixConfig(duration: 'auto'),
                    child: Text('Use Auto (Best Mix)', style: TextStyle(color: theme.accentLight)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _DjRadarPainter extends CustomPainter {
  final double angleRad;
  final bool isActive;
  final Color accent;

  const _DjRadarPainter({
    required this.angleRad,
    required this.isActive,
    required this.accent,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final maxR = size.width * 0.43;

    final ringPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    canvas.drawCircle(Offset(cx, cy), maxR, ringPaint);
    canvas.drawCircle(Offset(cx, cy), maxR * 0.66, ringPaint);
    canvas.drawCircle(Offset(cx, cy), maxR * 0.33, ringPaint);

    // Crosshairs
    canvas.drawLine(Offset(cx - maxR, cy), Offset(cx + maxR, cy), ringPaint);
    canvas.drawLine(Offset(cx, cy - maxR), Offset(cx, cy + maxR), ringPaint);

    // Listener head icon at center
    canvas.drawCircle(
      Offset(cx, cy),
      10,
      Paint()..color = Colors.white.withValues(alpha: 0.2),
    );
    canvas.drawCircle(Offset(cx, cy), 5, Paint()..color = Colors.white);

    // Satellite orb on orbit ring
    final orbitR = isActive ? maxR * 0.85 : 0.0;
    final sx = cx + orbitR * math.sin(angleRad);
    final sy = cy - orbitR * math.cos(angleRad);

    if (isActive) {
      canvas.drawLine(
        Offset(cx, cy),
        Offset(sx, sy),
        Paint()
          ..color = accent.withValues(alpha: 0.5)
          ..strokeWidth = 2,
      );
      canvas.drawCircle(
        Offset(sx, sy),
        16,
        Paint()..color = accent.withValues(alpha: 0.35),
      );
    }
    canvas.drawCircle(
      Offset(sx, sy),
      8,
      Paint()..color = isActive ? accent : Colors.white70,
    );
  }

  @override
  bool shouldRepaint(covariant _DjRadarPainter old) =>
      old.angleRad != angleRad || old.isActive != isActive || old.accent != accent;
}
