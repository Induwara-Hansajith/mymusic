package com.induw.mymusic.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Green = Color(0xFF1DB954)
private val Bg = Color(0xFF0B0B0F)
private val Surface = Color(0xFF16161D)
private val OnBg = Color(0xFFF2F2F7)

private val Scheme = darkColorScheme(
    primary = Green,
    onPrimary = Color.Black,
    background = Bg,
    onBackground = OnBg,
    surface = Surface,
    onSurface = OnBg,
    secondary = Color(0xFF7CFFB2),
    onSecondary = Color.Black
)

@Composable
fun MyMusicTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, content = content)
}
