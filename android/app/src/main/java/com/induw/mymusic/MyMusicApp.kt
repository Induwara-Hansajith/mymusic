package com.induw.mymusic

import android.app.Application
import com.induw.mymusic.auth.AuthManager
import com.induw.mymusic.data.LibraryRepository
import com.induw.mymusic.data.PlaylistsRepository
import com.induw.mymusic.data.db.AppDatabase
import com.induw.mymusic.lyrics.LrcLibClient
import com.induw.mymusic.media.MediaCatalog
import com.induw.mymusic.sync.SupabaseSync
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

class MyMusicApp : Application() {
    lateinit var http: OkHttpClient
        private set
    lateinit var database: AppDatabase
        private set
    lateinit var library: LibraryRepository
        private set
    lateinit var playlists: PlaylistsRepository
        private set
    lateinit var auth: AuthManager
        private set
    lateinit var sync: SupabaseSync
        private set
    lateinit var lyrics: LrcLibClient
        private set
    lateinit var catalog: MediaCatalog
        private set

    override fun onCreate() {
        super.onCreate()
        http = OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
        database = AppDatabase.create(this)
        library = LibraryRepository(database.trackDao())
        playlists = PlaylistsRepository(database.trackDao(), database.playlistDao())
        auth = AuthManager(this, http)
        sync = SupabaseSync(http).apply {
            onAuthExpired = { }
        }
        lyrics = LrcLibClient(http)
        catalog = MediaCatalog.create(this, http)
    }

    /** Keeps SupabaseSync's token in step with the stored session. */
    fun refreshSyncToken() {
        sync.accessToken = auth.currentSession()?.accessToken
    }
}
