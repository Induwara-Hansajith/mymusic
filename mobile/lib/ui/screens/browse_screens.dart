import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/ytm_models.dart';
import '../../providers/player_provider.dart';
import '../../services/youtube_service.dart';
import '../theme.dart';
import '../widgets/desktop_widgets.dart';
import '../widgets/track_tile.dart';

class AlbumDetailView extends StatefulWidget {
  final String albumId;
  final void Function(String albumId) onOpenAlbum;
  final void Function(String artistId, String artistName) onOpenArtist;

  const AlbumDetailView({
    super.key,
    required this.albumId,
    required this.onOpenAlbum,
    required this.onOpenArtist,
  });

  @override
  State<AlbumDetailView> createState() => _AlbumDetailViewState();
}

class _AlbumDetailViewState extends State<AlbumDetailView> {
  YtmAlbum? _album;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant AlbumDetailView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.albumId != widget.albumId) _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await YoutubeService().getAlbum(widget.albumId);
    if (mounted) {
      setState(() {
        _album = res;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(40),
          child: CircularProgressIndicator(),
        ),
      );
    }
    final a = _album;
    if (a == null) {
      return const Center(
        child: Text('Could not load album.', style: TextStyle(color: AppTheme.muted)),
      );
    }
    final player = context.read<PlayerProvider>();
    final n = a.tracks.length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 120),
      children: [
        DesktopContextHeader(
          type: 'Album',
          title: a.title,
          subtitle:
              '${a.artist}${a.year.isNotEmpty ? ' • ${a.year}' : ''} • $n song${n == 1 ? '' : 's'}',
          thumb: a.thumb,
          onPlayAll: a.tracks.isEmpty
              ? null
              : () => player.playTrack(
                    a.tracks.first,
                    queue: a.tracks,
                    index: 0,
                    contextTitle: a.title,
                  ),
        ),
        const SizedBox(height: 6),
        ...a.tracks.asMap().entries.map((e) => TrackTile(
              track: e.value,
              index: e.key,
              onOpenAlbum: widget.onOpenAlbum,
              onOpenArtist: widget.onOpenArtist,
              onTap: () => player.playTrack(
                e.value,
                queue: a.tracks,
                index: e.key,
                contextTitle: a.title,
              ),
            )),
      ],
    );
  }
}

class ArtistDetailView extends StatefulWidget {
  final String artistId;
  final String? fallbackName;
  final void Function(String albumId) onOpenAlbum;
  final void Function(String artistId, String artistName) onOpenArtist;
  final void Function(String playlistId) onOpenYtPlaylist;

  const ArtistDetailView({
    super.key,
    required this.artistId,
    this.fallbackName,
    required this.onOpenAlbum,
    required this.onOpenArtist,
    required this.onOpenYtPlaylist,
  });

  @override
  State<ArtistDetailView> createState() => _ArtistDetailViewState();
}

class _ArtistDetailViewState extends State<ArtistDetailView> {
  YtmArtist? _artist;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ArtistDetailView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.artistId != widget.artistId || oldWidget.fallbackName != widget.fallbackName) {
      _load();
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final yt = YoutubeService();
    String id = widget.artistId;
    if (id.isEmpty && (widget.fallbackName ?? '').isNotEmpty) {
      final s = await yt.searchYtm(widget.fallbackName!, 'artists');
      if (s.artists.isNotEmpty) id = s.artists.first.id;
    }
    YtmArtist? res;
    if (id.isNotEmpty) {
      res = await yt.getArtist(id);
    }
    if (mounted) {
      setState(() {
        _artist = res;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(40),
          child: CircularProgressIndicator(),
        ),
      );
    }
    final a = _artist;
    if (a == null) {
      return const Center(
        child: Text('Could not load artist.', style: TextStyle(color: AppTheme.muted)),
      );
    }
    final player = context.read<PlayerProvider>();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 120),
      children: [
        DesktopContextHeader(
          type: 'Artist',
          title: a.name,
          subtitle: '${a.songs.length} top songs',
          thumb: a.thumb,
          roundThumb: true,
          onPlayAll: a.songs.isEmpty
              ? null
              : () => player.playTrack(
                    a.songs.first,
                    queue: a.songs,
                    index: 0,
                    contextTitle: a.name,
                  ),
        ),
        if (a.songs.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Text('Songs', style: TextStyle(color: AppTheme.text, fontSize: 17, fontWeight: FontWeight.bold)),
          ),
          ...a.songs.asMap().entries.map((e) => TrackTile(
                track: e.value,
                index: e.key,
                onOpenAlbum: widget.onOpenAlbum,
                onOpenArtist: widget.onOpenArtist,
                onTap: () => player.playTrack(
                  e.value,
                  queue: a.songs,
                  index: e.key,
                  contextTitle: a.name,
                ),
              )),
        ],
        if (a.albums.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.only(top: 18, bottom: 10),
            child: Text('Albums', style: TextStyle(color: AppTheme.text, fontSize: 17, fontWeight: FontWeight.bold)),
          ),
          SizedBox(
            height: 204,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: a.albums.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, i) {
                final al = a.albums[i];
                return DesktopMediaCard(
                  title: al.title,
                  subtitle: al.year.isNotEmpty ? al.year : 'Album',
                  thumb: al.thumb,
                  onTap: () => widget.onOpenAlbum(al.id),
                );
              },
            ),
          ),
        ],
        if (a.singles.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.only(top: 18, bottom: 10),
            child: Text('Singles', style: TextStyle(color: AppTheme.text, fontSize: 17, fontWeight: FontWeight.bold)),
          ),
          SizedBox(
            height: 204,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: a.singles.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, i) {
                final al = a.singles[i];
                return DesktopMediaCard(
                  title: al.title,
                  subtitle: 'Single',
                  thumb: al.thumb,
                  onTap: () => widget.onOpenAlbum(al.id),
                );
              },
            ),
          ),
        ],
        if (a.videos.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.only(top: 18, bottom: 10),
            child: Text('Videos', style: TextStyle(color: AppTheme.text, fontSize: 17, fontWeight: FontWeight.bold)),
          ),
          ...a.videos.asMap().entries.map((e) => TrackTile(
                track: e.value,
                index: e.key,
                onOpenAlbum: widget.onOpenAlbum,
                onOpenArtist: widget.onOpenArtist,
                onTap: () => player.playTrack(
                  e.value,
                  queue: a.videos,
                  index: e.key,
                  contextTitle: a.name,
                ),
              )),
        ],
      ],
    );
  }
}

class YtPlaylistDetailView extends StatefulWidget {
  final String playlistId;
  final void Function(String albumId) onOpenAlbum;
  final void Function(String artistId, String artistName) onOpenArtist;

  const YtPlaylistDetailView({
    super.key,
    required this.playlistId,
    required this.onOpenAlbum,
    required this.onOpenArtist,
  });

  @override
  State<YtPlaylistDetailView> createState() => _YtPlaylistDetailViewState();
}

class _YtPlaylistDetailViewState extends State<YtPlaylistDetailView> {
  YtmPlaylistRef? _pl;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant YtPlaylistDetailView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.playlistId != widget.playlistId) _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await YoutubeService().getYtPlaylist(widget.playlistId);
    if (mounted) {
      setState(() {
        _pl = res;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(40),
          child: CircularProgressIndicator(),
        ),
      );
    }
    final p = _pl;
    if (p == null) {
      return const Center(
        child: Text('Could not load playlist.', style: TextStyle(color: AppTheme.muted)),
      );
    }
    final player = context.read<PlayerProvider>();
    final n = p.tracks.length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 120),
      children: [
        DesktopContextHeader(
          type: 'Playlist',
          title: p.title,
          subtitle: '${p.owner.isNotEmpty ? '${p.owner} • ' : ''}$n song${n == 1 ? '' : 's'}',
          thumb: p.thumb,
          onPlayAll: p.tracks.isEmpty
              ? null
              : () => player.playTrack(
                    p.tracks.first,
                    queue: p.tracks,
                    index: 0,
                    contextTitle: p.title,
                  ),
        ),
        const SizedBox(height: 6),
        ...p.tracks.asMap().entries.map((e) => TrackTile(
              track: e.value,
              index: e.key,
              onOpenAlbum: widget.onOpenAlbum,
              onOpenArtist: widget.onOpenArtist,
              onTap: () => player.playTrack(
                e.value,
                queue: p.tracks,
                index: e.key,
                contextTitle: p.title,
              ),
            )),
      ],
    );
  }
}
