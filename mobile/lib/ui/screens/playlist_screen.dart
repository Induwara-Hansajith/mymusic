import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/playlist.dart';
import '../../providers/player_provider.dart';
import '../theme.dart';
import '../widgets/track_tile.dart';

class PlaylistScreen extends StatelessWidget {
  final Playlist playlist;

  const PlaylistScreen({super.key, required this.playlist});

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text(playlist.name),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          // Playlist Header Banner
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: const LinearGradient(
                      colors: [AppTheme.accent, AppTheme.accentPink],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: const Icon(Icons.music_note, color: Colors.white, size: 44),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        playlist.name,
                        style: const TextStyle(
                          color: AppTheme.text,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${playlist.tracks.length} songs',
                        style: const TextStyle(color: AppTheme.muted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Play All & Shuffle Buttons
          if (playlist.tracks.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.accent,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.play_arrow, color: Colors.white),
                      label: const Text('Play All', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      onPressed: () {
                        player.playTrack(playlist.tracks[0], queue: playlist.tracks, index: 0);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppTheme.line),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.shuffle, color: AppTheme.text),
                      label: const Text('Shuffle', style: TextStyle(color: AppTheme.text, fontWeight: FontWeight.bold)),
                      onPressed: () {
                        final shuffled = List.of(playlist.tracks)..shuffle();
                        player.playTrack(shuffled[0], queue: shuffled, index: 0);
                      },
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 10),

          if (playlist.tracks.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(
                child: Text('This playlist has no songs yet.', style: TextStyle(color: AppTheme.muted)),
              ),
            )
          else
            ...playlist.tracks.asMap().entries.map(
                  (entry) => TrackTile(
                    track: entry.value,
                    queueContext: playlist.tracks,
                    indexInQueue: entry.key,
                  ),
                ),
        ],
      ),
    );
  }
}
