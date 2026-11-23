package com.induw.mymusic.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PlaylistAdd
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.induw.mymusic.BuildConfig
import com.induw.mymusic.MyMusicApp
import com.induw.mymusic.data.Playlist
import com.induw.mymusic.data.Track
import com.induw.mymusic.data.TrackSource
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class Tab { LIBRARY, LIKED, PLAYLISTS, SETTINGS }

@Composable
fun MyMusicAppRoot(app: MyMusicApp) {
    val scope = rememberCoroutineScope()
    val player = remember { PlayerController(app) }
    var tab by remember { mutableStateOf(Tab.LIBRARY) }
    var query by remember { mutableStateOf("") }
    var tracks by remember { mutableStateOf<List<Track>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var toast by remember { mutableStateOf<String?>(null) }
    var nowPlayingOpen by remember { mutableStateOf(false) }
    var playlistTarget by remember { mutableStateOf<Track?>(null) }
    val isPlaying by player.isPlaying.collectAsState()
    val currentTrack by player.currentTrack.collectAsState()
    val repeatMode by player.repeatMode.collectAsState()
    val shuffleOn by player.shuffle.collectAsState()

    DisposableEffect(Unit) {
        player.resolver = { track -> app.catalog.resolvePlayableUri(track) }
        onDispose { player.release() }
    }

    LaunchedEffect(Unit) {
        loading = true
        error = null
        runCatching {
            val local = app.catalog.scanLocalLibrary()
            app.library.replaceSource(TrackSource.LOCAL, local)
            tracks = local
        }.onFailure { error = it.message ?: "Failed to scan library" }
        loading = false
    }

    LaunchedEffect(query) {
        val job = launch {
            delay(350)
            val q = query.trim()
            if (q.isEmpty()) {
                if (tab == Tab.LIBRARY) tracks = app.catalog.scanLocalLibrary()
                return@launch
            }
            loading = true
            error = null
            runCatching { app.catalog.search(q) }
                .onSuccess { tracks = it }
                .onFailure { error = it.message ?: "Search failed" }
            loading = false
        }
        job.join()
    }

    fun downloadTrack(track: Track) = downloadTrackToMusic(app, track)

    fun playTrack(track: Track, context: List<Track>) {
        scope.launch {
            error = null
            toast = null
            runCatching {
                val list = if (context.isNotEmpty()) context else listOf(track)
                val startAt = list.indexOfFirst { it.id == track.id }.coerceAtLeast(0)
                player.automixSource = { tracks }
                player.playQueue(list, startAt)
            }.onFailure { error = it.message ?: "Playback failed" }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
        ) {
            when (tab) {
                Tab.LIBRARY -> SearchHeader(
                    query = query,
                    onQueryChange = { query = it },
                    hint = if (app.catalog.youtubeEnabled) "Search local + YouTube Music"
                    else "Search local library",
                    flavorNote = if (app.catalog.youtubeEnabled)
                        "Full APK: YouTube Music streaming enabled (GitHub / F-Droid distribution)."
                    else
                        "Play build: local library + cloud sync. YouTube streaming ships only in the Full APK."
                )
                else -> TabHeader(title = tab.name.lowercase().replaceFirstChar { it.uppercase() })
            }

            Box(modifier = Modifier.weight(1f)) {
                when {
                    loading && tracks.isEmpty() && tab == Tab.LIBRARY ->
                        CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                    tab == Tab.LIBRARY -> TrackList(
                        tracks = tracks,
                        error = error,
                        emptyText = if (app.catalog.youtubeEnabled)
                            "No results. Try another search."
                        else
                            "No local music found. Add audio files, or install My Music Full for YouTube.",
                        currentId = currentTrack?.id,
                        app = app,
                        onPlay = { track, ctx -> playTrack(track, ctx) },
                        onAddToPlaylist = { playlistTarget = it }
                    )
                    tab == Tab.LIKED -> LikedScreen(
                        app = app,
                        currentId = currentTrack?.id,
                        onPlay = { track, ctx -> playTrack(track, ctx) },
                        onAddToPlaylist = { playlistTarget = it }
                    )
                    tab == Tab.PLAYLISTS -> PlaylistsScreen(
                        app = app,
                        currentId = currentTrack?.id,
                        onPlay = { track, ctx -> playTrack(track, ctx) }
                    )
                    tab == Tab.SETTINGS -> SettingsScreen(app = app, player = player)
                }
            }

            if (error != null) {
                Text(
                    text = error!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            }
            if (toast != null) {
                Text(
                    text = toast!!,
                    color = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            }

            currentTrack?.let { track ->
                MiniPlayer(
                    title = track.title,
                    artist = track.artist,
                    isPlaying = isPlaying,
                    shuffleOn = shuffleOn,
                    repeatMode = repeatMode,
                    onToggle = { player.toggle() },
                    onNext = { player.next() },
                    onPrev = { player.previous() },
                    onOpen = { nowPlayingOpen = true }
                )
            }

            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(
                    selected = tab == Tab.LIBRARY,
                    onClick = { tab = Tab.LIBRARY; query = query },
                    icon = { Icon(Icons.Default.LibraryMusic, "Library") },
                    label = { Text("Library") }
                )
                NavigationBarItem(
                    selected = tab == Tab.LIKED,
                    onClick = { tab = Tab.LIKED },
                    icon = { Icon(Icons.Default.Favorite, "Liked") },
                    label = { Text("Liked") }
                )
                NavigationBarItem(
                    selected = tab == Tab.PLAYLISTS,
                    onClick = { tab = Tab.PLAYLISTS },
                    icon = { Icon(Icons.Default.QueueMusic, "Playlists") },
                    label = { Text("Playlists") }
                )
                NavigationBarItem(
                    selected = tab == Tab.SETTINGS,
                    onClick = { tab = Tab.SETTINGS },
                    icon = { Icon(Icons.Default.Settings, "Settings") },
                    label = { Text("Settings") }
                )
            }
        }

        if (nowPlayingOpen && currentTrack != null) {
            NowPlayingScreen(
                player = player,
                app = app,
                onClose = { nowPlayingOpen = false }
            )
        }

        playlistTarget?.let { track ->
            AddToPlaylistDialog(
                app = app,
                track = track,
                onDismiss = { playlistTarget = null },
                onAdded = { name ->
                    playlistTarget = null
                    toast = "Added to $name"
                }
            )
        }
    }
}

@Composable
private fun TabHeader(title: String) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
        Text(
            text = "My Music",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "$title · v${BuildConfig.VERSION_NAME}",
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(8.dp))
    }
}

@Composable
private fun SearchHeader(
    query: String,
    onQueryChange: (String) -> Unit,
    hint: String,
    flavorNote: String
) {
    Column {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Text(
                text = "My Music",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${BuildConfig.FLAVOR_LABEL} · v${BuildConfig.VERSION_NAME}",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
            )
        }
        Text(
            text = flavorNote,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surface)
                .padding(12.dp),
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f),
            style = MaterialTheme.typography.bodySmall
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            placeholder = { Text(hint) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.surface
            )
        )
        Spacer(modifier = Modifier.height(8.dp))
    }
}

@Composable
private fun TrackList(
    tracks: List<Track>,
    error: String?,
    emptyText: String,
    currentId: String?,
    app: MyMusicApp,
    onPlay: (Track, List<Track>) -> Unit,
    onAddToPlaylist: (Track) -> Unit
) {
    val likedIds by app.library.observeLiked().collectAsState(initial = emptyList())
    val likedSet = remember(likedIds) { likedIds.map { it.id }.toSet() }
    if (tracks.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize()) {
            Text(
                text = error ?: emptyText,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(24.dp),
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
        }
        return
    }
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        items(tracks, key = { it.id + it.mediaUri }) { track ->
            TrackRow(
                track = track,
                playing = track.id == currentId,
                liked = track.id in likedSet,
                onPlay = { onPlay(track, tracks) },
                onLike = {
                    UiScope.launch { app.library.setLiked(track.id, track.id !in likedSet) }
                },
                onAddToPlaylist = { onAddToPlaylist(track) },
                onDownload = { downloadTrackToMusic(app, track) }
            )
        }
    }
}

/** Single lightweight scope shared by fire-and-forget UI actions. */
object UiScope {
    val scope = kotlinx.coroutines.CoroutineScope(
        kotlinx.coroutines.Dispatchers.Main +
            kotlinx.coroutines.SupervisorJob()
    )

    fun launch(block: suspend kotlinx.coroutines.CoroutineScope.() -> Unit) {
        scope.launch(block = block)
    }
}

/** Saves a YouTube track via MediaStore, reporting the outcome as a system toast. */
private fun downloadTrackToMusic(app: MyMusicApp, track: Track) {
    val ctx = app.applicationContext
    UiScope.launch {
        runCatching { app.catalog.saveToDownloads(ctx, track) }
            .onSuccess { android.widget.Toast.makeText(ctx, "Saved to Music/My Music", android.widget.Toast.LENGTH_SHORT).show() }
            .onFailure { android.widget.Toast.makeText(ctx, it.message ?: "Download failed", android.widget.Toast.LENGTH_SHORT).show() }
    }
}

@Composable
private fun LikedScreen(
    app: MyMusicApp,
    currentId: String?,
    onPlay: (Track, List<Track>) -> Unit,
    onAddToPlaylist: (Track) -> Unit
) {
    val liked by app.library.observeLiked().collectAsState(initial = emptyList())
    Box(modifier = Modifier.fillMaxSize()) {
        if (liked.isEmpty()) {
            Text(
                text = "Songs you like appear here.",
                modifier = Modifier.align(Alignment.Center).padding(24.dp),
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(liked, key = { "liked-" + it.id }) { track ->
                    TrackRow(
                        track = track,
                        playing = track.id == currentId,
                        liked = true,
                        onPlay = { onPlay(track, liked) },
                        onLike = { UiScope.launch { app.library.setLiked(track.id, false) } },
                        onAddToPlaylist = { onAddToPlaylist(track) },
                        onDownload = { downloadTrackToMusic(app, track) }
                    )
                }
            }
        }
    }
}

@Composable
private fun PlaylistsScreen(
    app: MyMusicApp,
    currentId: String?,
    onPlay: (Track, List<Track>) -> Unit
) {
    val playlists by app.playlists.observePlaylists().collectAsState(initial = emptyList())
    var openPlaylist by remember { mutableStateOf<Playlist?>(null) }
    var newPlaylistName by remember { mutableStateOf("") }
    var creating by remember { mutableStateOf(false) }

    openPlaylist?.let { pl ->
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { openPlaylist = null }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                }
                Text(pl.name, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                TextButton(onClick = {
                    UiScope.launch { app.playlists.deletePlaylist(pl.id) }
                    openPlaylist = null
                }) { Text("Delete") }
            }
            Box(modifier = Modifier.fillMaxSize()) {
                if (pl.tracks.isEmpty()) {
                    Text(
                        text = "Add songs from Library or Liked with the playlist icon.",
                        modifier = Modifier.align(Alignment.Center).padding(24.dp),
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        items(pl.tracks, key = { "pl-" + pl.id + it.id }) { syncTrack ->
                            val t = PlaylistsRepositoryAccess.track(syncTrack)
                            TrackRow(
                                track = t,
                                playing = t.id == currentId,
                                liked = false,
                                onPlay = { onPlay(t, pl.tracks.map { PlaylistsRepositoryAccess.track(it) }) },
                                onLike = {},
                                onAddToPlaylist = {},
                                onRemove = {
                                    UiScope.launch {
                                        app.playlists.removeFromPlaylist(pl.id, t.id)
                                    }
                                },
                                onDownload = { downloadTrackToMusic(app, t) }
                            )
                        }
                    }
                }
            }
        }
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = newPlaylistName,
                onValueChange = { newPlaylistName = it },
                placeholder = { Text("New playlist name") },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            Spacer(modifier = Modifier.width(8.dp))
            Button(onClick = {
                val name = newPlaylistName
                creating = true
                UiScope.launch {
                    app.playlists.createPlaylist(name)
                    newPlaylistName = ""
                    creating = false
                }
            }) { Text("Create") }
        }
        Box(modifier = Modifier.fillMaxSize()) {
            if (playlists.isEmpty()) {
                Text(
                    text = "No playlists yet. Create one above.",
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    items(playlists, key = { it.id }) { playlist ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surface)
                                .clickable { openPlaylist = playlist }
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.QueueMusic, null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(playlist.name, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${playlist.tracks.size} songs",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                    }
                }
            }
            if (creating) CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
        }
    }
}

/** Helper to convert sync tracks back to playable Tracks from UI code. */
object PlaylistsRepositoryAccess {
    fun track(st: com.induw.mymusic.data.PlaylistsRepository.Companion.SyncTrack): Track =
        with(com.induw.mymusic.data.PlaylistsRepository.Companion) {
            st.asTrack()
        }
}

@Composable
private fun SettingsScreen(app: MyMusicApp, player: PlayerController) {
    val scope = rememberCoroutineScope()
    var signedIn by remember { mutableStateOf(app.auth.isSignedIn()) }
    var email by remember { mutableStateOf(app.auth.currentEmail()) }
    var status by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        app.refreshSyncToken()
        app.auth.completePendingSignIn()?.let {
            signedIn = true
            email = it
            status = "Signed in as $it"
        }
        signedIn = app.auth.isSignedIn()
        email = app.auth.currentEmail()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text("Account", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                if (signedIn) "Signed in as $email" else "Sign in to sync playlists and likes with Windows and Linux.",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (signedIn) {
                    Button(onClick = {
                        busy = true
                        status = null
                        scope.launch {
                            app.refreshSyncToken()
                            val userId = app.auth.currentUserId()
                            val ok = if (userId != null) {
                                app.sync.mergeAndPush(
                                    userId = userId,
                                    likedTracks = app.library.likedTracks(),
                                    playlists = app.playlists.allOnce()
                                )
                            } else false
                            status = if (ok) "Library synced." else "Sync failed — session may have expired, sign in again."
                            busy = false
                        }
                    }) { Text("Sync now") }
                    TextButton(onClick = {
                        scope.launch {
                            app.auth.signOut()
                            app.refreshSyncToken()
                            signedIn = false
                            email = ""
                            status = "Signed out."
                        }
                    }) { Text("Sign out") }
                } else {
                    Button(onClick = {
                        status = null
                        app.auth.startGoogleSignIn()
                    }) { Text("Continue with Google") }
                }
            }
            if (busy) {
                Spacer(modifier = Modifier.height(8.dp))
                CircularProgressIndicator(modifier = Modifier.size(24.dp))
            }
            status?.let {
                Spacer(modifier = Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.secondary)
            }
        }
        item {
            Text("Playback", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            val automixOn by player.automix.collectAsState()
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Auto-Mix (keep playing when the queue ends)",
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f)
                )
                Switch(
                    checked = automixOn,
                    onCheckedChange = { on -> player.setAutomix(on) }
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            EqualizerSection()
        }
        item {
            Text("About", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "My Music for Android ${BuildConfig.VERSION_NAME} (${BuildConfig.FLAVOR_LABEL} flavor). " +
                    "Playback follows the same Supabase cloud schema as the desktop app. " +
                    "Equalizer, Automix, Sonara visualizer, and DJ Studio remain desktop-only in this release.",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
private fun AddToPlaylistDialog(
    app: MyMusicApp,
    track: Track,
    onDismiss: () -> Unit,
    onAdded: (String) -> Unit
) {
    val scope = rememberCoroutineScope()
    val playlists by app.playlists.observePlaylists().collectAsState(initial = emptyList())
    var newPlaylistName by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                val name = newPlaylistName
                if (name.isNotBlank()) {
                    scope.launch {
                        val pl = app.playlists.createPlaylist(name)
                        app.playlists.addToPlaylist(pl.id, track)
                        onAdded(pl.name)
                    }
                }
            }) { Text("Create & add") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
        title = { Text("Add to playlist") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                playlists.forEach { playlist ->
                    FilterChip(
                        selected = false,
                        onClick = {
                            scope.launch {
                                app.playlists.addToPlaylist(playlist.id, track)
                                onAdded(playlist.name)
                            }
                        },
                        label = { Text(playlist.name + " (${playlist.tracks.size})") }
                    )
                }
                OutlinedTextField(
                    value = newPlaylistName,
                    onValueChange = { newPlaylistName = it },
                    placeholder = { Text("Or a new playlist name") },
                    singleLine = true
                )
            }
        }
    )
}

@Composable
private fun EqualizerSection() {
    val eqOn = remember { mutableStateOf(com.induw.mymusic.player.AudioFx.enabled) }
    val levelsState = remember { mutableStateOf(com.induw.mymusic.player.AudioFx.levels()) }
    val min = remember { com.induw.mymusic.player.AudioFx.minLevel() }
    val max = remember { com.induw.mymusic.player.AudioFx.maxLevel() }
    if (!com.induw.mymusic.player.AudioFx.available) {
        Text(
            "Equalizer starts with the first playback session.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
        )
        return
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text("Equalizer", modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f))
        Switch(
            checked = eqOn.value,
            onCheckedChange = {
                com.induw.mymusic.player.AudioFx.setEnabled(it)
                eqOn.value = it
            }
        )
    }
    if (eqOn.value && levelsState.value.isNotEmpty()) {
        levelsState.value.forEachIndexed { band, level ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    com.induw.mymusic.player.AudioFx.bandLabel(band),
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.size(width = 44.dp, height = 20.dp),
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
                Slider(
                    value = level.toFloat(),
                    onValueChange = { newValue ->
                        val milliBel = newValue.toInt()
                        com.induw.mymusic.player.AudioFx.setLevel(band, milliBel)
                        levelsState.value = levelsState.value.toMutableList()
                            .also { it[band] = milliBel }
                    },
                    valueRange = min.toFloat()..max.toFloat(),
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun TrackRow(
    track: Track,
    playing: Boolean,
    liked: Boolean,
    onPlay: () -> Unit,
    onLike: () -> Unit,
    onAddToPlaylist: () -> Unit,
    onRemove: (() -> Unit)? = null,
    onDownload: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(
                if (playing) MaterialTheme.colorScheme.surface
                else androidx.compose.ui.graphics.Color.Transparent
            )
            .clickable(onClick = onPlay)
            .padding(horizontal = 8.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                track.title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontWeight = FontWeight.SemiBold,
                color = if (playing) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = buildString {
                    append(track.artist)
                    when (track.source) {
                        TrackSource.YOUTUBE -> append(" · YouTube")
                        TrackSource.LOCAL -> append(" · Local")
                        TrackSource.CLOUD_META -> append(" · Cloud")
                    }
                },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.65f),
                style = MaterialTheme.typography.bodySmall
            )
        }
        if (onRemove != null) {
            IconButton(onClick = onRemove) {
                Icon(
                    Icons.Default.Delete,
                    "Remove from playlist",
                    tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                )
            }
        }
        if (onDownload != null && track.source == TrackSource.YOUTUBE) {
            IconButton(onClick = onDownload) {
                Icon(
                    Icons.Default.Download,
                    "Download",
                    tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                )
            }
        }
        IconButton(onClick = onAddToPlaylist) {
            Icon(
                Icons.Default.PlaylistAdd,
                "Add to playlist",
                tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
        }
        IconButton(onClick = onLike) {
            Icon(
                imageVector = if (liked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                contentDescription = "Like",
                tint = if (liked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
private fun MiniPlayer(
    title: String,
    artist: String,
    isPlaying: Boolean,
    shuffleOn: Boolean,
    repeatMode: PlayerController.RepeatMode,
    onToggle: () -> Unit,
    onNext: () -> Unit,
    onPrev: () -> Unit,
    onOpen: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onOpen)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Medium)
            Text(
                artist,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
            )
        }
        IconButton(onClick = onPrev) {
            Icon(Icons.Default.SkipPrevious, "Previous", modifier = Modifier.size(24.dp))
        }
        IconButton(onClick = onToggle) {
            Icon(
                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                contentDescription = if (isPlaying) "Pause" else "Play",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(30.dp)
            )
        }
        IconButton(onClick = onNext) {
            Icon(Icons.Default.SkipNext, "Next", modifier = Modifier.size(24.dp))
        }
    }
}

@Composable
private fun NowPlayingScreen(
    player: PlayerController,
    app: MyMusicApp,
    onClose: () -> Unit
) {
    val track by player.currentTrack.collectAsState()
    val isPlaying by player.isPlaying.collectAsState()
    val shuffleOn by player.shuffle.collectAsState()
    val repeatMode by player.repeatMode.collectAsState()
    val queue by player.queue.collectAsState()
    val currentIndex by player.currentIndex.collectAsState()
    val scope = rememberCoroutineScope()

    // Position ticker for the seek bar.
    var positionMs by remember { mutableStateOf(0L) }
    var durationMs by remember { mutableStateOf(0L) }
    LaunchedEffect(isPlaying, track) {
        while (true) {
            positionMs = player.currentPositionMs()
            durationMs = player.durationMs()
            delay(500)
        }
    }

    // Lyrics: fetch once per track, follow position when synced.
    var lyrics by remember(track) { mutableStateOf<com.induw.mymusic.data.LyricsResult?>(null) }
    LaunchedEffect(track) {
        val t = track ?: return@LaunchedEffect
        runCatching {
            app.lyrics.fetch(t.title, t.artist)
        }.onSuccess { lyrics = it }
    }
    var activeLyric by remember { mutableStateOf<Int>(-1) }
    LaunchedEffect(lyrics, positionMs) {
        val synced = lyrics?.synced ?: return@LaunchedEffect
        activeLyric = synced.indexOfLast { it.timeMs <= positionMs }.takeIf { it >= 0 } ?: -1
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                MaterialTheme.colorScheme.surface.copy(alpha = 0.98f)
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(16.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = {}) {} // leading icon only
                Text("Now Playing", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            }
            val current = track
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                current?.title ?: "Nothing playing",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                maxLines = 2
            )
            Text(
                current?.artist ?: "",
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.height(20.dp))
            Slider(
                value = if (durationMs > 0) positionMs.toFloat() / durationMs else 0f,
                onValueChange = { newValue ->
                    if (durationMs > 0) {
                        positionMs = (newValue * durationMs).toLong()
                        player.seekTo(positionMs)
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )
            Row(modifier = Modifier.fillMaxWidth()) {
                Text(
                    formatMs(positionMs),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    formatMs(durationMs),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }

            // Lyrics area visible when available.
            lyrics?.let { lyr ->
                Spacer(modifier = Modifier.height(12.dp))
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.background)
                        .padding(12.dp)
                ) {
                    if (lyr.synced.isNotEmpty()) {
                        val display = activeLyric.coerceAtLeast(0)
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                lyr.synced.getOrNull(display)?.text ?: "",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.primary,
                                maxLines = 2
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                lyr.synced.getOrNull(display + 1)?.text ?: "",
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                maxLines = 1
                            )
                        }
                    } else if (!lyr.plain.isNullOrEmpty()) {
                        LazyColumn {
                            items(listOf(lyr.plain)) { line ->
                                Text(line)
                            }
                        }
                    } else {
                        Text(
                            "No lyrics found for this track.",
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    }
                }
            } ?: Spacer(modifier = Modifier.weight(1f))

            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { player.toggleShuffle() }) {
                    Icon(
                        Icons.Default.Shuffle,
                        "Shuffle",
                        tint = if (shuffleOn) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurface
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                IconButton(onClick = { player.previous() }) {
                    Icon(Icons.Default.SkipPrevious, "Previous")
                }
                Spacer(modifier = Modifier.width(12.dp))
                IconButton(onClick = { player.previous() }) {
                    Icon(Icons.Default.SkipPrevious, "Previous")
                }
                Spacer(modifier = Modifier.width(12.dp))
                IconButton(onClick = { player.toggle() }) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = "Play/Pause",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(44.dp)
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                IconButton(onClick = { player.next() }) {
                    Icon(Icons.Default.SkipNext, "Next")
                }
                Spacer(modifier = Modifier.width(12.dp))
                IconButton(onClick = { player.cycleRepeat() }) {
                    Icon(
                        if (repeatMode == PlayerController.RepeatMode.ONE) Icons.Default.RepeatOne else Icons.Default.Repeat,
                        "Repeat",
                        tint = if (repeatMode == PlayerController.RepeatMode.OFF)
                            MaterialTheme.colorScheme.onSurface
                        else MaterialTheme.colorScheme.primary
                    )
                }
            }

            if (queue.size > 1) {
                Spacer(modifier = Modifier.height(10.dp))
                Text("Queue", fontWeight = FontWeight.Bold)
                LazyColumn(modifier = Modifier.height(160.dp)) {
                    items(queue.size) { i ->
                        val qTrack = queue[i]
                        Text(
                            text = "${i + 1}. ${qTrack.title}",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = if (i == currentIndex) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { player.jumpTo(i) }
                                .padding(vertical = 6.dp)
                        )
                    }
                }
            } else {
                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    }
}

private fun formatMs(ms: Long): String {
    if (ms <= 0) return "0:00"
    val total = ms / 1000
    return "%d:%02d".format(total / 60, total % 60)
}
