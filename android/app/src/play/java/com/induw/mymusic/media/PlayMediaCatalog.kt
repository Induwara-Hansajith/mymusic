package com.induw.mymusic.media

import android.content.Context
import com.induw.mymusic.data.Track
import com.induw.mymusic.data.TrackSource
import okhttp3.OkHttpClient

object FlavorMediaCatalogFactory {
    fun create(context: Context, @Suppress("UNUSED_PARAMETER") http: OkHttpClient): MediaCatalog =
        PlayMediaCatalog(LocalMusicScanner(context))
}

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

    override suspend fun searchStructured(query: String, filter: String?): Map<String, Any> {
        val tracks = search(query)
        val songsList = tracks.map { t ->
            mapOf(
                "id" to t.id,
                "title" to t.title,
                "artist" to t.artist,
                "duration" to (t.durationMs / 1000).toInt(),
                "thumb" to (t.artworkUrl ?: ""),
                "type" to "song",
                "localPath" to t.mediaUri
            )
        }
        return mapOf(
            "songs" to songsList,
            "videos" to emptyList<Any>(),
            "albums" to emptyList<Any>(),
            "artists" to emptyList<Any>(),
            "playlists" to emptyList<Any>()
        )
    }

    override suspend fun homeFeed(): List<Map<String, Any>> {
        val tracks = scanLocalLibrary()
        val songsList = tracks.take(16).map { t ->
            mapOf(
                "id" to t.id,
                "title" to t.title,
                "artist" to t.artist,
                "duration" to (t.durationMs / 1000).toInt(),
                "thumb" to (t.artworkUrl ?: ""),
                "type" to "song",
                "localPath" to t.mediaUri
            )
        }
        return listOf(
            mapOf(
                "title" to "Device Library",
                "songs" to songsList,
                "albums" to emptyList<Any>(),
                "artists" to emptyList<Any>(),
                "playlists" to emptyList<Any>(),
                "videos" to emptyList<Any>()
            )
        )
    }

    override suspend fun resolveStreamUrl(id: String): String {
        val track = scanLocalLibrary().firstOrNull { it.id == id }
            ?: error("Local track not found: $id")
        return track.mediaUri
    }

    override suspend fun radio(id: String): List<Map<String, Any>> {
        val tracks = scanLocalLibrary().shuffled().take(10)
        return tracks.map { t ->
            mapOf(
                "id" to t.id,
                "title" to t.title,
                "artist" to t.artist,
                "duration" to (t.durationMs / 1000).toInt(),
                "thumb" to (t.artworkUrl ?: ""),
                "type" to "song",
                "localPath" to t.mediaUri
            )
        }
    }

    override suspend fun resolvePlayableUri(track: Track): String {
        require(track.source == TrackSource.LOCAL) {
            "Play builds cannot stream YouTube. Install My Music Full from GitHub/F-Droid."
        }
        return track.mediaUri
    }
}
