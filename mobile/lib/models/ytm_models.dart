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
