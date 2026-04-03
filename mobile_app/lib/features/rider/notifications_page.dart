/// Notifications Page — in-app notification feed.
library;

import 'package:flutter/material.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/networking/api_client.dart';
import 'package:ucab_mobile/core/constants.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
  }

  Future<void> _fetchNotifications() async {
    setState(() => _loading = true);
    try {
      final resp = await ApiClient().dio.get(ApiConstants.notifications);
      if (mounted) {
        setState(() {
          _notifications = List<Map<String, dynamic>>.from(resp.data?['notifications'] ?? resp.data ?? []);
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
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: AppColors.bgPrimary,
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.secondary))
          : _notifications.isEmpty
              ? const Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('🔔', style: TextStyle(fontSize: 56)),
                    SizedBox(height: 12),
                    Text('No notifications', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                    SizedBox(height: 6),
                    Text("You're all caught up!", style: TextStyle(fontSize: 14, color: AppColors.textTertiary)),
                  ],
                ))
              : RefreshIndicator(
                  onRefresh: _fetchNotifications,
                  color: AppColors.secondary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _notifications.length,
                    itemBuilder: (_, i) {
                      final n = _notifications[i];
                      final isRead = n['is_read'] == true || n['isRead'] == true;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isRead ? AppColors.bgCard : const Color(0xFF0D1A0D),
                          border: Border.all(color: isRead ? AppColors.border : AppColors.secondary.withValues(alpha: 0.3)),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(children: [
                          Icon(Icons.notifications, color: isRead ? AppColors.textTertiary : AppColors.secondary, size: 22),
                          const SizedBox(width: 14),
                          Expanded(child: Text(n['message'] ?? '', style: TextStyle(fontSize: 14, fontWeight: isRead ? FontWeight.w500 : FontWeight.w700, color: AppColors.textPrimary), maxLines: 2, overflow: TextOverflow.ellipsis)),
                          if (!isRead) Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppColors.secondary, shape: BoxShape.circle)),
                        ]),
                      );
                    },
                  ),
                ),
    );
  }
}
