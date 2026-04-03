/// User Login / Register Screen
/// Mirrors UserLoginPage.js — dark card with Login|Register toggle,
/// phone, name, email + OTP, password fields.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/core/widgets.dart';
import 'package:ucab_mobile/features/auth/auth_provider.dart';
import 'package:ucab_mobile/networking/socket_service.dart';

class UserLoginScreen extends ConsumerStatefulWidget {
  const UserLoginScreen({super.key});

  @override
  ConsumerState<UserLoginScreen> createState() => _UserLoginScreenState();
}

class _UserLoginScreenState extends ConsumerState<UserLoginScreen> {
  bool _isLogin = true;
  final _phoneCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  bool _showPassword = false;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  void _handleSubmit() {
    if (_phoneCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Phone number is required')),
      );
      return;
    }
    
    ref.read(authProvider.notifier).clearError();

    if (_isLogin) {
      ref.read(authProvider.notifier).userLogin(
        phone: _phoneCtrl.text,
        name: _nameCtrl.text,
        password: _passwordCtrl.text,
      );
    } else {
      if (_passwordCtrl.text.isNotEmpty && _passwordCtrl.text != _confirmPassCtrl.text) {
        // Show local error for password mismatch
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Passwords do not match')),
        );
        return;
      }
      ref.read(authProvider.notifier).userRegister(
        phone: _phoneCtrl.text,
        name: _nameCtrl.text,
        email: _emailCtrl.text,
        password: _passwordCtrl.text,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    // Navigate on successful auth
    ref.listen(authProvider, (prev, next) {
      if (next.isAuthenticated && next.user != null) {
        // Connect socket with auth token after login
        ref.read(authProvider.notifier).getToken().then((token) {
          if (token != null) {
            SocketService().connectWithToken(token);
          }
        });
        Navigator.pushReplacementNamed(context, '/user');
      }
    });

    return Scaffold(
      body: Container(
        color: AppColors.bgPrimary,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // ── Logo ──
                  const Text(
                    'uride services',
                    style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -2, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Your city ride, simplified 🚖',
                    style: TextStyle(fontSize: 15, color: AppColors.textSecondary),
                  ),

                  const SizedBox(height: 36),

                  // ── Card ──
                  UcabCard(
                    padding: const EdgeInsets.all(28),
                    borderRadius: AppRadius.xxlBr,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Rider badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.secondary.withValues(alpha: 0.15),
                            borderRadius: AppRadius.fullBr,
                          ),
                          child: const Text('🙋 Rider', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.secondary)),
                        ),

                        const SizedBox(height: 16),

                        // ── Login | Register toggle ──
                        Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.borderLight),
                          ),
                          child: Row(
                            children: [
                              _ModeTab(label: 'Login', isActive: _isLogin, onTap: () => setState(() { _isLogin = true; ref.read(authProvider.notifier).clearError(); })),
                              _ModeTab(label: 'Register', isActive: !_isLogin, onTap: () => setState(() { _isLogin = false; ref.read(authProvider.notifier).clearError(); })),
                            ],
                          ),
                        ),

                        const SizedBox(height: 20),

                        // Title
                        Text(
                          _isLogin ? 'Welcome back' : 'Create account',
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _isLogin ? 'Enter your phone to book a ride' : 'Sign up to start riding instantly',
                          style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
                        ),

                        const SizedBox(height: 24),

                        // ── Fields ──
                        if (!_isLogin) ...[
                          UcabTextField(label: '👤 Full Name *', hint: 'e.g. Arjun Sharma', controller: _nameCtrl),
                          const SizedBox(height: 16),
                        ],

                        UcabTextField(label: '📱 Phone Number *', hint: '+91 98765 43210', controller: _phoneCtrl, keyboardType: TextInputType.phone),
                        const SizedBox(height: 16),

                        if (_isLogin)
                          UcabTextField(label: '👤 Your Name (optional)', hint: 'e.g. Arjun Sharma', controller: _nameCtrl),

                        if (!_isLogin) ...[
                          UcabTextField(label: '📧 Email (optional)', hint: 'you@example.com', controller: _emailCtrl, keyboardType: TextInputType.emailAddress),
                          const SizedBox(height: 16),
                        ],

                        const SizedBox(height: 16),

                        // Password
                        UcabTextField(
                          label: '🔒 Password (optional)',
                          hint: _isLogin ? 'Leave blank if phone-only login' : 'Set a password (optional)',
                          controller: _passwordCtrl,
                          obscureText: !_showPassword,
                          suffixIcon: IconButton(
                            icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility, color: AppColors.textSecondary, size: 20),
                            onPressed: () => setState(() => _showPassword = !_showPassword),
                          ),
                        ),

                        if (!_isLogin) ...[
                          const SizedBox(height: 16),
                          UcabTextField(
                            label: '🔒 Confirm Password',
                            hint: 'Repeat your password',
                            controller: _confirmPassCtrl,
                            obscureText: !_showPassword,
                          ),
                        ],

                        const SizedBox(height: 8),

                        // Error
                        if (authState.error != null)
                          ErrorBox(message: authState.error!),

                        const SizedBox(height: 8),

                        // Submit
                        UcabPrimaryButton(
                          label: authState.isLoading
                              ? 'Please wait…'
                              : _isLogin
                                  ? "Let's Go 🚖"
                                  : 'Create Account 🎉',
                          isLoading: authState.isLoading,
                          onPressed: _handleSubmit,
                        ),

                        const SizedBox(height: 16),

                        // Switch link
                        Center(
                          child: GestureDetector(
                            onTap: () => Navigator.pushReplacementNamed(context, '/login/captain'),
                            child: RichText(
                              text: const TextSpan(
                                text: 'Are you a captain? ',
                                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                                children: [
                                  TextSpan(
                                    text: 'Login here →',
                                    style: TextStyle(color: AppColors.secondary, fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Mode Tab (Login / Register) ────────────────────────────────────
class _ModeTab extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _ModeTab({required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFF00C853) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: isActive ? Colors.white : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}
