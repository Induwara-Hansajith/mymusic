package com.induw.mymusic.ui

import android.content.ComponentName
import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Player.REPEAT_MODE_OFF
import androidx.media3.common.Player.REPEAT_MODE_ONE
import androidx.media3.common.Player.REPEAT_MODE_ALL
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import com.induw.mymusic.data.Track
import com.induw.mymusic.player.PlaybackService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class PlayerController(context: Context) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null

    /** Resolves a track to a playable URI the moment it becomes current (YT streams). */
    var resolver: (suspend (Track) -> String)? = null
    private val trackById = HashMap<String, Track>()
    private var resolvingIndex = -1

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentTrack = MutableStateFlow<Track?>(null)
    val currentTrack: StateFlow<Track?> = _currentTrack.asStateFlow()

    private val _queue = MutableStateFlow<List<Track>>(emptyList())
    val queue: StateFlow<List<Track>> = _queue.asStateFlow()

    private val _currentIndex = MutableStateFlow(-1)
    val currentIndex: StateFlow<Int> = _currentIndex.asStateFlow()

    private val _shuffle = MutableStateFlow(false)
    val shuffle: StateFlow<Boolean> = _shuffle.asStateFlow()

    private val _repeatMode = MutableStateFlow(RepeatMode.OFF)
    val repeatMode: StateFlow<RepeatMode> = _repeatMode.asStateFlow()

    private val _hasQueue = MutableStateFlow(false)
    val hasQueue: StateFlow<Boolean> = _hasQueue.asStateFlow()

    private val _automix = MutableStateFlow(false)
    val automix: StateFlow<Boolean> = _automix.asStateFlow()

    /** Current browsable list (library/search/playlist) used to extend the queue. */
    var automixSource: (() -> List<Track>)? = null

    enum class RepeatMode { OFF, ALL, ONE }

    suspend fun ensureConnected() {
        if (controller != null) return
        val token = SessionToken(
            appContext,
            ComponentName(appContext, PlaybackService::class.java)
        )
        val future = MediaController.Builder(appContext, token).buildAsync()
        controllerFuture = future
        val c = future.awaitFuture()
        controller = c
        c.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _isPlaying.value = isPlaying
            }

            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                val idx = c.currentMediaItemIndex
                _currentIndex.value = idx
                val item = mediaItem
                if (item != null) {
                    _currentTrack.value = trackById[item.mediaId]
                    item.mediaId.takeIf { it.startsWith("yt:") || it.startsWith("meta:") }
                        ?.let { lazyResolve(c, idx) }
                }
                maybeAutomix(c)
            }

            override fun onShuffleModeEnabledChanged(enabled: Boolean) {
                _shuffle.value = enabled
            }

            override fun onRepeatModeChanged(repeatMode: Int) {
                _repeatMode.value = when (repeatMode) {
                    REPEAT_MODE_ONE -> RepeatMode.ONE
                    REPEAT_MODE_ALL -> RepeatMode.ALL
                    else -> RepeatMode.OFF
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                // Skip to the next track on a bad stream, mirroring desktop behavior.
                if (c.hasNextMediaItem()) c.seekToNextMediaItem() else c.pause()
            }
        })
        _isPlaying.value = c.isPlaying
        _currentTrack.value = c.currentMediaItem?.let { trackById[it.mediaId] }
    }

    /** Plays one track immediately as a single-item queue. */
    suspend fun play(track: Track, resolvedUri: String) {
        playQueue(listOf(track), 0, listOf(resolvedUri))
    }

    /** Plays a whole queue; resolvedUrs may be shorter and is completed lazily per track. */
    suspend fun playQueue(
        tracks: List<Track>,
        startIndex: Int = 0,
        resolvedUris: List<String> = emptyList()
    ) {
        ensureConnected()
        val c = controller ?: return
        tracks.forEach { trackById[it.id] = it }
        _queue.value = tracks
        _hasQueue.value = tracks.size > 1
        val items = tracks.mapIndexed { i, t ->
            val uri = resolvedUris.getOrNull(i)
                ?: (if (t.source == com.induw.mymusic.data.TrackSource.LOCAL) t.mediaUri else null)
            buildItem(t, uri ?: "mymusic://pending/${t.id}")
        }
        c.setMediaItems(items, startIndex.coerceIn(0, (tracks.size - 1).coerceAtLeast(0)), 0)
        c.prepare()
        c.play()
        // Resolve the first track straight away so playback starts.
        lazyResolve(c, c.currentMediaItemIndex)
    }

    fun toggle() {
        val c = controller ?: return
        if (c.isPlaying) c.pause() else c.play()
    }

    fun next() {
        controller?.takeIf { it.hasNextMediaItem() }?.seekToNextMediaItem()
            ?: controller?.run { seekTo(0) }
    }

    fun previous() {
        val c = controller ?: return
        if (c.hasPreviousMediaItem()) c.seekToPreviousMediaItem() else c.seekTo(0)
    }

    fun seekTo(positionMs: Long) {
        controller?.seekTo(positionMs)
    }

    fun setAutomix(on: Boolean) {
        _automix.value = on
        if (on) controller?.let { maybeAutomix(it) }
    }

    /** Appends more songs when the queue is nearly spent (desktop Automix behavior, mobile cut). */
    private fun maybeAutomix(c: MediaController) {
        if (!_automix.value) return
        if (c.mediaItemCount - c.currentMediaItemIndex > 2) return
        val source = automixSource?.invoke().orEmpty()
        if (source.isEmpty()) return
        val inQueue = (0 until c.mediaItemCount).mapNotNull { i ->
            trackById[c.getMediaItemAt(i).mediaId]?.id
        }.toHashSet()
        val additions = source.filter { it.id !in inQueue }.take(10)
        if (additions.isEmpty()) return
        additions.forEach { trackById[it.id] = it }
        c.addMediaItems(additions.map { t ->
            buildItem(
                t,
                if (t.source == com.induw.mymusic.data.TrackSource.LOCAL) t.mediaUri
                else "mymusic://pending/${t.id}"
            )
        })
        _queue.value = _queue.value + additions
    }

    fun toggleShuffle() {
        val c = controller ?: return
        c.shuffleModeEnabled = !c.shuffleModeEnabled
    }

    fun cycleRepeat() {
        val c = controller ?: return
        c.repeatMode = when (c.repeatMode) {
            REPEAT_MODE_OFF -> REPEAT_MODE_ALL
            REPEAT_MODE_ALL -> REPEAT_MODE_ONE
            else -> REPEAT_MODE_OFF
        }
    }

    fun jumpTo(index: Int) {
        controller?.seekToDefaultPosition(index)
    }

    fun currentPositionMs(): Long = controller?.currentPosition ?: 0
    fun durationMs(): Long {
        val c = controller ?: return 0
        val d = c.duration
        return if (d > 0) d else 0
    }

    fun queueTracksByTimeline(): List<Track> {
        val c = controller ?: return _queue.value
        val timeline = c.currentTimeline
        if (timeline.isEmpty) return _queue.value
        val out = ArrayList<Track>(timeline.windowCount)
        for (i in 0 until timeline.windowCount) {
            val window = timeline.getWindow(i, androidx.media3.common.Timeline.Window())
            trackById[window.mediaItem.mediaId]?.let { out.add(it) }
        }
        return out.ifEmpty { _queue.value }
    }

    private fun buildItem(track: Track, uri: String): MediaItem =
        MediaItem.Builder()
            .setMediaId(track.id)
            .setUri(uri)
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(track.title)
                    .setArtist(track.artist)
                    .setAlbumTitle(track.album)
                    .build()
            )
            .build()

    /** Swaps a placeholder item for the real stream URI when its turn arrives. */
    private fun lazyResolve(c: MediaController, index: Int) {
        if (index == resolvingIndex) return
        val track = c.currentMediaItem?.let { trackById[it.mediaId] } ?: return
        if (track.source == com.induw.mymusic.data.TrackSource.LOCAL) return
        val resolve = resolver ?: return
        resolvingIndex = index
        scope.launch {
            runCatching { resolve(track) }
                .onSuccess { uri ->
                    runCatching { c.replaceMediaItem(index, buildItem(track, uri)) }
                }
                .onFailure {
                    runCatching { if (c.hasNextMediaItem()) c.seekToNextMediaItem() else c.pause() }
                }
        }
    }

    fun release() {
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controller = null
        controllerFuture = null
    }
}

private suspend fun <T> ListenableFuture<T>.awaitFuture(): T =
    suspendCancellableCoroutine { cont ->
        addListener(
            {
                try {
                    cont.resume(get())
                } catch (e: Exception) {
                    cont.resumeWithException(e)
                }
            },
            MoreExecutors.directExecutor()
        )
        cont.invokeOnCancellation { cancel(true) }
    }
