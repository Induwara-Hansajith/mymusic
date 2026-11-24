import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../models/track.dart';
import '../../models/playlist.dart';
import '../../services/youtube_service.dart';
import '../../providers/player_provider.dart';
import '../../providers/library_provider.dart';
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
    final library = context.watch<LibraryProvider>();

    // 1. Real recently played from user history if available, else live Quick Picks
    final hasUserRecents = library.recentTracks.isNotEmpty;
    final recentlyPlayed = hasUserRecents
        ? library.recentTracks
        : (_feed['Quick Picks'] ?? YoutubeService.getCuratedTopHits());

    // 2. Live shelves from feed
    final topHits = _feed['Quick Picks'] ?? YoutubeService.getCuratedTopHits();
    final trending = _feed['Trending Now'] ?? YoutubeService.getCuratedLateNight();
    final chillTracks = _feed['Chill & Relax'] ?? YoutubeService.getCuratedChill();
    final lateNightTracks = _feed['Late Night'] ?? YoutubeService.getCuratedAfterHours();
    final workoutTracks = _feed['Workout Energy'] ?? YoutubeService.getCuratedDeepFocus();

    // 3. User favorites
    final favorites = library.favorites;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppTheme.accent,
          backgroundColor: AppTheme.panel,
          onRefresh: _loadFeed,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
            children: [
              // Top Bar Greeting & Equalizer Shortcut Button
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.auto_awesome, color: AppTheme.accentLight, size: 13),
                          SizedBox(width: 4),
                          Text(
                            'MY MUSIC',
                            style: TextStyle(
                              color: AppTheme.subtitle,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
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
                      tooltip: '10-Band Equalizer',
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

              const SizedBox(height: 18),

              // Desktop Spotlight Hero Banner
              _buildHeroSpotlightBanner(context, player, topHits),

              const SizedBox(height: 24),

              // Dynamic Song Themes & Featured Mood Banners
              _buildSectionHeader('Song Themes & Moods'),
              const SizedBox(height: 12),
              _buildThemesBannerCarousel(context, player, trending, lateNightTracks, chillTracks, workoutTracks),

              const SizedBox(height: 24),

              // Section 1: Recently played
              _buildSectionHeader(
                hasUserRecents ? 'Recently played' : 'Quick Picks for You',
                onSeeAll: () {},
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 185,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: recentlyPlayed.length,
                  itemBuilder: (ctx, i) {
                    final t = recentlyPlayed[i];
                    return _buildSquareTrackCard(
                      track: t,
                      onTap: () => player.playTrack(t, queue: recentlyPlayed, index: i),
                    );
                  },
                ),
              ),

              // Section 2: Liked Songs (if user has any favorites)
              if (favorites.isNotEmpty) ...[
                const SizedBox(height: 24),
                _buildSectionHeader('Liked Songs', onSeeAll: () {}),
                const SizedBox(height: 12),
                SizedBox(
                  height: 185,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: favorites.length,
                    itemBuilder: (ctx, i) {
                      final t = favorites[i];
                      return _buildSquareTrackCard(
                        track: t,
                        onTap: () => player.playTrack(t, queue: favorites, index: i),
                      );
                    },
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // Section 3: Made for you (Personalized mixes with 2x2 collage artwork)
              _buildSectionHeader('Made for you', onSeeAll: () {}),
              const SizedBox(height: 12),
              SizedBox(
                height: 195,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _buildCollageCard(
                      context: context,
                      title: 'After hours',
                      subtitle: 'Atmospheric nocturnal mix',
                      tracks: lateNightTracks,
                      gradient: const [Color(0xFF3B1D54), Color(0xFF1E1B4B)],
                    ),
                    _buildCollageCard(
                      context: context,
                      title: 'Deep focus',
                      subtitle: 'Concentration & flow state',
                      tracks: workoutTracks,
                      gradient: const [Color(0xFF0F766E), Color(0xFF1E3A8A)],
                    ),
                    _buildCollageCard(
                      context: context,
                      title: 'Chill Lofi Station',
                      subtitle: 'Warm analog beats',
                      tracks: chillTracks,
                      gradient: const [Color(0xFF78350F), Color(0xFF9A3412)],
                    ),
                    _buildCollageCard(
                      context: context,
                      title: 'Global Top Hits',
                      subtitle: 'World viral chart toppers',
                      tracks: topHits,
                      gradient: const [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Section 4: Trending Now
              _buildSectionHeader('Trending Now', onSeeAll: () {}),
              const SizedBox(height: 12),
              SizedBox(
                height: 185,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: trending.length,
                  itemBuilder: (ctx, i) {
                    final t = trending[i];
                    return _buildSquareTrackCard(
                      track: t,
                      onTap: () => player.playTrack(t, queue: trending, index: i),
                    );
                  },
                ),
              ),

              const SizedBox(height: 24),

              // Section 5: Chill & Relax
              _buildSectionHeader('Chill & Relax', onSeeAll: () {}),
              const SizedBox(height: 12),
              SizedBox(
                height: 185,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: chillTracks.length,
                  itemBuilder: (ctx, i) {
                    final t = chillTracks[i];
                    return _buildSquareTrackCard(
                      track: t,
                      onTap: () => player.playTrack(t, queue: chillTracks, index: i),
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

  // Desktop Spotlight Hero Banner
  Widget _buildHeroSpotlightBanner(BuildContext context, PlayerProvider player, List<Track> topHits) {
    final featuredTrack = topHits.isNotEmpty ? topHits.first : YoutubeService.trackVioletHour;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF4C1D95),
            Color(0xFF1E1B4B),
            Color(0xFF0F172A),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4C1D95).withValues(alpha: 0.35),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -20,
            bottom: -20,
            child: Icon(
              Icons.graphic_eq_rounded,
              size: 160,
              color: Colors.white.withValues(alpha: 0.05),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppTheme.accentLight.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              '✦ SPOTLIGHT MIX',
                              style: TextStyle(
                                color: AppTheme.accentLight,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        "Today's Top Mix",
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Direct 320kbps stream with Apple Music-style AutoMix',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 12.5,
                        ),
                      ),
                      const SizedBox(height: 14),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: const Color(0xFF1E1B4B),
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        icon: const Icon(Icons.play_arrow_rounded, size: 20, color: Color(0xFF1E1B4B)),
                        label: const Text(
                          'Play Mix',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        onPressed: () {
                          if (topHits.isNotEmpty) {
                            player.playTrack(topHits.first, queue: topHits, index: 0);
                          }
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: featuredTrack.thumb.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: featuredTrack.thumb,
                          width: 88,
                          height: 88,
                          fit: BoxFit.cover,
                          placeholder: (_, _) => Container(width: 88, height: 88, color: AppTheme.panel),
                          errorWidget: (_, _, _) => Container(width: 88, height: 88, color: AppTheme.panel),
                        )
                      : Container(
                          width: 88,
                          height: 88,
                          color: AppTheme.panel,
                          child: const Icon(Icons.music_note, color: Colors.white70),
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Dynamic Theme Banners Carousel
  Widget _buildThemesBannerCarousel(
    BuildContext context,
    PlayerProvider player,
    List<Track> trending,
    List<Track> lateNight,
    List<Track> chill,
    List<Track> workout,
  ) {
    final themes = [
      {
        'tag': 'TRENDING',
        'title': 'Global Viral 50',
        'sub': 'Today’s biggest chart anthems',
        'gradient': [const Color(0xFF6366F1), const Color(0xFF8B5CF6)],
        'icon': Icons.local_fire_department_rounded,
        'tracks': trending,
      },
      {
        'tag': 'NIGHT',
        'title': 'Late Night Melancholy',
        'sub': 'Atmospheric nocturnal soundscapes',
        'gradient': [const Color(0xFF3B1D54), const Color(0xFF1E1B4B)],
        'icon': Icons.nightlight_round,
        'tracks': lateNight,
      },
      {
        'tag': 'STUDY',
        'title': 'Deep Focus Flow',
        'sub': 'Pure instrumental concentration',
        'gradient': [const Color(0xFF0F766E), const Color(0xFF0369A1)],
        'icon': Icons.headphones_rounded,
        'tracks': chill,
      },
      {
        'tag': 'ENERGY',
        'title': 'Pure Adrenaline',
        'sub': 'High-octane workout beats',
        'gradient': [const Color(0xFFBE123C), const Color(0xFFF97316)],
        'icon': Icons.bolt_rounded,
        'tracks': workout,
      },
    ];

    return SizedBox(
      height: 125,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: themes.length,
        itemBuilder: (ctx, i) {
          final t = themes[i];
          final gradientColors = t['gradient'] as List<Color>;
          final trackList = t['tracks'] as List<Track>;

          return GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => PlaylistScreen(
                    playlist: Playlist(
                      id: 'theme_${t['tag']}',
                      name: t['title'] as String,
                      tracks: trackList,
                      createdAt: DateTime.now(),
                    ),
                  ),
                ),
              );
            },
            child: Container(
              width: 250,
              margin: const EdgeInsets.only(right: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: gradientColors,
                ),
                boxShadow: [
                  BoxShadow(
                    color: gradientColors.first.withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  Positioned(
                    right: -10,
                    bottom: -10,
                    child: Icon(
                      t['icon'] as IconData,
                      size: 90,
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.black26,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            t['tag'] as String,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              t['title'] as String,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              t['sub'] as String,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.8),
                                fontSize: 11.5,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
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

  Widget _buildSquareTrackCard({
    required Track track,
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
              track.title,
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
              track.artist,
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

  Widget _buildCollageCard({
    required BuildContext context,
    required String title,
    required String subtitle,
    required List<Track> tracks,
    required List<Color> gradient,
  }) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PlaylistScreen(
              playlist: Playlist(
                id: 'pl_${title.toLowerCase().replaceAll(' ', '_')}',
                name: title,
                tracks: tracks,
                createdAt: DateTime.now(),
              ),
            ),
          ),
        );
      },
      child: Container(
        width: 138,
        margin: const EdgeInsets.only(right: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 138,
              height: 138,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppTheme.line),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: tracks.length >= 4
                    ? GridView.builder(
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                        ),
                        itemCount: 4,
                        itemBuilder: (ctx, i) {
                          final t = tracks[i];
                          return CachedNetworkImage(
                            imageUrl: t.thumb,
                            fit: BoxFit.cover,
                            placeholder: (_, _) => Container(color: AppTheme.panel),
                            errorWidget: (_, _, _) => Container(
                              color: gradient[i % gradient.length],
                              child: const Icon(Icons.music_note, color: Colors.white54, size: 20),
                            ),
                          );
                        },
                      )
                    : Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: gradient,
                          ),
                        ),
                        child: const Center(
                          child: Icon(Icons.album_rounded, color: Colors.white70, size: 44),
                        ),
                      ),
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
