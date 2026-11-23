class LyricLine {
  final double timeSec;
  final String text;

  const LyricLine({required this.timeSec, required this.text});

  factory LyricLine.fromJson(Map<String, dynamic> json) => LyricLine(
        timeSec: (json['t'] as num? ?? 0.0).toDouble(),
        text: json['text'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        't': timeSec,
        'text': text,
      };
}

class LyricsData {
  final List<LyricLine> synced;
  final String? plain;

  const LyricsData({this.synced = const [], this.plain});

  bool get isEmpty => synced.isEmpty && (plain == null || plain!.trim().isEmpty);
}
