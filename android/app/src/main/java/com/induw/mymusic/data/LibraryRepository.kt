package com.induw.mymusic.data

import com.induw.mymusic.data.db.TrackDao
import com.induw.mymusic.data.db.TrackEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class LibraryRepository(private val dao: TrackDao) {
    fun observeTracks(): Flow<List<Track>> = dao.observeAll().map { rows -> rows.map { it.toTrack() } }
    fun observeLiked(): Flow<List<Track>> = dao.observeLiked().map { rows -> rows.map { it.toTrack() } }

    suspend fun upsert(tracks: List<Track>, likedIds: Set<String> = emptySet()) {
        dao.upsertAll(tracks.map { it.toEntity(liked = it.id in likedIds) })
    }

    suspend fun setLiked(id: String, liked: Boolean) = dao.setLiked(id, liked)

    suspend fun likedTracks(): List<Track> = dao.likedOnce().map { it.toTrack() }

    suspend fun replaceSource(source: TrackSource, tracks: List<Track>) {
        dao.clearSource(source.name)
        dao.upsertAll(tracks.map { it.toEntity() })
    }

    private fun TrackEntity.toTrack() = Track(
        id = id,
        title = title,
        artist = artist,
        album = album,
        durationMs = durationMs,
        artworkUrl = artworkUrl,
        source = runCatching { TrackSource.valueOf(source) }.getOrDefault(TrackSource.LOCAL),
        mediaUri = mediaUri,
        youtubeVideoId = youtubeVideoId
    )

    private fun Track.toEntity(liked: Boolean = false) = TrackEntity(
        id = id,
        title = title,
        artist = artist,
        album = album,
        durationMs = durationMs,
        artworkUrl = artworkUrl,
        source = source.name,
        mediaUri = mediaUri,
        youtubeVideoId = youtubeVideoId,
        liked = liked
    )
}
