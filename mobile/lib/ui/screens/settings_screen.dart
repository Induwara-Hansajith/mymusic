import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:audio_session/audio_session.dart';
import '../../services/auth_sync_service.dart';
import '../../providers/player_provider.dart';
import '../theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final AuthSyncService _auth = AuthSyncService();
  bool _discordPresence = true;
  bool _isSyncing = false;
  String _selectedOutputName = 'Default output · Auto-route';

  void _showOutputDeviceModal(BuildContext context) async {
    List<AudioDevice> devices = [];
    try {
      final session = await AudioSession.instance;
      final allDevs = await session.getDevices();
      devices = allDevs.where((d) => d.isOutput).toList();
    } catch (e) {
      debugPrint('[SettingsScreen] getDevices error: $e');
    }

    if (!context.mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          padding: const EdgeInsets.all(22),
          decoration: const BoxDecoration(
            color: AppTheme.panel,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppTheme.line,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Audio Output Device',
                    style: TextStyle(color: AppTheme.text, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.accent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${devices.isEmpty ? 1 : devices.length} available',
                      style: const TextStyle(color: AppTheme.accentLight, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Route music to your phone speaker, Bluetooth earbuds, or wired headphones.',
                style: TextStyle(color: AppTheme.subtitle, fontSize: 13),
              ),
              const SizedBox(height: 16),
              _buildDeviceTile(
                name: 'Default System Routing',
                typeDesc: 'Auto-routes to Bluetooth, headphones, or speaker',
                iconData: Icons.speaker_group_rounded,
                isSelected: _selectedOutputName.startsWith('Default'),
                onTap: () async {
                  try {
                    final manager = AndroidAudioManager();
                    await manager.setSpeakerphoneOn(false);
                    await manager.clearCommunicationDevice();
                  } catch (_) {}
                  setState(() => _selectedOutputName = 'Default output · Auto-route');
                  if (ctx.mounted) Navigator.pop(ctx);
                },
              ),
              const SizedBox(height: 8),
              if (devices.isNotEmpty)
                ...devices.map((d) {
                  final typeName = d.type.name.toLowerCase();
                  final isSpeaker = typeName.contains('speaker');
                  final isHeadphones = typeName.contains('head');
                  final isBluetooth = typeName.contains('bluetooth') || typeName.contains('ble');
                  final icon = isSpeaker
                      ? Icons.volume_up_rounded
                      : (isHeadphones ? Icons.headphones_rounded : (isBluetooth ? Icons.bluetooth_audio_rounded : Icons.speaker_rounded));
                  final isSel = _selectedOutputName == d.name;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _buildDeviceTile(
                      name: d.name.isNotEmpty ? d.name : 'Audio Device',
                      typeDesc: isSpeaker
                          ? 'Built-in Speaker'
                          : (isHeadphones ? 'Wired Headphones' : (isBluetooth ? 'Bluetooth Audio' : 'Audio Output')),
                      iconData: icon,
                      isSelected: isSel,
                      onTap: () async {
                        try {
                          final manager = AndroidAudioManager();
                          if (isSpeaker) {
                            await manager.setSpeakerphoneOn(true);
                          } else {
                            await manager.setSpeakerphoneOn(false);
                            final comm = await manager.getAvailableCommunicationDevices();
                            if (comm.isNotEmpty) {
                              final match = comm.firstWhere(
                                (c) => c.productName == d.name || c.id.toString() == d.id,
                                orElse: () => comm.first,
                              );
                              await manager.setCommunicationDevice(match);
                            }
                          }
                        } catch (_) {}
                        setState(() => _selectedOutputName = d.name.isNotEmpty ? d.name : 'Audio Device');
                        if (ctx.mounted) Navigator.pop(ctx);
                      },
                    ),
                  );
                })
              else ...[
                _buildDeviceTile(
                  name: 'Phone Speaker',
                  typeDesc: 'Force output through built-in loudspeaker',
                  iconData: Icons.volume_up_rounded,
                  isSelected: _selectedOutputName == 'Phone Speaker',
                  onTap: () async {
                    try {
                      final manager = AndroidAudioManager();
                      await manager.setSpeakerphoneOn(true);
                    } catch (_) {}
                    setState(() => _selectedOutputName = 'Phone Speaker');
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                ),
              ],
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  void _showEmailAuthModal(BuildContext context) {
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    bool isSignUp = false;
    String? errorMsg;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
          decoration: const BoxDecoration(
            color: AppTheme.panel,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppTheme.line,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                isSignUp ? 'Create Supabase Account' : 'Sign In with Email',
                style: const TextStyle(
                  color: AppTheme.text,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Sync your playlists and listening history across desktop and mobile.',
                style: TextStyle(color: AppTheme.muted, fontSize: 13),
              ),
              const SizedBox(height: 18),
              if (errorMsg != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(errorMsg!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                style: const TextStyle(color: AppTheme.text),
                decoration: InputDecoration(
                  hintText: 'Email address',
                  hintStyle: const TextStyle(color: AppTheme.muted),
                  filled: true,
                  fillColor: AppTheme.bg2,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: passCtrl,
                obscureText: true,
                style: const TextStyle(color: AppTheme.text),
                decoration: InputDecoration(
                  hintText: 'Password',
                  hintStyle: const TextStyle(color: AppTheme.muted),
                  filled: true,
                  fillColor: AppTheme.bg2,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.accent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () async {
                    final email = emailCtrl.text.trim();
                    final pass = passCtrl.text;
                    if (email.isEmpty || pass.isEmpty) {
                      setModalState(() => errorMsg = 'Please enter email and password');
                      return;
                    }
                    setModalState(() => errorMsg = null);
                    if (isSignUp) {
                      final err = await _auth.signUpWithPassword(email, pass);
                      if (err != null) {
                        setModalState(() => errorMsg = err);
                      } else {
                        if (ctx.mounted) Navigator.pop(ctx);
                        setState(() {});
                      }
                    } else {
                      final err = await _auth.signInWithPassword(email, pass);
                      if (err != null) {
                        setModalState(() => errorMsg = err);
                      } else {
                        if (ctx.mounted) Navigator.pop(ctx);
                        setState(() {});
                      }
                    }
                  },
                  child: Text(
                    isSignUp ? 'Sign Up' : 'Sign In',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: TextButton(
                  onPressed: () => setModalState(() => isSignUp = !isSignUp),
                  child: Text(
                    isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up',
                    style: const TextStyle(color: AppTheme.subtitle, fontSize: 13),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final isSignedIn = _auth.isSignedIn;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 110),
          children: [
            // Header
            const Text(
              'YOUR SPACE, YOUR SOUND',
              style: TextStyle(
                color: AppTheme.subtitle,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 2),
            const Text(
              'Settings',
              style: TextStyle(
                color: AppTheme.text,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 16),

            // Card 1: Account / Sync Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: AppTheme.line),
              ),
              child: isSignedIn
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 22,
                              backgroundColor: AppTheme.accent,
                              child: Text(
                                _auth.displayName.isNotEmpty
                                    ? _auth.displayName[0].toUpperCase()
                                    : 'M',
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
                                    _auth.userEmail ?? 'Signed in',
                                    style: const TextStyle(color: AppTheme.muted, fontSize: 13),
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
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                icon: _isSyncing
                                    ? const SizedBox(
                                        width: 14,
                                        height: 14,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      )
                                    : const Icon(Icons.sync_rounded, color: AppTheme.accentLight, size: 18),
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
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                icon: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 18),
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
                          'Take your music everywhere.',
                          style: TextStyle(
                            color: AppTheme.text,
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Sync playlists, likes, and listening history.',
                          style: TextStyle(color: AppTheme.muted, fontSize: 13),
                        ),
                        const SizedBox(height: 18),
                        Row(
                          children: [
                            // Google button
                            Expanded(
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: Colors.black87,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(vertical: 13),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(24),
                                  ),
                                ),
                                icon: const Icon(Icons.g_mobiledata_rounded, color: Colors.black87, size: 26),
                                label: const Text(
                                  'Google',
                                  style: TextStyle(
                                    color: Colors.black87,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                  ),
                                ),
                                onPressed: () async {
                                  final ok = await _auth.signInWithGoogle();
                                  if (!ok && context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Starting Google sign-in in browser...')),
                                    );
                                  }
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            // Email button
                            Expanded(
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF232336),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(vertical: 13),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(24),
                                    side: const BorderSide(color: AppTheme.line),
                                  ),
                                ),
                                icon: const Icon(Icons.email_outlined, color: Colors.white70, size: 20),
                                label: const Text(
                                  'Email',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                  ),
                                ),
                                onPressed: () => _showEmailAuthModal(context),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
            ),

            const SizedBox(height: 20),

            // Settings list
            _buildSettingRow(
              title: 'Cloud sync',
              subtitle: 'Sign in to back up your library',
              trailing: Text(
                isSignedIn ? 'Connected' : 'Sign in',
                style: const TextStyle(color: AppTheme.subtitle, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              onTap: () {
                if (!isSignedIn) {
                  _showEmailAuthModal(context);
                }
              },
            ),
            const SizedBox(height: 12),
            _buildSettingRow(
              title: 'Discord presence',
              subtitle: 'Share what is playing',
              trailing: Switch(
                value: _discordPresence,
                activeTrackColor: AppTheme.accent,
                activeThumbColor: Colors.white,
                onChanged: (v) => setState(() => _discordPresence = v),
              ),
            ),
            const SizedBox(height: 12),
            _buildSettingRow(
              title: 'Wallpaper',
              subtitle: 'Aurora · follows album artwork',
              trailing: const Text(
                'Change ›',
                style: TextStyle(color: AppTheme.muted, fontSize: 14),
              ),
            ),
            const SizedBox(height: 12),
            _buildSettingRow(
              title: 'Accent override',
              subtitle: 'Dynamic · sampled from artwork',
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: const BoxDecoration(
                      color: AppTheme.accent,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Dynamic ›',
                    style: TextStyle(color: AppTheme.muted, fontSize: 14),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _buildSettingRow(
              title: 'AutoMix',
              subtitle: 'Seamless 6-second crossfade',
              trailing: Switch(
                value: player.autoMixEnabled,
                activeTrackColor: AppTheme.accent,
                activeThumbColor: Colors.white,
                onChanged: (_) => player.toggleAutoMix(),
              ),
            ),
            const SizedBox(height: 12),
            _buildSettingRow(
              title: 'Audio output device',
              subtitle: _selectedOutputName,
              trailing: const Text(
                'Select ›',
                style: TextStyle(color: AppTheme.accentLight, fontWeight: FontWeight.w600, fontSize: 13),
              ),
              onTap: () => _showOutputDeviceModal(context),
            ),
            const SizedBox(height: 12),
            _buildSettingRow(
              title: 'Song sources',
              subtitle: 'Desktop YouTube Music · 320 kbps CDN fallback',
              trailing: const Text(
                'Desktop parity ›',
                style: TextStyle(color: AppTheme.accentLight, fontWeight: FontWeight.w600, fontSize: 13),
              ),
              onTap: () {
                showModalBottomSheet(
                  context: context,
                  backgroundColor: Colors.transparent,
                  builder: (ctx) => Container(
                    padding: const EdgeInsets.all(22),
                    decoration: const BoxDecoration(
                      color: AppTheme.panel,
                      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Center(
                          child: Container(
                            width: 40,
                            height: 4,
                            decoration: BoxDecoration(
                              color: AppTheme.line,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Text(
                          'Song Sources & Desktop Parity',
                          style: TextStyle(color: AppTheme.text, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'My Music Mobile streams songs using the exact same multi-engine architecture as desktop My Music:\n\n'
                          '• Desktop YouTube Music: High-bitrate m4a/opus streams extracted with Android client manifests.\n'
                          '• High-Fidelity 320 kbps CDN: Fast Akamai/Cloudfront audio delivery with zero throttling.\n'
                          '• Auto-Fallback & Radio: Automatic title+artist matching and dynamic radio queue continuation.\n'
                          '• LRCLIB Synced Lyrics: Millisecond-synced lyrics with live seeking.',
                          style: TextStyle(color: AppTheme.subtitle, fontSize: 13, height: 1.5),
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.accent,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () => Navigator.pop(ctx),
                            child: const Text('Got it', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            _buildSettingRow(
              title: 'Download quality',
              subtitle: 'High · 256 kbps AAC',
              trailing: const Text(
                'High ›',
                style: TextStyle(color: AppTheme.muted, fontSize: 14),
              ),
            ),
            const SizedBox(height: 12),
            _buildSettingRow(
              title: 'Accessibility',
              subtitle: 'Dynamic Type · VoiceOver · Reduce Motion',
              trailing: const Text(
                'Open ›',
                style: TextStyle(color: AppTheme.muted, fontSize: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingRow({
    required String title,
    required String subtitle,
    required Widget trailing,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppTheme.panel,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.line),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: AppTheme.text,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: AppTheme.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            trailing,
          ],
        ),
      ),
    );
  }

  Widget _buildDeviceTile({
    required String name,
    required String typeDesc,
    required IconData iconData,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.accent.withValues(alpha: 0.12) : AppTheme.bg2,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? AppTheme.accent : AppTheme.line,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isSelected ? AppTheme.accent : AppTheme.panel,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(iconData, color: isSelected ? Colors.white : AppTheme.muted, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      color: AppTheme.text,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(typeDesc, style: const TextStyle(color: AppTheme.muted, fontSize: 12)),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, color: AppTheme.accentLight, size: 20),
          ],
        ),
      ),
    );
  }
}
