package com.induw.mymusic.media

import android.content.Context
import com.induw.mymusic.data.Track
import com.induw.mymusic.data.TrackSource
import okhttp3.OkHttpClient

object FlavorMediaCatalogFactory {
    fun create(context: Context, @Suppress("UNUSED_PARAMETER") http: OkHttpClient): MediaCatalog =
        PlayMediaCatalog(LocalMusicScanner(context))
}

/**
 * Play Store–safe catalog: device audio only.
 * YouTube search/stream is intentionally unavailable in this flavor.
 */
private class PlayMediaCatalog(
    private val scanner: LocalMusicScanner
) : MediaCatalog {
    override suspend fun scanLocalLibrary(): List<Track> = scanner.scan()

    override suspend fun search(query: String): List<Track> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return emptyList()
        return scanner.scan().filter {
            it.title.lowercase().contains(q) || it.artist.lowercase().contains(q)
        }
    }

    override suspend fun resolvePlayableUri(track: Track): String {
        require(track.source == TrackSource.LOCAL) {
            "Play builds cannot stream YouTube. Install My Music Full from GitHub/F-Droid."
        }
        return track.mediaUri
    }
}
