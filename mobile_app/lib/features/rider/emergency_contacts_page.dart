/// Emergency Contacts Page — manage up to 5 emergency contacts.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ucab_mobile/core/theme.dart';
import 'package:ucab_mobile/core/widgets.dart';
import 'package:ucab_mobile/networking/api_client.dart';
import 'package:ucab_mobile/core/constants.dart';

class EmergencyContactsPage extends ConsumerStatefulWidget {
  const EmergencyContactsPage({super.key});
  @override
  ConsumerState<EmergencyContactsPage> createState() => _EmergencyContactsPageState();
}

class _EmergencyContactsPageState extends ConsumerState<EmergencyContactsPage> {
  List<Map<String, dynamic>> _contacts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchContacts();
  }

  Future<void> _fetchContacts() async {
    setState(() => _loading = true);
    try {
      final resp = await ApiClient().dio.get(ApiConstants.emergencyContacts);
      if (mounted) {
        setState(() {
          _contacts = List<Map<String, dynamic>>.from(resp.data?['contacts'] ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveContacts(List<Map<String, dynamic>> contacts) async {
    try {
      await ApiClient().dio.put(ApiConstants.emergencyContacts, data: {'contacts': contacts});
      _fetchContacts();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save contacts')),
        );
      }
    }
  }

  void _addContact() {
    if (_contacts.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 5 emergency contacts allowed')),
      );
      return;
    }
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSecondary,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SheetHandle(),
            const SizedBox(height: 16),
            const Text('Add Emergency Contact', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 16),
            UcabTextField(label: '👤 Name', hint: 'e.g. Mom', controller: nameCtrl),
            const SizedBox(height: 14),
            UcabTextField(label: '📱 Phone', hint: '+91 98765 43210', controller: phoneCtrl, keyboardType: TextInputType.phone),
            const SizedBox(height: 16),
            UcabPrimaryButton(
              label: 'Add Contact',
              onPressed: () {
                if (nameCtrl.text.trim().isEmpty || phoneCtrl.text.trim().isEmpty) return;
                final updated = [..._contacts, {'name': nameCtrl.text.trim(), 'phone': phoneCtrl.text.trim()}];
                _saveContacts(updated);
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _removeContact(int index) {
    final updated = [..._contacts]..removeAt(index);
    _saveContacts(updated);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(
        title: const Text('Emergency Contacts'),
        backgroundColor: AppColors.bgPrimary,
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
        actions: [
          IconButton(
            onPressed: _addContact,
            icon: const Icon(Icons.add_circle_outline, color: AppColors.secondary),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.secondary))
          : _contacts.isEmpty
              ? Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('🆘', style: TextStyle(fontSize: 56)),
                    const SizedBox(height: 12),
                    const Text('No emergency contacts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                    const SizedBox(height: 6),
                    const Text('Add contacts who should be notified in emergencies', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: AppColors.textTertiary)),
                    const SizedBox(height: 20),
                    ElevatedButton.icon(
                      onPressed: _addContact,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Add Contact'),
                    ),
                  ],
                ))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _contacts.length,
                  itemBuilder: (_, i) {
                    final c = _contacts[i];
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
                          UcabAvatar(initial: (c['name'] ?? 'U')[0], size: 40),
                          const SizedBox(width: 14),
                          Expanded(child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(c['name'] ?? '', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                              const SizedBox(height: 2),
                              Text(c['phone'] ?? '', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                            ],
                          )),
                          IconButton(
                            onPressed: () => _removeContact(i),
                            icon: const Icon(Icons.delete_outline, color: AppColors.danger, size: 22),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
