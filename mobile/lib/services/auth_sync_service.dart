import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'storage_service.dart';

enum CloudSyncStatus { idle, syncing, synced, offline, error }

class AuthLoopbackResult {
  final String? code;
  final String? callbackUrl;
  final String? accessToken;
  final String? refreshToken;
  final String? error;

  const AuthLoopbackResult({
    this.code,
    this.callbackUrl,
    this.accessToken,
    this.refreshToken,
    this.error,
  });
}

class AuthLoopbackServer {
  HttpServer? _server4;
  HttpServer? _server6;
  Completer<AuthLoopbackResult?>? _completer;
  int? _boundPort;

  int? get boundPort => _boundPort;

  /// Binds IPv4 (and optionally IPv6) loopback BEFORE launching the browser
  /// so the callback port is guaranteed listening when Google/Supabase redirects.
  Future<int?> bind({int startPort = 54321, int maxPort = 54325}) async {
    await stop();
    _completer = Completer<AuthLoopbackResult?>();

    for (int port = startPort; port <= maxPort; port++) {
      try {
        _server4 = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
        _boundPort = port;
        _attachListener(_server4!, port);

        // Best-effort IPv6 loopback on same port so localhost resolves cleanly
        try {
          _server6 = await HttpServer.bind(InternetAddress.loopbackIPv6, port);
          _attachListener(_server6!, port);
        } catch (_) {
          _server6 = null;
        }

        debugPrint('[AuthLoopbackServer] Bound http://127.0.0.1:$port');
        return port;
      } catch (e) {
        debugPrint('[AuthLoopbackServer] Port $port busy ($e)');
        await stop();
        _completer = Completer<AuthLoopbackResult?>();
      }
    }
    return null;
  }

  void _completeOnce(AuthLoopbackResult? result) {
    if (_completer != null && !_completer!.isCompleted) {
      _completer!.complete(result);
    }
  }

  void _attachListener(HttpServer server, int port) {
    server.listen((HttpRequest request) async {
      try {
        if (request.method == 'OPTIONS') {
          request.response
            ..statusCode = HttpStatus.noContent
            ..headers.set('Access-Control-Allow-Origin', '*')
            ..headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ..headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          await request.response.close();
          return;
        }

        final path = request.uri.path;
        final qp = request.uri.queryParameters;
        debugPrint('[AuthLoopbackServer] ${request.method} $path');

        if (path == '/auth/callback') {
          final directError = qp['error_description'] ?? qp['error'];
          final directCode = qp['code'];
          final directAccess = qp['access_token'];
          final directRefresh = qp['refresh_token'];

          if (directError != null && directError.isNotEmpty) {
            request.response
              ..statusCode = HttpStatus.ok
              ..headers.contentType = ContentType.html
              ..write(_buildStatusHtml(
                success: false,
                title: 'Sign-In Failed',
                message: directError,
              ));
            await request.response.close();
            _completeOnce(AuthLoopbackResult(error: directError));
            return;
          }

          if (directCode != null && directCode.isNotEmpty) {
            request.response
              ..statusCode = HttpStatus.ok
              ..headers.contentType = ContentType.html
              ..write(_buildStatusHtml(
                success: true,
                title: 'Signed In Successfully',
                message: 'Returning you to My Music...',
                autoReturnDeepLink: true,
              ));
            await request.response.close();
            _completeOnce(AuthLoopbackResult(
              code: directCode,
              callbackUrl: 'http://127.0.0.1:$port${request.uri}',
            ));
            return;
          }

          if (directAccess != null && directAccess.isNotEmpty) {
            request.response
              ..statusCode = HttpStatus.ok
              ..headers.contentType = ContentType.html
              ..write(_buildStatusHtml(
                success: true,
                title: 'Signed In Successfully',
                message: 'Returning you to My Music...',
                autoReturnDeepLink: true,
              ));
            await request.response.close();
            _completeOnce(AuthLoopbackResult(
              accessToken: directAccess,
              refreshToken: directRefresh ?? '',
            ));
            return;
          }

          // Implicit flow puts tokens in URL #hash fragment which browsers do not send to server.
          // Serve JS bridge to extract hash/query and relay to /token.
          request.response
            ..statusCode = HttpStatus.ok
            ..headers.contentType = ContentType.html
            ..write(_buildHashBridgeHtml());
          await request.response.close();
        } else if (path == '/token') {
          String access = qp['access_token'] ?? '';
          String refresh = qp['refresh_token'] ?? '';
          String code = qp['code'] ?? '';
          String error = qp['error'] ?? '';

          if (request.method == 'POST') {
            final body = await utf8.decoder.bind(request).join();
            try {
              final data = jsonDecode(body) as Map<String, dynamic>;
              access = data['access_token']?.toString() ?? access;
              refresh = data['refresh_token']?.toString() ?? refresh;
              code = data['code']?.toString() ?? code;
              error = data['error']?.toString() ?? error;
            } catch (_) {}
          }

          request.response
            ..statusCode = HttpStatus.ok
            ..headers.contentType = ContentType.json
            ..headers.set('Access-Control-Allow-Origin', '*')
            ..write(jsonEncode({'ok': error.isEmpty}));
          await request.response.close();

          if (error.isNotEmpty) {
            _completeOnce(AuthLoopbackResult(error: error));
          } else if (code.isNotEmpty) {
            _completeOnce(AuthLoopbackResult(
              code: code,
              callbackUrl: 'http://127.0.0.1:$port/auth/callback?code=${Uri.encodeComponent(code)}',
            ));
          } else if (access.isNotEmpty) {
            _completeOnce(AuthLoopbackResult(
              accessToken: access,
              refreshToken: refresh,
            ));
          } else {
            _completeOnce(const AuthLoopbackResult(error: 'No credentials received.'));
          }
        } else {
          request.response
            ..statusCode = HttpStatus.notFound
            ..write('Not Found');
          await request.response.close();
        }
      } catch (e) {
        debugPrint('[AuthLoopbackServer] Request error: $e');
      }
    });
  }

  Future<AuthLoopbackResult?> waitForResult({
    Duration timeout = const Duration(minutes: 3),
  }) async {
    if (_completer == null) return null;
    try {
      return await _completer!.future.timeout(timeout, onTimeout: () {
        return const AuthLoopbackResult(error: 'Google sign-in timed out. Please try again.');
      });
    } finally {
      await stop();
    }
  }

  void cancel() {
    _completeOnce(const AuthLoopbackResult(error: 'Sign-in cancelled.'));
  }

  Future<void> stop() async {
    try {
      await _server4?.close(force: true);
    } catch (_) {}
    try {
      await _server6?.close(force: true);
    } catch (_) {}
    _server4 = null;
    _server6 = null;
    _boundPort = null;
  }

  String _buildStatusHtml({
    required bool success,
    required String title,
    required String message,
    bool autoReturnDeepLink = false,
  }) {
    final safeTitle = const HtmlEscape().convert(title);
    final safeMsg = const HtmlEscape().convert(message);
    return '''<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Music - Sign In</title>
  <style>
    body {
      background: #07090e; color: #eef2f8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; padding: 20px; text-align: center;
    }
    .card {
      background: #101420; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px; padding: 32px 24px; max-width: 340px; width: 90%;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    }
    h2 { margin: 0 0 10px; font-size: 20px; font-weight: 700; color: ${success ? '#34d399' : '#f87171'}; }
    p { margin: 0; color: #95a0b5; font-size: 13.5px; line-height: 1.5; }
    .btn {
      display: inline-block; margin-top: 20px; padding: 12px 24px;
      background: #8b5cf6; color: #fff; font-weight: 700;
      border-radius: 999px; text-decoration: none; font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>${success ? '✓ ' : '⚠ '}$safeTitle</h2>
    <p>$safeMsg</p>
    ${success ? '<a class="btn" href="mymusic://auth-callback?done=1">Return to My Music</a>' : ''}
  </div>
  ${autoReturnDeepLink ? '<script>setTimeout(function(){ window.location.href = "mymusic://auth-callback?done=1"; }, 180);</script>' : ''}
</body>
</html>''';
  }

  String _buildHashBridgeHtml() {
    return '''<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Signing in to My Music</title>
  <style>
    body {
      background: #07090e; color: #eef2f8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; padding: 20px; text-align: center;
    }
    .card {
      background: #101420; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px; padding: 32px 24px; max-width: 340px; width: 90%;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    }
    .spinner {
      width: 38px; height: 38px; border: 3px solid rgba(255,255,255,0.12);
      border-top: 3px solid #8b5cf6; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin: 0 auto 18px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    h2 { margin: 0 0 8px; font-size: 19px; font-weight: 700; }
    p { margin: 0; color: #95a0b5; font-size: 13px; line-height: 1.5; }
    .btn {
      display: inline-block; margin-top: 20px; padding: 12px 24px;
      background: #8b5cf6; color: #fff; font-weight: 700;
      border-radius: 999px; text-decoration: none; font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card" id="content">
    <div class="spinner"></div>
    <h2>Completing Sign-In...</h2>
    <p>Connecting your Google account to My Music.</p>
  </div>
  <script>
    (async function() {
      try {
        const params = new URLSearchParams(window.location.search);
        if (window.location.hash && window.location.hash.length > 1) {
          const hp = new URLSearchParams(window.location.hash.substring(1));
          for (const [k, v] of hp.entries()) params.set(k, v);
        }
        const err = params.get('error_description') || params.get('error');
        const code = params.get('code');
        const access = params.get('access_token');
        const refresh = params.get('refresh_token') || '';
        if (err) {
          await fetch('/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err })
          });
          document.getElementById('content').innerHTML = '<h2 style="color:#f87171">Sign-In Failed</h2><p>' + err + '</p>';
          return;
        }
        if (code || access) {
          await fetch('/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, access_token: access, refresh_token: refresh })
          });
          document.getElementById('content').innerHTML =
            '<h2 style="color:#34d399">✓ Signed In Successfully</h2><p>Returning you to My Music...</p><a class="btn" href="mymusic://auth-callback?done=1">Open My Music</a>';
          setTimeout(function() { window.location.href = 'mymusic://auth-callback?done=1'; }, 180);
          return;
        }
        await fetch('/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No access token or authorization code returned.' })
        });
        document.getElementById('content').innerHTML = '<h2 style="color:#f87171">Sign-In Incomplete</h2><p>No token was returned from Google.</p>';
      } catch (e) {
        document.getElementById('content').innerHTML = '<h2 style="color:#f87171">Connection Error</h2><p>' + (e && e.message || e) + '</p>';
      }
    })();
  </script>
</body>
</html>''';
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

  CloudSyncStatus _syncStatus = CloudSyncStatus.idle;
  DateTime? _lastSyncedAt;
  String? _syncError;
  bool _isSyncing = false;
  bool _googleInProgress = false;
  Timer? _pushTimer;
  VoidCallback? onLibrarySynced;

  CloudSyncStatus get syncStatus => _syncStatus;
  DateTime? get lastSyncedAt => _lastSyncedAt;
  String? get syncError => _syncError;
  bool get googleInProgress => _googleInProgress;

  final AuthLoopbackServer _loopback = AuthLoopbackServer();
  StreamSubscription<AuthState>? _authSub;

  Future<void> init() async {
    if (_initialized) return;
    try {
      await Supabase.initialize(
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
      );
      _initialized = true;

      _authSub = Supabase.instance.client.auth.onAuthStateChange.listen((data) {
        debugPrint('[AuthSyncService] Auth state changed: ${data.event}');
        notifyListeners();
        if (data.event == AuthChangeEvent.signedIn) {
          syncNow();
        }
      });

      if (isSignedIn) {
        Future.delayed(const Duration(seconds: 2), () {
          syncNow();
        });
      }
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

  Session? get currentSession {
    if (!_initialized) return null;
    try {
      return client.auth.currentSession;
    } catch (_) {
      return null;
    }
  }

  bool get isSignedIn => currentUser != null;

  String? get userEmail => currentUser?.email;

  String get avatarUrl {
    final meta = currentUser?.userMetadata;
    final url = meta?['avatar_url'] ?? meta?['picture'];
    return url is String ? url : '';
  }

  String get displayName {
    final meta = currentUser?.userMetadata;
    if (meta != null && meta['full_name'] is String && (meta['full_name'] as String).isNotEmpty) {
      return meta['full_name'] as String;
    }
    if (meta != null && meta['name'] is String && (meta['name'] as String).isNotEmpty) {
      return meta['name'] as String;
    }
    if (userEmail != null && userEmail!.contains('@')) {
      return userEmail!.split('@')[0];
    }
    return 'Guest';
  }

  void cancelGoogleSignIn() {
    _loopback.cancel();
    _googleInProgress = false;
    notifyListeners();
  }

  /// Signs in with Google via loopback server + Chrome Custom Tabs (with external browser fallback).
  /// Returns null on success, or an error message on failure/cancellation.
  Future<String?> signInWithGoogle() async {
    if (!_initialized) {
      await init();
      if (!_initialized) return 'Cloud auth could not initialize.';
    }

    _googleInProgress = true;
    notifyListeners();

    StreamSubscription<AuthState>? liveAuthSub;
    try {
      final port = await _loopback.bind(startPort: 54321, maxPort: 54325);
      if (port == null) {
        return 'Could not start local sign-in listener (ports 54321–54325 busy).';
      }

      final redirectUrl = 'http://127.0.0.1:$port/auth/callback';

      // Use Supabase SDK's PKCE URL builder so code_verifier is saved in LocalStorage
      String authUrl;
      try {
        final oauthRes = await client.auth.getOAuthSignInUrl(
          provider: OAuthProvider.google,
          redirectTo: redirectUrl,
        );
        authUrl = oauthRes.url;
      } catch (e) {
        debugPrint('[AuthSyncService] getOAuthSignInUrl fallback: $e');
        authUrl =
            '$supabaseUrl/auth/v1/authorize?provider=google&redirect_to=${Uri.encodeComponent(redirectUrl)}';
      }

      // Also listen in case deep link signs the user in directly
      final authSignal = Completer<bool>();
      liveAuthSub = client.auth.onAuthStateChange.listen((data) {
        if (data.event == AuthChangeEvent.signedIn &&
            data.session != null &&
            !authSignal.isCompleted) {
          authSignal.complete(true);
        }
      });

      final uri = Uri.parse(authUrl);
      bool launched = false;
      try {
        launched = await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
      } catch (e) {
        debugPrint('[AuthSyncService] Custom Tabs launch failed ($e), trying external browser...');
      }
      if (!launched) {
        try {
          launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
        } catch (e) {
          debugPrint('[AuthSyncService] External browser launch failed: $e');
        }
      }
      if (!launched) {
        await _loopback.stop();
        return 'Could not open browser for Google sign-in.';
      }

      final result = await Future.any<AuthLoopbackResult?>([
        _loopback.waitForResult(),
        authSignal.future.then((_) => null),
      ]);

      try {
        await closeInAppWebView();
      } catch (_) {}

      // If signed in via deep link listener directly
      if (isSignedIn) {
        await syncNow();
        notifyListeners();
        return null;
      }

      if (result == null) {
        return 'Sign-in did not complete.';
      }
      if (result.error != null && result.error!.isNotEmpty) {
        return result.error;
      }

      // Path A: PKCE authorization code
      if (result.code != null && result.code!.isNotEmpty) {
        try {
          final cbUri = Uri.parse(
            result.callbackUrl ?? 'http://127.0.0.1:$port/auth/callback?code=${Uri.encodeComponent(result.code!)}',
          );
          await client.auth.getSessionFromUrl(cbUri);
        } catch (pkceErr) {
          debugPrint('[AuthSyncService] getSessionFromUrl failed ($pkceErr), trying manual PKCE exchange...');
          final tokenResp = await http.post(
            Uri.parse('$supabaseUrl/auth/v1/token?grant_type=pkce'),
            headers: {
              'apikey': supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'auth_code': result.code}),
          );
          if (tokenResp.statusCode >= 200 && tokenResp.statusCode < 300) {
            final data = jsonDecode(tokenResp.body) as Map<String, dynamic>;
            final refresh = data['refresh_token']?.toString() ?? '';
            final access = data['access_token']?.toString() ?? '';
            if (refresh.isNotEmpty) {
              await client.auth.setSession(refresh, accessToken: access.isNotEmpty ? access : null);
            }
          } else {
            return 'Google code exchange failed (${tokenResp.statusCode}).';
          }
        }
      } else if (result.accessToken != null && result.accessToken!.isNotEmpty) {
        // Path B: Implicit tokens — note gotrue.setSession expects refreshToken FIRST!
        final refresh = result.refreshToken ?? '';
        final access = result.accessToken!;
        if (refresh.isNotEmpty) {
          await client.auth.setSession(refresh, accessToken: access);
        } else {
          return 'Google sign-in returned no refresh token. Please try again.';
        }
      }

      if (!isSignedIn) {
        return 'Could not establish session after Google sign-in.';
      }

      await syncNow();
      notifyListeners();
      return null;
    } catch (e) {
      debugPrint('[AuthSyncService] Google sign-in error: $e');
      return e.toString().replaceFirst('AuthException(', '').replaceAll(')', '');
    } finally {
      await liveAuthSub?.cancel();
      await _loopback.stop();
      _googleInProgress = false;
      notifyListeners();
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
        await syncNow();
        return null;
      }
      return 'Sign in failed';
    } on AuthException catch (e) {
      return e.message;
    } catch (e) {
      return e.toString();
    }
  }

  Future<String?> signUpWithPassword(
    String email,
    String password, {
    String? name,
  }) async {
    try {
      final cleanName = (name ?? '').trim();
      final res = await client.auth.signUp(
        email: email.trim(),
        password: password,
        data: cleanName.isNotEmpty ? {'name': cleanName, 'full_name': cleanName} : null,
      );
      notifyListeners();
      if (res.session != null && res.user != null) {
        await syncNow();
        return null;
      }
      if (res.user != null) {
        return 'CONFIRM_EMAIL';
      }
      return 'Sign up failed';
    } on AuthException catch (e) {
      return e.message;
    } catch (e) {
      return e.toString();
    }
  }

  Future<String?> resetPassword(String email) async {
    try {
      await client.auth.resetPasswordForEmail(email.trim());
      return null;
    } on AuthException catch (e) {
      return e.message;
    } catch (e) {
      return e.toString();
    }
  }

  Future<String?> updateProfile({required String name}) async {
    if (!isSignedIn) return 'Not signed in.';
    try {
      final clean = name.trim();
      await client.auth.updateUser(
        UserAttributes(data: {'name': clean, 'full_name': clean}),
      );
      notifyListeners();
      return null;
    } on AuthException catch (e) {
      return e.message;
    } catch (e) {
      return e.toString();
    }
  }

  Future<String?> updatePassword(String newPassword) async {
    if (!isSignedIn) return 'Not signed in.';
    if (newPassword.trim().length < 6) {
      return 'Password must be at least 6 characters.';
    }
    try {
      await client.auth.updateUser(UserAttributes(password: newPassword.trim()));
      return null;
    } on AuthException catch (e) {
      return e.message;
    } catch (e) {
      return e.toString();
    }
  }

  Future<void> signOut() async {
    try {
      await client.auth.signOut();
    } catch (e) {
      debugPrint('[AuthSyncService] Sign out error: $e');
    }
    _syncStatus = CloudSyncStatus.idle;
    _syncError = null;
    notifyListeners();
  }

  Future<String?> _getFreshAccessToken() async {
    if (!isSignedIn) return null;
    try {
      var session = client.auth.currentSession;
      if (session == null) return null;
      if (session.isExpired) {
        final refreshed = await client.auth.refreshSession();
        session = refreshed.session;
      }
      return session?.accessToken;
    } catch (e) {
      debugPrint('[AuthSyncService] token refresh error: $e');
      return client.auth.currentSession?.accessToken;
    }
  }

  void scheduleAutoPush() {
    if (!isSignedIn) return;
    _pushTimer?.cancel();
    _pushTimer = Timer(const Duration(milliseconds: 2500), () {
      forcePush();
    });
  }

  /// Bi-directional library merge & sync with Supabase `user_libraries` table (matches desktop auth-sync.js).
  Future<bool> syncNow() async {
    if (!isSignedIn || _isSyncing) return false;
    final userId = currentUser?.id;
    if (userId == null) return false;

    _isSyncing = true;
    _syncStatus = CloudSyncStatus.syncing;
    _syncError = null;
    notifyListeners();

    try {
      final token = await _getFreshAccessToken();
      if (token == null) throw Exception('Session expired. Please sign in again.');

      final pullResp = await http
          .get(
            Uri.parse(
              '$supabaseUrl/rest/v1/user_libraries?user_id=eq.${Uri.encodeComponent(userId)}&select=*',
            ),
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 12));

      if (pullResp.statusCode < 200 || pullResp.statusCode >= 300) {
        throw Exception('Cloud read failed: HTTP ${pullResp.statusCode}');
      }

      final rows = jsonDecode(pullResp.body);
      final remote = (rows is List && rows.isNotEmpty && rows.first is Map)
          ? Map<String, dynamic>.from(rows.first as Map)
          : <String, dynamic>{};

      final storage = StorageService();
      final local = storage.exportAllForSync();
      final merged = _mergeLibraries(local, remote);

      await storage.applySyncedData(merged);
      onLibrarySynced?.call();

      final pushResp = await http
          .post(
            Uri.parse('$supabaseUrl/rest/v1/user_libraries'),
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates',
            },
            body: jsonEncode({
              'user_id': userId,
              'favorites': merged['favorites'],
              'playlists': merged['playlists'],
              'settings': merged['settings'],
              'play_stats': merged['playStats'],
              'lyrics_offsets': merged['lyricsOffsets'],
              'client_version': '1.1.9-android',
              'updated_at': DateTime.now().toUtc().toIso8601String(),
            }),
          )
          .timeout(const Duration(seconds: 12));

      if (pushResp.statusCode < 200 || pushResp.statusCode >= 300) {
        throw Exception('Cloud write failed: HTTP ${pushResp.statusCode}');
      }

      _syncStatus = CloudSyncStatus.synced;
      _lastSyncedAt = DateTime.now();
      _isSyncing = false;
      notifyListeners();
      return true;
    } catch (e) {
      final msg = e.toString();
      final offline = msg.contains('SocketException') || msg.contains('Failed host lookup');
      _syncStatus = offline ? CloudSyncStatus.offline : CloudSyncStatus.error;
      _syncError = msg;
      _isSyncing = false;
      notifyListeners();
      debugPrint('[AuthSyncService] syncNow error: $e');
      return false;
    }
  }

  Future<String?> forcePush() async {
    if (!isSignedIn) return 'Not signed in.';
    final userId = currentUser?.id;
    if (userId == null) return 'Not signed in.';

    _syncStatus = CloudSyncStatus.syncing;
    notifyListeners();
    try {
      final token = await _getFreshAccessToken();
      if (token == null) return 'Session expired. Please sign in again.';
      final local = StorageService().exportAllForSync();
      final res = await http
          .post(
            Uri.parse('$supabaseUrl/rest/v1/user_libraries'),
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates',
            },
            body: jsonEncode({
              'user_id': userId,
              'favorites': local['favorites'],
              'playlists': local['playlists'],
              'settings': local['settings'],
              'play_stats': local['playStats'],
              'lyrics_offsets': local['lyricsOffsets'],
              'client_version': '1.1.9-android',
              'updated_at': DateTime.now().toUtc().toIso8601String(),
            }),
          )
          .timeout(const Duration(seconds: 12));
      if (res.statusCode < 200 || res.statusCode >= 300) {
        _syncStatus = CloudSyncStatus.error;
        _syncError = 'HTTP ${res.statusCode}';
        notifyListeners();
        return 'Cloud push failed (HTTP ${res.statusCode})';
      }
      _syncStatus = CloudSyncStatus.synced;
      _lastSyncedAt = DateTime.now();
      notifyListeners();
      return null;
    } catch (e) {
      _syncStatus = CloudSyncStatus.error;
      _syncError = e.toString();
      notifyListeners();
      return e.toString();
    }
  }

  Future<String?> forcePull() async {
    if (!isSignedIn) return 'Not signed in.';
    final userId = currentUser?.id;
    if (userId == null) return 'Not signed in.';

    _syncStatus = CloudSyncStatus.syncing;
    notifyListeners();
    try {
      final token = await _getFreshAccessToken();
      if (token == null) return 'Session expired. Please sign in again.';
      final res = await http
          .get(
            Uri.parse(
              '$supabaseUrl/rest/v1/user_libraries?user_id=eq.${Uri.encodeComponent(userId)}&select=*',
            ),
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 12));
      if (res.statusCode < 200 || res.statusCode >= 300) {
        _syncStatus = CloudSyncStatus.error;
        notifyListeners();
        return 'Cloud pull failed (HTTP ${res.statusCode})';
      }
      final rows = jsonDecode(res.body);
      if (rows is List && rows.isNotEmpty && rows.first is Map) {
        final remote = Map<String, dynamic>.from(rows.first as Map);
        await StorageService().applySyncedData({
          'favorites': remote['favorites'] ?? [],
          'playlists': remote['playlists'] ?? [],
          'settings': remote['settings'] ?? {},
          'playStats': remote['play_stats'] ?? remote['playStats'] ?? {},
          'lyricsOffsets': remote['lyrics_offsets'] ?? remote['lyricsOffsets'] ?? {},
        });
        onLibrarySynced?.call();
      }
      _syncStatus = CloudSyncStatus.synced;
      _lastSyncedAt = DateTime.now();
      notifyListeners();
      return null;
    } catch (e) {
      _syncStatus = CloudSyncStatus.error;
      notifyListeners();
      return e.toString();
    }
  }

  Future<String?> deleteCloudData() async {
    if (!isSignedIn) return 'Not signed in.';
    final userId = currentUser?.id;
    if (userId == null) return 'Not signed in.';
    try {
      final token = await _getFreshAccessToken();
      if (token == null) return 'Session expired.';
      final res = await http
          .delete(
            Uri.parse(
              '$supabaseUrl/rest/v1/user_libraries?user_id=eq.${Uri.encodeComponent(userId)}',
            ),
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 12));
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return 'Failed to clear cloud data (HTTP ${res.statusCode})';
      }
      _syncStatus = CloudSyncStatus.idle;
      notifyListeners();
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  Future<String?> deleteAccount() async {
    final err = await deleteCloudData();
    await signOut();
    return err;
  }

  Map<String, dynamic> _mergeLibraries(
    Map<String, dynamic> local,
    Map<String, dynamic> remote,
  ) {
    // 1. Favorites union
    final seenFavs = <String>{};
    final mergedFavs = <dynamic>[];
    for (final item in [...(local['favorites'] as List? ?? []), ...(remote['favorites'] as List? ?? [])]) {
      if (item is Map && item['id'] is String && (item['id'] as String).isNotEmpty) {
        if (seenFavs.add(item['id'] as String)) {
          mergedFavs.add(item);
        }
      }
    }

    // 2. Playlists merge by id
    final plMap = <String, Map<String, dynamic>>{};
    for (final pl in (local['playlists'] as List? ?? [])) {
      if (pl is Map && pl['id'] is String) {
        plMap[pl['id'] as String] = Map<String, dynamic>.from(pl)
          ..['tracks'] = List<dynamic>.from(pl['tracks'] as List? ?? []);
      }
    }
    for (final rPl in (remote['playlists'] as List? ?? [])) {
      if (rPl is! Map || rPl['id'] is! String) continue;
      final id = rPl['id'] as String;
      if (!plMap.containsKey(id)) {
        plMap[id] = Map<String, dynamic>.from(rPl)
          ..['tracks'] = List<dynamic>.from(rPl['tracks'] as List? ?? []);
      } else {
        final existing = plMap[id]!;
        final tracks = existing['tracks'] as List<dynamic>;
        final seenIds = tracks
            .whereType<Map>()
            .map((t) => t['id']?.toString() ?? '')
            .toSet();
        for (final rt in (rPl['tracks'] as List? ?? [])) {
          if (rt is Map && rt['id'] is String && seenIds.add(rt['id'] as String)) {
            tracks.add(rt);
          }
        }
      }
    }

    // 3. Settings merge
    final localSettings = Map<String, dynamic>.from(local['settings'] as Map? ?? {});
    final remoteSettings = Map<String, dynamic>.from(remote['settings'] as Map? ?? {});
    final mergedSettings = Map<String, dynamic>.from(localSettings);
    for (final k in const [
      'eq',
      'eqPreset',
      'accentHue',
      'wallpaper',
      'wallpaperDim',
      'automix',
      'automixMode',
      'automixDuration',
      'crossfadeDuration',
      'viz',
      'fsViz',
      'lyricsStyle',
    ]) {
      if (remoteSettings.containsKey(k) && remoteSettings[k] != null) {
        mergedSettings[k] = remoteSettings[k];
      }
    }

    // 4. PlayStats merge
    final localStats = Map<String, dynamic>.from(local['playStats'] as Map? ?? {});
    final remoteStats = Map<String, dynamic>.from(
      (remote['play_stats'] ?? remote['playStats']) as Map? ?? {},
    );
    final mergedStats = {
      'totalPlays': ((localStats['totalPlays'] as num?)?.toInt() ?? 0) >
              ((remoteStats['totalPlays'] as num?)?.toInt() ?? 0)
          ? (localStats['totalPlays'] as num?)?.toInt() ?? 0
          : (remoteStats['totalPlays'] as num?)?.toInt() ?? 0,
      'totalSeconds': ((localStats['totalSeconds'] as num?)?.toInt() ?? 0) >
              ((remoteStats['totalSeconds'] as num?)?.toInt() ?? 0)
          ? (localStats['totalSeconds'] as num?)?.toInt() ?? 0
          : (remoteStats['totalSeconds'] as num?)?.toInt() ?? 0,
      'tracks': {
        ...Map<String, dynamic>.from(remoteStats['tracks'] as Map? ?? {}),
        ...Map<String, dynamic>.from(localStats['tracks'] as Map? ?? {}),
      },
      'artists': {
        ...Map<String, dynamic>.from(remoteStats['artists'] as Map? ?? {}),
        ...Map<String, dynamic>.from(localStats['artists'] as Map? ?? {}),
      },
    };

    // 5. LyricsOffsets merge
    final mergedOffsets = {
      ...Map<String, dynamic>.from(
        (remote['lyrics_offsets'] ?? remote['lyricsOffsets']) as Map? ?? {},
      ),
      ...Map<String, dynamic>.from(local['lyricsOffsets'] as Map? ?? {}),
    };

    return {
      'favorites': mergedFavs,
      'playlists': plMap.values.toList(),
      'settings': mergedSettings,
      'playStats': mergedStats,
      'lyricsOffsets': mergedOffsets,
    };
  }

  @override
  void dispose() {
    _pushTimer?.cancel();
    _authSub?.cancel();
    _loopback.stop();
    super.dispose();
  }
}
