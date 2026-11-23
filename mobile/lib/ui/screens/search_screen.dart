import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/search_provider.dart';
import '../theme.dart';
import '../widgets/track_tile.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final search = context.watch<SearchProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Container(
          height: 44,
          decoration: BoxDecoration(
            color: AppTheme.panel,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.line),
          ),
          child: TextField(
            controller: _controller,
            style: const TextStyle(color: AppTheme.text, fontSize: 14.5),
            onChanged: search.onQueryChanged,
            onSubmitted: search.executeSearch,
            decoration: InputDecoration(
              hintText: 'Search songs, albums, artists…',
              hintStyle: const TextStyle(color: AppTheme.muted),
              prefixIcon: const Icon(Icons.search, color: AppTheme.muted, size: 20),
              suffixIcon: _controller.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, color: AppTheme.muted, size: 18),
                      onPressed: () {
                        _controller.clear();
                        search.clear();
                      },
                    )
                  : null,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
            ),
          ),
        ),
      ),
      body: Stack(
        children: [
          // Main Body (Results or Empty State)
          if (search.isSearching)
            const Center(
              child: CircularProgressIndicator(color: AppTheme.accent),
            )
          else if (search.results.isNotEmpty)
            ListView.builder(
              padding: const EdgeInsets.only(top: 8, bottom: 90),
              itemCount: search.results.length,
              itemBuilder: (ctx, i) {
                final track = search.results[i];
                return TrackTile(
                  track: track,
                  queueContext: search.results,
                  indexInQueue: i,
                );
              },
            )
          else
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.search, size: 64, color: AppTheme.muted.withValues(alpha: 0.3)),
                  const SizedBox(height: 12),
                  const Text(
                    'Search over 100M+ songs on YouTube Music',
                    style: TextStyle(color: AppTheme.muted, fontSize: 14),
                  ),
                ],
              ),
            ),

          // Autocomplete Suggestions Overlay
          if (search.suggestions.isNotEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.line),
                boxShadow: const [
                  BoxShadow(color: Colors.black45, blurRadius: 16, offset: Offset(0, 4)),
                ],
              ),
              child: ListView.separated(
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                itemCount: search.suggestions.length,
                separatorBuilder: (_, _) => const Divider(height: 1, color: AppTheme.line),
                itemBuilder: (ctx, i) {
                  final sug = search.suggestions[i];
                  return ListTile(
                    dense: true,
                    leading: const Icon(Icons.history, color: AppTheme.muted, size: 18),
                    title: Text(sug, style: const TextStyle(color: AppTheme.text, fontSize: 14)),
                    onTap: () {
                      _controller.text = sug;
                      search.executeSearch(sug);
                    },
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
