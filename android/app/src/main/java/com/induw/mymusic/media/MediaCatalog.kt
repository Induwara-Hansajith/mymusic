package com.induw.mymusic.media

import android.content.Context
import com.induw.mymusic.BuildConfig
import com.induw.mymusic.data.Track
import okhttp3.OkHttpClient

interface MediaCatalog {
    val youtubeEnabled: Boolean get() = BuildConfig.YOUTUBE_STREAMING
    suspend fun scanLocalLibrary(): List<Track>
    suspend fun search(query: String): List<Track>
    suspend fun searchStructured(query: String, filter: String? = null): Map<String, Any>
    suspend fun homeFeed(): List<Map<String, Any>>
    suspend fun resolveStreamUrl(id: String): String
    suspend fun radio(id: String): List<Map<String, Any>>
    suspend fun resolvePlayableUri(track: Track): String

    suspend fun saveToDownloads(context: Context, track: Track): String =
        throw UnsupportedOperationException("Offline download is only available in My Music Full.")

    companion object {
        fun create(context: Context, http: OkHttpClient): MediaCatalog =
            FlavorMediaCatalogFactory.create(context, http)
    }
}
