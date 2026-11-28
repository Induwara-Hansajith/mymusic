import 'track.dart';

class YtmAlbum {
  final String id;
  final String title;
  final String artist;
  final String? artistId;
  final String thumb;
  final String year;
  final List<Track> tracks;

  const YtmAlbum({
    required this.id,
    required this.title,
    this.artist = '',
    this.artistId,
    this.thumb = '',
    this.year = '',
    this.tracks = const [],
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'artist': artist,
        if (artistId != null) 'artistId': artistId,
        'thumb': thumb,
        'year': year,
      };

  factory YtmAlbum.fromJson(Map<String, dynamic> json) => YtmAlbum(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? 'Album',
        artist: json['artist'] as String? ?? '',
        artistId: json['artistId'] as String?,
        thumb: json['thumb'] as String? ?? '',
        year: json['year'] as String? ?? '',
      );
}

class YtmArtist {
  final String id;
  final String name;
  final String thumb;
  final List<Track> songs;
  final List<YtmAlbum> albums;
  final List<YtmAlbum> singles;
  final List<Track> videos;
  final List<YtmPlaylistRef> playlists;

  const YtmArtist({
    required this.id,
    required this.name,
    this.thumb = '',
    this.songs = const [],
    this.albums = const [],
    this.singles = const [],
    this.videos = const [],
    this.playlists = const [],
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'thumb': thumb,
      };

  factory YtmArtist.fromJson(Map<String, dynamic> json) => YtmArtist(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? 'Artist',
        thumb: json['thumb'] as String? ?? '',
      );
}

class YtmPlaylistRef {
  final String id;
  final String title;
  final String owner;
  final String thumb;
  final List<Track> tracks;

  const YtmPlaylistRef({
    required this.id,
    required this.title,
    this.owner = '',
    this.thumb = '',
    this.tracks = const [],
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'owner': owner,
        'thumb': thumb,
      };

  factory YtmPlaylistRef.fromJson(Map<String, dynamic> json) => YtmPlaylistRef(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? 'Playlist',
        owner: json['owner'] as String? ?? '',
        thumb: json['thumb'] as String? ?? '',
      );
}

class YtmHomeShelf {
  final String title;
  final List<Track> songs;
  final List<Track> videos;
  final List<YtmAlbum> albums;
  final List<YtmArtist> artists;
  final List<YtmPlaylistRef> playlists;

  const YtmHomeShelf({
    required this.title,
    this.songs = const [],
    this.videos = const [],
    this.albums = const [],
    this.artists = const [],
    this.playlists = const [],
  });

  bool get isEmpty =>
      songs.isEmpty &&
      videos.isEmpty &&
      albums.isEmpty &&
      artists.isEmpty &&
      playlists.isEmpty;

  Map<String, dynamic> toJson() => {
        'title': title,
        'songs': songs.map((t) => t.toJson()).toList(),
        'videos': videos.map((t) => t.toJson()).toList(),
        'albums': albums.map((a) => a.toJson()).toList(),
        'artists': artists.map((a) => a.toJson()).toList(),
        'playlists': playlists.map((p) => p.toJson()).toList(),
      };

  factory YtmHomeShelf.fromJson(Map<String, dynamic> json) => YtmHomeShelf(
        title: json['title'] as String? ?? 'For you',
        songs: (json['songs'] as List? ?? [])
            .whereType<Map>()
            .map((m) => Track.fromJson(Map<String, dynamic>.from(m)))
            .where((t) => t.id.isNotEmpty)
            .toList(),
        videos: (json['videos'] as List? ?? [])
            .whereType<Map>()
            .map((m) => Track.fromJson(Map<String, dynamic>.from(m)))
            .where((t) => t.id.isNotEmpty)
            .toList(),
        albums: (json['albums'] as List? ?? [])
            .whereType<Map>()
            .map((m) => YtmAlbum.fromJson(Map<String, dynamic>.from(m)))
            .where((a) => a.id.isNotEmpty)
            .toList(),
        artists: (json['artists'] as List? ?? [])
            .whereType<Map>()
            .map((m) => YtmArtist.fromJson(Map<String, dynamic>.from(m)))
            .where((a) => a.id.isNotEmpty)
            .toList(),
        playlists: (json['playlists'] as List? ?? [])
            .whereType<Map>()
            .map((m) => YtmPlaylistRef.fromJson(Map<String, dynamic>.from(m)))
            .where((p) => p.id.isNotEmpty)
            .toList(),
      );
}

class YtmSearchResult {
  final List<Track> songs;
  final List<Track> videos;
  final List<YtmAlbum> albums;
  final List<YtmArtist> artists;
  final List<YtmPlaylistRef> playlists;

  const YtmSearchResult({
    this.songs = const [],
    this.videos = const [],
    this.albums = const [],
    this.artists = const [],
    this.playlists = const [],
  });
}
