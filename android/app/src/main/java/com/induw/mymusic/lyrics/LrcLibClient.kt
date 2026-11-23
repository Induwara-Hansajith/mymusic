package com.induw.mymusic.lyrics

import com.induw.mymusic.BuildConfig
import com.induw.mymusic.data.LyricsLine
import com.induw.mymusic.data.LyricsResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request

class LrcLibClient(private val http: OkHttpClient) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun fetch(title: String, artist: String): LyricsResult? = withContext(Dispatchers.IO) {
        val q = listOf(title, artist).joinToString(" ").trim()
        if (q.isBlank()) return@withContext null
        val url = "${BuildConfig.LRCLIB_BASE}/api/search?q=${java.net.URLEncoder.encode(q, "UTF-8")}"
        val req = Request.Builder().url(url).header("User-Agent", "MyMusicAndroid/0.1").build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) return@withContext null
            val body = resp.body?.string().orEmpty()
            val hits = json.decodeFromString<List<LrcHit>>(body)
            val best = hits.firstOrNull { !it.syncedLyrics.isNullOrBlank() } ?: hits.firstOrNull()
            best?.let { hit ->
                LyricsResult(
                    synced = parseSynced(hit.syncedLyrics),
                    plain = hit.plainLyrics ?: hit.syncedLyrics
                )
            }
        }
    }

    private fun parseSynced(raw: String?): List<LyricsLine> {
        if (raw.isNullOrBlank()) return emptyList()
        val re = Regex("""\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?](.*)""")
        return raw.lineSequence().mapNotNull { line ->
            val m = re.matchEntire(line.trim()) ?: return@mapNotNull null
            val min = m.groupValues[1].toLong()
            val sec = m.groupValues[2].toLong()
            val frac = m.groupValues[3].padEnd(3, '0').take(3).toLongOrNull() ?: 0L
            LyricsLine(timeMs = min * 60_000 + sec * 1_000 + frac, text = m.groupValues[4].trim())
        }.toList()
    }

    @Serializable
    private data class LrcHit(
        @SerialName("syncedLyrics") val syncedLyrics: String? = null,
        @SerialName("plainLyrics") val plainLyrics: String? = null
    )
}
