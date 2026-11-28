import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/thumb_cache_manager.dart';
import '../theme.dart';

/// A drop-in replacement for every thumbnail [CachedNetworkImage] in the app.
/// Automatically:
/// - Uses [ThumbCacheManager] (browser User-Agent + Referer header to avoid CDN 403s)
/// - Shows a [AppTheme.bg3] placeholder while loading
/// - Falls back to a music-note icon on error
/// - Shows a person icon when [round] is true (artist avatars)
class ThumbImage extends StatelessWidget {
  final String url;
  final double size;
  final double? width;
  final double? height;
  final BoxFit fit;
  final bool round;
  final double borderRadius;
  final IconData fallbackIcon;

  const ThumbImage({
    super.key,
    required this.url,
    this.size = 44,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.round = false,
    this.borderRadius = 8,
    this.fallbackIcon = Icons.music_note_rounded,
  });

  @override
  Widget build(BuildContext context) {
    final w = width ?? size;
    final h = height ?? size;

    if (url.isEmpty) {
      return _fallback(w, h);
    }

    return CachedNetworkImage(
      imageUrl: url,
      cacheManager: ThumbCacheManager(),
      width: w,
      height: h,
      fit: fit,
      placeholder: (_, __) => Container(width: w, height: h, color: AppTheme.bg3),
      errorWidget: (_, __, ___) => _fallback(w, h),
    );
  }

  Widget _fallback(double w, double h) => Container(
        width: w,
        height: h,
        color: AppTheme.bg3,
        child: Icon(fallbackIcon, color: AppTheme.muted, size: (w * 0.44).clamp(16, 48)),
      );
}
