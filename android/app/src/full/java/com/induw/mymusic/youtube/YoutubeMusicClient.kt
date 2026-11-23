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

class YoutubeMusicClient(http: OkHttpClient) {
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
                if (info.streamType.name.contains("VIDEO", ignoreCase = true).not() &&
                    info.streamType.name.contains("AUDIO", ignoreCase = true).not()
                ) {
                    // keep music/video results
                }
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

    suspend fun resolveAudioUrl(pageUrl: String): String = withContext(Dispatchers.IO) {
        val info = StreamInfo.getInfo(ServiceList.YouTube, pageUrl)
        val audio = info.audioStreams
            .sortedByDescending { it.bitrate }
            .firstOrNull()
            ?: error("No audio stream for $pageUrl")
        audio.content ?: error("Empty audio stream URL")
    }
}
