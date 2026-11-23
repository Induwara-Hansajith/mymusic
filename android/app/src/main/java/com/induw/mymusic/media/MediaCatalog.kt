package com.induw.mymusic.media

import android.content.Context
import com.induw.mymusic.BuildConfig
import com.induw.mymusic.data.Track
import okhttp3.OkHttpClient

/**
 * Flavor-backed catalog. Play builds only expose local audio.
 * Full builds also resolve YouTube Music search/stream URLs.
 */
interface MediaCatalog {
    val youtubeEnabled: Boolean get() = BuildConfig.YOUTUBE_STREAMING
    suspend fun scanLocalLibrary(): List<Track>
    suspend fun search(query: String): List<Track>
    suspend fun resolvePlayableUri(track: Track): String

    /** Saves a track into the public Music/My Music folder; offline downloader (Full flavor). */
    suspend fun saveToDownloads(context: Context, track: Track): String =
        throw UnsupportedOperationException(
            "Offline download is only available in My Music Full (GitHub / F-Droid)."
        )

    companion object {
        fun create(context: Context, http: OkHttpClient): MediaCatalog =
            FlavorMediaCatalogFactory.create(context, http)
    }
}
