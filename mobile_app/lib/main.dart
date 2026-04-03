/// UCAB Mobile App — Entry Point
/// Configures Riverpod, dark theme, and named routes matching the web frontend.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/features/auth/splash_screen.dart';
import 'package:ucab_mobile/features/auth/landing_page.dart';
import 'package:ucab_mobile/features/auth/user_login_screen.dart';
import 'package:ucab_mobile/features/auth/captain_login_screen.dart';
import 'package:ucab_mobile/features/rider/user_page.dart';
import 'package:ucab_mobile/features/captain/captain_page.dart';
// New feature pages
import 'package:ucab_mobile/features/rider/ride_history_page.dart';
import 'package:ucab_mobile/features/rider/wallet_page.dart';
import 'package:ucab_mobile/features/rider/carpool_page.dart';
import 'package:ucab_mobile/features/rider/support_page.dart';
import 'package:ucab_mobile/features/rider/emergency_contacts_page.dart';
import 'package:ucab_mobile/features/rider/notifications_page.dart';
import 'package:ucab_mobile/features/captain/captain_history_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Force dark system UI
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Colors.black,
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  // Lock portrait orientation for mobile
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  runApp(const ProviderScope(child: UcabApp()));
}

class UcabApp extends StatelessWidget {
  const UcabApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Uride Services',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,

      // Start with splash screen
      initialRoute: '/',

      routes: {
        '/': (_) => const SplashScreen(),
        '/landing': (_) => const LandingPage(),
        '/login/user': (_) => const UserLoginScreen(),
        '/login/captain': (_) => const CaptainLoginScreen(),
        '/user': (_) => const UserPage(),
        '/captain': (_) => const CaptainPage(),
        // Rider features
        '/ride-history': (_) => const RideHistoryPage(),
        '/wallet': (_) => const WalletPage(),
        '/carpool': (_) => const CarpoolPage(),
        '/support': (_) => const SupportPage(),
        '/emergency-contacts': (_) => const EmergencyContactsPage(),
        '/notifications': (_) => const NotificationsPage(),
        // Captain features
        '/captain/history': (_) => const CaptainHistoryPage(),
      },
    );
  }
}
