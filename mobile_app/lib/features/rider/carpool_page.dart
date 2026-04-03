/// Carpool Page — view available carpool offers and create new ones.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/core/widgets.dart';
import 'package:ucab_mobile/features/auth/auth_provider.dart';
import 'package:ucab_mobile/networking/api_client.dart';
import 'package:ucab_mobile/core/constants.dart';

class CarpoolPage extends ConsumerStatefulWidget {
  const CarpoolPage({super.key});
  @override
  ConsumerState<CarpoolPage> createState() => _CarpoolPageState();
}

class _CarpoolPageState extends ConsumerState<CarpoolPage> {
  List<Map<String, dynamic>> _offers = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchOffers();
  }

  Future<void> _fetchOffers() async {
    setState(() => _loading = true);
    try {
      final resp = await ApiClient().dio.get(ApiConstants.carpoolOffers);
      if (mounted) {
        setState(() {
          _offers = List<Map<String, dynamic>>.from(resp.data?['offers'] ?? resp.data ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showCreateOffer() {
    final fromCtrl = TextEditingController();
    final toCtrl = TextEditingController();
    final seatsCtrl = TextEditingController(text: '2');
    final priceCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSecondary,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SheetHandle(),
              const SizedBox(height: 16),
              const Text('Offer a Carpool', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              const Text('Share your ride and split the cost', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 20),
              UcabTextField(label: '📍 From', hint: 'e.g. Hyderabad CBD', controller: fromCtrl),
              const SizedBox(height: 14),
              UcabTextField(label: '📍 To', hint: 'e.g. Airport', controller: toCtrl),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(child: UcabTextField(label: '💺 Seats', hint: '2', controller: seatsCtrl, keyboardType: TextInputType.number)),
                  const SizedBox(width: 14),
                  Expanded(child: UcabTextField(label: '💰 Price/seat', hint: '₹100', controller: priceCtrl, keyboardType: TextInputType.number)),
                ],
              ),
              const SizedBox(height: 20),
              UcabPrimaryButton(
                label: 'Create Offer 🚗',
                onPressed: () async {
                  if (fromCtrl.text.trim().isEmpty || toCtrl.text.trim().isEmpty) return;
                  try {
                    final user = ref.read(authProvider).user;
                    await ApiClient().dio.post(ApiConstants.carpoolCreate, data: {
                      'userId': user?.id,
                      'userName': user?.name,
                      'from': fromCtrl.text.trim(),
                      'to': toCtrl.text.trim(),
                      'seats': int.tryParse(seatsCtrl.text) ?? 2,
                      'pricePerSeat': double.tryParse(priceCtrl.text) ?? 0,
                    });
                    if (!mounted) return;
                    Navigator.pop(context);
                    _fetchOffers();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('✅ Carpool offer created!')),
                    );
                  } catch (_) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Failed to create offer')),
                      );
                    }
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(
        title: const Text('Carpool'),
        backgroundColor: AppColors.bgPrimary,
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
        actions: [
          IconButton(
            onPressed: _showCreateOffer,
            icon: const Icon(Icons.add_circle_outline, color: AppColors.secondary),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateOffer,
        backgroundColor: AppColors.secondary,
        foregroundColor: Colors.black,
        icon: const Icon(Icons.directions_car),
        label: const Text('Offer a Ride', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.secondary))
          : _offers.isEmpty
              ? Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('🚗', style: TextStyle(fontSize: 56)),
                    const SizedBox(height: 12),
                    const Text('No carpool offers', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                    const SizedBox(height: 6),
                    const Text('Be the first to share a ride!', style: TextStyle(fontSize: 14, color: AppColors.textTertiary)),
                  ],
                ))
              : RefreshIndicator(
                  onRefresh: _fetchOffers,
                  color: AppColors.secondary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _offers.length,
                    itemBuilder: (_, i) {
                      final offer = _offers[i];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 14),
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: AppColors.bgCard,
                          border: Border.all(color: AppColors.border),
                          borderRadius: AppRadius.xlBr,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(children: [
                                  UcabAvatar(initial: (offer['userName'] ?? offer['user_name'] ?? 'U')[0], size: 32),
                                  const SizedBox(width: 10),
                                  Text(offer['userName'] ?? offer['user_name'] ?? 'Driver', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                                ]),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: AppColors.secondary.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    '${offer['seats'] ?? offer['available_seats'] ?? '?'} seats',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.secondary),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            Row(children: [
                              const LocationDot(isPickup: true),
                              const SizedBox(width: 10),
                              Expanded(child: Text(offer['from'] ?? offer['origin'] ?? '', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
                            ]),
                            const SizedBox(height: 6),
                            Row(children: [
                              const LocationDot(isPickup: false),
                              const SizedBox(width: 10),
                              Expanded(child: Text(offer['to'] ?? offer['destination'] ?? '', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
                            ]),
                            if (offer['pricePerSeat'] != null || offer['price_per_seat'] != null) ...[
                              const SizedBox(height: 10),
                              Text('₹${offer['pricePerSeat'] ?? offer['price_per_seat']}/seat', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.secondary)),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
