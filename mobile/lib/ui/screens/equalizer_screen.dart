import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/player_provider.dart';
import '../theme.dart';
import '../widgets/mini_player.dart';

class EqualizerScreen extends StatelessWidget {
  const EqualizerScreen({super.key});

  static const List<String> bandLabels = [
    '31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'
  ];

  static const Map<String, List<double>> presets = {
    'Warm & spacious': [4.0, 6.0, 3.0, -1.0, -3.0, 0.0, 3.0, 5.0, 4.0, 2.0],
    'Flat': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    'Bass boost': [7.0, 6.0, 5.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    'Vocal boost': [-2.0, -1.0, 0.0, 2.0, 5.0, 4.0, 3.0, 1.0, 0.0, -1.0],
    'Treble boost': [0.0, 0.0, 0.0, 0.0, 1.0, 2.0, 4.0, 6.0, 7.0, 8.0],
    'Electronic': [5.0, 4.0, 2.0, -1.0, -2.0, 1.0, 3.0, 4.0, 5.0, 5.0],
    'Rock': [4.0, 3.0, 1.0, 0.0, -1.0, 0.0, 2.0, 3.0, 4.0, 4.0],
    'Pop': [-1.0, 1.0, 3.0, 4.0, 4.0, 3.0, 1.0, 0.0, 1.0, 2.0],
  };

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: AppTheme.text),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text(
              'MAKE IT YOURS',
              style: TextStyle(
                color: AppTheme.subtitle,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.0,
              ),
            ),
            SizedBox(height: 2),
            Text(
              'Equalizer',
              style: TextStyle(
                color: AppTheme.text,
                fontSize: 26,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => player.resetEq(),
            child: const Text(
              'Reset',
              style: TextStyle(
                color: AppTheme.subtitle,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 110),
            children: [
              // Banner Card
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppTheme.line),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppTheme.accent.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.tune_rounded, color: AppTheme.accentLight, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Your sound. Fine-tuned.',
                          style: TextStyle(
                            color: AppTheme.text,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 3),
                        Text(
                          '10 bands · -12 to +12 dB',
                          style: TextStyle(
                            color: AppTheme.muted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // Preset Selector
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppTheme.line),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Preset',
                      style: TextStyle(
                        color: AppTheme.muted,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: presets.containsKey(player.eqPreset)
                            ? player.eqPreset
                            : 'Warm & spacious',
                        dropdownColor: AppTheme.panel,
                        icon: const Icon(Icons.keyboard_arrow_down_rounded, color: AppTheme.text),
                        style: const TextStyle(
                          color: AppTheme.text,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                        items: presets.keys.map((name) {
                          return DropdownMenuItem(
                            value: name,
                            child: Text(name),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null && presets.containsKey(val)) {
                            player.setEqPreset(val, presets[val]!);
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // 10-Band Sliders Card
              Container(
                padding: const EdgeInsets.fromLTRB(10, 16, 10, 14),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppTheme.line),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const SizedBox(
                          width: 28,
                          child: Text(
                            '+12',
                            style: TextStyle(color: AppTheme.muted, fontSize: 10),
                          ),
                        ),
                        Expanded(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: List.generate(10, (idx) {
                              final val = player.eqBands.length > idx
                                  ? player.eqBands[idx]
                                  : 0.0;
                              return SizedBox(
                                width: 28,
                                child: Text(
                                  val > 0 ? '+${val.toInt()}' : '${val.toInt()}',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: val != 0 ? AppTheme.accentLight : AppTheme.muted,
                                    fontSize: 11,
                                    fontWeight: val != 0 ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              );
                            }),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Vertical sliders
                    SizedBox(
                      height: 160,
                      child: Row(
                        children: [
                          const SizedBox(
                            width: 28,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('', style: TextStyle(fontSize: 10)),
                                Text('0', style: TextStyle(color: AppTheme.muted, fontSize: 10)),
                                Text('-12', style: TextStyle(color: AppTheme.muted, fontSize: 10)),
                              ],
                            ),
                          ),
                          Expanded(
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceAround,
                              children: List.generate(10, (idx) {
                                final val = player.eqBands.length > idx
                                    ? player.eqBands[idx]
                                    : 0.0;
                                return SizedBox(
                                  width: 28,
                                  child: RotatedBox(
                                    quarterTurns: 3,
                                    child: SliderTheme(
                                      data: SliderTheme.of(context).copyWith(
                                        trackHeight: 4,
                                        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                        activeTrackColor: AppTheme.accent,
                                        inactiveTrackColor: AppTheme.line,
                                        thumbColor: AppTheme.text,
                                        overlayShape: SliderComponentShape.noOverlay,
                                      ),
                                      child: Slider(
                                        value: val,
                                        min: -12.0,
                                        max: 12.0,
                                        onChanged: (newVal) {
                                          player.setEqBand(idx, newVal.roundToDouble());
                                        },
                                      ),
                                    ),
                                  ),
                                );
                              }),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    // Freq labels
                    Row(
                      children: [
                        const SizedBox(width: 28),
                        Expanded(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: List.generate(10, (idx) {
                              return SizedBox(
                                width: 28,
                                child: Text(
                                  bandLabels[idx],
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: AppTheme.muted,
                                    fontSize: 10,
                                  ),
                                ),
                              );
                            }),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // Playback Speed Card
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppTheme.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Playback speed',
                          style: TextStyle(
                            color: AppTheme.text,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '${player.speed.toStringAsFixed(1)}×',
                          style: const TextStyle(
                            color: AppTheme.accentLight,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        trackHeight: 3.5,
                        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                        activeTrackColor: AppTheme.accent,
                        inactiveTrackColor: AppTheme.line,
                        thumbColor: AppTheme.text,
                      ),
                      child: Slider(
                        value: player.speed,
                        min: 0.5,
                        max: 2.0,
                        divisions: 15,
                        onChanged: (newSpeed) {
                          player.setPlaybackSpeed(newSpeed);
                        },
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text('0.5×', style: TextStyle(color: AppTheme.muted, fontSize: 11)),
                        Text('2.0×', style: TextStyle(color: AppTheme.muted, fontSize: 11)),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Center(
                      child: InkWell(
                        onTap: () => player.togglePitchLock(),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: AppTheme.bg2,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: player.pitchLock ? AppTheme.accent : AppTheme.line,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                player.pitchLock ? Icons.lock_rounded : Icons.lock_open_rounded,
                                size: 14,
                                color: player.pitchLock ? AppTheme.accentLight : AppTheme.muted,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                player.pitchLock ? 'Pitch lock on' : 'Pitch lock off',
                                style: TextStyle(
                                  color: player.pitchLock ? AppTheme.accentLight : AppTheme.muted,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: MiniPlayer(),
          ),
        ],
      ),
    );
  }
}
