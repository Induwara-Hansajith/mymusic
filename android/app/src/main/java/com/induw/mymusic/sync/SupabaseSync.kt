package com.induw.mymusic.sync

import com.induw.mymusic.BuildConfig
import com.induw.mymusic.data.Playlist
import com.induw.mymusic.data.PlaylistsRepository.Companion.SyncTrack
import com.induw.mymusic.data.PlaylistsRepository.Companion.toSyncTrack
import com.induw.mymusic.data.Track
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * REST client for the shared user_libraries table, compatible with the desktop
 * Windows/Linux My Music sync format (favorites: track list, playlists: {id,name,traces[]}).
 */
class SupabaseSync(private val http: OkHttpClient) {

    var accessToken: String? = null
    var onAuthExpired: (() -> Unit)? = null

    suspend fun fetchLibrary(userId: String): UserLibraryRow? = withContext(Dispatchers.IO) {
        val token = accessToken ?: return@withContext null
        val url =
            "${BuildConfig.SUPABASE_URL}/rest/v1/user_libraries?user_id=eq.$userId&select=*"
        val req = Request.Builder()
            .url(url)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .get()
            .build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) return@withContext null
            val body = resp.body?.string().orEmpty()
            json.decodeFromString<List<UserLibraryRow>>(body).firstOrNull()
        }
    }

    suspend fun upsertLibrary(row: UserLibraryRow): Boolean = withContext(Dispatchers.IO) {
        val token = accessToken ?: return@withContext false
        val url = "${BuildConfig.SUPABASE_URL}/rest/v1/user_libraries"
        val payload = json.encodeToString(row)
        val req = Request.Builder()
            .url(url)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Prefer", "resolution=merge-duplicates")
            .post(payload.toRequestBody(media))
            .build()
        http.newCall(req).execute().use { resp ->
            if (resp.code == 401) onAuthExpired?.invoke()
            resp.isSuccessful
        }
    }

    /**
     * Merges local favorites/playlists with the remote record the same way the
     * desktop does: favorites unioned by id, playlists unioned by playlist id.
     */
    suspend fun mergeAndPush(
        userId: String,
        likedTracks: List<Track>,
        playlists: List<Playlist>
    ): Boolean {
        accessToken ?: return false
        val remote = fetchLibrary(userId)
        val remoteFavs = decodeFavorites(remote?.favorites)
        val remotePlaylists = decodePlaylists(remote?.playlists)

        val favs = LinkedHashSet<SyncTrack>()
        likedTracks.forEach { favs.add(it.toSyncTrack()) }
        remoteFavs.forEach { favs.add(it) }

        val merged = LinkedHashMap<String, Playlist>()
        playlists.forEach { merged[it.id] = it }
        remotePlaylists.forEach { remote ->
            val existing = merged[remote.id]
            merged[remote.id] = if (existing == null) {
                remote
            } else {
                val seen = existing.tracks.map { it.id }.toHashSet()
                existing.copy(
                    tracks = existing.tracks + remote.tracks.filter { it.id !in seen }
                )
            }
        }

        val favoritesElement = json.encodeToJsonElement(favs.toList())
        val playlistsElement = json.encodeToJsonElement(merged.values.toList())
        val row = UserLibraryRow(
            userId = userId,
            favorites = favoritesElement,
            playlists = playlistsElement,
            clientVersion = "android-${BuildConfig.VERSION_NAME}"
        )
        return upsertLibrary(row)
    }

    private fun decodeFavorites(element: JsonElement?): List<SyncTrack> =
        runCatching {
            json.decodeFromJsonElement<List<SyncTrack>>(element ?: return emptyList())
        }.getOrDefault(emptyList())

    private fun decodePlaylists(element: JsonElement?): List<Playlist> =
        runCatching {
            json.decodeFromJsonElement<List<Playlist>>(element ?: return emptyList())
        }.getOrDefault(emptyList())

    @Serializable
    data class UserLibraryRow(
        @SerialName("user_id") val userId: String,
        val favorites: JsonElement? = null,
        val playlists: JsonElement? = null,
        val settings: JsonElement? = null,
        @SerialName("play_stats") val playStats: JsonElement? = null,
        @SerialName("lyrics_offsets") val lyricsOffsets: JsonElement? = null,
        @SerialName("client_version") val clientVersion: String = "android-1.1.8"
    )

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }
    private val media = "application/json".toMediaType()
}
