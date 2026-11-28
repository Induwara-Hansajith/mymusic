import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/library_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/playlist_importer_service.dart';
import '../theme.dart';

Future<void> showImportPlaylistModal(
  BuildContext context, {
  void Function(String playlistId)? onImported,
}) async {
  final urlCtrl = TextEditingController();
  final csvNameCtrl = TextEditingController();
  final csvInputCtrl = TextEditingController();
  int tab = 0; // 0: URL, 1: CSV
  bool loading = false;
  String? statusText;
  bool isError = false;

  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setModal) {
        final accent = context.read<ThemeProvider>().accent;
        return Container(
          padding: EdgeInsets.fromLTRB(
            20,
            16,
            20,
            MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          decoration: const BoxDecoration(
            color: Color(0xFF101420),
            borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
            border: Border(top: BorderSide(color: AppTheme.glassBorder)),
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.playlist_add_check_rounded, color: AppTheme.text, size: 22),
                        SizedBox(width: 8),
                        Text(
                          'Import Playlist',
                          style: TextStyle(
                            color: AppTheme.text,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppTheme.muted),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _tabBtn(
                        label: 'YouTube / Spotify URL',
                        active: tab == 0,
                        accent: accent,
                        onTap: () => setModal(() {
                          tab = 0;
                          statusText = null;
                        }),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _tabBtn(
                        label: 'CSV / Text List',
                        active: tab == 1,
                        accent: accent,
                        onTap: () => setModal(() {
                          tab = 1;
                          statusText = null;
                        }),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (tab == 0) ...[
                  const Text(
                    'Paste any public YouTube Music, YouTube, or Spotify playlist link to extract and match its tracks.',
                    style: TextStyle(color: AppTheme.muted, fontSize: 12.5),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: urlCtrl,
                    style: const TextStyle(color: AppTheme.text, fontSize: 13.5),
                    decoration: InputDecoration(
                      hintText: 'https://www.youtube.com/playlist?list=... or Spotify link',
                      hintStyle: const TextStyle(color: AppTheme.muted, fontSize: 12.5),
                      filled: true,
                      fillColor: AppTheme.bg3,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppTheme.glassBorder),
                      ),
                    ),
                  ),
                ] else ...[
                  const Text(
                    'Paste CSV tracks (Title, Artist) or track names one per line.',
                    style: TextStyle(color: AppTheme.muted, fontSize: 12.5),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: csvNameCtrl,
                    style: const TextStyle(color: AppTheme.text, fontSize: 13.5),
                    decoration: InputDecoration(
                      hintText: 'Playlist Name (e.g. My Imported Mix)',
                      hintStyle: const TextStyle(color: AppTheme.muted, fontSize: 12.5),
                      filled: true,
                      fillColor: AppTheme.bg3,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppTheme.glassBorder),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: csvInputCtrl,
                    maxLines: 5,
                    style: const TextStyle(color: AppTheme.text, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Blinding Lights, The Weeknd\nStarboy, The Weeknd\nAs It Was, Harry Styles',
                      hintStyle: const TextStyle(color: AppTheme.muted, fontSize: 12),
                      filled: true,
                      fillColor: AppTheme.bg3,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppTheme.glassBorder),
                      ),
                    ),
                  ),
                ],
                if (statusText != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    statusText!,
                    style: TextStyle(
                      color: isError ? Colors.redAccent : AppTheme.accentLight,
                      fontSize: 12.5,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: loading ? null : () => Navigator.pop(ctx),
                      child: const Text('Cancel', style: TextStyle(color: AppTheme.muted)),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                      ),
                      onPressed: loading
                          ? null
                          : () async {
                              final importer = PlaylistImporterService();
                              final lib = context.read<LibraryProvider>();
                              setModal(() {
                                loading = true;
                                isError = false;
                                statusText = tab == 0
                                    ? 'Resolving playlist tracks…'
                                    : 'Parsing and matching tracks…';
                              });
                              try {
                                if (tab == 0) {
                                  final res = await importer.importFromUrl(urlCtrl.text);
                                  final pl = await lib.createPlaylist(res.title);
                                  for (final t in res.tracks) {
                                    await lib.addTrackToPlaylist(pl.id, t);
                                  }
                                  if (ctx.mounted) Navigator.pop(ctx);
                                  onImported?.call(pl.id);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Imported ${res.tracks.length} tracks')),
                                    );
                                  }
                                } else {
                                  final rows = importer.parseCsvOrLines(csvInputCtrl.text);
                                  if (rows.isEmpty) {
                                    throw Exception('No valid track rows found.');
                                  }
                                  setModal(() {
                                    statusText = 'Matching ${rows.length} tracks on YouTube Music…';
                                  });
                                  final matched = await importer.matchRows(rows);
                                  if (matched.isEmpty) {
                                    throw Exception('Could not match any tracks.');
                                  }
                                  final name = csvNameCtrl.text.trim().isEmpty
                                      ? 'Imported CSV'
                                      : csvNameCtrl.text.trim();
                                  final pl = await lib.createPlaylist(name);
                                  for (final t in matched) {
                                    await lib.addTrackToPlaylist(pl.id, t);
                                  }
                                  if (ctx.mounted) Navigator.pop(ctx);
                                  onImported?.call(pl.id);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Imported ${matched.length} tracks')),
                                    );
                                  }
                                }
                              } catch (e) {
                                setModal(() {
                                  loading = false;
                                  isError = true;
                                  statusText = e.toString().replaceFirst('Exception: ', '');
                                });
                              }
                            },
                      child: loading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : Text(tab == 0 ? 'Resolve & Import' : 'Match & Create Playlist'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    ),
  );
}

Widget _tabBtn({
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
        color: active ? accent.withValues(alpha: 0.2) : AppTheme.bg3,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: active ? accent : AppTheme.glassBorder),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: active ? AppTheme.text : AppTheme.muted,
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );
}
