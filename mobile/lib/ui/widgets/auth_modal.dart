import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/player_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/auth_sync_service.dart';
import '../theme.dart';

/// Complete Desktop `openAuthModal` parity (Google Sign-In, Email Sign-In/Sign-Up/Reset,
/// and authenticated Overview, Profile, Security, Cloud Sync, Danger Zone).
Future<void> showDesktopAuthModal(BuildContext context) async {
  final auth = AuthSyncService();
  String loggedOutTab = 'signin'; // 'signin' | 'signup' | 'recover'
  String loggedInTab = 'overview'; // 'overview' | 'profile' | 'security' | 'sync' | 'danger'
  String? alertMsg;
  bool alertIsError = false;
  bool busy = false;

  final inEmailCtrl = TextEditingController();
  final inPassCtrl = TextEditingController();
  final upNameCtrl = TextEditingController();
  final upEmailCtrl = TextEditingController();
  final upPassCtrl = TextEditingController();
  final recEmailCtrl = TextEditingController();
  final editNameCtrl = TextEditingController(text: auth.displayName);
  final newPassCtrl = TextEditingController();
  final confirmPassCtrl = TextEditingController();

  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setModal) {
        final accent = context.read<ThemeProvider>().accent;
        final isSignedIn = auth.isSignedIn;

        Widget alertBox() {
          if (alertMsg == null) return const SizedBox.shrink();
          return Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: alertIsError
                  ? Colors.redAccent.withValues(alpha: 0.14)
                  : const Color(0xFF10B981).withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: alertIsError
                    ? Colors.redAccent.withValues(alpha: 0.45)
                    : const Color(0xFF10B981).withValues(alpha: 0.45),
              ),
            ),
            child: Text(
              alertMsg!,
              style: TextStyle(
                color: alertIsError ? const Color(0xFFFCA5A5) : const Color(0xFF6EE7B7),
                fontSize: 12.5,
              ),
            ),
          );
        }

        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.9,
          ),
          padding: EdgeInsets.fromLTRB(
            20,
            16,
            20,
            MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          decoration: const BoxDecoration(
            color: Color(0xFF101420),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(top: BorderSide(color: AppTheme.glassBorder)),
          ),
          child: SingleChildScrollView(
            child: isSignedIn
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Authenticated header
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 22,
                            backgroundColor: accent,
                            backgroundImage: auth.avatarUrl.isNotEmpty
                                ? NetworkImage(auth.avatarUrl)
                                : null,
                            child: auth.avatarUrl.isEmpty
                                ? Text(
                                    auth.displayName.isNotEmpty
                                        ? auth.displayName[0].toUpperCase()
                                        : 'M',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 18,
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
                                  auth.displayName,
                                  style: const TextStyle(
                                    color: AppTheme.text,
                                    fontSize: 17,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  auth.userEmail ?? '',
                                  style: const TextStyle(color: AppTheme.muted, fontSize: 12.5),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: AppTheme.muted),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            for (final t in const [
                              ['overview', 'Overview'],
                              ['profile', 'Edit Profile'],
                              ['security', 'Security'],
                              ['sync', 'Cloud Sync'],
                              ['danger', 'Danger Zone'],
                            ])
                              Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  label: Text(t[1]),
                                  selected: loggedInTab == t[0],
                                  selectedColor: accent.withValues(alpha: 0.25),
                                  backgroundColor: AppTheme.bg3,
                                  labelStyle: TextStyle(
                                    color: loggedInTab == t[0] ? AppTheme.text : AppTheme.muted,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  onSelected: (_) => setModal(() {
                                    loggedInTab = t[0];
                                    alertMsg = null;
                                  }),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      alertBox(),
                      if (loggedInTab == 'overview') ...[
                        _cardTile(
                          title: 'Cloud Sync Status',
                          subtitle: auth.syncStatus == CloudSyncStatus.synced
                              ? 'Synced across desktop and mobile'
                              : (auth.syncStatus == CloudSyncStatus.syncing
                                  ? 'Syncing…'
                                  : (auth.syncError ?? 'Ready to sync')),
                          trailing: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(backgroundColor: accent),
                            icon: const Icon(Icons.sync_rounded, size: 17, color: Colors.white),
                            label: const Text('Sync Now', style: TextStyle(color: Colors.white)),
                            onPressed: busy
                                ? null
                                : () async {
                                    setModal(() => busy = true);
                                    final ok = await auth.syncNow();
                                    if (context.mounted) {
                                      context.read<LibraryProvider>().load();
                                      context.read<PlayerProvider>().reloadSyncedSettings();
                                      context.read<ThemeProvider>().load();
                                    }
                                    setModal(() {
                                      busy = false;
                                      alertIsError = !ok;
                                      alertMsg = ok
                                          ? 'Library synced with Supabase Cloud!'
                                          : (auth.syncError ?? 'Sync failed.');
                                    });
                                  },
                          ),
                        ),
                        const SizedBox(height: 10),
                        _cardTile(
                          title: 'Sign Out',
                          subtitle: 'Switch back to local guest mode safely.',
                          trailing: OutlinedButton(
                            onPressed: () async {
                              await auth.signOut();
                              if (ctx.mounted) Navigator.pop(ctx);
                            },
                            child: const Text('Sign Out', style: TextStyle(color: AppTheme.text)),
                          ),
                        ),
                      ] else if (loggedInTab == 'profile') ...[
                        TextField(
                          controller: editNameCtrl,
                          style: const TextStyle(color: AppTheme.text),
                          decoration: _inputDeco('Display Name'),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          height: 46,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: accent),
                            onPressed: busy
                                ? null
                                : () async {
                                    setModal(() => busy = true);
                                    final err = await auth.updateProfile(name: editNameCtrl.text);
                                    setModal(() {
                                      busy = false;
                                      alertIsError = err != null;
                                      alertMsg = err ?? 'Profile updated successfully!';
                                    });
                                  },
                            child: const Text('Save Changes', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ] else if (loggedInTab == 'security') ...[
                        TextField(
                          controller: newPassCtrl,
                          obscureText: true,
                          style: const TextStyle(color: AppTheme.text),
                          decoration: _inputDeco('New Password (min 6 chars)'),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: confirmPassCtrl,
                          obscureText: true,
                          style: const TextStyle(color: AppTheme.text),
                          decoration: _inputDeco('Confirm Password'),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          height: 46,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: accent),
                            onPressed: busy
                                ? null
                                : () async {
                                    if (newPassCtrl.text != confirmPassCtrl.text) {
                                      setModal(() {
                                        alertIsError = true;
                                        alertMsg = 'Passwords do not match.';
                                      });
                                      return;
                                    }
                                    setModal(() => busy = true);
                                    final err = await auth.updatePassword(newPassCtrl.text);
                                    if (err == null) {
                                      newPassCtrl.clear();
                                      confirmPassCtrl.clear();
                                    }
                                    setModal(() {
                                      busy = false;
                                      alertIsError = err != null;
                                      alertMsg = err ?? 'Password updated successfully!';
                                    });
                                  },
                            child: const Text('Update Password', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ] else if (loggedInTab == 'sync') ...[
                        _cardTile(
                          title: 'Upload Local to Cloud',
                          subtitle: 'Overwrite cloud library with this phone’s playlists and likes.',
                          trailing: OutlinedButton(
                            onPressed: busy
                                ? null
                                : () async {
                                    setModal(() => busy = true);
                                    final err = await auth.forcePush();
                                    setModal(() {
                                      busy = false;
                                      alertIsError = err != null;
                                      alertMsg = err ?? 'Local library uploaded to cloud.';
                                    });
                                  },
                            child: const Text('Upload', style: TextStyle(color: AppTheme.text)),
                          ),
                        ),
                        const SizedBox(height: 10),
                        _cardTile(
                          title: 'Download Cloud to Local',
                          subtitle: 'Replace local library with the cloud snapshot.',
                          trailing: OutlinedButton(
                            onPressed: busy
                                ? null
                                : () async {
                                    setModal(() => busy = true);
                                    final err = await auth.forcePull();
                                    if (context.mounted) {
                                      context.read<LibraryProvider>().load();
                                      context.read<PlayerProvider>().reloadSyncedSettings();
                                      context.read<ThemeProvider>().load();
                                    }
                                    setModal(() {
                                      busy = false;
                                      alertIsError = err != null;
                                      alertMsg = err ?? 'Cloud library loaded.';
                                    });
                                  },
                            child: const Text('Download', style: TextStyle(color: AppTheme.text)),
                          ),
                        ),
                        const SizedBox(height: 10),
                        _cardTile(
                          title: 'Clear Cloud Library',
                          subtitle: 'Delete cloud data while keeping local files intact.',
                          trailing: OutlinedButton(
                            onPressed: busy
                                ? null
                                : () async {
                                    setModal(() => busy = true);
                                    final err = await auth.deleteCloudData();
                                    setModal(() {
                                      busy = false;
                                      alertIsError = err != null;
                                      alertMsg = err ?? 'Cloud library cleared.';
                                    });
                                  },
                            child: const Text('Clear', style: TextStyle(color: Colors.redAccent)),
                          ),
                        ),
                      ] else if (loggedInTab == 'danger') ...[
                        _cardTile(
                          title: 'Delete Account & Cloud Data',
                          subtitle: 'Removes cloud backup and signs out on this device.',
                          trailing: ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                            onPressed: busy
                                ? null
                                : () async {
                                    setModal(() => busy = true);
                                    await auth.deleteAccount();
                                    if (ctx.mounted) Navigator.pop(ctx);
                                  },
                            child: const Text('Delete', style: TextStyle(color: Colors.white)),
                          ),
                        ),
                      ],
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Logged out header
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: accent.withValues(alpha: 0.16),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    'CROSS-PLATFORM CLOUD SYNC',
                                    style: TextStyle(
                                      color: context.read<ThemeProvider>().accentLight,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  loggedOutTab == 'signup'
                                      ? 'Create Account'
                                      : (loggedOutTab == 'recover' ? 'Reset Password' : 'Sign In'),
                                  style: const TextStyle(
                                    color: AppTheme.text,
                                    fontSize: 22,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: AppTheme.muted),
                            onPressed: () {
                              if (auth.googleInProgress) auth.cancelGoogleSignIn();
                              Navigator.pop(ctx);
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Keep your playlists, favorites, and stats in sync across Windows, Linux, and Android.',
                        style: TextStyle(color: AppTheme.muted, fontSize: 12.5),
                      ),
                      const SizedBox(height: 14),
                      if (loggedOutTab != 'recover')
                        Row(
                          children: [
                            Expanded(
                              child: _modeTab(
                                label: 'Sign In',
                                active: loggedOutTab == 'signin',
                                accent: accent,
                                onTap: () => setModal(() {
                                  loggedOutTab = 'signin';
                                  alertMsg = null;
                                }),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _modeTab(
                                label: 'Create Account',
                                active: loggedOutTab == 'signup',
                                accent: accent,
                                onTap: () => setModal(() {
                                  loggedOutTab = 'signup';
                                  alertMsg = null;
                                }),
                              ),
                            ),
                          ],
                        ),
                      const SizedBox(height: 14),
                      alertBox(),
                      if (loggedOutTab != 'recover') ...[
                        SizedBox(
                          width: double.infinity,
                          height: 46,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: Colors.black87,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: busy && auth.googleInProgress
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black87),
                                  )
                                : const Icon(Icons.g_mobiledata_rounded, size: 28, color: Colors.black87),
                            label: Text(
                              auth.googleInProgress
                                  ? 'Waiting for Google in browser…'
                                  : 'Continue with Google',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
                            ),
                            onPressed: busy
                                ? null
                                : () async {
                                    setModal(() {
                                      busy = true;
                                      alertIsError = false;
                                      alertMsg = 'Opening Google sign-in in browser...';
                                    });
                                    final err = await auth.signInWithGoogle();
                                    if (!ctx.mounted) return;
                                    if (err == null) {
                                      if (context.mounted) {
                                        context.read<LibraryProvider>().load();
                                        context.read<PlayerProvider>().reloadSyncedSettings();
                                        context.read<ThemeProvider>().load();
                                      }
                                      setModal(() => busy = false);
                                      Navigator.pop(ctx);
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Signed in as ${auth.displayName}')),
                                        );
                                      }
                                    } else {
                                      setModal(() {
                                        busy = false;
                                        alertIsError = true;
                                        alertMsg = err;
                                      });
                                    }
                                  },
                          ),
                        ),
                        if (auth.googleInProgress) ...[
                          const SizedBox(height: 6),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () {
                                auth.cancelGoogleSignIn();
                                setModal(() => busy = false);
                              },
                              child: const Text('Cancel Google sign-in', style: TextStyle(color: AppTheme.muted, fontSize: 12)),
                            ),
                          ),
                        ],
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            children: [
                              Expanded(child: Divider(color: AppTheme.line)),
                              Padding(
                                padding: EdgeInsets.symmetric(horizontal: 10),
                                child: Text('or with email', style: TextStyle(color: AppTheme.muted, fontSize: 12)),
                              ),
                              Expanded(child: Divider(color: AppTheme.line)),
                            ],
                          ),
                        ),
                      ],
                      if (loggedOutTab == 'signin') ...[
                        TextField(
                          controller: inEmailCtrl,
                          keyboardType: TextInputType.emailAddress,
                          style: const TextStyle(color: AppTheme.text),
                          decoration: _inputDeco('Email Address'),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: inPassCtrl,
                          obscureText: true,
                          style: const TextStyle(color: AppTheme.text),
                          decoration: _inputDeco('Password'),
                        ),
                        const SizedBox(height: 6),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () => setModal(() {
                              loggedOutTab = 'recover';
                              alertMsg = null;
                            }),
                            child: Text('Forgot password?', style: TextStyle(color: accent, fontSize: 12.5)),
                          ),
                        ),
                        SizedBox(
                          width: double.infinity,
                          height: 46,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: accent,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: busy
                                ? null
                                : () async {
                                    setModal(() {
                                      busy = true;
                                      alertMsg = null;
                                    });
                                    final err = await auth.signInWithPassword(inEmailCtrl.text, inPassCtrl.text);
                                    if (!ctx.mounted) return;
                                    if (err == null) {
                                      if (context.mounted) {
                                        context.read<LibraryProvider>().load();
                                        context.read<PlayerProvider>().reloadSyncedSettings();
                                        context.read<ThemeProvider>().load();
                                      }
                                      Navigator.pop(ctx);
                                    } else {
                                      setModal(() {
                                        busy = false;
                                        alertIsError = true;
                                        alertMsg = err;
                                      });
                                    }
                                  },
                            child: const Text('Sign In & Sync', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ] else if (loggedOutTab == 'signup') ...[
                        TextField(
                          controller: upNameCtrl,
                          style: const TextStyle(color: AppTheme.text),
                          decoration: _inputDeco('Display Name'),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: upEmailCtrl,
                          keyboardType: TextInputType.emailAddress,
                          style: const TextStyle(color: AppTheme.text),
                          decoration: _inputDeco('Email Address'),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: upPassCtrl,
                          obscureText: true,
                          style: const TextStyle(color: AppTheme.text),
                          decoration: _inputDeco('Password (min 6 characters)'),
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          height: 46,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: accent,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: busy
                                ? null
                                : () async {
                                    setModal(() {
                                      busy = true;
                                      alertMsg = null;
                                    });
                                    final err = await auth.signUpWithPassword(
                                      upEmailCtrl.text,
                                      upPassCtrl.text,
                                      name: upNameCtrl.text,
                                    );
                                    if (!ctx.mounted) return;
                                    if (err == null) {
                                      Navigator.pop(ctx);
                                    } else if (err == 'CONFIRM_EMAIL') {
                                      setModal(() {
                                        busy = false;
                                        alertIsError = false;
                                        alertMsg = 'Account created! Check your email to confirm before signing in.';
                                      });
                                    } else {
                                      setModal(() {
                                        busy = false;
                                        alertIsError = true;
                                        alertMsg = err;
                                      });
                                    }
                                  },
                            child: const Text('Create Account & Sync', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ] else ...[
                        TextField(
                          controller: recEmailCtrl,
                          keyboardType: TextInputType.emailAddress,
                          style: const TextStyle(color: AppTheme.text),
                          decoration: _inputDeco('Email Address'),
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          height: 46,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: accent,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: busy
                                ? null
                                : () async {
                                    setModal(() => busy = true);
                                    final err = await auth.resetPassword(recEmailCtrl.text);
                                    setModal(() {
                                      busy = false;
                                      alertIsError = err != null;
                                      alertMsg = err ?? 'Password recovery email sent.';
                                    });
                                  },
                            child: const Text('Send Reset Instructions', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                        TextButton(
                          onPressed: () => setModal(() => loggedOutTab = 'signin'),
                          child: const Text('Back to Sign In', style: TextStyle(color: AppTheme.muted)),
                        ),
                      ],
                    ],
                  ),
          ),
        );
      },
    ),
  );
}

InputDecoration _inputDeco(String hint) => InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AppTheme.muted, fontSize: 13.5),
      filled: true,
      fillColor: AppTheme.bg3,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(11),
        borderSide: const BorderSide(color: AppTheme.glassBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(11),
        borderSide: const BorderSide(color: AppTheme.glassBorder),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    );

Widget _modeTab({
  required String label,
  required bool active,
  required Color accent,
  required VoidCallback onTap,
}) {
  return GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: active ? accent.withValues(alpha: 0.22) : AppTheme.bg3,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: active ? accent : AppTheme.glassBorder),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: active ? AppTheme.text : AppTheme.muted,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
      ),
    ),
  );
}

Widget _cardTile({
  required String title,
  required String subtitle,
  required Widget trailing,
}) {
  return Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppTheme.bg3,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppTheme.glassBorder),
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: AppTheme.text, fontWeight: FontWeight.w600, fontSize: 13.5)),
              const SizedBox(height: 2),
              Text(subtitle, style: const TextStyle(color: AppTheme.muted, fontSize: 11.5)),
            ],
          ),
        ),
        const SizedBox(width: 10),
        trailing,
      ],
    ),
  );
}
