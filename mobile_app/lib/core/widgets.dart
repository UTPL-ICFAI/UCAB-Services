/// Reusable UI widgets matching the React web frontend's design language.
///
/// Provides cards, inputs, buttons, badges, and other components
/// that mirror the CSS classes from App.css.
library;

import 'package:flutter/material.dart';
import 'package:ucab_mobile/core/theme.dart';

// ─── Primary Button (white bg, black text — matches .btn-primary / .book-btn) ─
class UcabPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;

  const UcabPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: AppColors.primary,
          disabledBackgroundColor: const Color(0xFF333333),
          disabledForegroundColor: const Color(0xFF666666),
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -0.3),
        ),
        child: isLoading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.textTertiary),
              )
            : Text(label),
      ),
    );
  }
}

// ─── Cancel / Outline Button (matches .cancel-btn) ─────────────────────
class UcabOutlineButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final Color color;

  const UcabOutlineButton({
    super.key,
    required this.label,
    this.onPressed,
    this.color = AppColors.danger,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: BorderSide(color: color),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
      ),
    );
  }
}

// ─── Dark Card (matches .login-card, .location-card, .status-card, etc.) ─
class UcabCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Color? borderColor;
  final Color? backgroundColor;
  final BorderRadius? borderRadius;

  const UcabCard({
    super.key,
    required this.child,
    this.padding,
    this.borderColor,
    this.backgroundColor,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.bgCard,
        border: Border.all(color: borderColor ?? AppColors.border),
        borderRadius: borderRadius ?? AppRadius.xlBr,
      ),
      child: child,
    );
  }
}

// ─── Text Input (matches .input-group input dark styling) ─────────────
class UcabTextField extends StatelessWidget {
  final String label;
  final String hint;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final bool obscureText;
  final Widget? suffixIcon;
  final ValueChanged<String>? onChanged;
  final bool enabled;

  const UcabTextField({
    super.key,
    required this.label,
    required this.hint,
    this.controller,
    this.keyboardType,
    this.obscureText = false,
    this.suffixIcon,
    this.onChanged,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscureText,
          onChanged: onChanged,
          enabled: enabled,
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 15),
          decoration: InputDecoration(
            hintText: hint,
            suffixIcon: suffixIcon,
          ),
        ),
      ],
    );
  }
}

// ─── Location Dot (green / red) ─────────────────────────────────────────
class LocationDot extends StatelessWidget {
  final bool isPickup;

  const LocationDot({super.key, required this.isPickup});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: isPickup ? AppColors.greenDot : AppColors.redDot,
        shape: BoxShape.circle,
      ),
    );
  }
}

// ─── Badge (matches .badge for counts) ────────────────────────────────
class UcabBadge extends StatelessWidget {
  final String text;
  final Color bg;
  final Color textColor;

  const UcabBadge({
    super.key,
    required this.text,
    this.bg = AppColors.danger,
    this.textColor = AppColors.textPrimary,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: textColor),
      ),
    );
  }
}

// ─── Status Pulse Dot (animated green dot — .status-pulse) ────────────
class StatusPulse extends StatefulWidget {
  final Color color;

  const StatusPulse({super.key, this.color = AppColors.secondary});

  @override
  State<StatusPulse> createState() => _StatusPulseState();
}

class _StatusPulseState extends State<StatusPulse> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))..repeat();
    _animation = Tween<double>(begin: 0, end: 10).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (_, child) {
        return Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: widget.color,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: widget.color.withValues(alpha: 0.6 * (1 - _animation.value / 10)),
                blurRadius: _animation.value,
                spreadRadius: _animation.value / 2,
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Sheet Handle (drag indicator at top of bottom sheet) ────────────
class SheetHandle extends StatelessWidget {
  const SheetHandle({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 40,
        height: 4,
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: const Color(0xFF333333),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}

// ─── Avatar Circle (matches .avatar green gradient) ──────────────────
class UcabAvatar extends StatelessWidget {
  final String initial;
  final double size;

  const UcabAvatar({super.key, required this.initial, this.size = 36});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: AppColors.greenGradient,
      ),
      alignment: Alignment.center,
      child: Text(
        initial.toUpperCase(),
        style: TextStyle(
          color: AppColors.textPrimary,
          fontSize: size * 0.44,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ─── Error Box (matches .login-error) ─────────────────────────────────
class ErrorBox extends StatelessWidget {
  final String message;

  const ErrorBox({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    if (message.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      margin: const EdgeInsets.only(bottom: 12, top: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF2A0A0A),
        border: Border.all(color: const Color(0xFFC0392B)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message,
        style: const TextStyle(color: AppColors.danger, fontSize: 13),
      ),
    );
  }
}
