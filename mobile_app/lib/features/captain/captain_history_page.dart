/// Captain Trip History — completed rides for the captain.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/core/widgets.dart';
import 'package:ucab_mobile/features/auth/auth_provider.dart';
import 'package:ucab_mobile/networking/api_client.dart';
import 'package:ucab_mobile/core/constants.dart';

class CaptainHistoryPage extends ConsumerStatefulWidget {
  const CaptainHistoryPage({super.key});
  @override
  ConsumerState<CaptainHistoryPage> createState() => _CaptainHistoryPageState();
}

class _CaptainHistoryPageState extends ConsumerState<CaptainHistoryPage> {
  List<Map<String, dynamic>> _trips = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchTrips();
  }

  Future<void> _fetchTrips() async {
    setState(() => _loading = true);
    try {
      final user = ref.read(authProvider).user;
      if (user == null) return;
      final resp = await ApiClient().dio.get(ApiConstants.captainTrips, queryParameters: {'captainId': user.id, 'limit': 50});
      if (mounted) {
        setState(() {
          _trips = List<Map<String, dynamic>>.from(resp.data['trips'] ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(title: const Text('Trip History'), backgroundColor: AppColors.bgPrimary, leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context))),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.secondary))
          : _trips.isEmpty
              ? const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('🚕', style: TextStyle(fontSize: 56)),
                  SizedBox(height: 12),
                  Text('No trips yet', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                ]))
              : RefreshIndicator(
                  onRefresh: _fetchTrips,
                  color: AppColors.secondary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _trips.length,
                    itemBuilder: (_, i) {
                      final t = _trips[i];
                      final pickup = t['pickup'] is Map ? t['pickup'] : {};
                      final dropoff = t['dropoff'] is Map ? t['dropoff'] : {};
                      final fare = t['fare'] ?? 0;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 14),
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(color: AppColors.bgCard, border: Border.all(color: AppColors.border), borderRadius: AppRadius.xlBr),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            Text('₹${fare is num ? fare.toStringAsFixed(0) : fare}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.secondary)),
                            Text(t['rideType']?.toString().toUpperCase() ?? 'GO', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textTertiary)),
                          ]),
                          const SizedBox(height: 12),
                          Row(children: [const LocationDot(isPickup: true), const SizedBox(width: 10), Expanded(child: Text(pickup['address'] ?? 'Pickup', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis))]),
                          const SizedBox(height: 6),
                          Row(children: [const LocationDot(isPickup: false), const SizedBox(width: 10), Expanded(child: Text(dropoff['address'] ?? 'Dropoff', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis))]),
                          if (t['date'] != null) ...[
                            const SizedBox(height: 8),
                            Text(_fmt(t['date'].toString()), style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                          ],
                        ]),
                      );
                    },
                  ),
                ),
    );
  }

  String _fmt(String s) { try { final d = DateTime.parse(s).toLocal(); return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}'; } catch (_) { return s; } }
}
