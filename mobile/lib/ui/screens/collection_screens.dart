import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/player_provider.dart';
import '../../providers/theme_provider.dart';
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
    final accent = context.watch<ThemeProvider>().accent;
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
          extraActions: [
            if (list.isNotEmpty)
              ListenableBuilder(
                listenable: DownloadService(),
                builder: (_, _) {
                  final dl = DownloadService();
                  final pendingCount = list.where((t) => !dl.isDownloaded(t.id)).length;
                  final isBusy = list.any((t) => dl.isDownloading(t.id));
                  if (pendingCount == 0) {
                    return OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: const Color(0xFF34D399).withValues(alpha: 0.4)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                      ),
                      icon: const Icon(Icons.download_done_rounded, color: Color(0xFF34D399), size: 16),
                      label: const Text('All Offline', style: TextStyle(color: Color(0xFF34D399), fontSize: 12)),
                      onPressed: null,
                    );
                  }
                  return OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: accent.withValues(alpha: 0.5)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    icon: Icon(
                      isBusy ? Icons.downloading_rounded : Icons.download_for_offline_outlined,
                      color: accent,
                      size: 16,
                    ),
                    label: Text(
                      isBusy ? 'Downloading...' : 'Download All ($pendingCount)',
                      style: TextStyle(color: accent, fontSize: 12),
                    ),
                    onPressed: isBusy
                        ? null
                        : () {
                            dl.enqueueTracks(list);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Queued $pendingCount songs for background download'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                  );
                },
              ),
          ],
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
    final accent = context.watch<ThemeProvider>().accent;
    final list = library.downloaded;

    return ListenableBuilder(
      listenable: DownloadService(),
      builder: (_, _) {
        final dl = DownloadService();
        final active = dl.activeTracks;

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
                    active.isNotEmpty
                        ? '${active.length} downloading in background · ${list.length} offline track${list.length == 1 ? '' : 's'}'
                        : (list.isEmpty
                            ? 'Offline tracks saved on device'
                            : '${list.length} offline track${list.length == 1 ? '' : 's'} ready to play without internet'),
                    style: const TextStyle(color: AppTheme.muted, fontSize: 13),
                  ),
                ],
              ),
            ),
            if (active.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.only(bottom: 8),
                child: Text(
                  'BACKGROUND QUEUE',
                  style: TextStyle(
                    color: AppTheme.muted,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.0,
                  ),
                ),
              ),
              ...active.map((t) {
                final pct = (dl.progressFor(t.id) * 100).round();
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppTheme.panelCard,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.glassBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  t.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: AppTheme.text,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13.5,
                                  ),
                                ),
                                Text(
                                  '${t.artist} · ${pct > 0 ? "$pct%" : "Queued..."}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: AppTheme.muted, fontSize: 11.5),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                            padding: EdgeInsets.zero,
                            icon: const Icon(Icons.close_rounded, color: AppTheme.muted, size: 18),
                            onPressed: () => dl.cancelDownload(t.id),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: pct > 0 ? dl.progressFor(t.id) : null,
                          minHeight: 3.5,
                          backgroundColor: AppTheme.bg3,
                          color: accent,
                        ),
                      ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 12),
            ],
            if (list.isEmpty && active.isEmpty)
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
                      'Tap the (⋯) menu on any song and choose “Download offline” or tap Download All in Liked Songs & Playlists. Transfers continue reliably in the background.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.muted, fontSize: 13, height: 1.45),
                    ),
                  ],
                ),
              )
            else if (list.isNotEmpty)
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
      },
    );
  }
}
