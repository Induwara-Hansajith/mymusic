package com.induw.mymusic.media

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.induw.mymusic.data.Track
import com.induw.mymusic.data.TrackSource
import com.induw.mymusic.youtube.YoutubeMusicClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient

object FlavorMediaCatalogFactory {
    fun create(context: Context, http: OkHttpClient): MediaCatalog =
        FullMediaCatalog(LocalMusicScanner(context), YoutubeMusicClient(http), http)
}

private class FullMediaCatalog(
    private val scanner: LocalMusicScanner,
    private val youtube: YoutubeMusicClient,
    private val http: OkHttpClient
) : MediaCatalog {
    override suspend fun scanLocalLibrary(): List<Track> = scanner.scan()

    override suspend fun search(query: String): List<Track> {
        val q = query.trim().lowercase()
        val local = if (q.isEmpty()) emptyList() else scanner.scan().filter {
            it.title.lowercase().contains(q) || it.artist.lowercase().contains(q)
        }
        val remote = runCatching { youtube.search(query) }.getOrDefault(emptyList())
        return local + remote
    }

    override suspend fun searchStructured(query: String, filter: String?): Map<String, Any> {
        return youtube.searchStructured(query, filter)
    }

    override suspend fun homeFeed(): List<Map<String, Any>> {
        return youtube.homeFeed()
    }

    override suspend fun resolveStreamUrl(id: String): String {
        return youtube.resolveAudioUrlById(id)
    }

    override suspend fun radio(id: String): List<Map<String, Any>> {
        val tracks = youtube.getRelated(id, 16)
        return tracks.map { t ->
            val vid = t.youtubeVideoId?.ifBlank { null } ?: t.id.removePrefix("yt:")
            mapOf(
                "id" to vid,
                "title" to t.title,
                "artist" to t.artist,
                "duration" to (t.durationMs / 1000).toInt(),
                "thumb" to (t.artworkUrl ?: "https://i.ytimg.com/vi/$vid/hqdefault.jpg"),
                "type" to "song"
            )
        }
    }

    override suspend fun resolvePlayableUri(track: Track): String = when (track.source) {
        TrackSource.LOCAL, TrackSource.CLOUD_META -> track.mediaUri
        TrackSource.YOUTUBE -> youtube.resolveAudioUrl(track.mediaUri)
    }

    override suspend fun saveToDownloads(context: Context, track: Track): String =
        withContext(Dispatchers.IO) {
            val uri = resolvePlayableUri(track)
            val safeTitle = "${track.artist} - ${track.title}".replace(Regex("[\\\\/:*?\"<>|]"), "_")
            val resolver = context.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Audio.Media.DISPLAY_NAME, "$safeTitle.m4a")
                put(MediaStore.Audio.Media.MIME_TYPE, "audio/mp4")
                if (Build.VERSION.SDK_INT >= 29) {
                    put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/My Music")
                }
            }
            val target = resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values)
                ?: error("Could not create the download file.")
            try {
                val request = okhttp3.Request.Builder().url(uri).build()
                http.newCall(request).execute().use { resp ->
                    check(resp.isSuccessful) { "Stream server returned HTTP ${resp.code}" }
                    val body = resp.body ?: error("Empty stream response")
                    resolver.openOutputStream(target)!!.use { out ->
                        body.byteStream().copyTo(out)
                    }
                }
                target.toString()
            } catch (e: Exception) {
                runCatching { resolver.delete(target, null, null) }
                throw e
            }
        }
}
