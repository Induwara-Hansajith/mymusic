import 'package:flutter/material.dart';

class AppTheme {
  static const Color bg = Color(0xFF08080E);
  static const Color bg2 = Color(0xFF0E0E18);
  static const Color panel = Color(0xFF141422);
  static const Color panelCard = Color(0xFF161626);
  static const Color accent = Color(0xFF8B5CF6);
  static const Color accentLight = Color(0xFFA78BFA);
  static const Color accentDark = Color(0xFF7C3AED);
  static const Color accentPink = Color(0xFFEC4899);
  static const Color line = Color(0xFF232338);
  static const Color text = Color(0xFFFFFFFF);
  static const Color muted = Color(0xFF9CA3AF);
  static const Color subtitle = Color(0xFFA78BFA);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bg,
      primaryColor: accent,
      fontFamily: 'Roboto',
      colorScheme: const ColorScheme.dark(
        primary: accent,
        secondary: accentLight,
        surface: panel,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: text,
          fontSize: 24,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xF508080E),
        selectedItemColor: accentLight,
        unselectedItemColor: Color(0xFF6B7280),
        selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
    );
  }
}
