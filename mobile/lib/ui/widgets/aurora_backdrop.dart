import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../services/thumb_cache_manager.dart';
import '../../providers/theme_provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/player_provider.dart';
import '../theme.dart';

class AuroraBackdrop extends StatefulWidget {
  final Widget child;
  const AuroraBackdrop({super.key, required this.child});

  @override
  State<AuroraBackdrop> createState() => _AuroraBackdropState();
}

class _AuroraBackdropState extends State<AuroraBackdrop>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 16),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>();
    final lowRes = context.select<LibraryProvider, bool>((l) => l.lowResourceMode);
    final isPlaying = context.select<PlayerProvider, bool>((p) => p.isPlaying);

    if (lowRes && _ctrl.isAnimating) {
      _ctrl.stop();
    } else if (!lowRes && !_ctrl.isAnimating) {
      _ctrl.repeat();
    }

    final brightness = (1.0 - (theme.wallpaperDim / 100.0)).clamp(0.05, 1.0);

    return Stack(
      children: [
        // Base midnight obsidian canvas
        Container(color: AppTheme.bg),

        // Custom / Preset Wallpaper with Desktop dim overlay
        if (theme.wallpaper.isNotEmpty)
          Positioned.fill(
            child: Opacity(
              opacity: brightness,
              child: CachedNetworkImage(
                imageUrl: theme.wallpaper,
                cacheManager: ThumbCacheManager(),
                fit: BoxFit.cover,
                placeholder: (_, __) => const SizedBox.shrink(),
                errorWidget: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          ),

        // Ambient Aurora Orbs reacting to current album hue
        if (!lowRes)
          Positioned.fill(
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _ctrl,
                builder: (ctx, _) {
                  final t = _ctrl.value * 2 * math.pi;
                  final pulse = isPlaying ? 0.22 : 0.14;
                  return CustomPaint(
                    painter: _AuroraPainter(
                      t: t,
                      c1: theme.accent.withValues(alpha: pulse),
                      c2: theme.accent2.withValues(alpha: pulse * 0.85),
                    ),
                  );
                },
              ),
            ),
          ),

        // Dark readability vignette over wallpaper/aurora
        Positioned.fill(
          child: IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppTheme.bg.withValues(alpha: theme.wallpaper.isNotEmpty ? 0.45 : 0.2),
                    AppTheme.bg.withValues(alpha: theme.wallpaper.isNotEmpty ? 0.65 : 0.45),
                  ],
                ),
              ),
            ),
          ),
        ),

        widget.child,
      ],
    );
  }
}

class _AuroraPainter extends CustomPainter {
  final double t;
  final Color c1;
  final Color c2;

  const _AuroraPainter({required this.t, required this.c1, required this.c2});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    if (w <= 0 || h <= 0) return;

    final p1 = Offset(
      w * (0.25 + 0.12 * math.sin(t)),
      h * (0.18 + 0.08 * math.cos(t * 0.8)),
    );
    final p2 = Offset(
      w * (0.78 + 0.1 * math.cos(t * 0.7)),
      h * (0.55 + 0.1 * math.sin(t * 1.1)),
    );

    final paint1 = Paint()
      ..shader = RadialGradient(
        colors: [c1, c1.withValues(alpha: 0)],
      ).createShader(Rect.fromCircle(center: p1, radius: w * 0.65));

    final paint2 = Paint()
      ..shader = RadialGradient(
        colors: [c2, c2.withValues(alpha: 0)],
      ).createShader(Rect.fromCircle(center: p2, radius: w * 0.6));

    canvas.drawCircle(p1, w * 0.65, paint1);
    canvas.drawCircle(p2, w * 0.6, paint2);
  }

  @override
  bool shouldRepaint(covariant _AuroraPainter old) =>
      old.t != t || old.c1 != c1 || old.c2 != c2;
}
