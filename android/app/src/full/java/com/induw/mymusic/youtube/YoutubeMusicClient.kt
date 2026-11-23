package com.induw.mymusic.youtube

import com.induw.mymusic.data.Track
import com.induw.mymusic.data.TrackSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.StreamInfo
import java.util.concurrent.atomic.AtomicBoolean

class YoutubeMusicClient(private val http: OkHttpClient) {
    private val ready = AtomicBoolean(false)

    init {
        ensureInit(http)
    }

    private fun ensureInit(http: OkHttpClient) {
        if (ready.compareAndSet(false, true)) {
            NewPipe.init(NewPipeDownloaderImpl(http))
        }
    }

    suspend fun search(query: String, limit: Int = 20): List<Track> = withContext(Dispatchers.IO) {
        val q = query.trim()
        if (q.isEmpty()) return@withContext emptyList()
        val extractor = ServiceList.YouTube.getSearchExtractor(q)
        extractor.fetchPage()
        extractor.initialPage.items
            .asSequence()
            .mapNotNull { item ->
                val info = item as? org.schabi.newpipe.extractor.stream.StreamInfoItem ?: return@mapNotNull null
                val id = info.url.substringAfter("watch?v=").substringBefore("&").ifBlank {
                    info.url.hashCode().toString()
                }
                Track(
                    id = "yt:$id",
                    title = info.name ?: "Unknown",
                    artist = info.uploaderName ?: "YouTube",
                    durationMs = (info.duration.takeIf { it > 0 } ?: 0L) * 1000L,
                    artworkUrl = info.thumbnails.maxByOrNull { it.height }?.url,
                    source = TrackSource.YOUTUBE,
                    mediaUri = info.url,
                    youtubeVideoId = id
                )
            }
            .take(limit)
            .toList()
    }

    suspend fun searchStructured(query: String, filter: String? = null): Map<String, Any> = withContext(Dispatchers.IO) {
        val tracks = search(query, 25)
        val songsList = tracks.map { t ->
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
        mapOf(
            "songs" to songsList,
            "videos" to emptyList<Any>(),
            "albums" to emptyList<Any>(),
            "artists" to emptyList<Any>(),
            "playlists" to emptyList<Any>()
        )
    }

    suspend fun homeFeed(): List<Map<String, Any>> = withContext(Dispatchers.IO) {
        val hits = runCatching { search("top hits music 2026", 24) }.getOrDefault(emptyList())
        val quickPicks = hits.take(8).map { t ->
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
        val trending = hits.drop(8).take(12).map { t ->
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

        listOf(
            mapOf(
                "title" to "Quick Picks",
                "songs" to quickPicks,
                "albums" to emptyList<Any>(),
                "artists" to emptyList<Any>(),
                "playlists" to emptyList<Any>(),
                "videos" to emptyList<Any>()
            ),
            mapOf(
                "title" to "Trending Now",
                "songs" to trending,
                "albums" to emptyList<Any>(),
                "artists" to emptyList<Any>(),
                "playlists" to emptyList<Any>(),
                "videos" to emptyList<Any>()
            )
        )
    }

    suspend fun resolveAudioUrl(pageUrl: String): String = withContext(Dispatchers.IO) {
        val info = StreamInfo.getInfo(ServiceList.YouTube, pageUrl)
        val audio = info.audioStreams
            .sortedByDescending { it.bitrate }
            .firstOrNull()
            ?: error("No audio stream for $pageUrl")
        audio.content ?: error("Empty audio stream URL")
    }

    suspend fun resolveAudioUrlById(videoId: String): String = withContext(Dispatchers.IO) {
        val cleanId = videoId.removePrefix("yt:")
        val pageUrl = "https://www.youtube.com/watch?v=$cleanId"
        resolveAudioUrl(pageUrl)
    }

    suspend fun getRelated(videoId: String, limit: Int = 15): List<Track> = withContext(Dispatchers.IO) {
        val cleanId = videoId.removePrefix("yt:")
        val pageUrl = "https://www.youtube.com/watch?v=$cleanId"
        val info = runCatching { StreamInfo.getInfo(ServiceList.YouTube, pageUrl) }.getOrNull()
        val items = info?.relatedItems?.asSequence()
            ?.mapNotNull { item ->
                val streamItem = item as? org.schabi.newpipe.extractor.stream.StreamInfoItem ?: return@mapNotNull null
                val id = streamItem.url.substringAfter("watch?v=").substringBefore("&").ifBlank { return@mapNotNull null }
                Track(
                    id = "yt:$id",
                    title = streamItem.name ?: "Unknown",
                    artist = streamItem.uploaderName ?: "YouTube",
                    durationMs = (streamItem.duration.takeIf { it > 0 } ?: 0L) * 1000L,
                    artworkUrl = streamItem.thumbnails.maxByOrNull { it.height }?.url,
                    source = TrackSource.YOUTUBE,
                    mediaUri = streamItem.url,
                    youtubeVideoId = id
                )
            }
            ?.take(limit)
            ?.toList()
            .orEmpty()

        if (items.isNotEmpty()) items else search("related music", limit)
    }
}
