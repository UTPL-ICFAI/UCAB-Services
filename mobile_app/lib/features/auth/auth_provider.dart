/// Authentication state provider using Riverpod.
/// Manages login/register, JWT storage, and current user.
library;

import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ucab_mobile/core/constants.dart';
import 'package:ucab_mobile/networking/api_client.dart';

// ─── User Model ───────────────────────────────────────────────────
class AppUser {
  final String id;          // UUID string from PostgreSQL
  final String name;
  final String phone;
  final String? email;
  final String role;        // "user" | "captain"
  final String? vehicleType;
  final String? vehiclePlate;
  final double rating;

  AppUser({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    required this.role,
    this.vehicleType,
    this.vehiclePlate,
    this.rating = 5.0,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    // Backend returns _id (Mongoose-compat API) — handle both _id and id
    final rawId = json['_id'] ?? json['id'] ?? '';
    return AppUser(
      id: rawId.toString(),
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      email: json['email'],
      role: json['role'] ?? 'user',
      vehicleType: json['vehicle_type'] ?? json['vehicleType'] ??
          (json['vehicle'] is Map ? json['vehicle']['type'] : null),
      vehiclePlate: json['vehicle_plate'] ?? json['vehiclePlate'] ??
          (json['vehicle'] is Map ? json['vehicle']['plate'] : null),
      rating: _parseDouble(json['rating'], 5.0),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'phone': phone,
    'email': email,
    'role': role,
    'vehicle_type': vehicleType,
    'vehicle_plate': vehiclePlate,
    'rating': rating,
  };

  static double _parseDouble(dynamic v, double fallback) {
    if (v == null) return fallback;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    return double.tryParse(v.toString()) ?? fallback;
  }
}

// ─── Auth State ───────────────────────────────────────────────────
class AuthState {
  final AppUser? user;
  final bool isLoading;
  final String? error;
  final bool isAuthenticated;

  const AuthState({
    this.user,
    this.isLoading = false,
    this.error,
    this.isAuthenticated = false,
  });

  AuthState copyWith({
    AppUser? user,
    bool? isLoading,
    String? error,
    bool? isAuthenticated,
  }) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    );
  }
}

// ─── Auth Notifier ────────────────────────────────────────────────
class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _api = ApiClient();

  AuthNotifier() : super(const AuthState());

  /// Try to restore session from secure storage
  Future<void> tryAutoLogin() async {
    final token = await _api.getToken();
    final userJson = await _api.getUser();

    if (token != null && userJson != null) {
      try {
        final userData = jsonDecode(userJson);
        state = AuthState(
          user: AppUser.fromJson(userData),
          isAuthenticated: true,
        );
      } catch (_) {
        await _api.clearAuth();
      }
    }
  }

  /// Get the current JWT token (for socket auth etc.)
  Future<String?> getToken() => _api.getToken();

  /// User login
  Future<void> userLogin({required String phone, String? name, String? password}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.dio.post(ApiConstants.userLogin, data: {
        'phone': phone.trim(),
        if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
        if (password != null && password.trim().isNotEmpty) 'password': password.trim(),
      });
      final data = response.data;
      await _api.saveToken(data['token']);
      await _api.saveUser(jsonEncode(data['user']));
      state = AuthState(
        user: AppUser.fromJson(data['user']),
        isAuthenticated: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _extractError(e),
      );
    }
  }

  /// User register
  Future<void> userRegister({
    required String phone,
    required String name,
    String? email,
    String? password,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.dio.post(ApiConstants.userRegister, data: {
        'phone': phone.trim(),
        'name': name.trim(),
        if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
        if (password != null && password.trim().isNotEmpty) 'password': password.trim(),
      });
      final data = response.data;
      await _api.saveToken(data['token']);
      await _api.saveUser(jsonEncode(data['user']));
      state = AuthState(
        user: AppUser.fromJson(data['user']),
        isAuthenticated: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _extractError(e),
      );
    }
  }

  /// Captain login — backend requires phone + password
  Future<void> captainLogin({required String phone, required String password}) async {
    if (password.trim().isEmpty) {
      state = state.copyWith(error: 'Password is required for captain login');
      return;
    }
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.dio.post(ApiConstants.captainLogin, data: {
        'phone': phone.trim(),
        'password': password.trim(),
      });
      final data = response.data;
      final captainData = data['captain'] as Map<String, dynamic>;
      // Ensure role is set to captain
      captainData['role'] = 'captain';
      await _api.saveToken(data['token']);
      await _api.saveUser(jsonEncode(captainData));
      state = AuthState(
        user: AppUser.fromJson(captainData),
        isAuthenticated: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _extractError(e),
      );
    }
  }

  /// Captain register — sends nested vehicle object + document fields
  Future<void> captainRegister({
    required String phone,
    required String name,
    required String password,
    required String vehicleType,
    required String vehiclePlate,
    required String vehicleColor,
    String? vehicleModel,
    String? insuranceCert,
    String? driverLicense,
    String? driverAadhaar,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.dio.post(ApiConstants.captainRegister, data: {
        'phone': phone.trim(),
        'name': name.trim(),
        'password': password.trim(),
        'vehicle': {
          'type': vehicleType,
          'plate': vehiclePlate.trim(),
          'color': vehicleColor.trim(),
          'model': vehicleModel?.trim() ?? '',
        },
        'insuranceCert': insuranceCert ?? 'pending',
        'driverLicense': driverLicense ?? 'pending',
        'driverAadhaar': driverAadhaar ?? 'pending',
      });
      final data = response.data;
      final captainData = data['captain'] as Map<String, dynamic>;
      captainData['role'] = 'captain';
      await _api.saveToken(data['token']);
      await _api.saveUser(jsonEncode(captainData));
      state = AuthState(
        user: AppUser.fromJson(captainData),
        isAuthenticated: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _extractError(e),
      );
    }
  }

  /// Logout
  Future<void> logout() async {
    await _api.clearAuth();
    state = const AuthState();
  }

  /// Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }

  String _extractError(dynamic e) {
    if (e is DioException) {
      // Try to get specific message from backend response
      final msg = e.response?.data?['message'];
      if (msg != null) return msg.toString();
      // Network-level errors
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return 'Server is slow — please try again';
      }
      if (e.type == DioExceptionType.connectionError) {
        return 'Cannot reach server — check your internet';
      }
      return 'Connection failed — check your network';
    }
    return 'Something went wrong';
  }
}

// ─── Provider ─────────────────────────────────────────────────────
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
