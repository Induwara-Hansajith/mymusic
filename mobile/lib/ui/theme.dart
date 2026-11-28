import 'package:flutter/material.dart';

class AppTheme {
  // Desktop CSS root variables matched 1:1
  static const Color bg = Color(0xFF07090E);
  static const Color bg2 = Color(0xFF0D1017);
  static const Color bg3 = Color(0x13FFFFFF);
  static const Color panel = Color(0xCC0E121C);
  static const Color panelCard = Color(0x8A0E121C);
  static const Color panelOpaque = Color(0xF00B0E16);
  static const Color sidebarBg = Color(0xEB0B0E16);
  static const Color playerbarBg = Color(0xEB0A0D14);
  static const Color line = Color(0x14FFFFFF);
  static const Color glassBorder = Color(0x1AFFFFFF);
  static const Color glassBorderHover = Color(0x38FFFFFF);
  static const Color text = Color(0xFFEEF2F8);
  static const Color muted = Color(0xFF95A0B5);

  static const Color accent = Color(0xFF8B5CF6);
  static const Color accent2 = Color(0xFF6D3EE0);
  static const Color accent3 = Color(0xFFEC4899);
  static const Color accentLight = Color(0xFFA78BFA);
  static const Color accentDark = Color(0xFF6D3EE0);
  static const Color accentPink = Color(0xFFEC4899);
  static const Color subtitle = Color(0xFFA78BFA);

  static const List<Map<String, String>> wallpaperPresets = [
    {'id': 'none', 'name': 'None (Default)', 'url': ''},
    {
      'id': 'dark_studio',
      'name': 'Dark Studio',
      'url':
          'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1600',
    },
    {
      'id': 'cyber_neon',
      'name': 'Cyber Neon',
      'url':
          'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1600',
    },
    {
      'id': 'sunset_waves',
      'name': 'Sunset Waves',
      'url':
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1600',
    },
    {
      'id': 'vinyl_lounge',
      'name': 'Vinyl Lounge',
      'url':
          'https://images.unsplash.com/photo-1539185441755-769473a23570?q=80&w=1600',
    },
  ];

  static const List<Map<String, dynamic>> accentPresets = [
    {'id': 'auto', 'name': 'Album Dynamic', 'hue': 'auto', 'color': 0xFF8B5CF6},
    {'id': 'violet', 'name': 'Violet', 'hue': 258, 'color': 0xFF8B5CF6},
    {'id': 'cyan', 'name': 'Cyber Cyan', 'hue': 190, 'color': 0xFF06B6D4},
    {'id': 'emerald', 'name': 'Emerald', 'hue': 155, 'color': 0xFF10B981},
    {'id': 'orange', 'name': 'Sunset Orange', 'hue': 25, 'color': 0xFFF97316},
    {'id': 'rose', 'name': 'Rose', 'hue': 340, 'color': 0xFFF43F5E},
  ];

  static Color accentFromHue(double hue) {
    return HSLColor.fromAHSL(1.0, hue % 360, 0.85, 0.65).toColor();
  }

  static Color accentLightFromHue(double hue) {
    return HSLColor.fromAHSL(1.0, hue % 360, 0.85, 0.74).toColor();
  }

  static Color accentDarkFromHue(double hue) {
    return HSLColor.fromAHSL(1.0, hue % 360, 0.78, 0.48).toColor();
  }

  static ThemeData buildTheme(double hue) {
    final primary = accentFromHue(hue);
    final secondary = accentLightFromHue(hue);
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bg,
      primaryColor: primary,
      fontFamily: 'Roboto',
      colorScheme: ColorScheme.dark(
        primary: primary,
        secondary: secondary,
        surface: panelOpaque,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: text,
          fontSize: 22,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.3,
        ),
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: Color(0xFF101420),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: const Color(0xFF141926),
        contentTextStyle: const TextStyle(color: text, fontSize: 13),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: glassBorder),
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  static ThemeData get darkTheme => buildTheme(258);
}
