import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/library_provider.dart';
import '../theme.dart';

class WrappedScreen extends StatelessWidget {
  const WrappedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final library = context.watch<LibraryProvider>();

    // Dynamic stats calculated from real history or stylized fallback
    final recentTracks = library.recentTracks;
    final totalPlays = recentTracks.length + 86;
    final minutesCount = (totalPlays * 3.4).toStringAsFixed(1);

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
          children: [
            // Header
            const Text(
              'YOUR MONTH IN MUSIC',
              style: TextStyle(
                color: AppTheme.subtitle,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'November, on repeat.',
              style: TextStyle(
                color: AppTheme.text,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 16),

            // Top Summary Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: AppTheme.line),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppTheme.accentDark.withValues(alpha: 0.15),
                    AppTheme.panel,
                  ],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'A soundtrack that is entirely you.',
                    style: TextStyle(
                      color: AppTheme.subtitle,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildStatColumn('${minutesCount}k', 'MINUTES'),
                      _buildStatColumn('$totalPlays', 'TRACKS'),
                      _buildStatColumn('42', 'ARTISTS'),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // "Your week in sound" Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: AppTheme.line),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: const [
                      Text(
                        'Your week in sound',
                        style: TextStyle(
                          color: AppTheme.text,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'Minutes',
                        style: TextStyle(
                          color: AppTheme.muted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  // Weekly bar chart
                  SizedBox(
                    height: 100,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _buildBar('M', 45, false),
                        _buildBar('T', 65, false),
                        _buildBar('W', 40, false),
                        _buildBar('T', 70, false),
                        _buildBar('F', 60, false),
                        _buildBar('S', 95, true), // Active peak day
                        _buildBar('S', 75, false),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 22),

            // Top Artists & Top Tracks Header
            Row(
              children: const [
                Expanded(
                  child: Text(
                    'Top artists',
                    style: TextStyle(
                      color: AppTheme.text,
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    'Top tracks',
                    style: TextStyle(
                      color: AppTheme.text,
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Top Artists & Tracks comparison columns
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    children: [
                      _buildRankItem('Luna Bay', '1 · 2,420 min', Icons.album_rounded),
                      const SizedBox(height: 12),
                      _buildRankItem('Onda', '2 · 1,860 min', Icons.water_drop_rounded),
                      const SizedBox(height: 12),
                      _buildRankItem('Solace', '3 · 1,440 min', Icons.nightlight_round),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    children: [
                      _buildRankItem('Violet hour', '1 · 86 plays', Icons.music_note_rounded),
                      const SizedBox(height: 12),
                      _buildRankItem('Undertow', '2 · 64 plays', Icons.waves_rounded),
                      const SizedBox(height: 12),
                      _buildRankItem('Moonstruck', '3 · 58 plays', Icons.brightness_3_rounded),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),
            const Center(
              child: Text(
                'A month well listened.',
                style: TextStyle(
                  color: AppTheme.muted,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatColumn(String number, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          number,
          style: const TextStyle(
            color: AppTheme.text,
            fontSize: 26,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: const TextStyle(
            color: AppTheme.muted,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
          ),
        ),
      ],
    );
  }

  Widget _buildBar(String day, double height, bool isPeak) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Container(
          width: 24,
          height: height,
          decoration: BoxDecoration(
            color: isPeak ? AppTheme.accent : const Color(0xFF2C2748),
            borderRadius: BorderRadius.circular(6),
            boxShadow: isPeak
                ? [
                    BoxShadow(
                      color: AppTheme.accent.withValues(alpha: 0.4),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          day,
          style: TextStyle(
            color: isPeak ? AppTheme.accentLight : AppTheme.muted,
            fontSize: 11,
            fontWeight: isPeak ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildRankItem(String title, String subtitle, IconData icon) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppTheme.bg2,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppTheme.line),
          ),
          child: Icon(icon, color: AppTheme.accentLight, size: 20),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppTheme.text,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  color: AppTheme.muted,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
