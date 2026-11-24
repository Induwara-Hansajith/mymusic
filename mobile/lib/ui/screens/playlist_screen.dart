import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/playlist.dart';
import '../../models/track.dart';
import '../../providers/player_provider.dart';
import '../theme.dart';
import '../widgets/mini_player.dart';

class PlaylistScreen extends StatelessWidget {
  final Playlist? playlist;

  const PlaylistScreen({super.key, this.playlist});

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();

    final plName = playlist?.name ?? 'After hours';
    final tracks = playlist != null && playlist!.tracks.isNotEmpty
        ? playlist!.tracks
        : [
            Track(id: '1', title: 'Violet hour', artist: 'Luna Bay', durationSec: 222, thumb: ''),
            Track(id: '2', title: 'Moonstruck', artist: 'Solace', durationSec: 248, thumb: ''),
            Track(id: '3', title: 'Undertow', artist: 'Onda', durationSec: 236, thumb: ''),
            Track(id: '4', title: 'Sundown', artist: 'Daydream', durationSec: 201, thumb: ''),
          ];

    final isDefault = playlist == null;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: AppTheme.text),
          onPressed: () => Navigator.pop(context),
        ),
        centerTitle: true,
        title: const Text(
          'YOUR PLAYLIST',
          style: TextStyle(
            color: AppTheme.subtitle,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.0,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_horiz, color: AppTheme.text),
            onPressed: () {},
          ),
        ],
      ),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 110),
            children: [
              // 2x2 Collage Artwork Cover
              Center(
                child: Container(
                  width: 180,
                  height: 180,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(22),
                    color: AppTheme.panel,
                    border: Border.all(color: AppTheme.line),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.accentDark.withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: GridView.count(
                      crossAxisCount: 2,
                      physics: const NeverScrollableScrollPhysics(),
                      children: [
                        Container(color: const Color(0xFF3B1D54), child: const Icon(Icons.music_note, color: Colors.white60)),
                        Container(color: const Color(0xFF1E3A8A), child: const Icon(Icons.nightlight_round, color: Colors.white60)),
                        Container(color: const Color(0xFF162D4A), child: const Icon(Icons.water_drop_rounded, color: Colors.white60)),
                        Container(color: const Color(0xFF4A1828), child: const Icon(Icons.wb_twilight_rounded, color: Colors.white60)),
                      ],
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Playlist Info
              Text(
                plName,
                style: const TextStyle(
                  color: AppTheme.text,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                isDefault ? 'For when the world turns down.' : 'Curated collection',
                style: const TextStyle(
                  color: AppTheme.muted,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Made by you · ${tracks.length} tracks · 1 hr 32 min',
                style: const TextStyle(
                  color: AppTheme.muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),

              const SizedBox(height: 20),

              // Shuffle & Play Buttons
              Row(
                children: [
                  // Shuffle pill button
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.panel,
                        foregroundColor: AppTheme.text,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                          side: const BorderSide(color: AppTheme.line),
                        ),
                      ),
                      icon: const Icon(Icons.shuffle_rounded, size: 20, color: AppTheme.text),
                      label: const Text(
                        'Shuffle',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      onPressed: () {
                        if (tracks.isNotEmpty) {
                          final shuffled = List.of(tracks)..shuffle();
                          player.playTrack(shuffled[0], queue: shuffled, index: 0);
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 14),
                  // Play primary violet button
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.accent,
                        foregroundColor: Colors.white,
                        elevation: 4,
                        shadowColor: AppTheme.accent.withValues(alpha: 0.5),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                      icon: const Icon(Icons.play_arrow_rounded, size: 24, color: Colors.white),
                      label: const Text(
                        'Play',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      onPressed: () {
                        if (tracks.isNotEmpty) {
                          player.playTrack(tracks[0], queue: tracks, index: 0);
                        }
                      },
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Track rows
              ...tracks.asMap().entries.map((entry) {
                final idx = entry.key;
                final t = entry.value;
                final isCurrent = player.currentTrack?.id == t.id;

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: InkWell(
                    onTap: () => player.playTrack(t, queue: tracks, index: idx),
                    borderRadius: BorderRadius.circular(14),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: AppTheme.panel,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.music_note_rounded, color: AppTheme.accentLight, size: 22),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  t.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: isCurrent ? AppTheme.accentLight : AppTheme.text,
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '${t.artist} · ${t.durationFormatted}',
                                  style: const TextStyle(
                                    color: AppTheme.muted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.drag_handle_rounded, color: AppTheme.muted, size: 20),
                        ],
                      ),
                    ),
                  ),
                );
              }),
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
