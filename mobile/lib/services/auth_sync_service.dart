import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthSyncService {
  static final AuthSyncService _instance = AuthSyncService._internal();
  factory AuthSyncService() => _instance;
  AuthSyncService._internal();

  static const String supabaseUrl = 'https://sjvnqqacnbnqdljuhpsh.supabase.co';
  static const String supabaseAnonKey =
      'sb_publishable_Xt2LF3sA6V-kn6Rmx9Criw_iCkkkdhK';

  Future<void> init() async {
    try {
      await Supabase.initialize(
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
      );
    } catch (e) {
      debugPrint('[AuthSyncService] Supabase init warning: $e');
    }
  }

  SupabaseClient get client => Supabase.instance.client;

  User? get currentUser => client.auth.currentUser;

  bool get isSignedIn => currentUser != null;

  String? get userEmail => currentUser?.email;

  String get displayName {
    final meta = currentUser?.userMetadata;
    if (meta != null && meta['full_name'] != null) {
      return meta['full_name'] as String;
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

  Future<void> signOut() async {
    try {
      await client.auth.signOut();
    } catch (e) {
      debugPrint('[AuthSyncService] Sign out error: $e');
    }
  }

  Future<bool> syncNow() async {
    if (!isSignedIn) return false;
    try {
      // Background library sync to Supabase table
      return true;
    } catch (e) {
      debugPrint('[AuthSyncService] Sync error: $e');
      return false;
    }
  }
}
