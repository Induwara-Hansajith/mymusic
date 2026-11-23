package com.induw.mymusic.data

import com.induw.mymusic.data.db.PlaylistDao
import com.induw.mymusic.data.db.PlaylistEntity
import com.induw.mymusic.data.db.TrackDao
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class PlaylistsRepository(
    private val trackDao: TrackDao,
    private val playlistDao: PlaylistDao
) {
    private val json = Json { ignoreUnknownKeys = true }

    fun observePlaylists(): Flow<List<Playlist>> =
        playlistDao.observeAll().map { rows -> rows.map { it.toPlaylist() } }

    suspend fun createPlaylist(name: String): Playlist {
        val pl = Playlist(
            id = java.util.UUID.randomUUID().toString(),
            name = name.ifBlank { "New Playlist" },
            tracks = emptyList(),
            updatedAt = System.currentTimeMillis()
        )
        save(pl)
        return pl
    }

    suspend fun renamePlaylist(id: String, name: String) {
        val existing = allOnce().firstOrNull { it.id == id } ?: return
        save(existing.copy(name = name))
    }

    suspend fun deletePlaylist(id: String) = playlistDao.delete(id)

    suspend fun addToPlaylist(id: String, track: Track) {
        val existing = allOnce().firstOrNull { it.id == id } ?: return
        if (existing.tracks.any { it.id == track.id }) return
        save(existing.copy(tracks = existing.tracks + track.toSyncTrack()))
    }

    suspend fun removeFromPlaylist(id: String, trackId: String) {
        val existing = allOnce().firstOrNull { it.id == id } ?: return
        save(existing.copy(tracks = existing.tracks.filterNot { it.id == trackId }))
    }

    suspend fun allOnce(): List<Playlist> = playlistDao.allOnce().map { it.toPlaylist() }

    suspend fun replaceAll(playlists: List<Playlist>) {
        playlistDao.allOnce().forEach { pl ->
            if (playlists.none { it.id == pl.id }) playlistDao.delete(pl.id)
        }
        playlists.forEach { upsertJson(it) }
    }

    private suspend fun upsertJson(pl: Playlist) {
        playlistDao.upsert(
            PlaylistEntity(
                id = pl.id,
                name = pl.name,
                trackIdsJson = json.encodeToString(pl.tracks),
                updatedAt = pl.updatedAt
            )
        )
    }

    private suspend fun save(pl: Playlist) = upsertJson(pl)

    private fun PlaylistEntity.toPlaylist(): Playlist = Playlist(
        id = id,
        name = name,
        tracks = runCatching { json.decodeFromString<List<SyncTrack>>(trackIdsJson) }
            .getOrDefault(emptyList()),
        updatedAt = updatedAt
    )

    companion object {
        /** JSON shape identical to the desktop user_libraries.playlists entries. */
        @Serializable
        data class SyncTrack(
            val id: String,
            val title: String,
            val artist: String,
            val album: String = "",
            val durationMs: Long = 0,
            @Suppress("unused") val artworkUrl: String? = null,
            val youtubeVideoId: String? = null
        )

        fun Track.toSyncTrack() = SyncTrack(
            id = id,
            title = title,
            artist = artist,
            album = album,
            durationMs = durationMs,
            artworkUrl = artworkUrl,
            youtubeVideoId = youtubeVideoId
        )

        fun SyncTrack.asTrack(mediaUri: String = "sync://" + id, source: TrackSource = TrackSource.CLOUD_META) =
            Track(
                id = id,
                title = title,
                artist = artist,
                album = album,
                durationMs = durationMs,
                artworkUrl = artworkUrl,
                source = source,
                mediaUri = mediaUri,
                youtubeVideoId = youtubeVideoId
            )
    }
}
