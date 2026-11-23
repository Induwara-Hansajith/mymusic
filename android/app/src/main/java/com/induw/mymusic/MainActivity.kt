package com.induw.mymusic

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import com.induw.mymusic.bridge.AndroidNativeBridge
import com.induw.mymusic.player.PlaybackNotificationManager
import com.induw.mymusic.ui.UiScope
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var bridge: AndroidNativeBridge? = null
    private var notificationManager: PlaybackNotificationManager? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as MyMusicApp

        window.setFlags(android.view.WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED, android.view.WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = false
        window.statusBarColor = Color.parseColor("#07090E")
        window.navigationBarColor = Color.parseColor("#07090E")

        requestStartupPermissions()

        notificationManager = PlaybackNotificationManager(this, app.http)

        val wv = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#07090E"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                cacheMode = WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                setRenderPriority(WebSettings.RenderPriority.HIGH)
                builtInZoomControls = false
                displayZoomControls = false
            }
        }
        webView = wv

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url ?: return null
                return assetLoader.shouldInterceptRequest(url)
            }
        }

        val b = AndroidNativeBridge(this, wv, app, notificationManager!!)
        bridge = b
        wv.addJavascriptInterface(b, "AndroidNative")

        setContentView(wv)

        wv.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")

        onBackPressedDispatcher.addCallback(this) {
            wv.evaluateJavascript(
                "(function() { " +
                    "  var np = document.getElementById('nowPlayingOverlay'); " +
                    "  if (np && !np.classList.contains('hidden')) { np.classList.add('hidden'); return 'true'; } " +
                    "  var sb = document.getElementById('sidebar'); " +
                    "  if (sb && sb.classList.contains('mobile-open')) { " +
                    "    sb.classList.remove('mobile-open'); " +
                    "    var bd = document.getElementById('sidebarBackdrop'); if (bd) bd.classList.remove('mobile-open'); " +
                    "    return 'true'; " +
                    "  } " +
                    "  var backBtn = document.getElementById('btnBack'); " +
                    "  if (backBtn && !backBtn.disabled) { backBtn.click(); return 'true'; } " +
                    "  return 'false'; " +
                    "})()"
            ) { result ->
                if (result == "\"false\"" || result == "false") {
                    moveTaskToBack(true)
                }
            }
        }

        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val action = intent?.action
        when (action) {
            PlaybackNotificationManager.ACTION_TOGGLE -> bridge?.sendEvent("cmd:toggle", "{}")
            PlaybackNotificationManager.ACTION_NEXT -> bridge?.sendEvent("cmd:next", "{}")
            PlaybackNotificationManager.ACTION_PREV -> bridge?.sendEvent("cmd:prev", "{}")
        }

        val data: Uri? = intent?.data
        if (data != null && data.scheme == "mymusic" && data.host == "auth-callback") {
            handleAuthRedirect(data)
        }
    }

    private fun handleAuthRedirect(uri: Uri) {
        val app = application as MyMusicApp
        if (app.auth.handleRedirect(uri)) {
            app.refreshSyncToken()
            UiScope.launch {
                app.auth.completePendingSignIn()
                app.refreshSyncToken()
                val email = app.auth.currentEmail()
                val userObj = if (app.auth.isSignedIn() && email.isNotBlank()) {
                    JSONObject()
                        .put("id", email)
                        .put("email", email)
                        .put("name", email.substringBefore("@"))
                        .put("avatarUrl", JSONObject.NULL)
                } else JSONObject.NULL
                bridge?.sendEvent("auth:state-changed", JSONObject().put("user", userObj).toString())
            }
        }
    }

    private fun requestStartupPermissions() {
        val needed = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_AUDIO)
                != PackageManager.PERMISSION_GRANTED
            ) {
                needed += Manifest.permission.READ_MEDIA_AUDIO
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                needed += Manifest.permission.POST_NOTIFICATIONS
            }
        } else if (Build.VERSION.SDK_INT >= 23) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED
            ) {
                needed += Manifest.permission.READ_EXTERNAL_STORAGE
            }
        }
        if (needed.isNotEmpty()) permissionLauncher.launch(needed.toTypedArray())
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= TRIM_MEMORY_MODERATE) {
            webView?.clearCache(false)
        }
    }

    override fun onDestroy() {
        notificationManager?.cancel()
        webView?.destroy()
        webView = null
        super.onDestroy()
    }
}


