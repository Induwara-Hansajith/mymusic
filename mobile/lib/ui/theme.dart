import 'package:flutter/material.dart';

class AppTheme {
  static const Color bg = Color(0xFF07090E);
  static const Color bg2 = Color(0xFF0D1017);
  static const Color panel = Color(0xFF141824);
  static const Color panelCard = Color(0xFF0E121C);
  static const Color accent = Color(0xFF8B5CF6);
  static const Color accent2 = Color(0xFF6D3EE0);
  static const Color accentPink = Color(0xFFEC4899);
  static const Color line = Color(0x1FFFFFFF);
  static const Color text = Color(0xFFEEF2F8);
  static const Color muted = Color(0xFF95A0B5);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bg,
      primaryColor: accent,
      colorScheme: const ColorScheme.dark(
        primary: accent,
        secondary: accentPink,
        surface: panel,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: text,
          fontSize: 20,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.2,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xF207090E),
        selectedItemColor: accent,
        unselectedItemColor: muted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
    );
  }
}
