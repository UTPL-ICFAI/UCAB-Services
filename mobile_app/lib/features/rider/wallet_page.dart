/// Wallet Page — balance, transaction history, and top-up for riders.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/core/widgets.dart';
import 'package:ucab_mobile/features/auth/auth_provider.dart';
import 'package:ucab_mobile/networking/api_client.dart';
import 'package:ucab_mobile/core/constants.dart';

class WalletPage extends ConsumerStatefulWidget {
  const WalletPage({super.key});
  @override
  ConsumerState<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends ConsumerState<WalletPage> {
  double _balance = 0;
  int _loyaltyPoints = 0;
  List<Map<String, dynamic>> _transactions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchWalletData();
  }

  Future<void> _fetchWalletData() async {
    setState(() { _loading = true; });
    try {
      final user = ref.read(authProvider).user;
      if (user == null) return;

      // Fetch balance
      try {
        final balResp = await ApiClient().dio.get(ApiConstants.walletBalance, queryParameters: {'userId': user.id});
        _balance = _parseDouble(balResp.data?['balance']);
      } catch (_) {}

      // Fetch transaction history
      try {
        final histResp = await ApiClient().dio.get(ApiConstants.walletHistory, queryParameters: {'userId': user.id});
        _transactions = List<Map<String, dynamic>>.from(histResp.data?['transactions'] ?? []);
      } catch (_) {}

      // Fetch loyalty points
      try {
        final loyResp = await ApiClient().dio.get(ApiConstants.userLoyalty, queryParameters: {'userId': user.id});
        _loyaltyPoints = loyResp.data?['loyaltyPoints'] ?? 0;
      } catch (_) {}

      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  double _parseDouble(dynamic v) {
    if (v == null) return 0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  void _showTopUp() {
    final amountCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSecondary,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SheetHandle(),
            const SizedBox(height: 16),
            const Text('Top Up Wallet', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 16),
            UcabTextField(
              label: '💰 Amount',
              hint: 'Enter amount (e.g. 500)',
              controller: amountCtrl,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 8),
            // Quick amounts
            Row(
              children: [100, 200, 500, 1000].map((amt) {
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: OutlinedButton(
                      onPressed: () => amountCtrl.text = amt.toString(),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.secondary,
                        side: const BorderSide(color: AppColors.borderLight),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                      child: Text('₹$amt', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            UcabPrimaryButton(
              label: 'Add Money',
              onPressed: () async {
                final amount = double.tryParse(amountCtrl.text.trim());
                if (amount == null || amount <= 0) return;
                try {
                  final user = ref.read(authProvider).user;
                  await ApiClient().dio.post(ApiConstants.walletTopup, data: {
                    'userId': user?.id,
                    'amount': amount,
                  });
                  if (!mounted) return;
                  Navigator.pop(context);
                  _fetchWalletData();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('₹${amount.toStringAsFixed(0)} added to wallet!')),
                  );
                } catch (_) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Top-up failed. Try again.')),
                    );
                  }
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(
        title: const Text('Wallet'),
        backgroundColor: AppColors.bgPrimary,
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.secondary))
          : RefreshIndicator(
              onRefresh: _fetchWalletData,
              color: AppColors.secondary,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Balance card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: AppColors.greenGradient,
                      borderRadius: AppRadius.xlBr,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('WALLET BALANCE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white70, letterSpacing: 1)),
                        const SizedBox(height: 8),
                        Text('₹${_balance.toStringAsFixed(2)}', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: Colors.white)),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                onPressed: _showTopUp,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: Colors.black,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                child: const Text('+ Add Money', style: TextStyle(fontWeight: FontWeight.w700)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Loyalty points
                  UcabCard(
                    child: Row(
                      children: [
                        const Text('🏆', style: TextStyle(fontSize: 28)),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Loyalty Points', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                              const SizedBox(height: 4),
                              Text('$_loyaltyPoints points', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.gold)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Transaction history
                  const Text('TRANSACTION HISTORY', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5)),
                  const SizedBox(height: 12),

                  if (_transactions.isEmpty)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 32),
                        child: Text('No transactions yet', style: TextStyle(fontSize: 14, color: AppColors.textTertiary)),
                      ),
                    )
                  else
                    ..._transactions.map((tx) => _TransactionTile(tx: tx)),
                ],
              ),
            ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final Map<String, dynamic> tx;
  const _TransactionTile({required this.tx});

  @override
  Widget build(BuildContext context) {
    final type = tx['type']?.toString() ?? 'debit';
    final amount = tx['amount'] ?? 0;
    final desc = tx['description'] ?? '';
    final date = tx['created_at'] ?? tx['createdAt'] ?? '';
    final isCredit = type == 'credit';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: isCredit ? AppColors.secondary.withValues(alpha: 0.15) : AppColors.danger.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              isCredit ? Icons.arrow_downward : Icons.arrow_upward,
              color: isCredit ? AppColors.secondary : AppColors.danger,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(desc.toString(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text(_formatDate(date.toString()), style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
              ],
            ),
          ),
          Text(
            '${isCredit ? '+' : '-'}₹${amount is num ? amount.toStringAsFixed(0) : amount}',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: isCredit ? AppColors.secondary : AppColors.danger),
          ),
        ],
      ),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr).toLocal();
      return '${d.day}/${d.month}/${d.year}';
    } catch (_) {
      return dateStr;
    }
  }
}
