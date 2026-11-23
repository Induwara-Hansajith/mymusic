import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../models/track.dart';
import '../../services/youtube_service.dart';
import '../../providers/player_provider.dart';
import '../theme.dart';
import '../widgets/track_tile.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final YoutubeService _yt = YoutubeService();
  Map<String, List<Track>> _feed = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadFeed();
  }

  Future<void> _loadFeed() async {
    setState(() => _isLoading = true);
    final data = await _yt.getHomeFeed();
    if (mounted) {
      setState(() {
        _feed = data;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppTheme.accent),
      );
    }

    final quickPicks = _feed['Quick Picks'] ?? [];
    final trending = _feed['Trending Now'] ?? [];
    final chill = _feed['Chill & Relax'] ?? [];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                gradient: const LinearGradient(
                  colors: [AppTheme.accent, AppTheme.accent2],
                ),
              ),
              child: const Icon(Icons.music_note, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 10),
            const Text('My Music'),
          ],
        ),
      ),
      body: RefreshIndicator(
        color: AppTheme.accent,
        backgroundColor: AppTheme.panel,
        onRefresh: _loadFeed,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 90),
          children: [
            if (quickPicks.isNotEmpty) ...[
              _buildSectionHeader('Quick Picks'),
              SizedBox(
                height: 195,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  itemCount: quickPicks.length,
                  itemBuilder: (ctx, i) {
                    final t = quickPicks[i];
                    return _buildCardItem(context, t, quickPicks, i);
                  },
                ),
              ),
            ],
            if (trending.isNotEmpty) ...[
              _buildSectionHeader('Trending Now'),
              ...trending.take(8).map((t) => TrackTile(track: t, queueContext: trending)),
            ],
            if (chill.isNotEmpty) ...[
              _buildSectionHeader('Chill & Relax'),
              SizedBox(
                height: 195,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  itemCount: chill.length,
                  itemBuilder: (ctx, i) {
                    final t = chill[i];
                    return _buildCardItem(context, t, chill, i);
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
      child: Text(
        title,
        style: const TextStyle(
          color: AppTheme.text,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  Widget _buildCardItem(BuildContext context, Track track, List<Track> queue, int index) {
    final player = context.read<PlayerProvider>();
    return Container(
      width: 135,
      margin: const EdgeInsets.only(right: 12),
      child: GestureDetector(
        onTap: () => player.playTrack(track, queue: queue, index: index),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Stack(
                alignment: Alignment.bottomRight,
                children: [
                  CachedNetworkImage(
                    imageUrl: track.thumb,
                    width: 135,
                    height: 135,
                    fit: BoxFit.cover,
                    placeholder: (_, _) => Container(
                      width: 135,
                      height: 135,
                      color: AppTheme.panel,
                      child: const Icon(Icons.music_note, color: AppTheme.muted),
                    ),
                    errorWidget: (_, _, _) => Container(
                      width: 135,
                      height: 135,
                      color: AppTheme.panel,
                      child: const Icon(Icons.music_note, color: AppTheme.muted),
                    ),
                  ),
                  Container(
                    margin: const EdgeInsets.all(6),
                    padding: const EdgeInsets.all(6),
                    decoration: const BoxDecoration(
                      color: AppTheme.accent,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.play_arrow, color: Colors.white, size: 18),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Text(
              track.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppTheme.text,
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              track.artist,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppTheme.muted,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
