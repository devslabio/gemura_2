import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../shared/widgets/phone_input_field.dart';
import '../../../../../shared/widgets/custom_app_bar.dart';
import '../../../../../shared/widgets/profile_completion_widget.dart';
import '../../../../../shared/widgets/kyc_photo_upload_widget.dart';
import '../../../../../shared/widgets/account_type_badge.dart';
import '../../../../../core/providers/localization_provider.dart';
import '../providers/user_accounts_provider.dart';
import 'home_screen.dart';


class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _phoneController;
  late final TextEditingController _nidController;
  late final TextEditingController _addressController;
  
  // KYC Controllers
  late final TextEditingController _provinceController;
  late final TextEditingController _districtController;
  late final TextEditingController _sectorController;
  late final TextEditingController _cellController;
  late final TextEditingController _villageController;
  late final TextEditingController _idNumberController;
  
  final _phoneInputKey = GlobalKey<PhoneInputFieldState>();
  bool _saving = false;
  
  // KYC Photo URLs
  String? _idFrontPhotoUrl;
  String? _idBackPhotoUrl;
  String? _selfiePhotoUrl;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).value;
    _nameController = TextEditingController(text: user?.name ?? '');
    _emailController = TextEditingController(text: user?.email ?? '');
    _phoneController = TextEditingController(text: _removeCountryCode(user?.phoneNumber ?? ''));
    _nidController = TextEditingController(text: ''); // NID not in current user model
    _addressController = TextEditingController(text: user?.address ?? '');
    
    // Initialize KYC controllers
    _provinceController = TextEditingController(text: user?.province ?? '');
    _districtController = TextEditingController(text: user?.district ?? '');
    _sectorController = TextEditingController(text: user?.sector ?? '');
    _cellController = TextEditingController(text: user?.cell ?? '');
    _villageController = TextEditingController(text: user?.village ?? '');
    _idNumberController = TextEditingController(text: user?.idNumber ?? '');
    
    // Initialize KYC photo URLs
    _idFrontPhotoUrl = user?.idFrontPhotoUrl;
    _idBackPhotoUrl = user?.idBackPhotoUrl;
    _selfiePhotoUrl = user?.selfiePhotoUrl;
  }

  String _removeCountryCode(String phoneNumber) {
    // Remove country code if it starts with 250 (Rwanda)
    if (phoneNumber.startsWith('250')) {
      return phoneNumber.substring(3);
    }
    return phoneNumber;
  }

  Color _getRoleColor(String role) {
    switch (role.toLowerCase()) {
      case 'owner':
      case 'system_admin':
        return AppTheme.successColor;
      case 'admin':
        return AppTheme.primaryColor;
      case 'supplier':
        return AppTheme.warningColor;
      case 'customer':
        return AppTheme.infoColor;
      default:
        return AppTheme.textSecondaryColor;
    }
  }

  IconData _getRoleIcon(String role) {
    switch (role.toLowerCase()) {
      case 'owner':
      case 'system_admin':
        return Icons.person_outline;
      case 'admin':
        return Icons.admin_panel_settings;
      case 'supplier':
        return Icons.local_shipping;
      case 'customer':
        return Icons.shopping_cart;
      default:
        return Icons.business_outlined;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _nidController.dispose();
    _addressController.dispose();
    
    // Dispose KYC controllers
    _provinceController.dispose();
    _districtController.dispose();
    _sectorController.dispose();
    _cellController.dispose();
    _villageController.dispose();
    _idNumberController.dispose();
    
    super.dispose();
  }

  void _saveProfile() async {
    print('🔧 EditProfileScreen: Starting _saveProfile...');
    if (!_formKey.currentState!.validate()) {
      print('🔧 EditProfileScreen: Form validation failed');
      return;
    }
    setState(() => _saving = true);
    
    // Add a small delay to ensure UI updates are processed
    await Future.delayed(const Duration(milliseconds: 100));
    
    try {
      final phoneInputState = _phoneInputKey.currentState;
      final fullPhoneNumber = phoneInputState?.fullPhoneNumber ?? _phoneController.text.trim();
      
      print('🔧 EditProfileScreen: Form data - name: ${_nameController.text.trim()}, email: ${_emailController.text.trim()}, phone: $fullPhoneNumber, address: ${_addressController.text.trim()}');
      
      await ref.read(authProvider.notifier).updateUserProfile(
        name: _nameController.text.trim(),
        email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
        phoneNumber: fullPhoneNumber,
        address: _addressController.text.trim(),
        // KYC Fields
        province: _provinceController.text.trim().isEmpty ? null : _provinceController.text.trim(),
        district: _districtController.text.trim().isEmpty ? null : _districtController.text.trim(),
        sector: _sectorController.text.trim().isEmpty ? null : _sectorController.text.trim(),
        cell: _cellController.text.trim().isEmpty ? null : _cellController.text.trim(),
        village: _villageController.text.trim().isEmpty ? null : _villageController.text.trim(),
        idNumber: _idNumberController.text.trim().isEmpty ? null : _idNumberController.text.trim(),
      );
      
      print('🔧 EditProfileScreen: Profile update successful');
      if (mounted) {
        try {
          ScaffoldMessenger.of(context).showSnackBar(
            AppTheme.successSnackBar(message: ref.read(localizationServiceProvider).translate('profileUpdatedSuccessfully')),
          );
          print('🔧 EditProfileScreen: About to navigate back');
          Navigator.pop(context);
          print('🔧 EditProfileScreen: Navigation completed');
        } catch (e) {
          print('🔧 EditProfileScreen: Error during navigation: $e');
          // Fallback navigation
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (context) => const HomeScreen()),
          );
        }
      }
    } catch (e) {
      print('🔧 EditProfileScreen: Error updating profile: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          AppTheme.errorSnackBar(message: ref.read(localizationServiceProvider).translate('failedToUpdateProfile')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizationService = ref.watch(localizationServiceProvider);
    final authState = ref.watch(authProvider);
    final userAccountsState = ref.watch(userAccountsNotifierProvider);
    
    // Get current account role and name
    String currentRole = 'User';
    String currentAccountName = '';
    userAccountsState.whenData((accountsResponse) {
      if (accountsResponse?.data.accounts.isNotEmpty == true) {
        final currentAccount = accountsResponse!.data.accounts.firstWhere(
          (account) => account.isDefault,
          orElse: () => accountsResponse.data.accounts.first,
        );
        currentRole = currentAccount.role.toUpperCase();
        currentAccountName = currentAccount.accountName;
      }
    });
    
    return authState.when(
      data: (user) {
        
        return Scaffold(
          backgroundColor: AppTheme.backgroundColor,
          appBar: CustomAppBar(
            title: localizationService.translate('editProfile'),
          ),
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppTheme.spacing16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Profile Completion Widget
                    if (user != null) ProfileCompletionWidget(user: user),
                    const SizedBox(height: AppTheme.spacing16),

                    // Full Name Field
                    TextFormField(
                      controller: _nameController,
                      decoration: InputDecoration(
                        labelText: localizationService.translate('fullName'),
                        prefixIcon: const Icon(Icons.person_outline),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return localizationService.translate('nameRequired');
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppTheme.spacing16),

                    // Business Name Field (Read Only)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceColor,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.borderColor, width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.borderColor.withOpacity(0.1),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: _getRoleColor(currentRole).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              _getRoleIcon(currentRole),
                              color: _getRoleColor(currentRole),
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  localizationService.translate('businessName'),
                                  style: AppTheme.bodySmall.copyWith(
                                    color: AppTheme.textSecondaryColor,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 12,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  currentAccountName.isNotEmpty 
                                    ? currentAccountName 
                                    : localizationService.translate('noBusinessName'),
                                  style: AppTheme.bodyMedium.copyWith(
                                    color: AppTheme.textPrimaryColor,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 16,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: _getRoleColor(currentRole).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              currentRole,
                              style: AppTheme.bodySmall.copyWith(
                                color: _getRoleColor(currentRole),
                                fontWeight: FontWeight.w600,
                                fontSize: 10,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          AccountTypeBadge(
                            accountType: user?.accountType ?? 'owner',
                            compact: true,
                            showIcon: false,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing16),

                    // Email Field (Optional)
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(
                        labelText: localizationService.translate('emailOptional'),
                        prefixIcon: const Icon(Icons.email_outlined),
                        hintText: localizationService.translate('emailHint'),
                      ),
                      validator: (value) {
                        if (value != null && value.isNotEmpty && !value.contains('@')) {
                          return localizationService.translate('validEmailRequired');
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppTheme.spacing16),

                    // Phone Field
                    PhoneInputField(
                      key: _phoneInputKey,
                      controller: _phoneController,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return localizationService.translate('phoneRequired');
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppTheme.spacing16),

                    // NID Field (Optional)
                    TextFormField(
                      controller: _nidController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: localizationService.translate('nationalIdOptional'),
                        prefixIcon: const Icon(Icons.badge_outlined),
                        hintText: localizationService.translate('nationalIdHint'),
                      ),
                      validator: (value) {
                        // NID is optional, so no validation required
                        return null;
                      },
                    ),
                    const SizedBox(height: AppTheme.spacing16),

                    // Address Field
                    TextFormField(
                      controller: _addressController,
                      decoration: InputDecoration(
                        labelText: localizationService.translate('address'),
                        prefixIcon: const Icon(Icons.location_on_outlined),
                        hintText: localizationService.translate('addressHint'),
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing16),
                    
                    // KYC Section Header
                    Container(
                      padding: const EdgeInsets.all(AppTheme.spacing12),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(AppTheme.borderRadiusMedium),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.verified_user,
                            color: AppTheme.primaryColor,
                            size: 20,
                          ),
                          const SizedBox(width: AppTheme.spacing8),
                          Text(
                            'KYC Information',
                            style: AppTheme.titleMedium.copyWith(
                              color: AppTheme.primaryColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing16),
                    
                    // Province Field
                    TextFormField(
                      controller: _provinceController,
                      decoration: InputDecoration(
                        labelText: 'Province',
                        prefixIcon: const Icon(Icons.location_city_outlined),
                        hintText: 'e.g., Northern Province',
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing16),
                    
                    // District Field
                    TextFormField(
                      controller: _districtController,
                      decoration: InputDecoration(
                        labelText: 'District',
                        prefixIcon: const Icon(Icons.location_city_outlined),
                        hintText: 'e.g., Gicumbi',
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing16),
                    
                    // Sector Field
                    TextFormField(
                      controller: _sectorController,
                      decoration: InputDecoration(
                        labelText: 'Sector',
                        prefixIcon: const Icon(Icons.location_city_outlined),
                        hintText: 'e.g., Gicumbi',
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing16),
                    
                    // Cell Field
                    TextFormField(
                      controller: _cellController,
                      decoration: InputDecoration(
                        labelText: 'Cell',
                        prefixIcon: const Icon(Icons.location_city_outlined),
                        hintText: 'e.g., Gicumbi',
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing16),
                    
                    // Village Field
                    TextFormField(
                      controller: _villageController,
                      decoration: InputDecoration(
                        labelText: 'Village',
                        prefixIcon: const Icon(Icons.location_city_outlined),
                        hintText: 'e.g., Gicumbi Town',
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing16),
                    
                    // ID Number Field
                    TextFormField(
                      controller: _idNumberController,
                      decoration: InputDecoration(
                        labelText: 'ID Number',
                        prefixIcon: const Icon(Icons.badge_outlined),
                        hintText: 'e.g., 119908457694884870',
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing16),
                    
                    // KYC Photo Upload Section
                    Container(
                      padding: const EdgeInsets.all(AppTheme.spacing12),
                      decoration: BoxDecoration(
                        color: AppTheme.warningColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(AppTheme.borderRadiusMedium),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.camera_alt,
                            color: AppTheme.warningColor,
                            size: 20,
                          ),
                          const SizedBox(width: AppTheme.spacing8),
                          Text(
                            'KYC Photo Upload',
                            style: AppTheme.titleMedium.copyWith(
                              color: AppTheme.warningColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing16),
                    
                    // ID Front Photo Upload
                    KYCPhotoUploadWidget(
                      photoType: 'id_front',
                      title: 'ID Front Photo',
                      currentPhotoUrl: _idFrontPhotoUrl,
                      onPhotoUploaded: (photoUrl) {
                        setState(() {
                          _idFrontPhotoUrl = photoUrl;
                        });
                      },
                    ),
                    
                    // ID Back Photo Upload
                    KYCPhotoUploadWidget(
                      photoType: 'id_back',
                      title: 'ID Back Photo',
                      currentPhotoUrl: _idBackPhotoUrl,
                      onPhotoUploaded: (photoUrl) {
                        setState(() {
                          _idBackPhotoUrl = photoUrl;
                        });
                      },
                    ),
                    
                    // Selfie Photo Upload
                    KYCPhotoUploadWidget(
                      photoType: 'selfie',
                      title: 'Selfie Photo',
                      currentPhotoUrl: _selfiePhotoUrl,
                      onPhotoUploaded: (photoUrl) {
                        setState(() {
                          _selfiePhotoUrl = photoUrl;
                        });
                      },
                    ),
                    const SizedBox(height: AppTheme.spacing32),

                    // Save Button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _saving ? null : _saveProfile,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          backgroundColor: AppTheme.primaryColor,
                          foregroundColor: AppTheme.surfaceColor,
                          textStyle: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _saving
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.surfaceColor))
                            : Text(localizationService.translate('saveChanges')),
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing24),
                  ],
                ),
              ),
            ),
          ),
        );
      },
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, stack) => Scaffold(
        body: Center(
          child: Text('Error: $error'),
        ),
      ),
    );
  }
} 