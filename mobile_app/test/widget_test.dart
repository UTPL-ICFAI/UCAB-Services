// Basic Flutter widget test for UCAB Mobile App.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ucab_mobile/main.dart';

void main() {
  testWidgets('App launches and shows splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: UcabApp()));

    // Verify that the splash screen branding text is present
    expect(find.text('Uride '), findsOneWidget);
  });
}
