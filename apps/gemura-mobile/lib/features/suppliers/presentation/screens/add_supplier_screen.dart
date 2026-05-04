import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:contacts_service/contacts_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../../shared/utils/phone_validator.dart';
import '../../../../shared/utils/rwandan_phone_input_formatter.dart';
import '../providers/suppliers_provider.dart';

class AddSupplierScreen extends ConsumerStatefulWidget {
  const AddSupplierScreen({super.key});

  @override
  ConsumerState<AddSupplierScreen> createState() => _AddSupplierScreenState();
}

class _AddSupplierScreenState extends ConsumerState<AddSupplierScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();
  final _nidController = TextEditingController();
  final _pricePerLiterController = TextEditingController();
  
  bool _isSubmitting = false;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _nidController.dispose();
    _pricePerLiterController.dispose();
    super.dispose();
  }

  void _applyDisplayNameFromContact(String? display) {
    final t = (display ?? '').trim();
    if (t.isEmpty) return;
    final i = t.indexOf(' ');
    if (i < 0) {
      _firstNameController.text = t;
      _lastNameController.text = '';
    } else {
      _firstNameController.text = t.substring(0, i).trim();
      _lastNameController.text = t.substring(i + 1).trim();
    }
  }

  Future<void> _pickContact() async {
    try {

      final contacts = await ContactsService.getContacts(withThumbnails: false);
      final contactsWithPhones = contacts.where((c) => (c.phones?.isNotEmpty ?? false)).toList();

      if (contactsWithPhones.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('No contacts with phone numbers found'),
              backgroundColor: AppTheme.snackbarErrorColor,
            ),
          );
        }
        return;
      }

      if (mounted) {
        final selectedContact = await showModalBottomSheet<Contact>(
          context: context,
          backgroundColor: AppTheme.surfaceColor,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          builder: (context) => _ContactPickerSheet(contacts: contactsWithPhones),
        );

        if (selectedContact != null && selectedContact.phones!.isNotEmpty) {
          final phone = selectedContact.phones!.first.value ?? '';
          setState(() {
            _phoneController.text = phone;
            if (_firstNameController.text.trim().isEmpty &&
                _lastNameController.text.trim().isEmpty) {
              _applyDisplayNameFromContact(selectedContact.displayName);
            }
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error accessing contacts: $e'),
            backgroundColor: AppTheme.snackbarErrorColor,
          ),
        );
      }
    }
  }

  void _saveSupplier() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isSubmitting = true;
      });

      try {
        await ref.read(suppliersNotifierProvider.notifier).createSupplier(
          firstName: _firstNameController.text.trim(),
          lastName: _lastNameController.text.trim(),
          phone: _phoneController.text.trim(),
          email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
          nid: _nidController.text.trim().isEmpty ? null : _nidController.text.trim(),
          address: _addressController.text.trim().isEmpty ? null : _addressController.text.trim(),
          pricePerLiter: double.parse(_pricePerLiterController.text),
        );

        if (mounted) {
          final addedName =
              '${_firstNameController.text.trim()} ${_lastNameController.text.trim()}'.trim();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Supplier "$addedName" added successfully!'),
              backgroundColor: AppTheme.snackbarSuccessColor,
            ),
          );

          // Navigate back to suppliers list screen
          Navigator.of(context).pop();
        }
      } catch (error) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to add supplier: ${error.toString()}'),
              backgroundColor: AppTheme.snackbarErrorColor,
            ),
          );
        }
      } finally {
        if (mounted) {
          setState(() {
            _isSubmitting = false;
          });
        }
      }
    }
  }

    @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Add Supplier'),
        backgroundColor: AppTheme.surfaceColor,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimaryColor),
        titleTextStyle: AppTheme.titleMedium.copyWith(color: AppTheme.textPrimaryColor),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTheme.spacing16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [

              TextFormField(
                controller: _firstNameController,
                style: AppTheme.bodyMedium,
                decoration: InputDecoration(
                  hintText: 'First name',
                  prefixIcon: const Icon(Icons.person),
                  hintStyle: AppTheme.hintText,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.primaryColor, width: 2),
                  ),
                  filled: true,
                  fillColor: AppTheme.surfaceColor,
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'First name is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppTheme.spacing12),
              TextFormField(
                controller: _lastNameController,
                style: AppTheme.bodyMedium,
                decoration: InputDecoration(
                  hintText: 'Last name',
                  prefixIcon: const Icon(Icons.person_outline),
                  hintStyle: AppTheme.hintText,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.primaryColor, width: 2),
                  ),
                  filled: true,
                  fillColor: AppTheme.surfaceColor,
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Last name is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppTheme.spacing12),
              
              // Phone number field with contact picker
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _phoneController,
                      style: AppTheme.bodyMedium,
                      keyboardType: TextInputType.phone,
                      inputFormatters: [
                        PhoneInputFormatter(),
                      ],
                      decoration: InputDecoration(
                        hintText: '250788123456',
                        prefixIcon: const Icon(Icons.phone),
                        hintStyle: AppTheme.hintText,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                          borderSide: BorderSide(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                          borderSide: BorderSide(color: AppTheme.primaryColor, width: 2),
                        ),
                        filled: true,
                        fillColor: AppTheme.surfaceColor,
                      ),
                      validator: PhoneValidator.validateRwandanPhone,
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacing8),
                  Container(
                    height: 56, // Match TextFormField height
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceColor,
                      borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                      border: Border.all(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.contacts, color: AppTheme.primaryColor),
                      tooltip: 'Select from contacts',
                      onPressed: _pickContact,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppTheme.spacing12),
              
              // Email field
              TextFormField(
                controller: _emailController,
                style: AppTheme.bodyMedium,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  hintText: 'Email (optional)',
                  prefixIcon: const Icon(Icons.email),
                  hintStyle: AppTheme.hintText,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.primaryColor, width: 2),
                  ),
                  filled: true,
                  fillColor: AppTheme.surfaceColor,
                ),
              ),
              const SizedBox(height: AppTheme.spacing12),
              
              // Address field
              TextFormField(
                controller: _addressController,
                style: AppTheme.bodyMedium,
                decoration: InputDecoration(
                  hintText: 'Address (optional)',
                  prefixIcon: const Icon(Icons.location_on),
                  hintStyle: AppTheme.hintText,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.primaryColor, width: 2),
                  ),
                  filled: true,
                  fillColor: AppTheme.surfaceColor,
                ),
              ),
              const SizedBox(height: AppTheme.spacing12),
              
              // National ID field
              TextFormField(
                controller: _nidController,
                style: AppTheme.bodyMedium,
                decoration: InputDecoration(
                  hintText: 'National ID (optional)',
                  prefixIcon: const Icon(Icons.badge),
                  hintStyle: AppTheme.hintText,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.primaryColor, width: 2),
                  ),
                  filled: true,
                  fillColor: AppTheme.surfaceColor,
                ),
              ),
              const SizedBox(height: AppTheme.spacing12),
              
              // Price per liter field
              TextFormField(
                controller: _pricePerLiterController,
                style: AppTheme.bodyMedium,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  hintText: 'Price per liter (RWF)',
                  prefixIcon: const Icon(Icons.attach_money),
                  hintStyle: AppTheme.hintText,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    borderSide: BorderSide(color: AppTheme.primaryColor, width: 2),
                  ),
                  filled: true,
                  fillColor: AppTheme.surfaceColor,
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Price per liter is required';
                  }
                  if (double.tryParse(value) == null) {
                    return 'Please enter a valid number';
                  }
                  if (double.parse(value) <= 0) {
                    return 'Price must be greater than 0';
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppTheme.spacing24),

              // Save Button
              PrimaryButton(
                onPressed: _isSubmitting ? null : _saveSupplier,
                label: _isSubmitting ? 'Adding Supplier...' : 'Add Supplier',
                isLoading: _isSubmitting,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Contact picker bottom sheet
class _ContactPickerSheet extends StatefulWidget {
  final List<Contact> contacts;

  const _ContactPickerSheet({required this.contacts});

  @override
  State<_ContactPickerSheet> createState() => _ContactPickerSheetState();
}

class _ContactPickerSheetState extends State<_ContactPickerSheet> {
  String _searchQuery = '';
  List<Contact> _filteredContacts = [];

  @override
  void initState() {
    super.initState();
    _filteredContacts = widget.contacts;
  }

  void _filterContacts(String query) {
    setState(() {
      _searchQuery = query;
      if (query.isEmpty) {
        _filteredContacts = widget.contacts;
      } else {
        _filteredContacts = widget.contacts.where((contact) {
          final name = (contact.displayName ?? '').toLowerCase();
          final phone = contact.phones?.map((p) => (p.value ?? '').toLowerCase()).join(' ') ?? '';
          final searchTerm = query.toLowerCase();
          return name.contains(searchTerm) || phone.contains(searchTerm);
        }).toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        height: MediaQuery.of(context).size.height * 0.95,
        decoration: BoxDecoration(
          color: AppTheme.surfaceColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle bar
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(top: 12),
              decoration: BoxDecoration(
                color: AppTheme.borderColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            
            // Header
            Padding(
              padding: const EdgeInsets.all(AppTheme.spacing16),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: Icon(Icons.close, color: AppTheme.textSecondaryColor),
                  ),
                  Expanded(
                    child: Text(
                      'Select Contact',
                      style: AppTheme.titleMedium.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimaryColor,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(width: 48), // Balance the close button
                ],
              ),
            ),
            
            // Search bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing16),
              child: Container(
                decoration: BoxDecoration(
                  color: AppTheme.backgroundColor,
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius24),
                ),
                child: TextField(
                  onChanged: _filterContacts,
                  style: AppTheme.bodyMedium,
                  decoration: InputDecoration(
                    hintText: 'Search contacts...',
                    hintStyle: AppTheme.hintText,
                    prefixIcon: Icon(Icons.search, color: AppTheme.textHintColor),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing16, vertical: AppTheme.spacing12),
                  ),
                ),
              ),
            ),
            
            const SizedBox(height: AppTheme.spacing8),
            
            // Contacts count
            if (_searchQuery.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing16, vertical: AppTheme.spacing4),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '${_filteredContacts.length} contact${_filteredContacts.length == 1 ? '' : 's'}',
                    style: AppTheme.bodySmall.copyWith(color: AppTheme.textHintColor),
                  ),
                ),
              ),
            
            // Contacts list
            Expanded(
              child: _filteredContacts.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _searchQuery.isEmpty ? Icons.people_outline : Icons.search_off,
                            size: 64,
                            color: AppTheme.textHintColor,
                          ),
                          const SizedBox(height: AppTheme.spacing16),
                          Text(
                            _searchQuery.isEmpty 
                                ? 'No contacts found'
                                : 'No contacts match "${_searchQuery}"',
                            style: AppTheme.bodyMedium.copyWith(color: AppTheme.textSecondaryColor),
                          ),
                          if (_searchQuery.isNotEmpty) ...[
                            const SizedBox(height: AppTheme.spacing8),
                            Text(
                              'Try a different search term',
                              style: AppTheme.bodySmall.copyWith(color: AppTheme.textHintColor),
                            ),
                          ],
                        ],
                      ),
                    )
                  : ListView.builder(
                      itemCount: _filteredContacts.length,
                      itemBuilder: (context, index) {
                        final contact = _filteredContacts[index];
                        final phone = contact.phones?.isNotEmpty == true 
                            ? contact.phones!.first.value ?? '' 
                            : '';
                        
                        return Container(
                          margin: const EdgeInsets.symmetric(horizontal: AppTheme.spacing16, vertical: 0),
                          decoration: BoxDecoration(
                            color: AppTheme.surfaceColor,
                            borderRadius: BorderRadius.circular(AppTheme.borderRadius4),
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing16, vertical: 2),
                            leading: CircleAvatar(
                              radius: 18,
                              backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                              child: Text(
                                (contact.displayName ?? '?')[0].toUpperCase(),
                                style: TextStyle(
                                  color: AppTheme.primaryColor,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                            title: Text(
                              contact.displayName ?? 'Unknown Contact',
                              style: AppTheme.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            subtitle: phone.isNotEmpty
                                ? Text(
                                    phone,
                                    style: AppTheme.bodySmall.copyWith(color: AppTheme.textHintColor),
                                  )
                                : null,
                            trailing: Icon(
                              Icons.arrow_forward_ios,
                              color: AppTheme.textHintColor,
                              size: 16,
                            ),
                            onTap: () => Navigator.of(context).pop(contact),
                          ),
                        );
                      },
                    ),
            ),
            
            const SizedBox(height: AppTheme.spacing16),
          ],
        ),
      ),
    );
  }
} 