import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/track.dart';
import '../../providers/search_provider.dart';
import '../theme.dart';
import '../widgets/track_tile.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _ctrl = TextEditingController();
  int _activeFilter = 0; // 0: All, 1: Songs, 2: Videos, 3: Albums, 4: Artists
  final List<String> _filters = const ['All', 'Songs', 'Videos', 'Albums', 'Artists'];

  final List<String> _recentSearches = [
    'Luna Bay',
    'After hours',
    'Lo-fi beats',
  ];

  final List<Map<String, dynamic>> _moods = [
    {
      'title': 'Trending Hits',
      'color': const Color(0xFF6366F1),
      'icon': Icons.local_fire_department_rounded,
      'query': 'top hits 2026 songs',
    },
    {
      'title': 'Late night',
      'color': const Color(0xFF3B1D54),
      'icon': Icons.nightlight_round,
      'query': 'late night music vibes',
    },
    {
      'title': 'Deep Focus',
      'color': const Color(0xFF0F766E),
      'icon': Icons.headphones_rounded,
      'query': 'deep focus study instrumental',
    },
    {
      'title': 'Workout EDM',
      'color': const Color(0xFFBE123C),
      'icon': Icons.bolt_rounded,
      'query': 'workout motivation edm beats',
    },
    {
      'title': 'Chill Acoustic',
      'color': const Color(0xFFB45309),
      'icon': Icons.wb_sunny_rounded,
      'query': 'indie acoustic songs',
    },
    {
      'title': 'Electronic',
      'color': const Color(0xFF281C50),
      'icon': Icons.graphic_eq_rounded,
      'query': 'electronic synthwave beats',
    },
    {
      'title': 'Pop Pulse',
      'color': const Color(0xFF831843),
      'icon': Icons.auto_awesome,
      'query': 'pop viral hits',
    },
    {
      'title': 'Rock Classics',
      'color': const Color(0xFF1E293B),
      'icon': Icons.album_rounded,
      'query': 'rock classics',
    },
  ];

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  List<Track> _filteredResults(List<Track> list) {
    if (_activeFilter == 1) {
      // Songs
      return list;
    } else if (_activeFilter == 2) {
      // Videos
      return list.where((t) => t.id.startsWith('yt:') || !t.id.startsWith('saavn:')).toList();
    } else if (_activeFilter == 3) {
      // Albums
      return list.where((t) => t.album != null && t.album!.isNotEmpty).toList();
    } else if (_activeFilter == 4) {
      // Artists
      return list;
    }
    return list; // All
  }

  void _triggerSearch(String query) {
    if (query.trim().isEmpty) return;
    _ctrl.text = query;
    context.read<SearchProvider>().search(query);
    if (!_recentSearches.contains(query)) {
      setState(() {
        _recentSearches.insert(0, query);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final search = context.watch<SearchProvider>();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Find your next favorite.',
                    style: TextStyle(
                      color: AppTheme.subtitle,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'Search',
                    style: TextStyle(
                      color: AppTheme.text,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Search input bar
                  Container(
                    height: 50,
                    decoration: BoxDecoration(
                      color: AppTheme.panel,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.line),
                    ),
                    child: TextField(
                      controller: _ctrl,
                      style: const TextStyle(color: AppTheme.text, fontSize: 15),
                      cursorColor: AppTheme.accent,
                      decoration: InputDecoration(
                        hintText: 'Search songs, artists, albums...',
                        hintStyle: const TextStyle(color: AppTheme.muted, fontSize: 14),
                        prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.muted, size: 22),
                        suffixIcon: _ctrl.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.close_rounded, color: AppTheme.muted, size: 20),
                                onPressed: () {
                                  _ctrl.clear();
                                  search.clear();
                                  setState(() {});
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onChanged: (val) {
                        setState(() {});
                        search.onQueryChanged(val);
                      },
                      onSubmitted: (val) => _triggerSearch(val),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Filter Pills
                  SizedBox(
                    height: 36,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: _filters.length,
                      itemBuilder: (ctx, i) {
                        final isSel = _activeFilter == i;
                        return GestureDetector(
                          onTap: () => setState(() => _activeFilter = i),
                          child: Container(
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSel ? AppTheme.accent : AppTheme.panel,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isSel ? AppTheme.accent : AppTheme.line,
                              ),
                            ),
                            child: Text(
                              _filters[i],
                              style: TextStyle(
                                color: isSel ? Colors.white : AppTheme.muted,
                                fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // Content Area
            Expanded(
              child: _ctrl.text.isEmpty
                  ? _buildBrowseView()
                  : (search.isLoading
                      ? const Center(
                          child: CircularProgressIndicator(color: AppTheme.accent),
                        )
                      : (search.results.isNotEmpty
                          ? Builder(
                              builder: (ctx) {
                                final filtered = _filteredResults(search.results);
                                if (filtered.isEmpty) {
                                  return const Center(
                                    child: Text('No results in this category', style: TextStyle(color: AppTheme.muted)),
                                  );
                                }
                                return ListView.builder(
                                  padding: const EdgeInsets.only(bottom: 110),
                                  itemCount: filtered.length,
                                  itemBuilder: (ctx, i) {
                                    final t = filtered[i];
                                    return TrackTile(track: t, queueContext: filtered);
                                  },
                                );
                              },
                            )
                          : _buildSuggestionsView(search))),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuggestionsView(SearchProvider search) {
    if (search.suggestions.isEmpty) {
      return const Center(
        child: Text('No results found', style: TextStyle(color: AppTheme.muted)),
      );
    }
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.line),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        itemCount: search.suggestions.length,
        separatorBuilder: (_, __) => const Divider(color: AppTheme.line, height: 1),
        itemBuilder: (ctx, i) {
          final sug = search.suggestions[i];
          return ListTile(
            leading: const Icon(Icons.search_rounded, color: AppTheme.muted, size: 20),
            title: Text(sug, style: const TextStyle(color: AppTheme.text, fontSize: 14)),
            trailing: const Icon(Icons.north_west_rounded, color: AppTheme.muted, size: 16),
            onTap: () => _triggerSearch(sug),
          );
        },
      ),
    );
  }

  Widget _buildBrowseView() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 110),
      children: [
        // Browse your mood
        const Text(
          'Browse your mood',
          style: TextStyle(
            color: AppTheme.text,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.8,
          ),
          itemCount: _moods.length,
          itemBuilder: (ctx, i) {
            final m = _moods[i];
            return InkWell(
              onTap: () => _triggerSearch(m['query']),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: m['color'],
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.line),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      (m['color'] as Color).withValues(alpha: 0.9),
                      (m['color'] as Color),
                    ],
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      m['title'],
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Icon(m['icon'], color: Colors.white70, size: 26),
                  ],
                ),
              ),
            );
          },
        ),

        const SizedBox(height: 24),

        // Recent searches
        if (_recentSearches.isNotEmpty) ...[
          const Text(
            'Recent searches',
            style: TextStyle(
              color: AppTheme.text,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          ..._recentSearches.map((query) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    const Icon(Icons.access_time_rounded, color: AppTheme.muted, size: 18),
                    const SizedBox(width: 12),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _triggerSearch(query),
                        child: Text(
                          query,
                          style: const TextStyle(color: AppTheme.text, fontSize: 14),
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppTheme.muted, size: 18),
                      onPressed: () {
                        setState(() {
                          _recentSearches.remove(query);
                        });
                      },
                    ),
                  ],
                ),
              )),
        ],
      ],
    );
  }
}
