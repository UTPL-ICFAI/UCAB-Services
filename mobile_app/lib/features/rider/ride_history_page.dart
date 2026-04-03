/// Ride History Page — shows completed/cancelled rides for the rider.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/core/widgets.dart';
import 'package:ucab_mobile/features/auth/auth_provider.dart';
import 'package:ucab_mobile/networking/api_client.dart';
import 'package:ucab_mobile/core/constants.dart';

class RideHistoryPage extends ConsumerStatefulWidget {
  const RideHistoryPage({super.key});
  @override
  ConsumerState<RideHistoryPage> createState() => _RideHistoryPageState();
}

class _RideHistoryPageState extends ConsumerState<RideHistoryPage> {
  List<Map<String, dynamic>> _trips = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchTrips();
  }

  Future<void> _fetchTrips() async {
    setState(() { _loading = true; _error = null; });
    try {
      final user = ref.read(authProvider).user;
      if (user == null) return;
      final resp = await ApiClient().dio.get(
        ApiConstants.userTrips,
        queryParameters: {'userId': user.id, 'limit': 50},
      );
      final data = resp.data;
      setState(() {
        _trips = List<Map<String, dynamic>>.from(data['trips'] ?? []);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = 'Failed to load trip history'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(
        title: const Text('Ride History'),
        backgroundColor: AppColors.bgPrimary,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.secondary))
          : _error != null
              ? Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ErrorBox(message: _error!),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _fetchTrips, child: const Text('Retry')),
                  ],
                ))
              : _trips.isEmpty
                  ? Center(child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('🚗', style: TextStyle(fontSize: 56)),
                        const SizedBox(height: 12),
                        const Text('No rides yet', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                        const SizedBox(height: 6),
                        const Text('Your ride history will appear here', style: TextStyle(fontSize: 14, color: AppColors.textTertiary)),
                      ],
                    ))
                  : RefreshIndicator(
                      onRefresh: _fetchTrips,
                      color: AppColors.secondary,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _trips.length,
                        itemBuilder: (_, i) => _TripCard(trip: _trips[i]),
                      ),
                    ),
    );
  }
}

class _TripCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _TripCard({required this.trip});

  @override
  Widget build(BuildContext context) {
    final pickup = trip['pickup'] is Map ? trip['pickup'] : {};
    final dropoff = trip['dropoff'] is Map ? trip['dropoff'] : {};
    final fare = trip['fare'] ?? 0;
    final status = trip['status'] ?? 'completed';
    final rideType = trip['rideType'] ?? 'go';
    final date = trip['date'] ?? '';
    final captain = trip['captain'] is Map ? trip['captain'] : null;
    final isCancelled = status == 'cancelled';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        border: Border.all(color: isCancelled ? AppColors.danger.withValues(alpha: 0.3) : AppColors.border),
        borderRadius: AppRadius.xlBr,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(children: [
                Text('₹${fare is num ? fare.toStringAsFixed(0) : fare}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.secondary)),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isCancelled ? AppColors.danger.withValues(alpha: 0.15) : AppColors.secondary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    status.toString().toUpperCase(),
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: isCancelled ? AppColors.danger : AppColors.secondary),
                  ),
                ),
              ]),
              Text(rideType.toString().toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textTertiary)),
            ],
          ),
          const SizedBox(height: 12),

          // Route
          Row(children: [
            const LocationDot(isPickup: true),
            const SizedBox(width: 10),
            Expanded(child: Text(pickup['address'] ?? 'Pickup', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
          const SizedBox(height: 6),
          Row(children: [
            const LocationDot(isPickup: false),
            const SizedBox(width: 10),
            Expanded(child: Text(dropoff['address'] ?? 'Dropoff', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),

          // Captain info
          if (captain != null) ...[
            const SizedBox(height: 10),
            Row(children: [
              UcabAvatar(initial: (captain['name'] ?? 'C')[0], size: 28),
              const SizedBox(width: 8),
              Text(captain['name'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(width: 6),
              if (captain['rating'] != null)
                Text('⭐ ${captain['rating']}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            ]),
          ],

          // Date
          if (date.toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(_formatDate(date.toString()), style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
          ],
        ],
      ),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr).toLocal();
      return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateStr;
    }
  }
}
