import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../services/storage_service.dart';
import '../ui/theme.dart';

class ThemeProvider extends ChangeNotifier {
  final StorageService _storage = StorageService();
  final Map<String, List<double>> _paletteCache = {};

  double _hue = 258.0;
  double _secondaryHue = 298.0;
  dynamic _accentHueSetting = 'auto';
  bool _ambientColors = true;
  String _wallpaper = '';
  double _wallpaperDim = 60.0;
  String _lyricsStyle = 'random';
  String _viz = 'liquid';
  String _fsViz = 'stardust';

  ThemeProvider() {
    load();
  }

  double get hue => _hue;
  double get secondaryHue => _secondaryHue;
  dynamic get accentHueSetting => _accentHueSetting;
  bool get ambientColors => _ambientColors;
  String get wallpaper => _wallpaper;
  double get wallpaperDim => _wallpaperDim;
  String get lyricsStyle => _lyricsStyle;
  String get viz => _viz;
  String get fsViz => _fsViz;

  Color get accent => AppTheme.accentFromHue(_hue);
  Color get accentLight => AppTheme.accentLightFromHue(_hue);
  Color get accentDark => AppTheme.accentDarkFromHue(_hue);
  Color get accent2 => AppTheme.accentFromHue(_secondaryHue);

  void load() {
    final s = _storage.getSettingsMap();
    _accentHueSetting = s['accentHue'] ?? 'auto';
    _ambientColors = s['ambientColors'] != false;
    _wallpaper = s['wallpaper'] as String? ?? '';
    _wallpaperDim = (s['wallpaperDim'] as num?)?.toDouble() ?? 60.0;
    _lyricsStyle = s['lyricsStyle'] as String? ?? 'random';
    _viz = s['viz'] as String? ?? 'liquid';
    _fsViz = s['fsViz'] as String? ?? 'stardust';

    if (_accentHueSetting != 'auto' && _accentHueSetting is num) {
      _hue = (_accentHueSetting as num).toDouble().clamp(0, 360);
      _secondaryHue = (_hue + 40) % 360;
    } else {
      _hue = 258.0;
      _secondaryHue = 298.0;
    }
    notifyListeners();
  }

  Future<void> setWallpaper(String url) async {
    _wallpaper = url;
    await _storage.patchSettings({'wallpaper': url});
    notifyListeners();
  }

  Future<void> setWallpaperDim(double dim) async {
    _wallpaperDim = dim.clamp(0.0, 90.0);
    await _storage.patchSettings({'wallpaperDim': _wallpaperDim});
    notifyListeners();
  }

  Future<void> setAmbientColors(bool on) async {
    _ambientColors = on;
    if (on) {
      _accentHueSetting = 'auto';
    }
    await _storage.patchSettings({
      'ambientColors': on,
      'accentHue': _accentHueSetting,
    });
    if (!on) {
      _hue = 258.0;
      _secondaryHue = 298.0;
    }
    notifyListeners();
  }

  Future<void> setAccentHue(dynamic hueVal) async {
    if (hueVal == 'auto') {
      _accentHueSetting = 'auto';
      _ambientColors = true;
      await _storage.patchSettings({'accentHue': 'auto', 'ambientColors': true});
    } else {
      final numHue = (hueVal is num ? hueVal.toDouble() : double.tryParse('$hueVal') ?? 258.0)
          .clamp(0.0, 360.0);
      _accentHueSetting = numHue.round();
      _ambientColors = false;
      _hue = numHue;
      _secondaryHue = (numHue + 40) % 360;
      await _storage.patchSettings({
        'accentHue': _accentHueSetting,
        'ambientColors': false,
      });
    }
    notifyListeners();
  }

  Future<void> setLyricsStyle(String style) async {
    _lyricsStyle = style;
    await _storage.patchSettings({'lyricsStyle': style});
    notifyListeners();
  }

  Future<void> setViz(String v) async {
    _viz = v;
    await _storage.patchSettings({'viz': v});
    notifyListeners();
  }

  Future<void> setFsViz(String v) async {
    _fsViz = v;
    await _storage.patchSettings({'fsViz': v});
    notifyListeners();
  }

  /// Mirrors desktop `extractPaletteFromUrl` + `applyAccent`:
  /// samples pixels of album cover artwork and shifts the UI hue & aurora orbs.
  Future<void> applyAccentFromThumb(String? thumbUrl) async {
    if (!_ambientColors || _accentHueSetting != 'auto') return;
    if (thumbUrl == null || thumbUrl.isEmpty) {
      _hue = 258.0;
      _secondaryHue = 298.0;
      notifyListeners();
      return;
    }

    if (_paletteCache.containsKey(thumbUrl)) {
      final cached = _paletteCache[thumbUrl]!;
      _hue = cached[0];
      _secondaryHue = cached[1];
      notifyListeners();
      return;
    }

    try {
      final resp = await http
          .get(Uri.parse(thumbUrl))
          .timeout(const Duration(seconds: 5));
      if (resp.statusCode != 200 || resp.bodyBytes.isEmpty) return;

      final codec = await ui.instantiateImageCodec(
        resp.bodyBytes,
        targetWidth: 24,
        targetHeight: 24,
      );
      final frame = await codec.getNextFrame();
      final bd = await frame.image.toByteData(format: ui.ImageByteFormat.rawRgba);
      frame.image.dispose();
      if (bd == null) return;

      final bytes = bd.buffer.asUint8List();
      final bins = List<double>.filled(36, 0.0);
      for (int i = 0; i + 3 < bytes.length; i += 4) {
        final r = bytes[i] / 255.0;
        final g = bytes[i + 1] / 255.0;
        final b = bytes[i + 2] / 255.0;
        final maxC = math.max(r, math.max(g, b));
        final minC = math.min(r, math.min(g, b));
        final d = maxC - minC;
        if (d < 0.12 || maxC < 0.12 || minC > 0.92) continue;

        double h;
        if (maxC == r) {
          h = ((g - b) / d) % 6;
        } else if (maxC == g) {
          h = (b - r) / d + 2;
        } else {
          h = (r - g) / d + 4;
        }
        h = (h * 60 + 360) % 360;
        final sat = d / (maxC == 0 ? 1 : maxC);
        final bin = ((h / 10).floor()) % 36;
        bins[bin] += sat * maxC;
      }

      int bestBin = 0;
      double bestScore = -1;
      for (int b = 0; b < 36; b++) {
        if (bins[b] > bestScore) {
          bestScore = bins[b];
          bestBin = b;
        }
      }

      if (bestScore > 0) {
        final primary = bestBin * 10.0 + 5.0;
        int secBin = bestBin;
        double secScore = -1;
        for (int b = 0; b < 36; b++) {
          final dist = math.min((b - bestBin).abs(), 36 - (b - bestBin).abs());
          if (dist >= 4 && bins[b] > secScore) {
            secScore = bins[b];
            secBin = b;
          }
        }
        final sec = secScore > 0 ? secBin * 10.0 + 5.0 : (primary + 42.0) % 360;
        _paletteCache[thumbUrl] = [primary, sec];
        _hue = primary;
        _secondaryHue = sec;
        notifyListeners();
      }
    } catch (_) {}
  }
}
