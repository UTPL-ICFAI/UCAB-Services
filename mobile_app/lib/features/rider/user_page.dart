/// Rider Map Screen — Full Uber-style layout with OpenStreetMap,
/// bottom sheet for booking, ride type selection, fare estimation,
/// service tabs, real-time tracking, and full socket integration.
library;

import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/core/widgets.dart';
import 'package:ucab_mobile/features/auth/auth_provider.dart';
import 'package:ucab_mobile/networking/api_client.dart';
import 'package:ucab_mobile/networking/socket_service.dart';
import 'package:ucab_mobile/core/constants.dart';
import 'package:dio/dio.dart';

// ─── Ride Type Data ───────────────────────────────────────────────
class _RideType {
  final String id, name, icon, time;
  final int base, perKm;
  const _RideType({required this.id, required this.name, required this.icon, required this.time, required this.base, required this.perKm});
  int fare(double km, double surge) => ((base + perKm * km) * surge).round();
}

const _rideTypes = [
  _RideType(id: 'go', name: 'uride Go', icon: '🚗', time: '2 min', base: 30, perKm: 10),
  _RideType(id: 'premier', name: 'Premier', icon: '🚙', time: '4 min', base: 60, perKm: 15),
  _RideType(id: 'auto', name: 'Auto', icon: '🛺', time: '3 min', base: 20, perKm: 7),
  _RideType(id: 'bike', name: 'Bike', icon: '🏍️', time: '1 min', base: 15, perKm: 5),
];

// ─── Location Model ──────────────────────────────────────────────
class _Location {
  final double lat, lng;
  final String address;
  const _Location({required this.lat, required this.lng, required this.address});
}

/// Haversine distance in km
double _haversineKm(double lat1, double lng1, double lat2, double lng2) {
  const r = 6371.0;
  final dLat = (lat2 - lat1) * pi / 180;
  final dLon = (lng2 - lng1) * pi / 180;
  final a = sin(dLat / 2) * sin(dLat / 2) +
      cos(lat1 * pi / 180) * cos(lat2 * pi / 180) * sin(dLon / 2) * sin(dLon / 2);
  return r * 2 * atan2(sqrt(a), sqrt(1 - a));
}

class UserPage extends ConsumerStatefulWidget {
  const UserPage({super.key});
  @override
  ConsumerState<UserPage> createState() => _UserPageState();
}

class _UserPageState extends ConsumerState<UserPage> {
  final MapController _mapController = MapController();
  final _pickupCtrl = TextEditingController();
  final _dropoffCtrl = TextEditingController();

  // State
  _Location? _pickup;
  _Location? _dropoff;
  String _selectedType = 'go';
  String _rideStatus = 'idle'; // idle | searching | accepted | riding | rating
  String _payMethod = 'cash';
  String _toast = '';
  Timer? _toastTimer;
  double _surgeMultiplier = 1.0;
  String? _currentRideId;

  // Accepted ride info
  String _rideOtp = '';
  String _captainName = '';
  double _captainRating = 5.0;
  String _captainVehicle = '';
  String? _captainId;

  // Captain live location
  LatLng? _captainLocation;

  // Nearby captains for map preview
  List<Map<String, dynamic>> _nearbyCaptains = [];

  // Chat messages
  final List<Map<String, dynamic>> _chatMessages = [];

  @override
  void initState() {
    super.initState();
    _detectGPS();
    _connectSocketWithAuth();
    _fetchSurge();
  }

  @override
  void dispose() {
    _pickupCtrl.dispose();
    _dropoffCtrl.dispose();
    _toastTimer?.cancel();
    super.dispose();
  }

  /// Computed route distance
  double get _routeDistKm {
    if (_pickup == null || _dropoff == null) return 0;
    return _haversineKm(_pickup!.lat, _pickup!.lng, _dropoff!.lat, _dropoff!.lng);
  }

  // ─── Socket Auth ───────────────────────────────────────────────
  Future<void> _connectSocketWithAuth() async {
    final token = await ApiClient().getToken();
    if (token != null) {
      SocketService().connectWithToken(token);
    } else {
      SocketService().connect();
    }
    _setupSocketListeners();
  }

  void _setupSocketListeners() {
    final socket = SocketService().socket;

    socket.on('ride requested', (data) {
      final d = Map<String, dynamic>.from(data as Map);
      if (mounted) setState(() => _currentRideId = d['rideId']?.toString());
    });

    socket.on('ride accepted', (data) {
      final d = Map<String, dynamic>.from(data as Map);
      // Only handle events for our ride
      if (_currentRideId != null && d['rideId']?.toString() != _currentRideId) return;
      if (mounted) {
        setState(() {
          _rideStatus = 'accepted';
          _rideOtp = d['otp']?.toString() ?? '';
          _captainName = d['captainName'] ?? 'Your Captain';
          _captainId = d['captainId']?.toString();
          if (d['captain'] is Map) {
            final cap = d['captain'] as Map;
            _captainRating = _parseD(cap['rating'], 5.0);
            final v = cap['vehicle'];
            if (v is Map) {
              _captainVehicle = '${v['color'] ?? ''} ${v['model'] ?? ''}'.trim();
            }
          }
        });
        _showToast('🎉 Captain is on the way!');
      }
    });

    socket.on('captain:location', (data) {
      final d = Map<String, dynamic>.from(data as Map);
      if (mounted) {
        setState(() => _captainLocation = LatLng(
          _parseD(d['lat'], 0), _parseD(d['lng'], 0),
        ));
      }
    });

    socket.on('captain:arrived', (data) {
      if (mounted) _showToast('📍 Captain has arrived at your pickup!');
    });

    socket.on('ride:started', (_) {
      if (mounted) {
        setState(() => _rideStatus = 'riding');
        _showToast('🚗 Your ride has started!');
      }
    });

    socket.on('ride completed', (_) {
      if (mounted) {
        setState(() {
          _rideStatus = 'rating';
          _captainLocation = null;
        });
        _showToast('🏁 Trip completed! Please rate your captain.');
      }
    });

    socket.on('ride error', (data) {
      final d = data is Map ? Map<String, dynamic>.from(data) : {};
      if (mounted) {
        setState(() => _rideStatus = 'idle');
        _showToast('❌ ${d['message'] ?? 'Ride error'}');
      }
    });

    // In-ride chat from captain
    socket.on('captain:message', (data) {
      final d = Map<String, dynamic>.from(data as Map);
      if (mounted) {
        setState(() => _chatMessages.add({
          'from': 'captain',
          'message': d['message'],
          'ts': DateTime.now().millisecondsSinceEpoch,
        }));
        _showToast('💬 ${d['captainName'] ?? 'Captain'}: ${d['message']}');
      }
    });

    // Wallet events
    socket.on('wallet:updated', (data) {
      if (mounted) _showToast('💳 Wallet updated');
    });

    socket.on('loyalty:points_earned', (data) {
      final d = data is Map ? Map<String, dynamic>.from(data) : {};
      if (mounted) _showToast('🏆 You earned ${d['points'] ?? 0} loyalty points!');
    });
  }

  // ─── GPS Detection ─────────────────────────────────────────────
  Future<void> _detectGPS() async {
    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) {
        _showToast('❌ Location permission denied');
        return;
      }
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);

      // Reverse geocode
      String address = '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}';
      try {
        final resp = await ApiClient().dio.get(
          'https://nominatim.openstreetmap.org/reverse',
          queryParameters: {'lat': pos.latitude, 'lon': pos.longitude, 'format': 'json'},
          options: Options(headers: {'Accept-Language': 'en'}),
        );
        address = (resp.data['display_name'] ?? '').split(',').take(3).join(',').trim();
      } catch (_) {}

      if (mounted) {
        setState(() {
          _pickup = _Location(lat: pos.latitude, lng: pos.longitude, address: address);
          _pickupCtrl.text = address;
        });
        _mapController.move(LatLng(pos.latitude, pos.longitude), 14);
        _showToast('✅ Location detected!');
        _fetchNearbyCaptains(pos.latitude, pos.longitude);
      }
    } catch (_) {
      _showToast('⚠️ Could not detect location');
    }
  }

  // ─── Nearby Captains ──────────────────────────────────────────
  Future<void> _fetchNearbyCaptains(double lat, double lng) async {
    try {
      final resp = await ApiClient().dio.get(ApiConstants.nearbyCaptains, queryParameters: {'lat': lat, 'lng': lng, 'radius': 5});
      if (mounted) {
        setState(() => _nearbyCaptains = List<Map<String, dynamic>>.from(resp.data?['captains'] ?? []));
      }
    } catch (_) {}
  }

  // ─── Surge ────────────────────────────────────────────────────
  Future<void> _fetchSurge() async {
    try {
      final resp = await ApiClient().dio.get(ApiConstants.surge);
      if (mounted) setState(() => _surgeMultiplier = _parseD(resp.data?['multiplier'], 1.0));
    } catch (_) {}
  }

  // ─── Book Ride ─────────────────────────────────────────────────
  void _requestRide() {
    if (_pickup == null || _dropoff == null) {
      _showToast('⚠️ Please set pickup & dropoff');
      return;
    }
    final type = _rideTypes.firstWhere((t) => t.id == _selectedType);
    final fare = type.fare(_routeDistKm, _surgeMultiplier);

    SocketService().socket.emit('new ride request', {
      'pickup': {'lat': _pickup!.lat, 'lng': _pickup!.lng, 'address': _pickup!.address},
      'dropoff': {'lat': _dropoff!.lat, 'lng': _dropoff!.lng, 'address': _dropoff!.address},
      'rideType': _selectedType,
      'fare': fare,
      'paymentMethod': _payMethod,
      'distKm': _routeDistKm,
    });
    setState(() => _rideStatus = 'searching');
    _showToast('🔍 Searching for captains...');
  }

  void _cancelRide() {
    SocketService().socket.emit('cancel ride', {});
    setState(() {
      _rideStatus = 'idle';
      _currentRideId = null;
      _captainLocation = null;
      _chatMessages.clear();
    });
    _showToast('Ride cancelled');
  }

  // ─── Chat ─────────────────────────────────────────────────────
  void _sendMessage(String message) {
    if (message.trim().isEmpty || _currentRideId == null) return;
    SocketService().socket.emit('user:message', {
      'rideId': _currentRideId,
      'message': message.trim(),
    });
    setState(() => _chatMessages.add({
      'from': 'me',
      'message': message.trim(),
      'ts': DateTime.now().millisecondsSinceEpoch,
    }));
  }

  // ─── Toast ─────────────────────────────────────────────────────
  void _showToast(String msg) {
    _toastTimer?.cancel();
    setState(() => _toast = msg);
    _toastTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) setState(() => _toast = '');
    });
  }

  // ─── Search Location ──────────────────────────────────────────
  Future<void> _searchLocation(String query, bool isPickup) async {
    if (query.length < 3) return;
    try {
      final resp = await ApiClient().dio.get(
        'https://nominatim.openstreetmap.org/search',
        queryParameters: {'q': query, 'format': 'json', 'limit': 5},
        options: Options(headers: {'Accept-Language': 'en'}),
      );
      if ((resp.data as List).isNotEmpty && mounted) {
        _showLocationPicker(resp.data as List, isPickup);
      }
    } catch (_) {}
  }

  void _showLocationPicker(List results, bool isPickup) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSecondary,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => ListView.builder(
        shrinkWrap: true,
        padding: const EdgeInsets.all(16),
        itemCount: results.length,
        itemBuilder: (_, i) {
          final r = results[i];
          final name = r['display_name'] ?? '';
          final short = name.split(',').take(3).join(',').trim();
          return ListTile(
            leading: Icon(isPickup ? Icons.trip_origin : Icons.location_on, color: isPickup ? AppColors.secondary : AppColors.danger, size: 20),
            title: Text(short, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary), maxLines: 2, overflow: TextOverflow.ellipsis),
            onTap: () {
              final lat = double.parse(r['lat']);
              final lng = double.parse(r['lon']);
              final loc = _Location(lat: lat, lng: lng, address: short);
              setState(() {
                if (isPickup) { _pickup = loc; _pickupCtrl.text = short; } else { _dropoff = loc; _dropoffCtrl.text = short; }
              });
              _mapController.move(LatLng(lat, lng), 14);
              Navigator.pop(context);
            },
          );
        },
      ),
    );
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
    final selectedType = _rideTypes.firstWhere((t) => t.id == _selectedType);
    final fare = selectedType.fare(_routeDistKm, _surgeMultiplier);

    return Scaffold(
      body: Stack(
        children: [
          // ── Full-screen Map ──
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _pickup != null ? LatLng(_pickup!.lat, _pickup!.lng) : const LatLng(20.5937, 78.9629),
              initialZoom: 13,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                subdomains: const ['a', 'b', 'c', 'd'],
              ),
              MarkerLayer(markers: [
                if (_pickup != null)
                  Marker(point: LatLng(_pickup!.lat, _pickup!.lng), width: 40, height: 40,
                    child: const Icon(Icons.trip_origin, color: AppColors.secondary, size: 28)),
                if (_dropoff != null)
                  Marker(point: LatLng(_dropoff!.lat, _dropoff!.lng), width: 40, height: 40,
                    child: const Icon(Icons.location_on, color: AppColors.danger, size: 32)),
                // Captain live location during ride
                if (_captainLocation != null)
                  Marker(point: _captainLocation!, width: 44, height: 44,
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle, color: AppColors.secondary,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.4), blurRadius: 8)],
                      ),
                      child: const Icon(Icons.directions_car, color: Colors.white, size: 20),
                    )),
                // Nearby captains preview
                ..._nearbyCaptains.map((c) => Marker(
                  point: LatLng(_parseD(c['lat'], 0), _parseD(c['lng'], 0)),
                  width: 30, height: 30,
                  child: Opacity(opacity: 0.6, child: Container(
                    decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.textTertiary,
                      border: Border.all(color: Colors.white, width: 2)),
                    child: const Icon(Icons.directions_car, color: Colors.white, size: 14),
                  )),
                )),
              ]),
            ],
          ),

          // ── Top Bar ──
          Positioned(
            top: 0, left: 0, right: 0,
            child: Container(
              padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 8, left: 16, right: 16, bottom: 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
                  colors: [Colors.black.withValues(alpha: 0.85), Colors.transparent]),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  RichText(text: const TextSpan(children: [
                    TextSpan(text: 'Uride ', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -1, color: AppColors.textPrimary)),
                    TextSpan(text: 'Services', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -1, color: AppColors.secondary)),
                  ])),
                  Row(children: [
                    IconButton(onPressed: _detectGPS, icon: const Icon(Icons.my_location, color: AppColors.textPrimary, size: 22),
                      style: IconButton.styleFrom(backgroundColor: AppColors.bgTertiary)),
                    const SizedBox(width: 8),
                    GestureDetector(onTap: () => _showAccountDrawer(user),
                      child: UcabAvatar(initial: user?.name.isNotEmpty == true ? user!.name[0] : 'U')),
                  ]),
                ],
              ),
            ),
          ),

          // ── Bottom Sheet ──
          DraggableScrollableSheet(
            initialChildSize: 0.35, minChildSize: 0.12, maxChildSize: 0.85,
            builder: (context, scrollController) {
              return Container(
                decoration: const BoxDecoration(color: Color(0xFF0A0A0A), borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 32),
                  children: [
                    const SheetHandle(),
                    if (_rideStatus == 'idle') ..._buildBookingView(fare, selectedType),
                    if (_rideStatus == 'searching') ..._buildSearchingView(fare),
                    if (_rideStatus == 'accepted' || _rideStatus == 'riding') ..._buildAcceptedView(),
                    if (_rideStatus == 'rating') ..._buildRatingView(),
                  ],
                ),
              );
            },
          ),

          // ── Toast ──
          if (_toast.isNotEmpty)
            Positioned(
              bottom: 100, left: 24, right: 24,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(100)),
                child: Text(_toast, textAlign: TextAlign.center, style: const TextStyle(color: Colors.black, fontSize: 14, fontWeight: FontWeight.w700)),
              ),
            ),
        ],
      ),
    );
  }

  // ─── Booking View (idle) ───────────────────────────────────────
  List<Widget> _buildBookingView(int fare, _RideType type) {
    return [
      const Text('Where to?', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
      const SizedBox(height: 14),

      // Location card
      UcabCard(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        backgroundColor: const Color(0xFF161616), borderColor: const Color(0xFF2A2A2A),
        borderRadius: BorderRadius.circular(14),
        child: Column(children: [
          _locationRow(isPickup: true, ctrl: _pickupCtrl),
          Container(height: 1, color: const Color(0xFF2A2A2A)),
          _locationRow(isPickup: false, ctrl: _dropoffCtrl),
        ]),
      ),

      // Distance display
      if (_pickup != null && _dropoff != null) ...[
        const SizedBox(height: 8),
        Text('📏 ${_routeDistKm.toStringAsFixed(1)} km', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
      ],

      // Surge warning
      if (_surgeMultiplier > 1.0) ...[
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
          child: Row(children: [
            const Text('⚡', style: TextStyle(fontSize: 16)),
            const SizedBox(width: 8),
            Text('Surge ${_surgeMultiplier.toStringAsFixed(1)}x — High demand', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.warning)),
          ]),
        ),
      ],

      const SizedBox(height: 16),

      // Ride type selector
      const Text('CHOOSE A RIDE', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5)),
      const SizedBox(height: 12),
      SizedBox(
        height: 100,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          separatorBuilder: (context, index) => const SizedBox(width: 10),
          itemCount: _rideTypes.length,
          itemBuilder: (_, i) {
            final t = _rideTypes[i];
            final isSelected = t.id == _selectedType;
            return GestureDetector(
              onTap: () => setState(() => _selectedType = t.id),
              child: Container(
                width: 110, padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF1A1A1A) : AppColors.bgCard,
                  border: Border.all(color: isSelected ? AppColors.borderActive : AppColors.border, width: 2),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(t.icon, style: const TextStyle(fontSize: 28)),
                  const SizedBox(height: 4),
                  Text(t.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                  Text(t.time, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  Text('₹${t.fare(_routeDistKm, _surgeMultiplier)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.secondary)),
                ]),
              ),
            );
          },
        ),
      ),

      const SizedBox(height: 16),

      // Payment method
      Row(children: [
        _payChip('💵', 'Cash', 'cash'),
        const SizedBox(width: 10),
        _payChip('📲', 'UPI', 'upi'),
        const SizedBox(width: 10),
        _payChip('💳', 'Wallet', 'wallet'),
      ]),

      const SizedBox(height: 16),

      // Fare + book
      UcabCard(
        padding: const EdgeInsets.all(14), backgroundColor: const Color(0xFF161616), borderColor: const Color(0xFF2A2A2A),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Estimated Fare', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(height: 4),
            Text('₹$fare', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
          ]),
          ElevatedButton(
            onPressed: _requestRide,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent, foregroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
            ),
            child: const Text('Book Now'),
          ),
        ]),
      ),
    ];
  }

  // ─── Searching View ────────────────────────────────────────────
  List<Widget> _buildSearchingView(int fare) {
    return [
      const SizedBox(height: 20),
      Center(child: SizedBox(width: 52, height: 52, child: CircularProgressIndicator(strokeWidth: 4, color: AppColors.textPrimary.withValues(alpha: 0.7)))),
      const SizedBox(height: 16),
      const Center(child: Text('Finding your captain...', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
      const SizedBox(height: 6),
      const Center(child: Text('Hold tight, matching you with a nearby driver', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: AppColors.textSecondary))),
      const SizedBox(height: 24),
      Center(child: Text('₹$fare', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.secondary))),
      const SizedBox(height: 24),
      UcabOutlineButton(label: 'Cancel Ride', onPressed: _cancelRide),
    ];
  }

  // ─── Accepted / Riding View ────────────────────────────────────
  List<Widget> _buildAcceptedView() {
    return [
      UcabCard(
        backgroundColor: const Color(0xFF0D2818), borderColor: AppColors.secondary,
        child: Column(children: [
          Row(children: [
            const StatusPulse(),
            const SizedBox(width: 10),
            Text(_rideStatus == 'riding' ? 'Ride in progress' : 'Captain is on the way',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.secondary)),
          ]),
          const SizedBox(height: 16),

          // Captain info
          Row(children: [
            UcabAvatar(initial: _captainName.isNotEmpty ? _captainName[0] : 'C', size: 52),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_captainName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Row(children: [
                Text('⭐ ${_captainRating.toStringAsFixed(1)}', style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
                if (_captainVehicle.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0xFF252525), border: Border.all(color: AppColors.borderLight), borderRadius: BorderRadius.circular(8)),
                    child: Text(_captainVehicle, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                  ),
                ],
              ]),
            ])),
          ]),

          // OTP Display
          if (_rideOtp.isNotEmpty && _rideStatus == 'accepted') ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.1),
                border: Border.all(color: AppColors.info.withValues(alpha: 0.3)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                const Icon(Icons.lock, color: AppColors.info, size: 20),
                const SizedBox(width: 12),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('YOUR RIDE OTP', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.info, letterSpacing: 0.5)),
                  const SizedBox(height: 4),
                  Text(_rideOtp, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.textPrimary, letterSpacing: 8)),
                ]),
                const Spacer(),
                const Text('Share this\nwith captain', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: AppColors.textTertiary)),
              ]),
            ),
          ],

          const SizedBox(height: 16),

          // Chat button
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _showChat,
                icon: const Icon(Icons.chat_bubble_outline, size: 18),
                label: Text('Chat${_chatMessages.isNotEmpty ? ' (${_chatMessages.length})' : ''}'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.info,
                  side: const BorderSide(color: AppColors.info),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () {
                  SocketService().socket.emit('sos alert', {
                    'rideId': _currentRideId,
                    'riderId': ref.read(authProvider).user?.id,
                    'captainId': _captainId,
                  });
                  _showToast('🆘 SOS Alert sent!');
                },
                icon: const Icon(Icons.sos, size: 20),
                label: const Text('SOS'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.danger, foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
          ]),
        ]),
      ),
    ];
  }

  // ─── Chat Bottom Sheet ─────────────────────────────────────────
  void _showChat() {
    final msgCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSecondary,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SheetHandle(),
            const Text('Chat with Captain', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 12),
            SizedBox(
              height: 200,
              child: _chatMessages.isEmpty
                  ? const Center(child: Text('No messages yet', style: TextStyle(color: AppColors.textTertiary)))
                  : ListView.builder(
                      itemCount: _chatMessages.length,
                      itemBuilder: (_, i) {
                        final m = _chatMessages[i];
                        final isMe = m['from'] == 'me';
                        return Align(
                          alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: isMe ? AppColors.secondary : AppColors.bgInput,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(m['message'] ?? '', style: TextStyle(color: isMe ? Colors.black : AppColors.textPrimary, fontSize: 14)),
                          ),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: msgCtrl,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(hintText: 'Type a message...'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: () { _sendMessage(msgCtrl.text); msgCtrl.clear(); },
                icon: const Icon(Icons.send, color: AppColors.secondary),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  // ─── Rating View ───────────────────────────────────────────────
  List<Widget> _buildRatingView() {
    return [
      const SizedBox(height: 20),
      const Center(child: Text('⭐', style: TextStyle(fontSize: 48))),
      const SizedBox(height: 12),
      const Center(child: Text('Rate your Captain', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
      const SizedBox(height: 20),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(5, (i) {
          return GestureDetector(
            onTap: () {
              SocketService().socket.emit('rate captain', {
                'captainId': _captainId,
                'rideId': _currentRideId,
                'rating': i + 1,
              });
              _showToast('⭐ Thanks for rating ${i + 1} stars!');
              Future.delayed(const Duration(seconds: 1), () {
                if (mounted) setState(() { _rideStatus = 'idle'; _currentRideId = null; _chatMessages.clear(); });
              });
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Text('★', style: TextStyle(fontSize: 40, color: Colors.yellow.shade700)),
            ),
          );
        }),
      ),
      const SizedBox(height: 20),
      TextButton(
        onPressed: () => setState(() { _rideStatus = 'idle'; _currentRideId = null; _chatMessages.clear(); }),
        child: const Text('Skip', style: TextStyle(color: AppColors.textSecondary)),
      ),
    ];
  }

  // ─── Location Row Helper ───────────────────────────────────────
  Widget _locationRow({required bool isPickup, required TextEditingController ctrl}) {
    return Row(children: [
      LocationDot(isPickup: isPickup),
      const SizedBox(width: 12),
      Expanded(
        child: TextField(
          controller: ctrl,
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            hintText: isPickup ? 'Pickup location' : 'Where to?',
            hintStyle: const TextStyle(color: AppColors.textTertiary),
            border: InputBorder.none, enabledBorder: InputBorder.none, focusedBorder: InputBorder.none,
            filled: false, contentPadding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onSubmitted: (v) => _searchLocation(v, isPickup),
        ),
      ),
      IconButton(icon: const Icon(Icons.search, color: AppColors.textSecondary, size: 20), onPressed: () => _searchLocation(ctrl.text, isPickup)),
    ]);
  }

  // ─── Payment Chip ──────────────────────────────────────────────
  Widget _payChip(String icon, String label, String method) {
    final isSelected = _payMethod == method;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _payMethod = method),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF0E2B1A) : AppColors.bgInput,
            border: Border.all(color: isSelected ? AppColors.secondary : const Color(0xFF2A2A2A), width: 2),
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: Text('$icon $label', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isSelected ? AppColors.secondary : AppColors.textSecondary)),
        ),
      ),
    );
  }

  // ─── Account Drawer ────────────────────────────────────────────
  void _showAccountDrawer(AppUser? user) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSecondary,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7, minChildSize: 0.4, maxChildSize: 0.9, expand: false,
          builder: (_, scrollCtrl) {
            return ListView(
              controller: scrollCtrl,
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 36),
              children: [
                const SheetHandle(),
                const SizedBox(height: 10),
                Row(children: [
                  UcabAvatar(initial: user?.name.isNotEmpty == true ? user!.name[0] : 'U', size: 52),
                  const SizedBox(width: 14),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(user?.name ?? 'User', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    const SizedBox(height: 3),
                    Text(user?.phone ?? '', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ])),
                ]),
                const SizedBox(height: 24),
                _drawerItem(Icons.history, 'Ride History', () { Navigator.pop(context); Navigator.pushNamed(context, '/ride-history'); }),
                _drawerItem(Icons.account_balance_wallet, 'Wallet', () { Navigator.pop(context); Navigator.pushNamed(context, '/wallet'); }),
                _drawerItem(Icons.directions_car, 'Carpool', () { Navigator.pop(context); Navigator.pushNamed(context, '/carpool'); }),
                _drawerItem(Icons.support_agent, 'Support', () { Navigator.pop(context); Navigator.pushNamed(context, '/support'); }),
                _drawerItem(Icons.emergency, 'Emergency Contacts', () { Navigator.pop(context); Navigator.pushNamed(context, '/emergency-contacts'); }),
                _drawerItem(Icons.notifications, 'Notifications', () { Navigator.pop(context); Navigator.pushNamed(context, '/notifications'); }),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: () {
                    SocketService().disconnect();
                    ref.read(authProvider.notifier).logout();
                    Navigator.pushReplacementNamed(context, '/landing');
                  },
                  icon: const Icon(Icons.logout, size: 18),
                  label: const Text('Logout'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.danger, foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _drawerItem(IconData icon, String label, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textSecondary, size: 22),
      title: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textTertiary, size: 20),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}
