import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:contacts_service/contacts_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../../shared/utils/national_id_validator.dart';
import '../../../../shared/utils/phone_validator.dart';
import '../../../../shared/widgets/phone_input_field.dart';
import '../../domain/supplier_create_exception.dart';
import '../../domain/supplier_form_fields.dart';
import '../../domain/supplier_validation_parser.dart';
import '../providers/suppliers_provider.dart';

class AddSupplierScreen extends ConsumerStatefulWidget {
  const AddSupplierScreen({super.key});

  @override
  ConsumerState<AddSupplierScreen> createState() => _AddSupplierScreenState();
}

class _AddSupplierScreenState extends ConsumerState<AddSupplierScreen> {
  final _formKey = GlobalKey<FormState>();
  final _scrollController = ScrollController();
  final _firstNameFieldKey = GlobalKey<FormFieldState<String>>();
  final _lastNameFieldKey = GlobalKey<FormFieldState<String>>();
  final _phoneFieldKey = GlobalKey<FormFieldState<String>>();
  final _phoneInputKey = GlobalKey<PhoneInputFieldState>();
  final _emailFieldKey = GlobalKey<FormFieldState<String>>();
  final _addressFieldKey = GlobalKey<FormFieldState<String>>();
  final _nidFieldKey = GlobalKey<FormFieldState<String>>();
  final _priceFieldKey = GlobalKey<FormFieldState<String>>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();
  final _nidController = TextEditingController();
  final _pricePerLiterController = TextEditingController();
  
  bool _isSubmitting = false;
  bool _showFieldValidation = false;
  String? _formBanner;
  Map<String, String> _apiFieldErrors = {};

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _nidController.dispose();
    _pricePerLiterController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _clearApiError(String field) {
    if (_apiFieldErrors.remove(field) == null) return;
    setState(() {
      if (_apiFieldErrors.isEmpty && _formKey.currentState?.validate() == true) {
        _formBanner = null;
      }
    });
    _formKey.currentState?.validate();
  }

  String? _validateField(
    String fieldKey,
    String? value,
    String? Function(String?) builtIn,
  ) {
    final apiMsg = _apiFieldErrors[fieldKey];
    if (apiMsg != null && apiMsg.isNotEmpty) return apiMsg;
    return builtIn(value);
  }

  String? _validateFirstName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'First name is required';
    }
    return null;
  }

  String? _validateLastName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Last name is required';
    }
    return null;
  }

  String? _validateEmail(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return null;
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v)) {
      return 'Enter a valid email address';
    }
    return null;
  }

  String? _validatePrice(String? value) {
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
  }

  String _missingRequiredSummary() {
    final missing = <String>[];
    if (_validateFirstName(_firstNameController.text) != null) {
      missing.add('First name');
    }
    if (_validateLastName(_lastNameController.text) != null) {
      missing.add('Last name');
    }
    if (PhoneValidator.validateLocalNineDigits(_phoneController.text) != null) {
      missing.add('Phone');
    }
    if (NationalIdValidator.validate(_nidController.text) != null) {
      missing.add('National ID');
    }
    if (_validatePrice(_pricePerLiterController.text) != null) {
      missing.add('Price per liter');
    }
    if (missing.isEmpty) {
      return 'Please fix the highlighted fields below.';
    }
    return 'Required: ${missing.join(', ')}';
  }

  void _scrollToFirstError() {
    final keys = [
      _firstNameFieldKey,
      _lastNameFieldKey,
      _phoneFieldKey,
      _emailFieldKey,
      _addressFieldKey,
      _nidFieldKey,
      _priceFieldKey,
    ];
    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final key in keys) {
        final field = key.currentState;
        if (field != null && field.hasError) {
          final ctx = field.context;
          if (ctx.mounted) {
            Scrollable.ensureVisible(
              ctx,
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
              alignment: 0.2,
            );
          }
          break;
        }
      }
    });
  }

  InputDecoration _fieldDecoration({
    required String hintText,
    required IconData icon,
    int? maxLength,
  }) {
    return InputDecoration(
      hintText: hintText,
      prefixIcon: Icon(icon),
      hintStyle: AppTheme.hintText,
      counterText: maxLength != null ? '' : null,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
        borderSide: BorderSide(
          color: AppTheme.thinBorderColor,
          width: AppTheme.thinBorderWidth,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
        borderSide: const BorderSide(color: AppTheme.primaryColor, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
        borderSide: const BorderSide(color: AppTheme.errorColor, width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
        borderSide: const BorderSide(color: AppTheme.errorColor, width: 2),
      ),
      filled: true,
      fillColor: AppTheme.surfaceColor,
    );
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
          setState(() {
            _phoneInputKey.currentState?.setPhoneFromContact(
              selectedContact.phones!.first.value ?? '',
            );
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
    setState(() {
      _showFieldValidation = true;
      _formBanner = null;
    });

    final valid = _formKey.currentState!.validate();
    if (!valid) {
      setState(() {
        _formBanner = _missingRequiredSummary();
      });
      _scrollToFirstError();
      return;
    }

    setState(() {
      _isSubmitting = true;
      _apiFieldErrors = {};
      _formBanner = null;
      });

      try {
        await ref.read(suppliersNotifierProvider.notifier).createSupplier(
          firstName: _firstNameController.text.trim(),
          lastName: _lastNameController.text.trim(),
        phone: PhoneValidator.normalizeForApi(_phoneController.text),
          email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
        nid: NationalIdValidator.digitsOnly(_nidController.text),
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
          Navigator.of(context).pop();
        }
    } on SupplierCreateException catch (error) {
      if (!mounted) return;
      setState(() {
        _apiFieldErrors = Map<String, String>.from(error.fieldErrors)
          ..remove('_form');
        _formBanner = error.fieldErrors['_form'] ??
            SupplierValidationParser.summaryMessage(error.fieldErrors);
      });
      _formKey.currentState!.validate();
      _scrollToFirstError();
      ScaffoldMessenger.of(context).showSnackBar(
        AppTheme.errorSnackBar(message: error.message),
      );
      } catch (error) {
      if (!mounted) return;
      final msg = error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
      setState(() {
        _formBanner = msg;
      });
          ScaffoldMessenger.of(context).showSnackBar(
        AppTheme.errorSnackBar(message: msg),
          );
      } finally {
        if (mounted) {
          setState(() {
            _isSubmitting = false;
          });
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
        autovalidateMode: _showFieldValidation
            ? AutovalidateMode.onUserInteraction
            : AutovalidateMode.disabled,
        child: SingleChildScrollView(
          controller: _scrollController,
          padding: const EdgeInsets.all(AppTheme.spacing16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_formBanner != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppTheme.spacing12),
                  decoration: BoxDecoration(
                    color: AppTheme.errorColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                    border: Border.all(color: AppTheme.errorColor.withValues(alpha: 0.35)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.error_outline, color: AppTheme.errorColor, size: 20),
                      const SizedBox(width: AppTheme.spacing8),
                      Expanded(
                        child: Text(
                          _formBanner!,
                          style: AppTheme.bodySmall.copyWith(color: AppTheme.errorColor),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppTheme.spacing12),
              ],
              TextFormField(
                key: _firstNameFieldKey,
                controller: _firstNameController,
                style: AppTheme.bodyMedium,
                textCapitalization: TextCapitalization.words,
                decoration: _fieldDecoration(
                  hintText: 'First name *',
                  icon: Icons.person,
                ),
                onChanged: (_) => _clearApiError(SupplierFormFields.firstName),
                validator: (value) => _validateField(
                  SupplierFormFields.firstName,
                  value,
                  _validateFirstName,
                ),
              ),
              const SizedBox(height: AppTheme.spacing12),
              TextFormField(
                key: _lastNameFieldKey,
                controller: _lastNameController,
                style: AppTheme.bodyMedium,
                textCapitalization: TextCapitalization.words,
                decoration: _fieldDecoration(
                  hintText: 'Last name *',
                  icon: Icons.person_outline,
                ),
                onChanged: (_) => _clearApiError(SupplierFormFields.lastName),
                validator: (value) => _validateField(
                  SupplierFormFields.lastName,
                  value,
                  _validateLastName,
                ),
              ),
              const SizedBox(height: AppTheme.spacing12),
              
              PhoneInputField(
                key: _phoneInputKey,
                fieldKey: _phoneFieldKey,
                      controller: _phoneController,
                rwandaOnly: true,
                decoration: _fieldDecoration(
                  hintText: 'Phone number *',
                  icon: Icons.phone_outlined,
                ).copyWith(prefixIcon: null),
                onChanged: (_) => _clearApiError(SupplierFormFields.phone),
                validator: (value) => _validateField(
                  SupplierFormFields.phone,
                  value,
                  PhoneValidator.validateLocalNineDigits,
                ),
                trailing: IconButton(
                      icon: const Icon(Icons.contacts, color: AppTheme.primaryColor),
                      tooltip: 'Select from contacts',
                      onPressed: _pickContact,
                    ),
              ),
              const SizedBox(height: AppTheme.spacing12),
              
              // Email field
              TextFormField(
                key: _emailFieldKey,
                controller: _emailController,
                style: AppTheme.bodyMedium,
                keyboardType: TextInputType.emailAddress,
                decoration: _fieldDecoration(
                  hintText: 'Email (optional)',
                  icon: Icons.email,
                ),
                onChanged: (_) => _clearApiError(SupplierFormFields.email),
                validator: (value) => _validateField(
                  SupplierFormFields.email,
                  value,
                  _validateEmail,
                ),
              ),
              const SizedBox(height: AppTheme.spacing12),
              
              // Address field
              TextFormField(
                key: _addressFieldKey,
                controller: _addressController,
                style: AppTheme.bodyMedium,
                decoration: _fieldDecoration(
                  hintText: 'Address (optional)',
                  icon: Icons.location_on,
                ),
                onChanged: (_) => _clearApiError(SupplierFormFields.address),
                validator: (value) => _validateField(
                  SupplierFormFields.address,
                  value,
                  (_) => null,
                ),
              ),
              const SizedBox(height: AppTheme.spacing12),
              
              // National ID field (required by API)
              TextFormField(
                key: _nidFieldKey,
                controller: _nidController,
                style: AppTheme.bodyMedium,
                keyboardType: TextInputType.number,
                maxLength: 16,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(16),
                ],
                decoration: _fieldDecoration(
                  hintText: 'National ID (16 digits, starts with 1) *',
                  icon: Icons.badge,
                  maxLength: 16,
                ),
                onChanged: (_) => _clearApiError(SupplierFormFields.nid),
                validator: (value) => _validateField(
                  SupplierFormFields.nid,
                  value,
                  NationalIdValidator.validate,
                ),
              ),
              const SizedBox(height: AppTheme.spacing12),
              
              // Price per liter field
              TextFormField(
                key: _priceFieldKey,
                controller: _pricePerLiterController,
                style: AppTheme.bodyMedium,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: _fieldDecoration(
                  hintText: 'Price per liter (RWF) *',
                  icon: Icons.attach_money,
                ),
                onChanged: (_) => _clearApiError(SupplierFormFields.pricePerLiter),
                validator: (value) => _validateField(
                  SupplierFormFields.pricePerLiter,
                  value,
                  _validatePrice,
                ),
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