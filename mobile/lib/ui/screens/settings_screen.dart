import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/auth_sync_service.dart';
import '../../providers/library_provider.dart';
import '../theme.dart';
import '../widgets/glass_card.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final AuthSyncService _auth = AuthSyncService();
  bool _isSyncing = false;

  @override
  Widget build(BuildContext context) {
    final library = context.watch<LibraryProvider>();
    final isSignedIn = _auth.isSignedIn;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
        children: [
          // Account & Cloud Sync Section
          const Text(
            'ACCOUNT & CLOUD SYNC',
            style: TextStyle(
              color: AppTheme.muted,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 10),
          GlassCard(
            child: isSignedIn
                ? Column(
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 24,
                            backgroundColor: AppTheme.accent,
                            child: Text(
                              _auth.displayName.isNotEmpty
                                  ? _auth.displayName[0].toUpperCase()
                                  : 'U',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _auth.displayName,
                                  style: const TextStyle(
                                    color: AppTheme.text,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _auth.userEmail ?? '',
                                  style: const TextStyle(
                                    color: AppTheme.muted,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppTheme.line),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              icon: _isSyncing
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Icon(Icons.sync, color: AppTheme.accent, size: 18),
                              label: const Text('Sync Now', style: TextStyle(color: AppTheme.text)),
                              onPressed: _isSyncing
                                  ? null
                                  : () async {
                                      setState(() => _isSyncing = true);
                                      await _auth.syncNow();
                                      setState(() => _isSyncing = false);
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(content: Text('Synced with Supabase Cloud')),
                                        );
                                      }
                                    },
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppTheme.line),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              icon: const Icon(Icons.logout, color: Colors.redAccent, size: 18),
                              label: const Text('Sign Out', style: TextStyle(color: Colors.redAccent)),
                              onPressed: () async {
                                await _auth.signOut();
                                setState(() {});
                              },
                            ),
                          ),
                        ],
                      ),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Sign In to Sync Playlists',
                        style: TextStyle(
                          color: AppTheme.text,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Keep your liked songs, custom playlists, and listening history in sync with My Music Desktop.',
                        style: TextStyle(color: AppTheme.muted, fontSize: 13),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: Colors.black87,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          icon: const Icon(Icons.account_circle, color: Colors.black87),
                          label: const Text(
                            'Sign In with Google',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          onPressed: () async {
                            final ok = await _auth.signInWithGoogle();
                            if (ok) {
                              setState(() {});
                            }
                          },
                        ),
                      ),
                    ],
                  ),
          ),

          const SizedBox(height: 24),

          // Performance & Playback
          const Text(
            'PERFORMANCE & PLAYBACK',
            style: TextStyle(
              color: AppTheme.muted,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 10),
          GlassCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                SwitchListTile(
                  title: const Text('Low Resource Mode', style: TextStyle(color: AppTheme.text)),
                  subtitle: const Text(
                    'Optimizes image memory and reduces background animations on budget phones',
                    style: TextStyle(color: AppTheme.muted, fontSize: 12),
                  ),
                  activeThumbColor: AppTheme.accent,
                  value: library.lowResourceMode,
                  onChanged: (val) => library.setLowResourceMode(val),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // About
          const Text(
            'ABOUT',
            style: TextStyle(
              color: AppTheme.muted,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 10),
          const GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'My Music Mobile',
                  style: TextStyle(color: AppTheme.text, fontWeight: FontWeight.bold, fontSize: 15),
                ),
                SizedBox(height: 4),
                Text(
                  'Version 1.1.8 • High Performance Flutter Native Engine',
                  style: TextStyle(color: AppTheme.muted, fontSize: 13),
                ),
                SizedBox(height: 6),
                Text(
                  'Features: Direct YouTube Music audio streaming, LRCLIB synchronized lyrics, dual-deck background player, local & cloud sync.',
                  style: TextStyle(color: AppTheme.muted, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
