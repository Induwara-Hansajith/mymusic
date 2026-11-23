package com.induw.mymusic.player

import android.media.audiofx.Equalizer

/**
 * Device equalizer attached to the Media3 player's audio session by [PlaybackService].
 * Read and adjusted directly from the Settings screen (same process).
 */
object AudioFx {
    private var equalizer: Equalizer? = null
    var failedReason: String? = null
        private set

    fun attach(audioSessionId: Int) {
        if (equalizer != null) return
        runCatching { equalizer = Equalizer(0, audioSessionId).apply { enabled = false } }
            .onFailure { failedReason = it.message }
    }

    val available: Boolean get() = equalizer != null
    val enabled: Boolean get() = equalizer?.enabled ?: false

    fun setEnabled(on: Boolean) {
        equalizer?.enabled = on
    }

    fun bandCount(): Int = equalizer?.numberOfBands?.toInt() ?: 0

    fun minLevel(): Int {
        val range = equalizer?.bandLevelRange ?: return -1500
        return range[0].toInt()
    }

    fun maxLevel(): Int {
        val range = equalizer?.bandLevelRange ?: return 1500
        return range[1].toInt()
    }

    fun levels(): List<Int> {
        val eq = equalizer ?: return emptyList()
        return (0 until eq.numberOfBands).map { eq.getBandLevel(it.toShort()).toInt() }
    }

    fun setLevel(band: Int, milliBel: Int) {
        equalizer?.setBandLevel(band.toShort(), milliBel.toShort())
    }

    fun bandLabel(band: Int): String {
        val eq = equalizer ?: return ""
        // centerFreq returns milliHz
        val mHz = eq.getCenterFreq(band.toShort())
        val hz = mHz / 1000
        return if (hz >= 1000) "%.1fk".format(hz / 1000f) else "${hz}Hz"
    }

    fun detach() {
        equalizer?.release()
        equalizer = null
    }
}
