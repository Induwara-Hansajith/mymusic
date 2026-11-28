class Track {
  final String id;
  final String title;
  final String artist;
  final String? artistId;
  final int durationSec;
  final String thumb;
  final String? localPath;
  final String? album;
  final String? albumId;
  final String type; // 'song' | 'video'

  const Track({
    required this.id,
    required this.title,
    required this.artist,
    this.artistId,
    required this.durationSec,
    required this.thumb,
    this.localPath,
    this.album,
    this.albumId,
    this.type = 'song',
  });

  String get cleanId => id.startsWith('yt:') ? id.substring(3) : id;

  String get durationFormatted {
    final m = durationSec ~/ 60;
    final s = durationSec % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'artist': artist,
        if (artistId != null) 'artistId': artistId,
        'durationSec': durationSec,
        'duration': durationSec,
        'thumb': thumb,
        if (localPath != null) 'localPath': localPath,
        if (album != null) 'album': album,
        if (albumId != null) 'albumId': albumId,
        'type': type,
      };

  factory Track.fromJson(Map<String, dynamic> json) {
    final rawDur = json['durationSec'] ?? json['duration'];
    final parsedDur = rawDur is num ? rawDur.round() : int.tryParse('$rawDur') ?? 0;
    return Track(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Unknown Title',
      artist: json['artist'] as String? ?? 'Unknown Artist',
      artistId: json['artistId'] as String?,
      durationSec: parsedDur > 0 ? parsedDur : 180,
      thumb: json['thumb'] as String? ??
          (json['artworkUrl'] as String? ?? ''),
      localPath: json['localPath'] as String?,
      album: json['album'] as String?,
      albumId: json['albumId'] as String?,
      type: json['type'] as String? ?? 'song',
    );
  }

  Track copyWith({
    String? id,
    String? title,
    String? artist,
    String? artistId,
    int? durationSec,
    String? thumb,
    String? localPath,
    String? album,
    String? albumId,
    String? type,
  }) =>
      Track(
        id: id ?? this.id,
        title: title ?? this.title,
        artist: artist ?? this.artist,
        artistId: artistId ?? this.artistId,
        durationSec: durationSec ?? this.durationSec,
        thumb: thumb ?? this.thumb,
        localPath: localPath ?? this.localPath,
        album: album ?? this.album,
        albumId: albumId ?? this.albumId,
        type: type ?? this.type,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Track && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
