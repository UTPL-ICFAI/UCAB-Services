/// Captain Dashboard — Full Uber-Driver-style layout
/// Online/Offline toggle, incoming ride requests, accept/reject,
/// OTP verification, earnings stats, chat, and account drawer.
library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/core/widgets.dart';
import 'package:ucab_mobile/features/auth/auth_provider.dart';
import 'package:ucab_mobile/networking/socket_service.dart';
import 'package:ucab_mobile/networking/api_client.dart';

class CaptainPage extends ConsumerStatefulWidget {
  const CaptainPage({super.key});
  @override
  ConsumerState<CaptainPage> createState() => _CaptainPageState();
}

class _CaptainPageState extends ConsumerState<CaptainPage> {
  final MapController _mapController = MapController();
  bool _isOnline = false;
  List<Map<String, dynamic>> _rides = [];
  Map<String, dynamic>? _acceptedRide;
  double _earnings = 0;
  int _totalRides = 0;
  double _rating = 5.0;
  String _toast = '';
  Timer? _toastTimer;
  Timer? _locationTimer;
  Timer? _idleLocationTimer;

  // OTP verification
  final _otpCtrl = TextEditingController();
  bool _otpVerified = false;

  // Chat
  final List<Map<String, dynamic>> _chatMessages = [];

  LatLng _currentPos = const LatLng(20.5937, 78.9629);

  @override
  void initState() {
    super.initState();
    _detectGPS();
    _initSocketWithAuth();
  }

  Future<void> _initSocketWithAuth() async {
    final token = await ApiClient().getToken();
    if (token != null) {
      SocketService().connectWithToken(token);
    } else {
      SocketService().connect();
    }
    _connectSocket();
  }

  @override
  void dispose() {
    _toastTimer?.cancel();
    _locationTimer?.cancel();
    _idleLocationTimer?.cancel();
    _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _detectGPS() async {
    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      if (mounted) {
        setState(() => _currentPos = LatLng(pos.latitude, pos.longitude));
        _mapController.move(_currentPos, 14);
      }
    } catch (_) {}
  }

  void _connectSocket() {
    final socket = SocketService().socket;

    // Captain profile from server (restores earnings/stats)
    socket.on('captain profile', (data) {
      final d = Map<String, dynamic>.from(data as Map);
      if (mounted) {
        setState(() {
          _earnings = _parseD(d['earnings'], _earnings);
          _totalRides = d['totalRides'] ?? _totalRides;
          _rating = _parseD(d['rating'], _rating);
        });
      }
    });

    // New ride broadcast
    socket.on('new ride', (ride) {
      if (!_isOnline || !mounted) return;
      final rideMap = Map<String, dynamic>.from(ride as Map);
      setState(() {
        if (!_rides.any((r) => r['rideId'] == rideMap['rideId'])) {
          _rides = [rideMap, ..._rides];
        }
      });
      _showToast('🔔 New ride request nearby!');
    });

    // Ride accepted by someone else — remove from list
    socket.on('ride accepted', (data) {
      final d = Map<String, dynamic>.from(data as Map);
      if (mounted) {
        setState(() => _rides = _rides.where((r) => r['rideId'] != d['rideId']).toList());
      }
    });

    socket.on('ride already taken', (_) {
      if (mounted) {
        setState(() => _acceptedRide = null);
        _showToast('⚠️ Ride already accepted by another captain');
      }
    });

    socket.on('ride completed', (_) {
      if (mounted) {
        setState(() => _acceptedRide = null);
        _showToast('🏁 Ride completed!');
      }
    });

    // OTP verification result
    socket.on('otp result', (data) {
      final d = Map<String, dynamic>.from(data as Map);
      if (d['valid'] == true) {
        setState(() => _otpVerified = true);
        _showToast('✅ OTP verified! Ride has started.');
      } else {
        _showToast('❌ ${d['reason'] ?? 'Invalid OTP'}');
      }
    });

    // Stats updated
    socket.on('stats updated', (data) {
      final d = Map<String, dynamic>.from(data as Map);
      if (mounted) {
        setState(() {
          _earnings = _parseD(d['earnings'], _earnings);
          _totalRides = d['totalRides'] ?? _totalRides;
        });
      }
    });

    // Chat from rider
    socket.on('user:message', (data) {
      final d = Map<String, dynamic>.from(data as Map);
      if (mounted) {
        setState(() => _chatMessages.add({
          'from': 'rider',
          'message': d['message'],
          'ts': DateTime.now().millisecondsSinceEpoch,
        }));
        _showToast('💬 Rider: ${d['message']}');
      }
    });

    // Wallet events
    socket.on('wallet:updated', (data) {
      if (mounted) _showToast('💳 Wallet updated');
    });
  }

  void _toggleOnline() async {
    final socket = SocketService().socket;
    setState(() => _isOnline = !_isOnline);
    if (_isOnline) {
      final token = await ApiClient().getToken();
      socket.emit('captain online', {'token': token ?? ''});
      _showToast('You are now online 🟢');
      _startIdleLocationBroadcast();
    } else {
      socket.emit('captain offline', {});
      _idleLocationTimer?.cancel();
      _showToast('You are now offline ⚫');
    }
  }

  void _startIdleLocationBroadcast() {
    _idleLocationTimer?.cancel();
    _idleLocationTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      if (!_isOnline || _acceptedRide != null) return;
      try {
        final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
        SocketService().socket.emit('captain:idle_location', {'lat': pos.latitude, 'lng': pos.longitude});
        if (mounted) setState(() => _currentPos = LatLng(pos.latitude, pos.longitude));
      } catch (_) {}
    });
  }

  void _acceptRide(Map<String, dynamic> ride) {
    final user = ref.read(authProvider).user;
    SocketService().socket.emit('accept ride', {
      'rideId': ride['rideId'],
      'captainId': user?.id ?? '',
      'captainName': user?.name ?? 'Captain',
    });
    setState(() {
      _acceptedRide = ride;
      _rides = _rides.where((r) => r['rideId'] != ride['rideId']).toList();
      _otpVerified = false;
      _otpCtrl.clear();
      _chatMessages.clear();
    });
    _showToast('✅ Ride accepted! Head to pickup.');
    _startLocationBroadcast(ride['rideId']);
  }

  void _startLocationBroadcast(dynamic rideId) {
    _locationTimer?.cancel();
    _locationTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      try {
        final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
        SocketService().socket.emit('captain:location', {'rideId': rideId, 'lat': pos.latitude, 'lng': pos.longitude});
        if (mounted) setState(() => _currentPos = LatLng(pos.latitude, pos.longitude));
      } catch (_) {}
    });
  }

  void _arrivedAtPickup() {
    if (_acceptedRide == null) return;
    SocketService().socket.emit('captain:arrived', {'rideId': _acceptedRide!['rideId']});
    _showToast('📍 Rider notified of your arrival');
  }

  void _verifyOtp() {
    if (_acceptedRide == null || _otpCtrl.text.trim().isEmpty) return;
    SocketService().socket.emit('verify otp', {
      'rideId': _acceptedRide!['rideId'],
      'otp': _otpCtrl.text.trim(),
    });
  }

  void _completeRide() {
    if (_acceptedRide == null) return;
    if (!_otpVerified) { _showToast('⚠️ Please verify the rider OTP first'); return; }
    _locationTimer?.cancel();
    final user = ref.read(authProvider).user;
    SocketService().socket.emit('complete ride', {
      'rideId': _acceptedRide!['rideId'],
      'captainId': user?.id ?? '',
      'fare': _acceptedRide!['fare'],
    });
    setState(() {
      _totalRides++;
      _earnings += (_acceptedRide!['fare'] ?? 0).toDouble();
      _acceptedRide = null;
      _chatMessages.clear();
    });
    _showToast('🏁 Ride completed!');
    _startIdleLocationBroadcast();
  }

  void _rejectRide(String rideId) {
    setState(() => _rides = _rides.where((r) => r['rideId'] != rideId).toList());
    _showToast('Ride skipped');
  }

  void _sendMessage(String message) {
    if (message.trim().isEmpty || _acceptedRide == null) return;
    SocketService().socket.emit('captain:message', {
      'rideId': _acceptedRide!['rideId'],
      'message': message.trim(),
    });
    setState(() => _chatMessages.add({
      'from': 'me',
      'message': message.trim(),
      'ts': DateTime.now().millisecondsSinceEpoch,
    }));
  }

  void _showToast(String msg) {
    _toastTimer?.cancel();
    setState(() => _toast = msg);
    _toastTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) setState(() => _toast = '');
    });
  }

  static double _parseD(dynamic v, double f) {
    if (v == null) return f;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    return double.tryParse(v.toString()) ?? f;
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      body: Stack(
        children: [
          // ── Full-screen Map ──
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(initialCenter: _currentPos, initialZoom: 13),
            children: [
              TileLayer(urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', subdomains: const ['a', 'b', 'c', 'd']),
              MarkerLayer(markers: [
                Marker(point: _currentPos, width: 40, height: 40,
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle, color: _isOnline ? AppColors.secondary : AppColors.textTertiary,
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.4), blurRadius: 8)],
                    ),
                    child: const Icon(Icons.person, color: Colors.white, size: 20),
                  )),
              ]),
            ],
          ),

          // ── Top Bar ──
          Positioned(
            top: 0, left: 0, right: 0,
            child: Container(
              padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 8, left: 16, right: 16, bottom: 12),
              decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.black.withValues(alpha: 0.85), Colors.transparent])),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  RichText(text: const TextSpan(children: [
                    TextSpan(text: 'Uride ', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -1, color: AppColors.textPrimary)),
                    TextSpan(text: 'Services', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -1, color: AppColors.secondary)),
                  ])),
                  Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(color: AppColors.bgCard, border: Border.all(color: AppColors.borderLight), borderRadius: AppRadius.fullBr),
                      child: Text(user?.vehicleType?.toUpperCase() ?? 'CAPTAIN', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(onTap: () => _showCaptainDrawer(user), child: UcabAvatar(initial: user?.name.isNotEmpty == true ? user!.name[0] : 'C')),
                  ]),
                ],
              ),
            ),
          ),

          // ── Bottom Panel ──
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: Container(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.65),
              decoration: const BoxDecoration(color: Color(0xFF0A0A0A), borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SheetHandle(),

                    // Online toggle
                    UcabCard(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
                      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(_isOnline ? 'You are Online' : 'You are Offline', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 3),
                          Text(_isOnline ? 'Waiting for ride requests' : 'Go online to start earning', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                        ]),
                        Switch(value: _isOnline, onChanged: (_) => _toggleOnline(), activeTrackColor: AppColors.secondary, inactiveTrackColor: const Color(0xFF333333)),
                      ]),
                    ),

                    const SizedBox(height: 12),

                    // Stats row
                    Row(children: [
                      _statCard('₹${_earnings.toStringAsFixed(0)}', 'Earnings', AppColors.secondary),
                      const SizedBox(width: 10),
                      _statCard('$_totalRides', 'Rides', AppColors.blue),
                      const SizedBox(width: 10),
                      _statCard(_rating.toStringAsFixed(1), 'Rating', AppColors.gold),
                    ]),

                    const SizedBox(height: 16),

                    // Content area
                    if (_acceptedRide != null) ...[
                      _buildAcceptedRideCard(),
                    ] else if (_rides.isEmpty) ...[
                      Center(child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 32),
                        child: Column(children: [
                          const Text('🚗', style: TextStyle(fontSize: 48)),
                          const SizedBox(height: 12),
                          Text(_isOnline ? 'Waiting for rides...' : 'Go online to receive rides', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.textTertiary)),
                        ]),
                      )),
                    ] else ...[
                      Row(children: [
                        const Text('Ride Requests', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        const SizedBox(width: 8),
                        UcabBadge(text: '${_rides.length}'),
                      ]),
                      const SizedBox(height: 12),
                      ..._rides.map((ride) => _buildRideRequestCard(ride)),
                    ],
                  ],
                ),
              ),
            ),
          ),

          // ── Toast ──
          if (_toast.isNotEmpty)
            Positioned(bottom: 100, left: 24, right: 24,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(100)),
                child: Text(_toast, textAlign: TextAlign.center, style: const TextStyle(color: Colors.black, fontSize: 14, fontWeight: FontWeight.w700)),
              )),
        ],
      ),
    );
  }

  // ─── Ride Request Card ─────────────────────────────────────────
  Widget _buildRideRequestCard(Map<String, dynamic> ride) {
    final fare = ride['fare'] ?? 0;
    final pickup = ride['pickup'] ?? {};
    final dropoff = ride['dropoff'] ?? {};
    final rideId = ride['rideId']?.toString() ?? '';
    final payMethod = ride['paymentMethod'] ?? 'cash';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: AppColors.bgCard, border: Border.all(color: AppColors.border), borderRadius: AppRadius.xlBr),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('₹$fare', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.secondary)),
          Row(children: [
            Text(payMethod.toString().toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textTertiary)),
            const SizedBox(width: 8),
            Text(ride['rideType']?.toString().toUpperCase() ?? 'GO', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          ]),
        ]),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.bgTertiary, borderRadius: BorderRadius.circular(10)),
          child: Column(children: [
            Row(children: [const LocationDot(isPickup: true), const SizedBox(width: 10), Expanded(child: Text(pickup['address'] ?? 'Pickup', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis))]),
            const SizedBox(height: 8),
            Row(children: [const LocationDot(isPickup: false), const SizedBox(width: 10), Expanded(child: Text(dropoff['address'] ?? 'Dropoff', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis))]),
          ]),
        ),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: ElevatedButton(onPressed: () => _acceptRide(ride),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent, foregroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(vertical: 13), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            child: const Text('Accept', style: TextStyle(fontWeight: FontWeight.w700)))),
          const SizedBox(width: 10),
          OutlinedButton(onPressed: () => _rejectRide(rideId),
            style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger, side: const BorderSide(color: AppColors.danger), padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            child: const Text('Skip', style: TextStyle(fontWeight: FontWeight.w600))),
        ]),
      ]),
    );
  }

  // ─── Accepted Ride Card ────────────────────────────────────────
  Widget _buildAcceptedRideCard() {
    final ride = _acceptedRide!;
    final fare = ride['fare'] ?? 0;
    final pickup = ride['pickup'] ?? {};
    final dropoff = ride['dropoff'] ?? {};

    return UcabCard(
      backgroundColor: const Color(0xFF0D2818), borderColor: AppColors.secondary,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const StatusPulse(),
          const SizedBox(width: 10),
          const Expanded(child: Text('Active Ride', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.secondary))),
          Text('₹$fare', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.secondary)),
        ]),
        const SizedBox(height: 14),

        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.bgTertiary.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(10)),
          child: Column(children: [
            Row(children: [const LocationDot(isPickup: true), const SizedBox(width: 10), Expanded(child: Text(pickup['address'] ?? 'Pickup', style: const TextStyle(fontSize: 14, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis))]),
            const SizedBox(height: 8),
            Row(children: [const LocationDot(isPickup: false), const SizedBox(width: 10), Expanded(child: Text(dropoff['address'] ?? 'Dropoff', style: const TextStyle(fontSize: 14, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis))]),
          ]),
        ),

        // Arrived button
        if (!_otpVerified) ...[
          const SizedBox(height: 12),
          SizedBox(width: double.infinity, child: OutlinedButton.icon(
            onPressed: _arrivedAtPickup,
            icon: const Icon(Icons.pin_drop, size: 18),
            label: const Text("I've Arrived"),
            style: OutlinedButton.styleFrom(foregroundColor: AppColors.info, side: const BorderSide(color: AppColors.info), padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
          )),
        ],

        // OTP Verification
        if (!_otpVerified) ...[
          const SizedBox(height: 14),
          const Text('VERIFY RIDER OTP', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary, letterSpacing: 0.5)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: TextField(
              controller: _otpCtrl, keyboardType: TextInputType.number, maxLength: 4, textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: 8, color: AppColors.secondary),
              decoration: InputDecoration(counterText: '', hintText: '1234', filled: true, fillColor: const Color(0xFF1A1A2E),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.info, width: 2)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.info, width: 2))),
            )),
            const SizedBox(width: 8),
            ElevatedButton(onPressed: _verifyOtp,
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00C853), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              child: const Text('Verify', style: TextStyle(fontWeight: FontWeight.w700))),
          ]),
        ] else ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.secondary.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
            child: const Row(children: [
              Icon(Icons.check_circle, color: AppColors.secondary, size: 20),
              SizedBox(width: 8),
              Text('OTP Verified — Ride in progress', style: TextStyle(color: AppColors.secondary, fontWeight: FontWeight.w700, fontSize: 14)),
            ]),
          ),
        ],

        const SizedBox(height: 12),

        // Chat button
        OutlinedButton.icon(
          onPressed: _showCaptainChat,
          icon: const Icon(Icons.chat_bubble_outline, size: 18),
          label: Text('Chat with Rider${_chatMessages.isNotEmpty ? ' (${_chatMessages.length})' : ''}'),
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.info, side: const BorderSide(color: AppColors.info),
            padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
        ),

        const SizedBox(height: 14),

        SizedBox(width: double.infinity, child: ElevatedButton(
          onPressed: _completeRide,
          style: ElevatedButton.styleFrom(
            backgroundColor: _otpVerified ? AppColors.secondary : const Color(0xFF333333),
            foregroundColor: _otpVerified ? Colors.black : AppColors.textDisabled,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          child: const Text('Complete Ride 🏁'),
        )),
      ]),
    );
  }

  void _showCaptainChat() {
    final msgCtrl = TextEditingController();
    showModalBottomSheet(
      context: context, backgroundColor: AppColors.bgSecondary, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SheetHandle(),
          const Text('Chat with Rider', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 12),
          SizedBox(height: 200, child: _chatMessages.isEmpty
            ? const Center(child: Text('No messages yet', style: TextStyle(color: AppColors.textTertiary)))
            : ListView.builder(itemCount: _chatMessages.length, itemBuilder: (_, i) {
                final m = _chatMessages[i];
                final isMe = m['from'] == 'me';
                return Align(alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(margin: const EdgeInsets.only(bottom: 6), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(color: isMe ? AppColors.secondary : AppColors.bgInput, borderRadius: BorderRadius.circular(12)),
                    child: Text(m['message'] ?? '', style: TextStyle(color: isMe ? Colors.black : AppColors.textPrimary, fontSize: 14))));
              })),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: TextField(controller: msgCtrl, style: const TextStyle(color: AppColors.textPrimary), decoration: const InputDecoration(hintText: 'Type a message...'))),
            const SizedBox(width: 8),
            IconButton(onPressed: () { _sendMessage(msgCtrl.text); msgCtrl.clear(); }, icon: const Icon(Icons.send, color: AppColors.secondary)),
          ]),
        ]),
      ),
    );
  }

  Widget _statCard(String value, String label, Color color) {
    return Expanded(child: Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 14),
      decoration: BoxDecoration(color: AppColors.bgCard, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(14)),
      child: Column(children: [
        Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 3),
        Text(label.toUpperCase(), style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, letterSpacing: 0.4)),
      ]),
    ));
  }

  void _showCaptainDrawer(AppUser? user) {
    showModalBottomSheet(
      context: context, backgroundColor: AppColors.bgSecondary, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.65, minChildSize: 0.4, maxChildSize: 0.85, expand: false,
        builder: (_, scrollCtrl) => ListView(
          controller: scrollCtrl, padding: const EdgeInsets.fromLTRB(20, 10, 20, 36),
          children: [
            const SheetHandle(),
            const SizedBox(height: 10),
            Row(children: [
              UcabAvatar(initial: user?.name.isNotEmpty == true ? user!.name[0] : 'C', size: 52),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(user?.name ?? 'Captain', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 3),
                Text(user?.phone ?? '', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(color: _isOnline ? AppColors.secondary.withValues(alpha: 0.2) : AppColors.bgInput, borderRadius: AppRadius.fullBr),
                  child: Text(_isOnline ? '🟢 Online' : '⚫ Offline', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _isOnline ? AppColors.secondary : AppColors.textSecondary)),
                ),
              ])),
              Column(children: [
                Text('⭐ ${_rating.toStringAsFixed(1)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const Text('rating', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              ]),
            ]),
            const SizedBox(height: 24),
            Row(children: [
              _drawerStat('💰', '₹${_earnings.toStringAsFixed(0)}', 'Total Earned', AppColors.secondary),
              const SizedBox(width: 10),
              _drawerStat('🚗', '$_totalRides', 'Total Rides', AppColors.blue),
            ]),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.history, color: AppColors.textSecondary, size: 22),
              title: const Text('Trip History', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              trailing: const Icon(Icons.chevron_right, color: AppColors.textTertiary, size: 20),
              onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/captain/history'); },
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () { SocketService().disconnect(); ref.read(authProvider.notifier).logout(); Navigator.pushReplacementNamed(context, '/landing'); },
              icon: const Icon(Icons.logout, size: 18), label: const Text('Logout'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            ),
          ],
        ),
      ),
    );
  }

  Widget _drawerStat(String icon, String value, String label, Color color) {
    return Expanded(child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.bgCard, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(14)),
      child: Column(children: [
        Text(icon, style: const TextStyle(fontSize: 24)),
        const SizedBox(height: 6),
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 3),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
      ]),
    ));
  }
}
