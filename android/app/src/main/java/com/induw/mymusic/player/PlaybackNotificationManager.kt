package com.induw.mymusic.player

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.induw.mymusic.MainActivity
import com.induw.mymusic.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request

class PlaybackNotificationManager(
    private val context: Context,
    private val http: OkHttpClient
) {
    companion object {
        const val CHANNEL_ID = "mymusic_playback_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_TOGGLE = "com.induw.mymusic.ACTION_TOGGLE"
        const val ACTION_NEXT = "com.induw.mymusic.ACTION_NEXT"
        const val ACTION_PREV = "com.induw.mymusic.ACTION_PREV"
    }

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val powerManager =
        context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private var wakeLock: PowerManager.WakeLock? = null
    private val scope = CoroutineScope(Dispatchers.IO + Job())

    private var currentTitle: String = "My Music"
    private var currentArtist: String = "Playing"
    private var currentArtworkUrl: String? = null
    private var currentBitmap: Bitmap? = null
    private var isPlaying: Boolean = false

    init {
        createChannel()
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "MyMusic:PlaybackWakeLock"
        ).apply { setReferenceCounted(false) }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Playback Controls",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows now playing controls and lockscreen widget"
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun update(
        title: String?,
        artist: String?,
        artworkUrl: String?,
        playing: Boolean
    ) {
        val t = title?.ifBlank { null } ?: currentTitle
        val a = artist?.ifBlank { null } ?: currentArtist
        val changed = (t != currentTitle) || (a != currentArtist) || (playing != isPlaying)
        currentTitle = t
        currentArtist = a
        isPlaying = playing

        if (playing) {
            runCatching { wakeLock?.acquire(24 * 60 * 60 * 1000L) }
        } else {
            runCatching { if (wakeLock?.isHeld == true) wakeLock?.release() }
        }

        if (artworkUrl != null && artworkUrl != currentArtworkUrl) {
            currentArtworkUrl = artworkUrl
            scope.launch {
                loadArtwork(artworkUrl)
                showNotification()
            }
        } else {
            showNotification()
        }
    }

    private fun loadArtwork(url: String) {
        try {
            val req = Request.Builder().url(url).build()
            http.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) {
                    resp.body?.byteStream()?.use { stream ->
                        currentBitmap = BitmapFactory.decodeStream(stream)
                    }
                }
            }
        } catch (_: Exception) {
            currentBitmap = null
        }
    }

    private fun showNotification() {
        val openIntent = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val prevIntent = PendingIntent.getActivity(
            context,
            1,
            Intent(context, MainActivity::class.java).apply {
                action = ACTION_PREV
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val toggleIntent = PendingIntent.getActivity(
            context,
            2,
            Intent(context, MainActivity::class.java).apply {
                action = ACTION_TOGGLE
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val nextIntent = PendingIntent.getActivity(
            context,
            3,
            Intent(context, MainActivity::class.java).apply {
                action = ACTION_NEXT
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val playPauseText = if (isPlaying) "Pause" else "Play"

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setContentIntent(openIntent)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevIntent)
            .addAction(
                if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                playPauseText,
                toggleIntent
            )
            .addAction(android.R.drawable.ic_media_next, "Next", nextIntent)
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setShowActionsInCompactView(0, 1, 2)
            )

        currentBitmap?.let { builder.setLargeIcon(it) }

        notificationManager.notify(NOTIFICATION_ID, builder.build())
    }

    fun cancel() {
        runCatching { if (wakeLock?.isHeld == true) wakeLock?.release() }
        notificationManager.cancel(NOTIFICATION_ID)
    }
}
