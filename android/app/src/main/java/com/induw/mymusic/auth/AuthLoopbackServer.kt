package com.induw.mymusic.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import com.induw.mymusic.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.io.PrintWriter
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket

/**
 * Local loopback OAuth server for Supabase Google Sign-In on Android.
 * Runs on 127.0.0.1:54321, matching the exact whitelisted redirect URL used by desktop.
 * Intercepts auth credentials and notifies the app.
 */
class AuthLoopbackServer(
    private val context: Context,
    private val authManager: AuthManager
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var serverJob: Job? = null
    private var serverSocket: ServerSocket? = null

    companion object {
        private const val TAG = "AuthLoopbackServer"
        private const val PORT = 54321
        private const val REDIRECT_URL = "http://127.0.0.1:54321/auth/callback"
    }

    @Synchronized
    fun start(onComplete: (Boolean) -> Unit) {
        stop()

        serverJob = scope.launch {
            try {
                val srv = ServerSocket(PORT, 10, InetAddress.getByName("127.0.0.1")).apply {
                    reuseAddress = true
                    soTimeout = 180_000 // 3 minutes timeout
                }
                serverSocket = srv
                Log.d(TAG, "Auth loopback server listening on 127.0.0.1:$PORT")

                val authUrl = "${BuildConfig.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${Uri.encode(REDIRECT_URL)}"
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(authUrl)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)

                while (isActive && !srv.isClosed) {
                    val client = try {
                        srv.accept()
                    } catch (e: Exception) {
                        break
                    }
                    handleClient(client, onComplete)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Server error", e)
                onComplete(false)
            } finally {
                stop()
            }
        }
    }

    private fun handleClient(client: Socket, onComplete: (Boolean) -> Unit) {
        scope.launch {
            try {
                val reader = BufferedReader(InputStreamReader(client.getInputStream(), Charsets.UTF_8))
                val firstLine = reader.readLine() ?: return@launch
                val parts = firstLine.split(" ")
                if (parts.size < 2) return@launch
                val rawPath = parts[1]
                val uri = Uri.parse("http://127.0.0.1:$PORT$rawPath")
                val path = uri.path ?: "/"

                val writer = PrintWriter(OutputStreamWriter(client.getOutputStream(), Charsets.UTF_8), true)

                if (path == "/auth/callback") {
                    val htmlBytes = CALLBACK_HTML.toByteArray(Charsets.UTF_8)
                    writer.print("HTTP/1.1 200 OK\r\n")
                    writer.print("Content-Type: text/html; charset=utf-8\r\n")
                    writer.print("Content-Length: ${htmlBytes.size}\r\n")
                    writer.print("Connection: close\r\n\r\n")
                    writer.flush()
                    client.getOutputStream().write(htmlBytes)
                    client.getOutputStream().flush()
                } else if (path == "/token") {
                    val token = uri.getQueryParameter("access_token")
                    val refresh = uri.getQueryParameter("refresh_token")
                    val code = uri.getQueryParameter("code")
                    val error = uri.getQueryParameter("error")

                    val jsonResp = "{\"ok\":true}"
                    val jsonBytes = jsonResp.toByteArray(Charsets.UTF_8)
                    writer.print("HTTP/1.1 200 OK\r\n")
                    writer.print("Content-Type: application/json; charset=utf-8\r\n")
                    writer.print("Access-Control-Allow-Origin: *\r\n")
                    writer.print("Content-Length: ${jsonBytes.size}\r\n")
                    writer.print("Connection: close\r\n\r\n")
                    writer.flush()
                    client.getOutputStream().write(jsonBytes)
                    client.getOutputStream().flush()

                    if (!error.isNullOrBlank()) {
                        Log.w(TAG, "OAuth error: $error")
                        onComplete(false)
                        stop()
                    } else if (!token.isNullOrBlank()) {
                        val user = authManager.completeDirectSession(token, refresh)
                        Log.d(TAG, "Direct session stored for: ${user?.email}")
                        onComplete(user != null)
                        stop()
                    } else if (!code.isNullOrBlank()) {
                        val user = authManager.completeWithCode(code)
                        Log.d(TAG, "Exchanged code for: ${user?.email}")
                        onComplete(user != null)
                        stop()
                    }
                } else {
                    writer.print("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n")
                    writer.flush()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling client request", e)
            } finally {
                try { client.close() } catch (_: Exception) {}
            }
        }
    }

    @Synchronized
    fun stop() {
        try { serverSocket?.close() } catch (_: Exception) {}
        serverSocket = null
        serverJob?.cancel()
        serverJob = null
    }
}

private val CALLBACK_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Music - Sign-In</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #07090e; color: #f8fafc;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;
    }
    .card {
      background: #141824; border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px; padding: 36px 32px; max-width: 440px; text-align: center;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6); width: 100%;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin: 0 0 10px; font-weight: 700; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.5; margin: 0 0 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon" id="icon">🔄</div>
    <h1 id="title">Completing Sign-In...</h1>
    <p id="desc">Connecting your account with My Music. Please wait a moment.</p>
  </div>
  <script>
    (async () => {
      try {
        let params = new URLSearchParams(window.location.search);
        if (window.location.hash && window.location.hash.length > 1) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          for (const [k, v] of hashParams.entries()) { params.set(k, v); }
        }
        const token = params.get('access_token');
        const refresh = params.get('refresh_token');
        const code = params.get('code');
        const error = params.get('error_description') || params.get('error');

        if (error) {
          document.getElementById('icon').textContent = '⚠️';
          document.getElementById('title').textContent = 'Sign-In Failed';
          document.getElementById('desc').textContent = error;
          await fetch('/token?error=' + encodeURIComponent(error));
          return;
        }

        if (token) {
          const res = await fetch('/token?access_token=' + encodeURIComponent(token) + '&refresh_token=' + encodeURIComponent(refresh || ''));
          if (res.ok) {
            document.getElementById('icon').textContent = '✅';
            document.getElementById('title').textContent = 'Sign-In Successful!';
            document.getElementById('desc').textContent = 'Returning to My Music...';
            window.location.href = 'mymusic://auth-callback?done=1';
            setTimeout(() => { try { window.close(); } catch {} }, 1200);
          }
          return;
        }

        if (code) {
          const res = await fetch('/token?code=' + encodeURIComponent(code));
          if (res.ok) {
            document.getElementById('icon').textContent = '✅';
            document.getElementById('title').textContent = 'Sign-In Successful!';
            document.getElementById('desc').textContent = 'Returning to My Music...';
            window.location.href = 'mymusic://auth-callback?done=1';
            setTimeout(() => { try { window.close(); } catch {} }, 1200);
          }
          return;
        }

        document.getElementById('icon').textContent = '⚠️';
        document.getElementById('title').textContent = 'Sign-In Incomplete';
        document.getElementById('desc').textContent = 'No authentication token received.';
      } catch (err) {
        document.getElementById('icon').textContent = '⚠️';
        document.getElementById('title').textContent = 'Connection Error';
        document.getElementById('desc').textContent = err.message || 'Could not communicate with My Music app.';
      }
    })();
  </script>
</body>
</html>
""".trimIndent()
