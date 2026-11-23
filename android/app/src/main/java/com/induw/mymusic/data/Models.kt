package com.induw.mymusic.data

data class Track(
    val id: String,
    val title: String,
    val artist: String,
    val album: String = "",
    val durationMs: Long = 0L,
    val artworkUrl: String? = null,
    val source: TrackSource,
    val mediaUri: String,
    val youtubeVideoId: String? = null
)

enum class TrackSource {
    LOCAL,
    YOUTUBE,
    CLOUD_META
}

data class LyricsLine(
    val timeMs: Long,
    val text: String
)

data class LyricsResult(
    val synced: List<LyricsLine>,
    val plain: String?
)

/** Playlist model shared with the desktop sync schema. */
data class Playlist(
    val id: String,
    val name: String,
    val tracks: List<PlaylistsRepository.Companion.SyncTrack> = emptyList(),
    val updatedAt: Long = 0L
)
