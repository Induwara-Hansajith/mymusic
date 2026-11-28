import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:audio_session/audio_session.dart';
import '../../providers/library_provider.dart';
import '../../providers/player_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/auth_sync_service.dart';
import '../../services/storage_service.dart';
import '../theme.dart';
import '../widgets/auth_modal.dart';
import '../widgets/desktop_widgets.dart';
import 'equalizer_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final AuthSyncService _auth = AuthSyncService();
  final TextEditingController _customWpCtrl = TextEditingController();
  late String _selectedOutputName;
  bool _discordPresence = true;

  @override
  void initState() {
    super.initState();
    final s = StorageService().getSettingsMap();
    _selectedOutputName = s['outputDeviceName'] as String? ?? 'Default output · Auto-route';
    _discordPresence = s['discordPresence'] != false;
    _customWpCtrl.text = s['wallpaper'] as String? ?? '';
    _auth.addListener(_onAuthChanged);
  }

  void _onAuthChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuthChanged);
    _customWpCtrl.dispose();
    super.dispose();
  }

  Future<void> showOutputDeviceModal(BuildContext context) async {
    await showAudioOutputDeviceSheet(
      context,
      selectedName: _selectedOutputName,
      onSelected: (name) async {
        await StorageService().patchSettings({'outputDeviceName': name});
        if (mounted) setState(() => _selectedOutputName = name);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final library = context.watch<LibraryProvider>();
    final theme = context.watch<ThemeProvider>();
    final isSignedIn = _auth.isSignedIn;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 120),
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 6, bottom: 14),
          child: Text(
            'Settings',
            style: TextStyle(
              color: AppTheme.text,
              fontSize: 26,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
            ),
          ),
        ),

        // 1. Account & Cloud Sync Card
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.cloud_outlined, color: theme.accentLight, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Account & Cloud Sync',
                    style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: theme.accent,
                    backgroundImage: _auth.avatarUrl.isNotEmpty
                        ? NetworkImage(_auth.avatarUrl)
                        : null,
                    child: _auth.avatarUrl.isEmpty
                        ? Text(
                            isSignedIn && _auth.displayName.isNotEmpty
                                ? _auth.displayName[0].toUpperCase()
                                : 'G',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 17,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isSignedIn ? _auth.displayName : 'Not signed in (Guest mode)',
                          style: const TextStyle(color: AppTheme.text, fontSize: 14.5, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isSignedIn
                              ? (_auth.userEmail ?? 'Connected to Supabase Cloud')
                              : 'Sign in with Google or Email to sync playlists & stats with Desktop',
                          style: const TextStyle(color: AppTheme.muted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isSignedIn ? AppTheme.bg3 : theme.accent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    onPressed: () => showDesktopAuthModal(context),
                    child: Text(isSignedIn ? 'Manage' : 'Sign In'),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 2. Audio Output Device Card
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.headphones_rounded, color: theme.accentLight, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Audio Output Device',
                    style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              InkWell(
                onTap: () => showOutputDeviceModal(context),
                borderRadius: BorderRadius.circular(10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Active Output Device',
                            style: TextStyle(color: AppTheme.text, fontSize: 14, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _selectedOutputName,
                            style: const TextStyle(color: AppTheme.muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      'Select ›',
                      style: TextStyle(color: theme.accentLight, fontWeight: FontWeight.w700, fontSize: 13.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 3. Audio DSP & Live DJ Studio Card
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.tune_rounded, color: theme.accentLight, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Audio DSP & Live DJ Studio',
                    style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '8D Spatial Audio, 10-Band EQ & Mix Deck',
                          style: TextStyle(color: AppTheme.text, fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Hardware-accelerated EQ, Bass Punch, DJ Filter Sweep & Speed',
                          style: TextStyle(color: AppTheme.muted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppTheme.glassBorder),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const EqualizerScreen()),
                    ),
                    child: const Text('Configure EQ', style: TextStyle(color: AppTheme.text)),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 4. Wallpaper & Backdrop Card (Exact Desktop Presets + Dim Slider)
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.wallpaper_rounded, color: theme.accentLight, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Wallpaper & Backdrop',
                    style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 76,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: AppTheme.wallpaperPresets.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 10),
                  itemBuilder: (_, i) {
                    final wp = AppTheme.wallpaperPresets[i];
                    final url = wp['url']!;
                    final active = theme.wallpaper == url;
                    return GestureDetector(
                      onTap: () {
                        _customWpCtrl.text = url;
                        theme.setWallpaper(url);
                      },
                      child: Container(
                        width: 112,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: active ? theme.accent : AppTheme.glassBorder,
                            width: active ? 2 : 1,
                          ),
                          color: const Color(0xFF131722),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              if (url.isNotEmpty)
                                CachedNetworkImage(imageUrl: url, fit: BoxFit.cover),
                              Container(
                                alignment: Alignment.bottomLeft,
                                padding: const EdgeInsets.all(6),
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [Colors.transparent, Colors.black87],
                                  ),
                                ),
                                child: Text(
                                  wp['name']!,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _customWpCtrl,
                      style: const TextStyle(color: AppTheme.text, fontSize: 12.5),
                      decoration: InputDecoration(
                        hintText: 'Custom wallpaper image URL...',
                        hintStyle: const TextStyle(color: AppTheme.muted, fontSize: 12),
                        filled: true,
                        fillColor: AppTheme.bg3,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(color: AppTheme.glassBorder),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppTheme.glassBorder),
                    ),
                    onPressed: () => theme.setWallpaper(_customWpCtrl.text.trim()),
                    child: const Text('Apply', style: TextStyle(color: AppTheme.text)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Backdrop Dimming', style: TextStyle(color: AppTheme.text, fontSize: 13.5, fontWeight: FontWeight.w600)),
                  Text('${theme.wallpaperDim.round()}%', style: TextStyle(color: theme.accentLight, fontWeight: FontWeight.bold, fontSize: 12.5)),
                ],
              ),
              Slider(
                value: theme.wallpaperDim.clamp(0, 90),
                min: 0,
                max: 90,
                divisions: 18,
                activeColor: theme.accent,
                inactiveColor: AppTheme.line,
                onChanged: (v) => theme.setWallpaperDim(v),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 5. Appearance, Ambient Colors & Performance
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.palette_outlined, color: theme.accentLight, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Appearance & Performance',
                    style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Dynamic Ambient Colors', style: TextStyle(color: AppTheme.text, fontSize: 14, fontWeight: FontWeight.w600)),
                subtitle: const Text('Shift app accents & aurora orbs to match album art', style: TextStyle(color: AppTheme.muted, fontSize: 12)),
                value: theme.ambientColors,
                activeThumbColor: Colors.white,
                activeTrackColor: theme.accent,
                onChanged: (v) {
                  theme.setAmbientColors(v);
                  if (v) theme.applyAccentFromThumb(player.currentTrack?.thumb);
                },
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: AppTheme.accentPresets.map((p) {
                  final isSel = theme.accentHueSetting.toString() == p['hue'].toString();
                  final color = Color(p['color'] as int);
                  return ChoiceChip(
                    avatar: CircleAvatar(backgroundColor: color, radius: 7),
                    label: Text(p['name'] as String),
                    selected: isSel,
                    selectedColor: color.withValues(alpha: 0.25),
                    backgroundColor: AppTheme.bg3,
                    labelStyle: TextStyle(
                      color: isSel ? AppTheme.text : AppTheme.muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                    onSelected: (_) {
                      theme.setAccentHue(p['hue']);
                      if (p['hue'] == 'auto') {
                        theme.applyAccentFromThumb(player.currentTrack?.thumb);
                      }
                    },
                  );
                }).toList(),
              ),
              const Divider(color: AppTheme.line, height: 22),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Low Resource Mode', style: TextStyle(color: AppTheme.text, fontSize: 14, fontWeight: FontWeight.w600)),
                subtitle: const Text('Disable animated aurora orbs to save battery & GPU', style: TextStyle(color: AppTheme.muted, fontSize: 12)),
                value: library.lowResourceMode,
                activeThumbColor: Colors.white,
                activeTrackColor: theme.accent,
                onChanged: (v) => library.setLowResourceMode(v),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 6. AutoMix & Transitions Card
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.auto_awesome_rounded, color: theme.accentLight, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'AutoMix & Song Transitions',
                    style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Enable AutoMix', style: TextStyle(color: AppTheme.text, fontSize: 14, fontWeight: FontWeight.w600)),
                subtitle: const Text('Smooth Apple Music-style transitions between songs', style: TextStyle(color: AppTheme.muted, fontSize: 12)),
                value: player.autoMixEnabled,
                activeThumbColor: Colors.white,
                activeTrackColor: theme.accent,
                onChanged: (v) => player.setAutoMixConfig(enabled: v),
              ),
              if (player.autoMixEnabled) ...[
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Transition Duration', style: TextStyle(color: AppTheme.text, fontSize: 13.5)),
                    Text(
                      player.autoMixDuration == 'auto'
                          ? 'Auto (Best Mix)'
                          : '${player.crossfadeDuration}s',
                      style: TextStyle(color: theme.accentLight, fontWeight: FontWeight.bold, fontSize: 12.5),
                    ),
                  ],
                ),
                Slider(
                  value: (player.autoMixDuration == 'auto' ? 6 : player.crossfadeDuration).toDouble().clamp(1, 15),
                  min: 1,
                  max: 15,
                  divisions: 14,
                  activeColor: theme.accent,
                  inactiveColor: AppTheme.line,
                  onChanged: (v) => player.setAutoMixConfig(
                    duration: v.round(),
                    crossfadeDuration: v.round(),
                  ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => player.setAutoMixConfig(duration: 'auto'),
                    child: Text('Reset to Auto (Best Mix)', style: TextStyle(color: theme.accentLight, fontSize: 12)),
                  ),
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 7. Lyrics & Visual Animation Style Card (All 11 Desktop Styles)
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.lyrics_outlined, color: theme.accentLight, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Lyrics & Visual Animation',
                    style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: theme.lyricsStyle,
                dropdownColor: const Color(0xFF101420),
                style: const TextStyle(color: AppTheme.text, fontSize: 13.5),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppTheme.bg3,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppTheme.glassBorder),
                  ),
                ),
                items: const [
                  DropdownMenuItem(value: 'random', child: Text('🔀 Auto-Randomize per Song')),
                  DropdownMenuItem(value: 'cinematic', child: Text('✨ Cinematic Story (SONARA AI)')),
                  DropdownMenuItem(value: 'apple-music', child: Text('🎵 Apple Music Kinetic Blur')),
                  DropdownMenuItem(value: 'verci-visual', child: Text('✨ Verci Visual (Animated Emojis)')),
                  DropdownMenuItem(value: 'verci-chat', child: Text('💬 Verci iMessage Chat Bubbles')),
                  DropdownMenuItem(value: 'verci-notifications', child: Text('📱 Verci Lock-Screen Notifications')),
                  DropdownMenuItem(value: 'verci-fisheye', child: Text('👁️ Verci 3D Fisheye Stack')),
                  DropdownMenuItem(value: 'verci-code', child: Text('💻 Verci Code Terminal')),
                  DropdownMenuItem(value: 'verci-constellation', child: Text('🌌 Verci Constellation Stars')),
                  DropdownMenuItem(value: 'karaoke', child: Text('🎤 Classic Karaoke')),
                  DropdownMenuItem(value: 'minimal', child: Text('📄 Minimalist Clean')),
                ],
                onChanged: (v) {
                  if (v != null) theme.setLyricsStyle(v);
                },
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 8. Playback & Sources
        GlassContainer(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Sources & Integration',
                style: TextStyle(color: AppTheme.text, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Discord Rich Presence', style: TextStyle(color: AppTheme.text, fontSize: 14, fontWeight: FontWeight.w600)),
                subtitle: const Text('Share active listening status', style: TextStyle(color: AppTheme.muted, fontSize: 12)),
                value: _discordPresence,
                activeThumbColor: Colors.white,
                activeTrackColor: theme.accent,
                onChanged: (v) {
                  setState(() => _discordPresence = v);
                  StorageService().patchSettings({'discordPresence': v});
                },
              ),
              const Text(
                'Song Sources: YouTube Music Innertube + 320 kbps Akamai CDN fallback · High-res artwork',
                style: TextStyle(color: AppTheme.muted, fontSize: 12),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Shared Output Device Modal triggered from both Settings and Player Bar headphone icon.
Future<void> showAudioOutputDeviceSheet(
  BuildContext context, {
  required String selectedName,
  required Future<void> Function(String name) onSelected,
}) async {
  List<AudioDevice> devices = [];
  try {
    final session = await AudioSession.instance;
    final allDevs = await session.getDevices();
    devices = allDevs.where((d) => d.isOutput).toList();
  } catch (e) {
    debugPrint('[OutputDeviceSheet] getDevices error: $e');
  }
  if (!context.mounted) return;
  final accent = context.read<ThemeProvider>().accent;

  await showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Color(0xFF101420),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: AppTheme.glassBorder)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
                  color: accent.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${devices.isEmpty ? 1 : devices.length} available',
                  style: TextStyle(color: accent, fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Route music to your phone speaker, Bluetooth earbuds, or wired headphones.',
            style: TextStyle(color: AppTheme.muted, fontSize: 12.5),
          ),
          const SizedBox(height: 14),
          _deviceTile(
            name: 'Default System Routing',
            desc: 'Auto-routes to Bluetooth, headphones, or speaker',
            icon: Icons.speaker_group_rounded,
            selected: selectedName.startsWith('Default'),
            accent: accent,
            onTap: () async {
              try {
                final manager = AndroidAudioManager();
                await manager.setSpeakerphoneOn(false);
                await manager.clearCommunicationDevice();
                await manager.setMode(AndroidAudioHardwareMode.normal);
              } catch (_) {}
              await onSelected('Default output · Auto-route');
              if (ctx.mounted) Navigator.pop(ctx);
            },
          ),
          const SizedBox(height: 8),
          if (devices.isNotEmpty)
            ...devices.map((d) {
              final t = d.type.name.toLowerCase();
              final isSpeaker = t.contains('speaker');
              final isHead = t.contains('head');
              final isBt = t.contains('bluetooth') || t.contains('ble');
              final label = d.name.isNotEmpty ? d.name : 'Audio Device';
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _deviceTile(
                  name: label,
                  desc: isSpeaker
                      ? 'Built-in Speaker'
                      : (isHead ? 'Wired Headphones' : (isBt ? 'Bluetooth Audio' : 'Audio Output')),
                  icon: isSpeaker
                      ? Icons.volume_up_rounded
                      : (isHead ? Icons.headphones_rounded : (isBt ? Icons.bluetooth_audio_rounded : Icons.speaker_rounded)),
                  selected: selectedName == label,
                  accent: accent,
                  onTap: () async {
                    try {
                      final manager = AndroidAudioManager();
                      if (isSpeaker) {
                        await manager.setMode(AndroidAudioHardwareMode.inCommunication);
                        await manager.setSpeakerphoneOn(true);
                      } else {
                        await manager.setMode(AndroidAudioHardwareMode.inCommunication);
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
                    await onSelected(label);
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                ),
              );
            })
          else
            _deviceTile(
              name: 'Phone Speaker',
              desc: 'Force output through built-in loudspeaker',
              icon: Icons.volume_up_rounded,
              selected: selectedName == 'Phone Speaker',
              accent: accent,
              onTap: () async {
                try {
                  final manager = AndroidAudioManager();
                  await manager.setMode(AndroidAudioHardwareMode.inCommunication);
                  await manager.setSpeakerphoneOn(true);
                } catch (_) {}
                await onSelected('Phone Speaker');
                if (ctx.mounted) Navigator.pop(ctx);
              },
            ),
        ],
      ),
    ),
  );
}

Widget _deviceTile({
  required String name,
  required String desc,
  required IconData icon,
  required bool selected,
  required Color accent,
  required VoidCallback onTap,
}) {
  return InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(12),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: selected ? accent.withValues(alpha: 0.14) : AppTheme.bg3,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: selected ? accent : AppTheme.glassBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: selected ? accent : AppTheme.panel,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: selected ? Colors.white : AppTheme.muted, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(color: AppTheme.text, fontWeight: FontWeight.bold, fontSize: 13.5)),
                Text(desc, style: const TextStyle(color: AppTheme.muted, fontSize: 11.5)),
              ],
            ),
          ),
          if (selected) Icon(Icons.check_circle_rounded, color: accent, size: 20),
        ],
      ),
    ),
  );
}
