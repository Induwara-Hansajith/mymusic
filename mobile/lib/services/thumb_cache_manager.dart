import 'package:flutter_cache_manager/flutter_cache_manager.dart';

/// A [CacheManager] that sends a browser-like User-Agent when fetching
/// thumbnails from YouTube / Google CDN endpoints, avoiding the 403 responses
/// those servers return for the default Dart `dart:io` user-agent string.
class ThumbCacheManager extends CacheManager with ImageCacheManager {
  static const key = 'thumbCache';

  static final ThumbCacheManager _instance = ThumbCacheManager._();
  factory ThumbCacheManager() => _instance;

  ThumbCacheManager._()
      : super(
          Config(
            key,
            stalePeriod: const Duration(days: 7),
            maxNrOfCacheObjects: 500,
            fileService: _BrowserHeaderFileService(),
          ),
        );
}

/// [FileService] that adds a browser-like `User-Agent` header to every request
/// so YouTube CDN and Google image servers don't block Dart's default UA.
class _BrowserHeaderFileService extends HttpFileService {
  static const _ua =
      'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36';

  @override
  Future<FileServiceResponse> get(
    String url, {
    Map<String, String>? headers,
  }) {
    final merged = {
      'User-Agent': _ua,
      'Referer': 'https://music.youtube.com/',
      ...?headers,
    };
    return super.get(url, headers: merged);
  }
}
