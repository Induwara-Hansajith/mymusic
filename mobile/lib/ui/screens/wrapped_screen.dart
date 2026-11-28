import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../models/track.dart';
import '../../providers/library_provider.dart';
import '../../providers/player_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/thumb_cache_manager.dart';
import '../../services/youtube_service.dart';
import '../theme.dart';
import '../widgets/desktop_widgets.dart';

class WrappedScreen extends StatefulWidget {
  final void Function(String artistId, String artistName)? onOpenArtist;

  const WrappedScreen({super.key, this.onOpenArtist});

  @override
  State<WrappedScreen> createState() => _WrappedScreenState();
}

class _WrappedScreenState extends State<WrappedScreen> {
  final Map<String, String> _artistThumbs = {};

  @override
  void initState() {
    super.initState();
    _loadArtistThumbs();
  }

  Future<void> _loadArtistThumbs() async {
    final stats = context.read<LibraryProvider>().playStats;
    final artists = Map<String, dynamic>.from(stats['artists'] as Map? ?? {});
    final list = artists.entries.toList()
      ..sort((a, b) => (((b.value as Map)['plays'] as num?)?.toInt() ?? 0)
          .compareTo(((a.value as Map)['plays'] as num?)?.toInt() ?? 0));
    for (final entry in list.take(10)) {
      final info = Map<String, dynamic>.from(entry.value as Map);
      final existing = info['thumb'] as String?;
      if (existing != null && existing.isNotEmpty) {
        _artistThumbs[entry.key] = existing;
        continue;
      }
      final t = await YoutubeService().resolveArtistThumb(
        entry.key,
        artistId: info['id'] as String?,
      );
      if (t != null && t.isNotEmpty && mounted) {
        setState(() => _artistThumbs[entry.key] = t);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final library = context.watch<LibraryProvider>();
    final player = context.read<PlayerProvider>();
    final accent = context.watch<ThemeProvider>().accent;

    final stats = library.playStats;
    final totalPlays = (stats['totalPlays'] as num?)?.toInt() ?? 0;
    final totalSeconds = (stats['totalSeconds'] as num?)?.toInt() ?? 0;
    final totalHours = (totalSeconds / 3600.0);
    final totalMins = (totalSeconds / 60.0).round();
    final timeDisplay = totalHours >= 1
        ? '${totalHours.toStringAsFixed(1)} Hours'
        : '$totalMins Mins';

    final rawTracks = Map<String, dynamic>.from(stats['tracks'] as Map? ?? {});
    final topTracks = rawTracks.entries.toList()
      ..sort((a, b) => (((b.value as Map)['plays'] as num?)?.toInt() ?? 0)
          .compareTo(((a.value as Map)['plays'] as num?)?.toInt() ?? 0));

    final rawArtists = Map<String, dynamic>.from(stats['artists'] as Map? ?? {});
    final topArtists = rawArtists.entries.toList()
      ..sort((a, b) => (((b.value as Map)['plays'] as num?)?.toInt() ?? 0)
          .compareTo(((a.value as Map)['plays'] as num?)?.toInt() ?? 0));

    final topArtistName = topArtists.isNotEmpty ? topArtists.first.key : 'None yet';
    final topArtistPlays = topArtists.isNotEmpty
        ? '${((topArtists.first.value as Map)['plays'] ?? 0)} plays'
        : '—';

    final topTrackTitle = topTracks.isNotEmpty
        ? ((topTracks.first.value as Map)['title']?.toString() ?? 'None yet')
        : 'None yet';
    final topTrackPlays = topTracks.isNotEmpty
        ? '${((topTracks.first.value as Map)['plays'] ?? 0)} plays'
        : '—';

    final topTrackQueue = topTracks.take(10).map((e) {
      final m = Map<String, dynamic>.from(e.value as Map);
      return Track.fromJson({...m, 'id': e.key});
    }).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 120),
      children: [
        const Text(
          'Listening Analytics',
          style: TextStyle(
            color: AppTheme.text,
            fontSize: 26,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Your listening history, mini-wrapped trends, and favorite music',
          style: TextStyle(color: AppTheme.muted, fontSize: 13),
        ),
        const SizedBox(height: 16),

        // 4 Desktop Stat Cards in 2x2 grid
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.55,
          children: [
            _statCard('Listening Time', timeDisplay, '$totalMins total minutes', accent),
            _statCard('Total Tracks Played', '$totalPlays', '${rawTracks.length} unique songs', accent),
            _statCard('Top Artist', topArtistName, topArtistPlays, accent),
            _statCard('Top Song', topTrackTitle, topTrackPlays, accent),
          ],
        ),

        const SizedBox(height: 18),

        // Top Songs Section
        GlassContainer(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Top Songs',
                style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 10),
              if (topTracks.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    'Play some songs to build your top tracks list!',
                    style: TextStyle(color: AppTheme.muted, fontSize: 13),
                  ),
                )
              else
                ...topTracks.take(10).toList().asMap().entries.map((entry) {
                  final i = entry.key;
                  final m = Map<String, dynamic>.from(entry.value.value as Map);
                  final track = topTrackQueue[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 24,
                          child: Text(
                            '${i + 1}',
                            style: TextStyle(
                              color: i == 0
                                  ? const Color(0xFFFBBF24)
                                  : (i == 1
                                      ? const Color(0xFFE5E7EB)
                                      : (i == 2 ? const Color(0xFFD97706) : AppTheme.muted)),
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: track.thumb.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: track.thumb,
                                  cacheManager: ThumbCacheManager(),
                                  width: 40,
                                  height: 40,
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) => Container(width: 40, height: 40, color: AppTheme.bg3),
                                  errorWidget: (_, __, ___) => Container(
                                    width: 40, height: 40, color: AppTheme.bg3,
                                    child: const Icon(Icons.music_note, color: AppTheme.muted, size: 18),
                                  ),
                                )
                              : Container(
                                  width: 40,
                                  height: 40,
                                  color: AppTheme.bg3,
                                  child: const Icon(Icons.music_note, color: AppTheme.muted, size: 18),
                                ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                track.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: AppTheme.text, fontWeight: FontWeight.w600, fontSize: 13.5),
                              ),
                              Text(
                                track.artist,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: AppTheme.muted, fontSize: 11.5),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          '${m['plays'] ?? 0} plays',
                          style: const TextStyle(color: AppTheme.muted, fontSize: 11.5, fontWeight: FontWeight.w600),
                        ),
                        IconButton(
                          icon: Icon(Icons.play_arrow_rounded, color: accent),
                          onPressed: () => player.playTrack(
                            track,
                            queue: topTrackQueue,
                            index: i,
                            contextTitle: 'Top Songs',
                          ),
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Top Artists Section
        GlassContainer(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Top Artists',
                style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 10),
              if (topArtists.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    'Listen to music to see your top artists!',
                    style: TextStyle(color: AppTheme.muted, fontSize: 13),
                  ),
                )
              else
                ...topArtists.take(10).toList().asMap().entries.map((entry) {
                  final i = entry.key;
                  final name = entry.value.key;
                  final m = Map<String, dynamic>.from(entry.value.value as Map);
                  final thumb = _artistThumbs[name] ?? (m['thumb'] as String? ?? '');
                  final secs = (m['seconds'] as num?)?.toInt() ?? 0;
                  final mins = (secs / 60).round();
                  final artistId = m['id'] as String? ?? '';

                  return InkWell(
                    onTap: () => widget.onOpenArtist?.call(artistId, name),
                    borderRadius: BorderRadius.circular(10),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 24,
                            child: Text(
                              '${i + 1}',
                              style: TextStyle(
                                color: i == 0
                                    ? const Color(0xFFFBBF24)
                                    : (i == 1
                                        ? const Color(0xFFE5E7EB)
                                        : (i == 2 ? const Color(0xFFD97706) : AppTheme.muted)),
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                              ),
                            ),
                          ),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: thumb.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: thumb,
                                    cacheManager: ThumbCacheManager(),
                                    width: 40,
                                    height: 40,
                                    fit: BoxFit.cover,
                                    placeholder: (_, __) => CircleAvatar(
                                      radius: 20,
                                      backgroundColor: accent.withValues(alpha: 0.25),
                                    ),
                                    errorWidget: (_, __, ___) => CircleAvatar(
                                      radius: 20,
                                      backgroundColor: accent.withValues(alpha: 0.25),
                                      child: Text(
                                        name.isNotEmpty ? name[0].toUpperCase() : 'A',
                                        style: const TextStyle(color: AppTheme.text, fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  )
                                : CircleAvatar(
                                    radius: 20,
                                    backgroundColor: accent.withValues(alpha: 0.25),
                                    child: Text(
                                      name.isNotEmpty ? name[0].toUpperCase() : 'A',
                                      style: const TextStyle(color: AppTheme.text, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: AppTheme.text, fontWeight: FontWeight.w600, fontSize: 13.5),
                                ),
                                Text(
                                  '$mins minutes listened',
                                  style: const TextStyle(color: AppTheme.muted, fontSize: 11.5),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${m['plays'] ?? 0} plays',
                            style: const TextStyle(color: AppTheme.muted, fontSize: 11.5, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
            ],
          ),
        ),
      ],
    );
  }

  Widget _statCard(String label, String value, String sub, Color accent) {
    return GlassContainer(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: AppTheme.muted,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppTheme.text,
              fontSize: 19,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            sub,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: accent, fontSize: 11.5, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
