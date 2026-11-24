import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../models/track.dart';
import '../../models/playlist.dart';
import '../../services/youtube_service.dart';
import '../../providers/player_provider.dart';
import '../theme.dart';
import 'equalizer_screen.dart';
import 'playlist_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final YoutubeService _yt = YoutubeService();
  Map<String, List<Track>> _feed = {};

  @override
  void initState() {
    super.initState();
    _loadFeed();
  }

  Future<void> _loadFeed() async {
    final data = await _yt.getHomeFeed();
    if (mounted) {
      setState(() {
        _feed = data;
      });
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();

    final recentlyPlayed = [
      YoutubeService.trackVioletHour,
      YoutubeService.trackMoonstruck,
      YoutubeService.trackTidal,
      ...(_feed['Quick Picks'] ?? YoutubeService.getCuratedTopHits()).where(
        (t) => t.id != YoutubeService.trackVioletHour.id &&
               t.id != YoutubeService.trackMoonstruck.id &&
               t.id != YoutubeService.trackTidal.id,
      ),
    ];

    final newReleases = [
      YoutubeService.trackSundown,
      YoutubeService.trackBlueRoom,
      YoutubeService.trackOrbit,
      ...(_feed['Trending Now'] ?? YoutubeService.getCuratedLateNight()).where(
        (t) => t.id != YoutubeService.trackSundown.id &&
               t.id != YoutubeService.trackBlueRoom.id &&
               t.id != YoutubeService.trackOrbit.id,
      ),
    ];

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppTheme.accent,
          backgroundColor: AppTheme.panel,
          onRefresh: _loadFeed,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 110),
            children: [
              // Top Bar Greeting & Equalizer Button
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'MY MUSIC',
                        style: TextStyle(
                          color: AppTheme.subtitle,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.0,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _getGreeting(),
                        style: const TextStyle(
                          color: AppTheme.text,
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    decoration: BoxDecoration(
                      color: AppTheme.panel,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppTheme.line),
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.tune_rounded, color: AppTheme.text, size: 22),
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const EqualizerScreen()),
                        );
                      },
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Section 1: Recently played
              _buildSectionHeader('Recently played', onSeeAll: () {}),
              const SizedBox(height: 12),
              SizedBox(
                height: 180,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: recentlyPlayed.length,
                  itemBuilder: (ctx, i) {
                    final t = recentlyPlayed[i];
                    return _buildSquareCard(
                      track: t,
                      title: t.title,
                      subtitle: t.artist,
                      onTap: () => player.playTrack(t, queue: recentlyPlayed, index: i),
                    );
                  },
                ),
              ),

              const SizedBox(height: 24),

              // Section 2: Made for you
              _buildSectionHeader('Made for you', onSeeAll: () {}),
              const SizedBox(height: 12),
              SizedBox(
                height: 180,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _buildCuratedCard(
                      title: 'After hours',
                      subtitle: 'Your daily mix',
                      icon: Icons.nightlife_rounded,
                      color: const Color(0xFF4C1D95),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PlaylistScreen(
                              playlist: Playlist(
                                id: 'after_hours',
                                name: 'After hours',
                                tracks: YoutubeService.getCuratedAfterHours(),
                                createdAt: DateTime.now(),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                    _buildCuratedCard(
                      title: 'Deep focus',
                      subtitle: 'Made for your mind',
                      icon: Icons.water_drop_rounded,
                      color: const Color(0xFF1E3A8A),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PlaylistScreen(
                              playlist: Playlist(
                                id: 'deep_focus',
                                name: 'Deep focus',
                                tracks: YoutubeService.getCuratedDeepFocus(),
                                createdAt: DateTime.now(),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                    _buildCuratedCard(
                      title: 'Slow burn',
                      subtitle: 'A softer landing',
                      icon: Icons.wb_twilight_rounded,
                      color: const Color(0xFF5A1E2D),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PlaylistScreen(
                              playlist: Playlist(
                                id: 'slow_burn',
                                name: 'Slow burn',
                                tracks: YoutubeService.getCuratedSlowBurn(),
                                createdAt: DateTime.now(),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Section 3: New releases
              _buildSectionHeader('New releases', onSeeAll: () {}),
              const SizedBox(height: 12),
              SizedBox(
                height: 180,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: newReleases.length,
                  itemBuilder: (ctx, i) {
                    final t = newReleases[i];
                    return _buildSquareCard(
                      track: t,
                      title: t.title,
                      subtitle: t.artist,
                      onTap: () => player.playTrack(t, queue: newReleases, index: i),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, {VoidCallback? onSeeAll}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: AppTheme.text,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        if (onSeeAll != null)
          GestureDetector(
            onTap: onSeeAll,
            child: const Text(
              'See all',
              style: TextStyle(
                color: AppTheme.muted,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildSquareCard({
    required Track track,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 128,
        margin: const EdgeInsets.only(right: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: track.thumb.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: track.thumb,
                      width: 128,
                      height: 128,
                      fit: BoxFit.cover,
                      placeholder: (_, _) => Container(
                        width: 128,
                        height: 128,
                        color: AppTheme.panel,
                        child: const Icon(Icons.music_note, color: AppTheme.muted),
                      ),
                      errorWidget: (_, _, _) => Container(
                        width: 128,
                        height: 128,
                        color: AppTheme.panel,
                        child: const Icon(Icons.music_note, color: AppTheme.muted),
                      ),
                    )
                  : Container(
                      width: 128,
                      height: 128,
                      color: AppTheme.panel,
                      child: const Icon(Icons.music_note, color: AppTheme.muted),
                    ),
            ),
            const SizedBox(height: 8),
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
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppTheme.muted,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCuratedCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 128,
        margin: const EdgeInsets.only(right: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 128,
              height: 128,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(18),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    color.withValues(alpha: 0.8),
                    color,
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Center(
                child: Icon(icon, color: Colors.white70, size: 40),
              ),
            ),
            const SizedBox(height: 8),
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
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppTheme.muted,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
