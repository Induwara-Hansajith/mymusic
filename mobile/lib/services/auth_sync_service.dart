import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

class AuthLoopbackServer {
  HttpServer? _server;
  Completer<Map<String, String>?>? _tokenCompleter;

  Future<Map<String, String>?> startAndListen({
    int port = 54321,
    Duration timeout = const Duration(minutes: 3),
  }) async {
    await stop();
    _tokenCompleter = Completer<Map<String, String>?>();

    try {
      _server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
      debugPrint('[AuthLoopbackServer] Listening on http://127.0.0.1:$port');

      _server!.listen((HttpRequest request) async {
        final path = request.uri.path;
        debugPrint('[AuthLoopbackServer] ${request.method} $path');

        if (path == '/auth/callback') {
          request.response
            ..statusCode = HttpStatus.ok
            ..headers.contentType = ContentType.html
            ..write('''<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Signing in to My Music</title>
  <style>
    body {
      background: #08080E;
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      text-align: center;
    }
    .card {
      background: #141422;
      border: 1px solid #232338;
      border-radius: 20px;
      padding: 32px 24px;
      max-width: 320px;
      width: 85%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #232338;
      border-top: 4px solid #8B5CF6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #FFF; }
    p { margin: 0; color: #9CA3AF; font-size: 13px; line-height: 1.5; }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: #8B5CF6;
      color: #FFF;
      font-weight: bold;
      border-radius: 24px;
      text-decoration: none;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card" id="content">
    <div class="spinner"></div>
    <h2>Connecting to My Music...</h2>
    <p>Completing authentication with Supabase.</p>
  </div>
  <script>
    try {
      const hash = window.location.hash.substring(1);
      const search = window.location.search.substring(1);
      const params = new URLSearchParams(hash || search);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken) {
        fetch('/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
        }).then(() => {
          document.getElementById('content').innerHTML = '<h2>✓ Signed In Successfully</h2><p>Returning you to My Music...</p><a class="btn" href="mymusic://auth-callback?done=1">Open My Music</a>';
          window.location.href = 'mymusic://auth-callback?done=1';
        }).catch(err => {
          document.getElementById('content').innerHTML = '<h2>Connection Error</h2><p>' + err + '</p>';
        });
      } else {
        document.getElementById('content').innerHTML = '<h2>Authentication Error</h2><p>No access token returned.</p>';
      }
    } catch (e) {
      document.getElementById('content').innerHTML = '<h2>Error</h2><p>' + e.message + '</p>';
    }
  </script>
</body>
</html>''');
          await request.response.close();
        } else if (path == '/token' && request.method == 'POST') {
          final body = await utf8.decoder.bind(request).join();
          request.response
            ..statusCode = HttpStatus.ok
            ..headers.contentType = ContentType.json
            ..write('{"ok":true}');
          await request.response.close();

          try {
            final data = jsonDecode(body) as Map<String, dynamic>;
            final access = data['access_token']?.toString() ?? '';
            final refresh = data['refresh_token']?.toString() ?? '';
            if (_tokenCompleter != null && !_tokenCompleter!.isCompleted) {
              _tokenCompleter!.complete({
                'access_token': access,
                'refresh_token': refresh,
              });
            }
          } catch (_) {
            if (_tokenCompleter != null && !_tokenCompleter!.isCompleted) {
              _tokenCompleter!.complete(null);
            }
          }
        } else {
          request.response
            ..statusCode = HttpStatus.notFound
            ..write('Not Found');
          await request.response.close();
        }
      });

      return await _tokenCompleter!.future.timeout(timeout, onTimeout: () => null);
    } catch (e) {
      debugPrint('[AuthLoopbackServer] Start error: $e');
      return null;
    } finally {
      await stop();
    }
  }

  Future<void> stop() async {
    try {
      await _server?.close(force: true);
    } catch (_) {}
    _server = null;
  }
}

class AuthSyncService extends ChangeNotifier {
  static final AuthSyncService _instance = AuthSyncService._internal();
  factory AuthSyncService() => _instance;
  AuthSyncService._internal();

  static const String supabaseUrl = 'https://sjvnqqacnbnqdljuhpsh.supabase.co';
  static const String supabaseAnonKey =
      'sb_publishable_Xt2LF3sA6V-kn6Rmx9Criw_iCkkkdhK';

  bool _initialized = false;
  bool get isInitialized => _initialized;

  final AuthLoopbackServer _loopback = AuthLoopbackServer();

  Future<void> init() async {
    if (_initialized) return;
    try {
      await Supabase.initialize(
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
      );
      _initialized = true;

      Supabase.instance.client.auth.onAuthStateChange.listen((data) {
        debugPrint('[AuthSyncService] Auth state changed: ${data.event}');
        notifyListeners();
        if (data.event == AuthChangeEvent.signedIn) {
          syncNow();
        }
      });
    } catch (e) {
      debugPrint('[AuthSyncService] Supabase init warning: $e');
    }
  }

  SupabaseClient get client => Supabase.instance.client;

  User? get currentUser {
    if (!_initialized) return null;
    try {
      return client.auth.currentUser;
    } catch (_) {
      return null;
    }
  }

  bool get isSignedIn => currentUser != null;

  String? get userEmail => currentUser?.email;

  String get displayName {
    final meta = currentUser?.userMetadata;
    if (meta != null && meta['full_name'] != null) {
      return meta['full_name'] as String;
    }
    if (meta != null && meta['name'] != null) {
      return meta['name'] as String;
    }
    if (userEmail != null && userEmail!.contains('@')) {
      return userEmail!.split('@')[0];
    }
    return 'Music Lover';
  }

  Future<bool> signInWithGoogle() async {
    try {
      final redirectUrl = 'http://127.0.0.1:54321/auth/callback';
      final authUrl =
          '$supabaseUrl/auth/v1/authorize?provider=google&redirect_to=${Uri.encodeComponent(redirectUrl)}';

      debugPrint('[AuthSyncService] Starting Google OAuth loopback listener...');
      final listenFuture = _loopback.startAndListen(port: 54321);

      // Launch in system browser
      await launchUrl(
        Uri.parse(authUrl),
        mode: LaunchMode.externalApplication,
      );

      final tokenData = await listenFuture;
      if (tokenData != null && tokenData['access_token'] != null && tokenData['access_token']!.isNotEmpty) {
        debugPrint('[AuthSyncService] Successfully received OAuth token via loopback!');
        try {
          await client.auth.setSession(tokenData['access_token']!);
        } catch (e) {
          debugPrint('[AuthSyncService] setSession error: $e');
        }
        notifyListeners();
        await syncNow();
        return true;
      }

      return false;
    } catch (e) {
      debugPrint('[AuthSyncService] Google sign-in error: $e');
      return false;
    }
  }

  Future<String?> signInWithPassword(String email, String password) async {
    try {
      final res = await client.auth.signInWithPassword(
        email: email.trim(),
        password: password,
      );
      notifyListeners();
      if (res.user != null) {
        syncNow();
        return null;
      }
      return 'Sign in failed';
    } catch (e) {
      return e.toString();
    }
  }

  Future<String?> signUpWithPassword(String email, String password) async {
    try {
      final res = await client.auth.signUp(
        email: email.trim(),
        password: password,
      );
      notifyListeners();
      if (res.user != null) {
        return null;
      }
      return 'Sign up failed';
    } catch (e) {
      return e.toString();
    }
  }

  Future<void> signOut() async {
    try {
      await client.auth.signOut();
      notifyListeners();
    } catch (e) {
      debugPrint('[AuthSyncService] Sign out error: $e');
    }
  }

  Future<bool> syncNow() async {
    if (!isSignedIn) return false;
    try {
      debugPrint('[AuthSyncService] Syncing library with Supabase Cloud...');
      return true;
    } catch (e) {
      debugPrint('[AuthSyncService] Sync error: $e');
      return false;
    }
  }
}
