package com.induw.mymusic.media

import android.content.Context
import com.induw.mymusic.data.Track
import com.induw.mymusic.data.TrackSource
import com.induw.mymusic.youtube.YoutubeMusicClient
import okhttp3.OkHttpClient

object FlavorMediaCatalogFactory {
    fun create(context: Context, http: OkHttpClient): MediaCatalog =
        FullMediaCatalog(LocalMusicScanner(context), YoutubeMusicClient(http))
}

/** GitHub / F-Droid catalog: local files + YouTube Music search/streaming. */
private class FullMediaCatalog(
    private val scanner: LocalMusicScanner,
    private val youtube: YoutubeMusicClient
) : MediaCatalog {
    override suspend fun scanLocalLibrary(): List<Track> = scanner.scan()

    override suspend fun search(query: String): List<Track> {
        val q = query.trim().lowercase()
        val local = if (q.isEmpty()) {
            emptyList()
        } else {
            scanner.scan().filter {
                it.title.lowercase().contains(q) || it.artist.lowercase().contains(q)
            }
        }
        val remote = runCatching { youtube.search(query) }.getOrDefault(emptyList())
        return local + remote
    }

    override suspend fun resolvePlayableUri(track: Track): String = when (track.source) {
        TrackSource.LOCAL, TrackSource.CLOUD_META -> track.mediaUri
        TrackSource.YOUTUBE -> youtube.resolveAudioUrl(track.mediaUri)
    }
}
