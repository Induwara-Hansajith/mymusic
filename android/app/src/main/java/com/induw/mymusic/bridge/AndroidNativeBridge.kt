package com.induw.mymusic.bridge

import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.induw.mymusic.BuildConfig
import com.induw.mymusic.MainActivity
import com.induw.mymusic.MyMusicApp
import com.induw.mymusic.data.Track
import com.induw.mymusic.data.TrackSource
import com.induw.mymusic.player.PlaybackNotificationManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

class AndroidNativeBridge(
    private val activity: MainActivity,
    private val webView: WebView,
    private val app: MyMusicApp,
    private val notificationManager: PlaybackNotificationManager
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @JavascriptInterface
    fun postMessage(id: String, channel: String, payloadJson: String) {
        scope.launch {
            handleChannel(id, channel, payloadJson)
        }
    }

    private suspend fun handleChannel(id: String, channel: String, payloadJson: String) {
        try {
            val json = if (payloadJson.isNotBlank()) JSONObject(payloadJson) else JSONObject()
            when (channel) {
                "ytm:search" -> {
                    val query = json.optString("query")
                    val filter = json.optString("filter").ifBlank { null }
                    val result = app.catalog.searchStructured(query, filter)
                    val dataJson = mapToJson(result)
                    sendResult(id, true, JSONObject().put("ok", true).put("data", dataJson).toString())
                }

                "ytm:suggestions" -> {
                    val query = json.optString("query")
                    val list = getSuggestions(query)
                    val arr = JSONArray(list)
                    sendResult(id, true, JSONObject().put("ok", true).put("data", arr).toString())
                }

                "ytm:home" -> {
                    val shelves = app.catalog.homeFeed()
                    val arr = JSONArray()
                    for (shelf in shelves) {
                        arr.put(mapToJson(shelf))
                    }
                    sendResult(id, true, JSONObject().put("ok", true).put("data", arr).toString())
                }

                "ytm:stream" -> {
                    val trackId = json.optString("id")
                    val url = app.catalog.resolveStreamUrl(trackId)
                    val urlsArr = JSONArray().put(url)
                    sendResult(id, true, JSONObject().put("ok", true).put("data", JSONObject().put("urls", urlsArr)).toString())
                }

                "ytm:lyrics" -> {
                    val trackObj = json.optJSONObject("track")
                    val title = trackObj?.optString("title").orEmpty()
                    val artist = trackObj?.optString("artist").orEmpty()
                    val lrc = app.lyrics.fetch(title, artist)
                    val syncedArr = JSONArray()
                    lrc?.synced?.forEach {
                        syncedArr.put(JSONObject().put("t", it.timeMs.toDouble() / 1000.0).put("text", it.text))
                    }
                    val resObj = JSONObject()
                        .put("synced", if (lrc?.synced?.isNotEmpty() == true) syncedArr else JSONObject.NULL)
                        .put("plain", lrc?.plain ?: JSONObject.NULL)
                    sendResult(id, true, JSONObject().put("ok", true).put("data", resObj).toString())
                }

                "ytm:radio" -> {
                    val trackId = json.optString("id")
                    val related = app.catalog.radio(trackId)
                    val arr = JSONArray()
                    for (r in related) arr.put(mapToJson(r))
                    sendResult(id, true, JSONObject().put("ok", true).put("data", arr).toString())
                }

                "ytm:artist-thumb" -> {
                    val artistId = json.optString("artistId")
                    val thumb = if (artistId.isNotBlank()) "https://i.ytimg.com/vi/$artistId/hqdefault.jpg" else ""
                    sendResult(id, true, JSONObject().put("ok", true).put("data", JSONObject().put("thumb", thumb).put("id", artistId)).toString())
                }

                "ytm:translate" -> {
                    val text = json.optString("text")
                    val targetLang = json.optString("targetLang", "en")
                    val translated = translateText(text, targetLang)
                    sendResult(id, true, JSONObject().put("ok", true).put("data", translated).toString())
                }

                "player:status" -> {
                    val title = json.optString("title")
                    val artist = json.optString("artist")
                    val artwork = json.optString("artwork")
                    val playing = json.optBoolean("playing", false)
                    notificationManager.update(title, artist, artwork.ifBlank { null }, playing)
                    sendResult(id, true, JSONObject().put("ok", true).put("data", JSONObject.NULL).toString())
                }

                "download:start" -> {
                    val trackJson = json.optJSONObject("track")
                    if (trackJson != null) {
                        val vid = trackJson.optString("id")
                        val t = Track(
                            id = vid,
                            title = trackJson.optString("title", "Unknown"),
                            artist = trackJson.optString("artist", "Unknown"),
                            durationMs = trackJson.optLong("duration", 0L) * 1000L,
                            artworkUrl = trackJson.optString("thumb").ifBlank { null },
                            source = TrackSource.YOUTUBE,
                            mediaUri = "https://www.youtube.com/watch?v=$vid",
                            youtubeVideoId = vid
                        )
                        val path = app.catalog.saveToDownloads(activity, t)
                        sendResult(id, true, JSONObject().put("ok", true).put("data", JSONObject().put("path", path)).toString())
                    } else {
                        sendResult(id, false, JSONObject().put("ok", false).put("error", "No track provided").toString())
                    }
                }

                "auth:get-user" -> {
                    val email = app.auth.currentEmail()
                    val userObj = if (app.auth.isSignedIn() && email.isNotBlank()) {
                        JSONObject()
                            .put("id", email)
                            .put("email", email)
                            .put("name", email.substringBefore("@"))
                            .put("avatarUrl", JSONObject.NULL)
                    } else {
                        JSONObject.NULL
                    }
                    val resObj = JSONObject()
                        .put("user", userObj)
                        .put("sync", JSONObject().put("status", "idle"))
                    sendResult(id, true, JSONObject().put("ok", true).put("data", resObj).toString())
                }

                "auth:signin-google" -> {
                    val authUrl = "${BuildConfig.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=mymusic://auth-callback"
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(authUrl)).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    activity.startActivity(intent)
                    sendResult(id, true, JSONObject().put("ok", true).put("data", JSONObject().put("opened", true)).toString())
                }

                "auth:signout" -> {
                    app.auth.signOut()
                    sendEvent("auth:state-changed", JSONObject().put("user", JSONObject.NULL).toString())
                    sendResult(id, true, JSONObject().put("ok", true).put("data", JSONObject.NULL).toString())
                }

                "auth:sync-now" -> {
                    app.refreshSyncToken()
                    sendResult(id, true, JSONObject().put("ok", true).put("data", JSONObject().put("status", "synced")).toString())
                }

                else -> {
                    sendResult(id, true, JSONObject().put("ok", true).put("data", JSONObject.NULL).toString())
                }
            }
        } catch (e: Exception) {
            val errJson = JSONObject().put("ok", false).put("error", e.message ?: "Native error").toString()
            sendResult(id, false, errJson)
        }
    }

    private fun getSuggestions(query: String): List<String> {
        val q = query.trim()
        if (q.isEmpty()) return emptyList()
        val list = mutableListOf<String>()
        try {
            val url = "https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${URLEncoder.encode(q, "UTF-8")}"
            val req = Request.Builder().url(url).build()
            app.http.newCall(req).execute().use { resp ->
                val body = resp.body?.string().orEmpty()
                val start = body.indexOf("[[")
                val end = body.indexOf("]]")
                if (start != -1 && end != -1) {
                    val inner = body.substring(start + 2, end)
                    val parts = inner.split("],[")
                    for (part in parts) {
                        val s = part.substringAfter("\"").substringBefore("\"")
                        if (s.isNotBlank()) list.add(s)
                    }
                }
            }
        } catch (_: Exception) {}
        return list
    }

    private fun translateText(text: String, targetLang: String): String {
        if (text.isBlank()) return text
        return try {
            val url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${URLEncoder.encode(targetLang, "UTF-8")}&dt=t&q=${URLEncoder.encode(text, "UTF-8")}"
            app.http.newCall(Request.Builder().url(url).build()).execute().use { resp ->
                val body = resp.body?.string().orEmpty()
                val arr = JSONArray(body)
                val segments = arr.optJSONArray(0)
                if (segments != null) {
                    val sb = StringBuilder()
                    for (i in 0 until segments.length()) {
                        val seg = segments.optJSONArray(i)
                        if (seg != null) sb.append(seg.optString(0))
                    }
                    if (sb.isNotEmpty()) sb.toString() else text
                } else text
            }
        } catch (_: Exception) {
            text
        }
    }

    private fun sendResult(id: String, success: Boolean, jsonResult: String) {
        activity.runOnUiThread {
            val escaped = jsonResult.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
            webView.evaluateJavascript("window.__onAndroidResult('$id', $success, '$escaped')", null)
        }
    }

    fun sendEvent(event: String, jsonPayload: String) {
        activity.runOnUiThread {
            val escaped = jsonPayload.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
            webView.evaluateJavascript("window.__onAndroidEvent('$event', '$escaped')", null)
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun mapToJson(map: Map<String, Any?>): JSONObject {
        val obj = JSONObject()
        for ((k, v) in map) {
            when (v) {
                null -> obj.put(k, JSONObject.NULL)
                is Map<*, *> -> obj.put(k, mapToJson(v as Map<String, Any?>))
                is List<*> -> obj.put(k, listToJson(v))
                else -> obj.put(k, v)
            }
        }
        return obj
    }

    @Suppress("UNCHECKED_CAST")
    private fun listToJson(list: List<*>): JSONArray {
        val arr = JSONArray()
        for (item in list) {
            when (item) {
                null -> arr.put(JSONObject.NULL)
                is Map<*, *> -> arr.put(mapToJson(item as Map<String, Any?>))
                is List<*> -> arr.put(listToJson(item))
                else -> arr.put(item)
            }
        }
        return arr
    }
}

