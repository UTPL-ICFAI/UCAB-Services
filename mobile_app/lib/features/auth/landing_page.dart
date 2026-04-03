/// Landing Page — Role Picker
/// Mirrors the React LandingPage.js with animated role cards.
library;

import 'package:flutter/material.dart';
import 'package:ucab_mobile/core/theme.dart';

class _RoleInfo {
  final String id;
  final String icon;
  final String title;
  final String subtitle;
  final LinearGradient gradient;
  final Color accent;
  final List<String> features;
  final String route;

  const _RoleInfo({
    required this.id,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.gradient,
    required this.accent,
    required this.features,
    required this.route,
  });
}

const _roles = [
  _RoleInfo(
    id: 'rider',
    icon: '🚗',
    title: "I'm a Rider",
    subtitle: 'Book rides, couriers & rentals',
    gradient: AppColors.riderCardGradient,
    accent: AppColors.info,
    features: ['Instant ride booking', 'Real-time tracking', 'Schedule in advance'],
    route: '/login/user',
  ),
  _RoleInfo(
    id: 'captain',
    icon: '🚕',
    title: "I'm a Captain",
    subtitle: 'Drive & earn on your schedule',
    gradient: AppColors.captainCardGradient,
    accent: AppColors.secondary,
    features: ['Accept ride requests', 'Real-time earnings', 'Trip history & stats'],
    route: '/login/captain',
  ),
];

class LandingPage extends StatefulWidget {
  const LandingPage({super.key});

  @override
  State<LandingPage> createState() => _LandingPageState();
}

class _LandingPageState extends State<LandingPage> with TickerProviderStateMixin {
  late List<AnimationController> _controllers;
  late List<Animation<Offset>> _slideAnimations;
  late List<Animation<double>> _fadeAnimations;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      _roles.length,
      (i) => AnimationController(vsync: this, duration: const Duration(milliseconds: 600)),
    );
    _slideAnimations = _controllers.map((c) {
      return Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero).animate(
        CurvedAnimation(parent: c, curve: Curves.easeOut),
      );
    }).toList();
    _fadeAnimations = _controllers.map((c) {
      return Tween<double>(begin: 0, end: 1).animate(
        CurvedAnimation(parent: c, curve: Curves.easeOut),
      );
    }).toList();

    // Stagger animations
    for (int i = 0; i < _controllers.length; i++) {
      Future.delayed(Duration(milliseconds: 100 + i * 150), () {
        if (mounted) _controllers[i].forward();
      });
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.xxl),
            child: Column(
              children: [
                // ── Header ──
                RichText(
                  textAlign: TextAlign.center,
                  text: const TextSpan(children: [
                    TextSpan(
                      text: 'Uride ',
                      style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: AppColors.textPrimary, letterSpacing: -1),
                    ),
                    TextSpan(
                      text: 'Services',
                      style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: AppColors.secondary, letterSpacing: -1),
                    ),
                  ]),
                ),
                const SizedBox(height: AppSpacing.sm),
                const Text(
                  'Your city, your way',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.secondary, letterSpacing: 0.5),
                ),
                const SizedBox(height: AppSpacing.xs),
                const Text(
                  'The complete mobility platform for riders and drivers',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.6),
                ),

                const SizedBox(height: AppSpacing.xxl),

                // ── Role Cards ──
                ..._roles.asMap().entries.map((entry) {
                  final i = entry.key;
                  final role = entry.value;
                  return SlideTransition(
                    position: _slideAnimations[i],
                    child: FadeTransition(
                      opacity: _fadeAnimations[i],
                      child: _RoleCard(role: role),
                    ),
                  );
                }),

                const SizedBox(height: AppSpacing.xxl),

                // ── Footer ──
                const Text(
                  '🔒 Secure · 📡 Real-time · ⚡ Reliable',
                  style: TextStyle(fontSize: 12, color: AppColors.textTertiary, letterSpacing: 0.5),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Role Card Widget ──────────────────────────────────────────────
class _RoleCard extends StatelessWidget {
  final _RoleInfo role;

  const _RoleCard({required this.role});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, role.route),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: AppSpacing.md),
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          gradient: role.gradient,
          border: Border.all(color: role.accent.withValues(alpha: 0.25)),
          borderRadius: AppRadius.xlBr,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon
            Text(role.icon, style: const TextStyle(fontSize: 48)),
            const SizedBox(height: AppSpacing.sm),

            // Tag
            Text(
              role.id.toUpperCase(),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
                color: role.accent.withValues(alpha: 0.8),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),

            // Title
            Text(role.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white)),
            const SizedBox(height: 4),

            // Subtitle
            Text(role.subtitle, style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: 0.7), height: 1.5)),

            const SizedBox(height: AppSpacing.md),

            // Features
            ...role.features.map((f) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Text('✓', style: TextStyle(color: role.accent, fontSize: 14, fontWeight: FontWeight.w700)),
                  const SizedBox(width: 8),
                  Text(f, style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.7))),
                ],
              ),
            )),

            const SizedBox(height: AppSpacing.lg),

            // CTA
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pushNamed(context, role.route),
                style: ElevatedButton.styleFrom(
                  backgroundColor: role.accent,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: AppRadius.lgBr),
                  textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, letterSpacing: 0.5),
                ),
                child: const Text('Get Started →'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
