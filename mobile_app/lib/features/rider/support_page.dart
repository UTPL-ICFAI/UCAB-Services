/// Support Page — submit support tickets and view history.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/core/widgets.dart';
import 'package:ucab_mobile/features/auth/auth_provider.dart';
import 'package:ucab_mobile/networking/api_client.dart';
import 'package:ucab_mobile/core/constants.dart';

class SupportPage extends ConsumerStatefulWidget {
  const SupportPage({super.key});
  @override
  ConsumerState<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends ConsumerState<SupportPage> {
  final _subjectCtrl = TextEditingController();
  final _messageCtrl = TextEditingController();
  bool _submitting = false;
  List<Map<String, dynamic>> _tickets = [];
  bool _loadingTickets = true;

  @override
  void initState() {
    super.initState();
    _fetchTickets();
  }

  @override
  void dispose() {
    _subjectCtrl.dispose();
    _messageCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchTickets() async {
    try {
      final user = ref.read(authProvider).user;
      if (user == null) return;
      final resp = await ApiClient().dio.get(
        ApiConstants.supportTickets,
        queryParameters: {'userId': user.id},
      );
      if (mounted) {
        setState(() {
          _tickets = List<Map<String, dynamic>>.from(resp.data?['tickets'] ?? []);
          _loadingTickets = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingTickets = false);
    }
  }

  Future<void> _submitTicket() async {
    if (_subjectCtrl.text.trim().isEmpty || _messageCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Subject and message are required')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final user = ref.read(authProvider).user;
      await ApiClient().dio.post(ApiConstants.supportTicket, data: {
        'userId': user?.id,
        'userName': user?.name,
        'userPhone': user?.phone,
        'subject': _subjectCtrl.text.trim(),
        'message': _messageCtrl.text.trim(),
      });
      _subjectCtrl.clear();
      _messageCtrl.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Ticket submitted successfully!')),
        );
        _fetchTickets();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to submit ticket')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(
        title: const Text('Support'),
        backgroundColor: AppColors.bgPrimary,
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Submit new ticket
          UcabCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('📬 New Ticket', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 4),
                const Text('Describe your issue and we\'ll get back to you', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                const SizedBox(height: 16),
                UcabTextField(label: 'Subject', hint: 'e.g. Payment not received', controller: _subjectCtrl),
                const SizedBox(height: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('MESSAGE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _messageCtrl,
                      maxLines: 4,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 15),
                      decoration: const InputDecoration(hintText: 'Describe your issue in detail...'),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                UcabPrimaryButton(
                  label: 'Submit Ticket',
                  isLoading: _submitting,
                  onPressed: _submitTicket,
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Ticket history
          const Text('YOUR TICKETS', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5)),
          const SizedBox(height: 12),

          if (_loadingTickets)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator(color: AppColors.secondary)))
          else if (_tickets.isEmpty)
            const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Text('No tickets yet', style: TextStyle(color: AppColors.textTertiary))))
          else
            ..._tickets.map((t) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.bgCard,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(child: Text(t['subject'] ?? '', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: (t['status'] == 'resolved') ? AppColors.secondary.withValues(alpha: 0.15) : AppColors.warning.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          (t['status'] ?? 'open').toString().toUpperCase(),
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: (t['status'] == 'resolved') ? AppColors.secondary : AppColors.warning),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(t['message'] ?? '', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
              ),
            )),
        ],
      ),
    );
  }
}
