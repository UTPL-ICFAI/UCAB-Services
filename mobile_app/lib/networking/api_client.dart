/// Dio HTTP client configured for the UCAB backend.
/// Automatically attaches JWT token to every request.
library;

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ucab_mobile/core/constants.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  final _storage = const FlutterSecureStorage();

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    // Interceptor: attach JWT token to every request
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'ucab_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) {
        // TODO: Handle 401 (token expired) → redirect to login
        return handler.next(error);
      },
    ));
  }

  // ─── Auth helpers ────────────────────────────────────────────
  Future<void> saveToken(String token) async {
    await _storage.write(key: 'ucab_token', value: token);
  }

  Future<void> saveUser(String userJson) async {
    await _storage.write(key: 'ucab_user', value: userJson);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: 'ucab_token');
  }

  Future<String?> getUser() async {
    return await _storage.read(key: 'ucab_user');
  }

  Future<void> clearAuth() async {
    await _storage.deleteAll();
  }
}
