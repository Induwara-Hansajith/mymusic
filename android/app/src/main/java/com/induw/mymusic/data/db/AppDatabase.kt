package com.induw.mymusic.data.db

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "tracks")
data class TrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long,
    val artworkUrl: String?,
    val source: String,
    val mediaUri: String,
    val youtubeVideoId: String?,
    val liked: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)

/**
 * Playlist mirrors the desktop JSON shape: { id, name, tracks: [{ id, title, artist, album,
 * durationMs, artworkUrl, youtubeVideoId }] }. trackIds reference sync track ids, so playlists
 * round-trip with Windows/Linux.
 */
@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val trackIdsJson: String,
    val updatedAt: Long = System.currentTimeMillis()
)

@Dao
interface TrackDao {
    @Query("SELECT * FROM tracks ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM tracks WHERE liked = 1 ORDER BY updatedAt DESC")
    fun observeLiked(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM tracks WHERE id IN (:ids)")
    suspend fun byIds(ids: List<String>): List<TrackEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(tracks: List<TrackEntity>)

    @Query("UPDATE tracks SET liked = :liked, updatedAt = :at WHERE id = :id")
    suspend fun setLiked(id: String, liked: Boolean, at: Long = System.currentTimeMillis())

    @Query("SELECT * FROM tracks WHERE liked = 1")
    suspend fun likedOnce(): List<TrackEntity>

    @Query("DELETE FROM tracks WHERE source = :source")
    suspend fun clearSource(source: String)
}

@Dao
interface PlaylistDao {
    @Query("SELECT * FROM playlists ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<PlaylistEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(playlist: PlaylistEntity)

    @Query("DELETE FROM playlists WHERE id = :id")
    suspend fun delete(id: String)

    @Query("SELECT * FROM playlists")
    suspend fun allOnce(): List<PlaylistEntity>
}

@Database(
    entities = [TrackEntity::class, PlaylistEntity::class],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun trackDao(): TrackDao
    abstract fun playlistDao(): PlaylistDao

    companion object {
        fun create(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "mymusic.db")
                .fallbackToDestructiveMigration()
                .build()
    }
}
