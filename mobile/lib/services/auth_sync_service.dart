import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthSyncService extends ChangeNotifier {
  static final AuthSyncService _instance = AuthSyncService._internal();
  factory AuthSyncService() => _instance;
  AuthSyncService._internal();

  static const String supabaseUrl = 'https://sjvnqqacnbnqdljuhpsh.supabase.co';
  static const String supabaseAnonKey =
      'sb_publishable_Xt2LF3sA6V-kn6Rmx9Criw_iCkkkdhK';

  bool _initialized = false;
  bool get isInitialized => _initialized;

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
      final res = await client.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: 'mymusic://auth-callback',
      );
      return res;
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
      debugPrint('[AuthSyncService] Syncing library with Supabase...');
      return true;
    } catch (e) {
      debugPrint('[AuthSyncService] Sync error: $e');
      return false;
    }
  }
}
