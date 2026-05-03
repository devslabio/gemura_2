import 'package:flutter/material.dart';
import 'package:contacts_service/contacts_service.dart';
import '../../../../core/theme/app_theme.dart';

class ContactSelectionScreen extends StatefulWidget {
  const ContactSelectionScreen({super.key});

  @override
  State<ContactSelectionScreen> createState() => _ContactSelectionScreenState();
}

class _ContactSelectionScreenState extends State<ContactSelectionScreen> {
  List<Contact> _contacts = [];
  List<Contact> _selectedContacts = [];
  bool _isLoading = true;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadContacts();
  }

  Future<void> _loadContacts() async {
    try {
      final contacts = await ContactsService.getContacts();
      setState(() {
        _contacts = contacts.toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading contacts: $e'),
            backgroundColor: AppTheme.snackbarErrorColor,
          ),
        );
      }
    }
  }

  List<Contact> get _filteredContacts {
    if (_searchQuery.isEmpty) {
      return _contacts;
    }
    return _contacts.where((contact) {
      final name = (contact.displayName ?? '').toLowerCase();
      final phones = contact.phones?.map((p) => (p.value ?? '').toLowerCase()).join(' ') ?? '';
      final emails = contact.emails?.map((e) => (e.value ?? '').toLowerCase()).join(' ') ?? '';
      final query = _searchQuery.toLowerCase();
      
      return name.contains(query) || phones.contains(query) || emails.contains(query);
    }).toList();
  }

  void _toggleContactSelection(Contact contact) {
    setState(() {
      if (_selectedContacts.contains(contact)) {
        _selectedContacts.remove(contact);
      } else {
        _selectedContacts.add(contact);
      }
    });
  }

  void _sendSelectedContacts() {
    if (_selectedContacts.isNotEmpty) {
      Navigator.pop(context, _selectedContacts);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Select Contacts'),
        backgroundColor: AppTheme.surfaceColor,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimaryColor),
        actions: [
          if (_selectedContacts.isNotEmpty)
            TextButton(
              onPressed: _sendSelectedContacts,
              child: Text(
                'Send (${_selectedContacts.length})',
                style: AppTheme.bodyMedium.copyWith(
                  color: AppTheme.primaryColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Container(
            padding: const EdgeInsets.all(AppTheme.spacing16),
            child: TextField(
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                });
              },
              decoration: InputDecoration(
                hintText: 'Search contacts...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                ),
                filled: true,
                fillColor: AppTheme.surfaceColor,
              ),
            ),
          ),
          
          // Contacts list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredContacts.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.people_outline,
                              size: 64,
                              color: AppTheme.textSecondaryColor,
                            ),
                            const SizedBox(height: AppTheme.spacing16),
                            Text(
                              _searchQuery.isEmpty ? 'No contacts found' : 'No contacts match your search',
                              style: AppTheme.titleMedium.copyWith(
                                color: AppTheme.textSecondaryColor,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: _filteredContacts.length,
                        itemBuilder: (context, index) {
                          final contact = _filteredContacts[index];
                          final isSelected = _selectedContacts.contains(contact);
                          
                          return Container(
                            margin: const EdgeInsets.symmetric(
                              horizontal: AppTheme.spacing16,
                              vertical: AppTheme.spacing4,
                            ),
                            decoration: BoxDecoration(
                              color: AppTheme.surfaceColor,
                              borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                              border: Border.all(
                                color: isSelected 
                                    ? AppTheme.primaryColor 
                                    : AppTheme.thinBorderColor,
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: InkWell(
                              onTap: () => _toggleContactSelection(contact),
                              borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppTheme.spacing8,
                                  vertical: AppTheme.spacing4,
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.center,
                                  children: [
                                    Checkbox(
                                      value: isSelected,
                                      onChanged: (_) => _toggleContactSelection(contact),
                                      activeColor: AppTheme.primaryColor,
                                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                      visualDensity: VisualDensity.compact,
                                    ),
                                    CircleAvatar(
                                      backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                                      radius: 20,
                                      child: Text(
                                        ((contact.displayName ?? '').isNotEmpty
                                                ? (contact.displayName ?? '')[0].toUpperCase()
                                                : '?'),
                                        style: AppTheme.bodyMedium.copyWith(
                                          color: AppTheme.primaryColor,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: AppTheme.spacing12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(
                                            contact.displayName ?? 'Unknown Contact',
                                            style: AppTheme.bodyMedium.copyWith(
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          if (contact.phones?.isNotEmpty == true)
                                            Text(
                                              contact.phones!.first.value ?? '',
                                              style: AppTheme.bodySmall.copyWith(
                                                color: AppTheme.textSecondaryColor,
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
} 