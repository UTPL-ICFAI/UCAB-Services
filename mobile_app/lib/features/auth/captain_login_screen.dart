/// Captain Login / Register Screen
/// Mirrors CaptainLoginPage.js — dark card with Login|Register toggle,
/// vehicle type grid, plate number, document uploads, etc.
library;

import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/core/widgets.dart';
import 'package:ucab_mobile/features/auth/auth_provider.dart';
import 'package:ucab_mobile/networking/socket_service.dart';

class _VehicleOption {
  final String icon;
  final String label;
  final String type;
  final String desc;

  const _VehicleOption({required this.icon, required this.label, required this.type, required this.desc});
}

const _vehicleOptions = [
  _VehicleOption(icon: '🚗', label: 'Car', type: 'car', desc: 'Sedan / Hatchback'),
  _VehicleOption(icon: '🏎️', label: 'Premier', type: 'premier', desc: 'Premium sedan'),
  _VehicleOption(icon: '🛺', label: 'Auto', type: 'auto', desc: 'Auto rickshaw'),
  _VehicleOption(icon: '🏍️', label: 'Bike', type: 'bike', desc: 'Motorcycle taxi'),
];

class CaptainLoginScreen extends ConsumerStatefulWidget {
  const CaptainLoginScreen({super.key});

  @override
  ConsumerState<CaptainLoginScreen> createState() => _CaptainLoginScreenState();
}

class _CaptainLoginScreenState extends ConsumerState<CaptainLoginScreen> {
  bool _isLogin = true;
  final _phoneCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _plateCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  final _colorCtrl = TextEditingController();
  bool _showPassword = false;
  String _selectedVehicle = 'car';

  // Document images (base64 encoded)
  String? _insuranceCert;
  String? _driverLicense;
  String? _driverAadhaar;
  // File references for preview
  File? _insuranceFile;
  File? _licenseFile;
  File? _aadhaarFile;

  final _picker = ImagePicker();

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _nameCtrl.dispose();
    _passwordCtrl.dispose();
    _plateCtrl.dispose();
    _modelCtrl.dispose();
    _colorCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage(String docType) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.bgSecondary,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Choose Source', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _sourceButton(Icons.camera_alt, 'Camera', () => Navigator.pop(context, ImageSource.camera)),
                _sourceButton(Icons.photo_library, 'Gallery', () => Navigator.pop(context, ImageSource.gallery)),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );

    if (source == null) return;

    final picked = await _picker.pickImage(source: source, maxWidth: 800, imageQuality: 70);
    if (picked == null) return;

    final file = File(picked.path);
    final bytes = await file.readAsBytes();
    final b64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';

    setState(() {
      switch (docType) {
        case 'insurance':
          _insuranceCert = b64;
          _insuranceFile = file;
          break;
        case 'license':
          _driverLicense = b64;
          _licenseFile = file;
          break;
        case 'aadhaar':
          _driverAadhaar = b64;
          _aadhaarFile = file;
          break;
      }
    });
  }

  Widget _sourceButton(IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 64, height: 64,
            decoration: BoxDecoration(
              color: AppColors.bgInput,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.borderLight),
            ),
            child: Icon(icon, color: AppColors.secondary, size: 28),
          ),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        ],
      ),
    );
  }

  void _handleSubmit() {
    if (_phoneCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Phone number is required')),
      );
      return;
    }

    if (_passwordCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password is required')),
      );
      return;
    }

    ref.read(authProvider.notifier).clearError();

    if (_isLogin) {
      ref.read(authProvider.notifier).captainLogin(
        phone: _phoneCtrl.text,
        password: _passwordCtrl.text,
      );
    } else {
      if (_nameCtrl.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Name is required')),
        );
        return;
      }
      if (_plateCtrl.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vehicle plate number is required')),
        );
        return;
      }
      if (_colorCtrl.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vehicle color is required')),
        );
        return;
      }
      if (_insuranceCert == null || _driverLicense == null || _driverAadhaar == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please upload all required documents')),
        );
        return;
      }

      ref.read(authProvider.notifier).captainRegister(
        phone: _phoneCtrl.text,
        name: _nameCtrl.text,
        password: _passwordCtrl.text,
        vehicleType: _selectedVehicle,
        vehiclePlate: _plateCtrl.text,
        vehicleColor: _colorCtrl.text,
        vehicleModel: _modelCtrl.text,
        insuranceCert: _insuranceCert,
        driverLicense: _driverLicense,
        driverAadhaar: _driverAadhaar,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    ref.listen(authProvider, (prev, next) {
      if (next.isAuthenticated && next.user != null) {
        // Connect socket with auth token after login
        ref.read(authProvider.notifier).getToken().then((token) {
          if (token != null) {
            SocketService().connectWithToken(token);
          }
        });
        Navigator.pushReplacementNamed(context, '/captain');
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
                  const Text(
                    'uride services',
                    style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -2, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Captain Portal 🚕',
                    style: TextStyle(fontSize: 15, color: AppColors.textSecondary),
                  ),

                  const SizedBox(height: 36),

                  UcabCard(
                    padding: const EdgeInsets.all(28),
                    borderRadius: AppRadius.xxlBr,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Captain badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.warning.withValues(alpha: 0.15),
                            borderRadius: AppRadius.fullBr,
                          ),
                          child: const Text('🚕 Captain', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.warning)),
                        ),

                        const SizedBox(height: 16),

                        // Toggle
                        Container(
                          decoration: BoxDecoration(
                            color: AppColors.bgInput,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          padding: const EdgeInsets.all(4),
                          child: Row(
                            children: [
                              _ModeChip(label: 'Login', isActive: _isLogin, onTap: () => setState(() { _isLogin = true; ref.read(authProvider.notifier).clearError(); })),
                              _ModeChip(label: 'Register', isActive: !_isLogin, onTap: () => setState(() { _isLogin = false; ref.read(authProvider.notifier).clearError(); })),
                            ],
                          ),
                        ),

                        const SizedBox(height: 20),

                        Text(
                          _isLogin ? 'Welcome back, Captain' : 'Join the fleet',
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _isLogin ? 'Sign in to start earning' : 'Register your vehicle and start driving',
                          style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
                        ),

                        const SizedBox(height: 24),

                        // ── Fields ──
                        if (!_isLogin) ...[
                          UcabTextField(label: '👤 Full Name *', hint: 'e.g. Rajesh Kumar', controller: _nameCtrl),
                          const SizedBox(height: 16),
                        ],

                        UcabTextField(label: '📱 Phone Number *', hint: '+91 98765 43210', controller: _phoneCtrl, keyboardType: TextInputType.phone),
                        const SizedBox(height: 16),

                        UcabTextField(
                          label: '🔒 Password *',
                          hint: _isLogin ? 'Enter password' : 'Set a password',
                          controller: _passwordCtrl,
                          obscureText: !_showPassword,
                          suffixIcon: IconButton(
                            icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility, color: AppColors.textSecondary, size: 20),
                            onPressed: () => setState(() => _showPassword = !_showPassword),
                          ),
                        ),

                        // ── Register-only fields ──
                        if (!_isLogin) ...[
                          const SizedBox(height: 20),

                          // Vehicle type grid
                          const Text(
                            'VEHICLE TYPE',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 8),
                          GridView.count(
                            crossAxisCount: 2,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                            childAspectRatio: 1.6,
                            children: _vehicleOptions.map((v) {
                              final isSelected = _selectedVehicle == v.type;
                              return GestureDetector(
                                onTap: () => setState(() => _selectedVehicle = v.type),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: isSelected ? const Color(0xFF1F1F1F) : AppColors.bgInput,
                                    border: Border.all(color: isSelected ? AppColors.borderActive : AppColors.borderLight, width: 2),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(v.icon, style: const TextStyle(fontSize: 26)),
                                      const SizedBox(height: 4),
                                      Text(v.label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                                      Text(v.desc, style: const TextStyle(fontSize: 11, color: AppColors.textDisabled)),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          ),

                          const SizedBox(height: 16),

                          // Vehicle details
                          Row(
                            children: [
                              Expanded(child: UcabTextField(label: '🚗 Model', hint: 'e.g. Swift', controller: _modelCtrl)),
                              const SizedBox(width: 12),
                              Expanded(child: UcabTextField(label: '🔢 Plate *', hint: 'KA-01-1234', controller: _plateCtrl)),
                            ],
                          ),
                          const SizedBox(height: 16),
                          UcabTextField(label: '🎨 Vehicle Color *', hint: 'e.g. White, Silver, Black', controller: _colorCtrl),

                          const SizedBox(height: 20),

                          // ── Document Uploads ──
                          const Text(
                            'REQUIRED DOCUMENTS',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 12),
                          _docUploadTile(
                            icon: Icons.shield,
                            label: 'Insurance Certificate *',
                            file: _insuranceFile,
                            onTap: () => _pickImage('insurance'),
                          ),
                          const SizedBox(height: 10),
                          _docUploadTile(
                            icon: Icons.badge,
                            label: 'Driver License *',
                            file: _licenseFile,
                            onTap: () => _pickImage('license'),
                          ),
                          const SizedBox(height: 10),
                          _docUploadTile(
                            icon: Icons.credit_card,
                            label: 'Aadhaar Card *',
                            file: _aadhaarFile,
                            onTap: () => _pickImage('aadhaar'),
                          ),
                        ],

                        const SizedBox(height: 8),

                        if (authState.error != null)
                          ErrorBox(message: authState.error!),

                        const SizedBox(height: 8),

                        UcabPrimaryButton(
                          label: authState.isLoading
                              ? 'Please wait…'
                              : _isLogin
                                  ? "Let's Drive 🚕"
                                  : 'Register Captain 🎉',
                          isLoading: authState.isLoading,
                          onPressed: _handleSubmit,
                        ),

                        const SizedBox(height: 16),

                        Center(
                          child: GestureDetector(
                            onTap: () => Navigator.pushReplacementNamed(context, '/login/user'),
                            child: RichText(
                              text: const TextSpan(
                                text: 'Are you a rider? ',
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

  /// Document upload tile with preview
  Widget _docUploadTile({required IconData icon, required String label, File? file, required VoidCallback onTap}) {
    final isUploaded = file != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isUploaded ? const Color(0xFF0D2818) : AppColors.bgInput,
          border: Border.all(color: isUploaded ? AppColors.secondary : AppColors.borderLight),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, color: isUploaded ? AppColors.secondary : AppColors.textSecondary, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isUploaded ? AppColors.secondary : AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text(
                    isUploaded ? '✅ Uploaded' : 'Tap to capture or select',
                    style: TextStyle(fontSize: 12, color: isUploaded ? AppColors.secondary.withValues(alpha: 0.7) : AppColors.textTertiary),
                  ),
                ],
              ),
            ),
            if (isUploaded)
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.file(file, width: 40, height: 40, fit: BoxFit.cover),
              )
            else
              const Icon(Icons.camera_alt_outlined, color: AppColors.textTertiary, size: 20),
          ],
        ),
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _ModeChip({required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isActive ? AppColors.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isActive ? AppColors.primary : AppColors.textDisabled,
            ),
          ),
        ),
      ),
    );
  }
}
