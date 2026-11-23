import 'package:flutter_test/flutter_test.dart';
import 'package:mymusic_mobile/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MyMusicApp());
    expect(find.byType(MyMusicApp), findsOneWidget);
  });
}
