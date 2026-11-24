class Track {
  final String id;
  final String title;
  final String artist;
  final int durationSec;
  final String thumb;
  final String? localPath;
  final String? album;

  const Track({
    required this.id,
    required this.title,
    required this.artist,
    required this.durationSec,
    required this.thumb,
    this.localPath,
    this.album,
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
        'durationSec': durationSec,
        'thumb': thumb,
        'localPath': localPath,
        'album': album,
      };

  factory Track.fromJson(Map<String, dynamic> json) => Track(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? 'Unknown Title',
        artist: json['artist'] as String? ?? 'Unknown Artist',
        durationSec: json['durationSec'] as int? ??
            (json['duration'] as int? ?? 180),
        thumb: json['thumb'] as String? ??
            (json['artworkUrl'] as String? ?? ''),
        localPath: json['localPath'] as String?,
        album: json['album'] as String?,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Track && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
