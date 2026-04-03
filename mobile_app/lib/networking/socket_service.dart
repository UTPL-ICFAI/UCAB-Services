/// Socket.IO client manager for real-time features:
/// - ride requests, captain location updates, notifications
library;

import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:ucab_mobile/core/constants.dart';

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;

  io.Socket? _socket;
  String? _authToken;

  SocketService._internal();

  /// Set the JWT token for authenticated socket connections
  void setToken(String? token) {
    _authToken = token;
  }

  io.Socket get socket {
    _socket ??= _createSocket();
    return _socket!;
  }

  io.Socket _createSocket() {
    final builder = io.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .disableAutoConnect()
        .enableReconnection()
        .setReconnectionDelay(2000)
        .setReconnectionAttempts(10);

    // Attach JWT token for server-side user identification
    if (_authToken != null) {
      builder.setAuth({'token': _authToken!});
      builder.setQuery({'token': _authToken!});
    }

    return io.io(ApiConstants.baseUrl, builder.build());
  }

  /// Connect with a fresh token (call after login)
  void connectWithToken(String token) {
    _authToken = token;
    // Dispose old socket and create new one with token
    _socket?.dispose();
    _socket = null;
    socket.connect();
  }

  void connect() {
    socket.connect();
  }

  void disconnect() {
    socket.disconnect();
  }

  void dispose() {
    socket.dispose();
    _socket = null;
  }
}
