import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/player_provider.dart';
import '../../services/download_service.dart';
import '../theme.dart';
import '../widgets/desktop_widgets.dart';
import '../widgets/track_tile.dart';

class LikedSongsView extends StatelessWidget {
  final void Function(String albumId) onOpenAlbum;
  final void Function(String artistId, String artistName) onOpenArtist;

  const LikedSongsView({
    super.key,
    required this.onOpenAlbum,
    required this.onOpenArtist,
  });

  @override
  Widget build(BuildContext context) {
    final library = context.watch<LibraryProvider>();
    final player = context.read<PlayerProvider>();
    final list = library.favorites;
    final n = list.length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 120),
      children: [
        DesktopContextHeader(
          type: 'Playlist',
          title: 'Liked Songs',
          subtitle: '$n song${n == 1 ? '' : 's'} you liked',
          thumb: list.isNotEmpty ? list.first.thumb : null,
          onPlayAll: list.isEmpty
              ? null
              : () => player.playTrack(
                    list.first,
                    queue: list,
                    index: 0,
                    contextTitle: 'Liked Songs',
                  ),
        ),
        if (list.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 28),
            child: Text(
              'Tap the heart on any song to like it.',
              style: TextStyle(color: AppTheme.muted, fontSize: 13.5),
            ),
          )
        else
          ...list.asMap().entries.map((e) => TrackTile(
                track: e.value,
                index: e.key,
                onOpenAlbum: onOpenAlbum,
                onOpenArtist: onOpenArtist,
                onTap: () => player.playTrack(
                  e.value,
                  queue: list,
                  index: e.key,
                  contextTitle: 'Liked Songs',
                ),
              )),
      ],
    );
  }
}

class RecentlyPlayedView extends StatelessWidget {
  final void Function(String albumId) onOpenAlbum;
  final void Function(String artistId, String artistName) onOpenArtist;

  const RecentlyPlayedView({
    super.key,
    required this.onOpenAlbum,
    required this.onOpenArtist,
  });

  @override
  Widget build(BuildContext context) {
    final library = context.watch<LibraryProvider>();
    final player = context.read<PlayerProvider>();
    final list = library.recentTracks;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 120),
      children: [
        DesktopContextHeader(
          type: 'History',
          title: 'Recently Played',
          subtitle: '${list.length} track${list.length == 1 ? '' : 's'}',
          thumb: list.isNotEmpty ? list.first.thumb : null,
          onPlayAll: list.isEmpty
              ? null
              : () => player.playTrack(
                    list.first,
                    queue: list,
                    index: 0,
                    contextTitle: 'Recently Played',
                  ),
          extraActions: [
            if (list.isNotEmpty)
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.glassBorder),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                icon: const Icon(Icons.delete_sweep_outlined, color: AppTheme.muted, size: 17),
                label: const Text('Clear', style: TextStyle(color: AppTheme.muted, fontSize: 12.5)),
                onPressed: () => library.clearHistory(),
              ),
          ],
        ),
        if (list.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 28),
            child: Text(
              'Songs you play will show up here.',
              style: TextStyle(color: AppTheme.muted, fontSize: 13.5),
            ),
          )
        else
          ...list.asMap().entries.map((e) => TrackTile(
                track: e.value,
                index: e.key,
                onOpenAlbum: onOpenAlbum,
                onOpenArtist: onOpenArtist,
                onTap: () => player.playTrack(
                  e.value,
                  queue: list,
                  index: e.key,
                  contextTitle: 'Recently Played',
                ),
              )),
      ],
    );
  }
}

class DownloadsView extends StatelessWidget {
  final void Function(String albumId) onOpenAlbum;
  final void Function(String artistId, String artistName) onOpenArtist;

  const DownloadsView({
    super.key,
    required this.onOpenAlbum,
    required this.onOpenArtist,
  });

  @override
  Widget build(BuildContext context) {
    final library = context.watch<LibraryProvider>();
    final player = context.read<PlayerProvider>();
    final list = library.downloaded;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 120),
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Downloads',
                style: TextStyle(
                  color: AppTheme.text,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                list.isEmpty
                    ? 'Offline tracks saved on device'
                    : '${list.length} offline track${list.length == 1 ? '' : 's'} ready to play without internet',
                style: const TextStyle(color: AppTheme.muted, fontSize: 13),
              ),
            ],
          ),
        ),
        if (list.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 38),
            child: Column(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: const BoxDecoration(
                    color: AppTheme.bg3,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.download_rounded, color: AppTheme.muted, size: 28),
                ),
                const SizedBox(height: 14),
                const Text(
                  'No offline downloads yet',
                  style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Tap the (⋯) menu on any song and choose “Download offline” to save high-quality audio files for offline playback.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.muted, fontSize: 13, height: 1.45),
                ),
              ],
            ),
          )
        else
          ...list.asMap().entries.map((e) => Row(
                children: [
                  Expanded(
                    child: TrackTile(
                      track: e.value,
                      index: e.key,
                      showOfflineTag: true,
                      onOpenAlbum: onOpenAlbum,
                      onOpenArtist: onOpenArtist,
                      onTap: () => player.playTrack(
                        e.value,
                        queue: list,
                        index: e.key,
                        contextTitle: 'Downloads',
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 20),
                    onPressed: () async {
                      await DownloadService().deleteDownload(e.value.id);
                      if (context.mounted) library.refreshDownloaded();
                    },
                  ),
                ],
              )),
      ],
    );
  }
}
