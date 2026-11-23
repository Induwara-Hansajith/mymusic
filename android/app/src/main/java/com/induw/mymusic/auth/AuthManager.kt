package com.induw.mymusic.auth

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import com.induw.mymusic.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Serializable
data class Session(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String? = null,
    @SerialName("expires_in") val expiresIn: Long = 3600
)

@Serializable
data class SupabaseUser(
    val id: String,
    val email: String? = null
)

/**
 * Supabase Google OAuth via the same flow the desktop app uses:
 * browser -> redirect_to mymusic://auth-callback?code=... -> POST /auth/v1/token {auth_code}.
 * Kept as the single source of the access token for [com.induw.mymusic.sync.SupabaseSync].
 */
class AuthManager(context: Context, private val http: OkHttpClient) {

    companion object {
        const val CALLBACK_SCHEME = "mymusic"
        const val CALLBACK_HOST = "auth-callback"
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val media = "application/json".toMediaType()
    private val appContext = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences("mymusic.auth", Context.MODE_PRIVATE)

    @Volatile
    private var pendingCode: String? = null

    fun currentSession(): Session? = prefs.getString("access", null)?.let { access ->
        Session(
            accessToken = access,
            refreshToken = prefs.getString("refresh", null),
            expiresIn = prefs.getLong("expiresIn", 3600)
        )
    }

    fun currentEmail(): String = prefs.getString("email", null).orEmpty()

    fun isSignedIn(): Boolean = currentSession() != null

    private val loopbackServer = AuthLoopbackServer(appContext, this)

    fun startGoogleSignIn() {
        startGoogleSignInLoopback { }
    }

    fun startGoogleSignInLoopback(onComplete: (Boolean) -> Unit) {
        loopbackServer.start(onComplete)
    }

    suspend fun completeDirectSession(accessToken: String, refreshToken: String?): SupabaseUser? = withContext(Dispatchers.IO) {
        val session = Session(
            accessToken = accessToken,
            refreshToken = refreshToken?.ifBlank { null },
            expiresIn = 3600
        )
        storeSession(session)
        val u = fetchUser()
        u?.let { saveEmail(it.email) }
        u
    }

    suspend fun completeWithCode(code: String): SupabaseUser? = withContext(Dispatchers.IO) {
        if (exchangeCode(code)) {
            val u = fetchUser()
            u?.let { saveEmail(it.email) }
            u
        } else {
            null
        }
    }

    /** Returns true when the intent was an auth callback. */
    fun handleRedirect(uri: Uri?): Boolean {
        if (uri == null || uri.scheme != CALLBACK_SCHEME || uri.host != CALLBACK_HOST) return false
        uri.getQueryParameter("error")?.let { pendingCode = "error:$it" }
        uri.getQueryParameter("code")?.let { pendingCode = it }
        return true
    }

    /** Complete any pending sign-in. Returns the user email on success. */
    suspend fun completePendingSignIn(): String? = withContext(Dispatchers.IO) {
        val pending = pendingCode
        pendingCode = null
        when {
            pending == null -> currentEmail().ifEmpty { null }
            pending.startsWith("error:") -> null
            else -> {
                if (exchangeCode(pending.removePrefix("error:")) && fetchUser() != null) {
                    currentEmail().ifEmpty { "Google account" }
                } else {
                    null
                }
            }        }
    }

    private suspend fun exchangeCode(code: String): Boolean = runCatching {
        val body = json.encodeToString(
            kotlinx.serialization.json.JsonObject.serializer(),
            kotlinx.serialization.json.buildJsonObject {
                put("auth_code", kotlinx.serialization.json.JsonPrimitive(code))
            }
        )
        val req = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/auth/v1/token?grant_type=pkce")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .post(body.toRequestBody(media))
            .build()
        http.newCall(req).execute().use { resp ->
            val data = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) return@use false
            val session = runCatching { json.decodeFromString<Session>(data) }.getOrNull()
                ?: return@use false
            storeSession(session)
            fetchUser()?.let { saveEmail(it.email) }
            true
        }
    }.getOrDefault(false)

    private suspend fun fetchUser(): SupabaseUser? {
        val token = currentSession()?.accessToken ?: return null
        val req = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/auth/v1/user")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .get()
            .build()
        return runCatching {
            http.newCall(req).execute().use { resp ->
                val data = resp.body?.string().orEmpty()
                if (!resp.isSuccessful) return@use null
                runCatching { json.decodeFromString<SupabaseUser>(data) }.getOrNull()
            }
        }.getOrNull()
    }

    /** Validated user id, refreshing the access token once if needed. */
    suspend fun currentUserId(): String? {
        fetchUser()?.let { saveEmail(it.email); return it.id }
        if (refreshAccessToken() && fetchUser() != null) {
            return fetchUser()?.id
        }
        return null
    }

    private fun saveEmail(email: String?) {
        email?.let { prefs.edit().putString("email", it).apply() }
    }

    suspend fun refreshAccessToken(): Boolean = withContext(Dispatchers.IO) {
        val refresh = currentSession()?.refreshToken ?: return@withContext false
        val req = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .post("{\"grant_type\":\"refresh_token\",\"refresh_token\":\"$refresh\"}".toRequestBody(media))
            .build()
        runCatching {
            http.newCall(req).execute().use { resp ->
                val data = resp.body?.string().orEmpty()
                if (!resp.isSuccessful) return@use false
                runCatching { json.decodeFromString<Session>(data) }.getOrNull()?.let {
                    storeSession(it)
                    true
                } ?: false
            }
        }.getOrDefault(false)
    }

    suspend fun signOut() {
        currentSession()?.let {
            runCatching {
                val req = Request.Builder()
                    .url("${BuildConfig.SUPABASE_URL}/auth/v1/logout")
                    .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    .header("Authorization", "Bearer ${it.accessToken}")
                    .post("{}".toRequestBody(media))
                    .build()
                http.newCall(req).execute().close()
            }
        }
        prefs.edit().clear().apply()
    }

    private fun storeSession(s: Session) {
        prefs.edit()
            .putString("access", s.accessToken)
            .putString("refresh", s.refreshToken)
            .putLong("expiresIn", s.expiresIn)
            .apply()
    }
}
