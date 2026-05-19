import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import '../../../../core/theme/app_theme.dart';
import '../providers/auth_provider.dart';
import '../../../../shared/utils/snackbar_helper.dart';
import '../../../../shared/widgets/phone_input_field.dart';
import '../../../../shared/models/user.dart';
import '../../../../shared/utils/registration_defaults.dart';
import 'login_screen.dart';
import '../../../../shared/widgets/primary_button.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _accountNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _nidController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _phoneInputKey = GlobalKey<PhoneInputFieldState>();
  bool _isPasswordVisible = false;
  bool _isConfirmPasswordVisible = false;
  bool _isLoading = false;
  String _selectedAccountType = User.accountTypeMCC;

  @override
  void dispose() {
    _nameController.dispose();
    _accountNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _nidController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final phoneInputState = _phoneInputKey.currentState;
      final fullPhoneNumber = phoneInputState?.fullPhoneNumber ?? _phoneController.text.trim();
      
      final accountType = _selectedAccountType;
      await ref.read(authProvider.notifier).signUpWithEmailAndPassword(
            _nameController.text.trim(),
            _accountNameController.text.trim(),
            _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
            fullPhoneNumber,
            _passwordController.text,
            RegistrationDefaults.platformRoleForAccountType(accountType),
            accountType,
            _nidController.text.trim().isEmpty ? null : _nidController.text.trim(),
          );
      
      // Show success message
      if (mounted) {
        showIntentionSnackBar(
          context,
          'Registration successful! You can now login with your email or phone number.',
          intent: SnackBarIntent.success,
        );
        
        // Navigate to login screen after a short delay
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(
                builder: (context) => const LoginScreen(),
              ),
              (route) => false,
            );
          }
        });
      }
    } catch (e) {
      if (!mounted) return;
      String errorMessage = 'Registration failed. ';
      
      if (e is DioException) {
        final statusCode = e.response?.statusCode;
        final backendMsg = e.response?.data?['message'] ?? e.message;
        
        switch (statusCode) {
          case 400:
            if (backendMsg?.contains('required') == true) {
              errorMessage = 'Please fill in all required fields.';
            } else if (backendMsg?.contains('email') == true) {
              errorMessage = 'Please enter a valid email address.';
            } else if (backendMsg?.contains('phone') == true) {
              errorMessage = 'Please enter a valid phone number.';
            } else {
              errorMessage += backendMsg ?? 'Invalid request. Please check your input.';
            }
            break;
          case 409:
            errorMessage = 'An account with this email or phone already exists.';
            break;
          case 422:
            errorMessage = 'Invalid data format. Please check your input.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
          default:
            if (e.type == DioExceptionType.connectionTimeout ||
                e.type == DioExceptionType.receiveTimeout ||
                e.type == DioExceptionType.sendTimeout) {
              errorMessage = 'Connection timeout. Please check your internet connection.';
            } else if (e.type == DioExceptionType.connectionError) {
              errorMessage = 'No internet connection. Please check your network.';
            } else {
              errorMessage += backendMsg ?? 'Please try again.';
            }
        }
      } else {
        errorMessage += e.toString();
      }
      
      showIntentionSnackBar(
        context,
        errorMessage,
        intent: SnackBarIntent.error,
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppTheme.spacing24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo and Title
                  Image.asset(
                    'assets/images/logo.png',
                    height: 80,
                  ),
                  const SizedBox(height: AppTheme.spacing24),
                  Text(
                    'Create Account',
                    style: Theme.of(context).textTheme.displaySmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppTheme.spacing8),
                  Text(
                    'Sign up to get started',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: AppTheme.textSecondaryColor,
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppTheme.spacing32),

                  // Name Field
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Full Name',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your name';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppTheme.spacing16),

                  // Account Type Selection
                  DropdownButtonFormField<String>(
                    value: _selectedAccountType,
                    decoration: const InputDecoration(
                      labelText: 'Account Type *',
                      prefixIcon: Icon(Icons.business_outlined),
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      DropdownMenuItem(
                        value: User.accountTypeMCC,
                        child: Text(
                          'MCC (Milk Collection Center)',
                          style: AppTheme.bodyMedium,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      DropdownMenuItem(
                        value: User.accountTypeAgent,
                        child: Text(
                          'Agent',
                          style: AppTheme.bodyMedium,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      DropdownMenuItem(
                        value: User.accountTypeCollector,
                        child: Text(
                          'Collector (Abacunda)',
                          style: AppTheme.bodyMedium,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      DropdownMenuItem(
                        value: User.accountTypeVeterinarian,
                        child: Text(
                          'Veterinarian',
                          style: AppTheme.bodyMedium,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      DropdownMenuItem(
                        value: User.accountTypeSupplier,
                        child: Text(
                          'Supplier',
                          style: AppTheme.bodyMedium,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      DropdownMenuItem(
                        value: User.accountTypeCustomer,
                        child: Text(
                          'Customer',
                          style: AppTheme.bodyMedium,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      DropdownMenuItem(
                        value: User.accountTypeFarmer,
                        child: Text(
                          'Farmer',
                          style: AppTheme.bodyMedium,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),

                    ],
                    onChanged: (value) {
                      setState(() {
                        _selectedAccountType = value!;
                      });
                    },
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please select an account type';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppTheme.spacing16),

                  // Business Name Field
                  TextFormField(
                    controller: _accountNameController,
                    decoration: const InputDecoration(
                      labelText: 'Business Name (Optional)',
                      prefixIcon: Icon(Icons.business_outlined),
                      hintText: 'e.g., MCC Gicumbi, Dairy Farm Ltd',
                    ),
                    validator: (value) {
                      // Business name is optional, so no validation required
                      return null;
                    },
                  ),
                  const SizedBox(height: AppTheme.spacing16),

                  // Email Field (Optional)
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email (Optional)',
                      prefixIcon: Icon(Icons.email_outlined),
                      hintText: 'Enter your email address',
                    ),
                    validator: (value) {
                      if (value != null && value.isNotEmpty && !value.contains('@')) {
                        return 'Please enter a valid email';
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
                        return 'Please enter your phone number';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppTheme.spacing16),

                  // NID Field (Optional/Mandatory for agent candidates)
                  TextFormField(
                    controller: _nidController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'National ID (Optional)',
                      prefixIcon: Icon(Icons.badge_outlined),
                      hintText: 'Enter your National ID number',
                    ),
                    validator: (value) {
                      // NID is optional
                      return null;
                    },
                  ),
                  const SizedBox(height: AppTheme.spacing16),



                  // Password Field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: !_isPasswordVisible,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _isPasswordVisible
                              ? Icons.visibility_off
                              : Icons.visibility,
                        ),
                        onPressed: () {
                          setState(() {
                            _isPasswordVisible = !_isPasswordVisible;
                          });
                        },
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter a password';
                      }
                      if (value.length < 6) {
                        return 'Password must be at least 6 characters';
                      }
                      if (!RegExp(r'[A-Z]').hasMatch(value)) {
                        return 'Include at least one uppercase letter';
                      }
                      if (!RegExp(r'[0-9]').hasMatch(value)) {
                        return 'Include at least one number';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppTheme.spacing16),

                  // Confirm Password Field
                  TextFormField(
                    controller: _confirmPasswordController,
                    obscureText: !_isConfirmPasswordVisible,
                    decoration: InputDecoration(
                      labelText: 'Confirm Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _isConfirmPasswordVisible
                              ? Icons.visibility_off
                              : Icons.visibility,
                        ),
                        onPressed: () {
                          setState(() {
                            _isConfirmPasswordVisible = !_isConfirmPasswordVisible;
                          });
                        },
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please confirm your password';
                      }
                      if (value != _passwordController.text) {
                        return 'Passwords do not match';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppTheme.spacing24),

                  // Register Button
                  PrimaryButton(
                    label: 'Create Account',
                    isLoading: _isLoading,
                    onPressed: _isLoading ? null : _handleRegister,
                  ),
                  const SizedBox(height: AppTheme.spacing16),

                  // Already have an account? Login
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Already have an account?',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.of(context).pop();
                        },
                        child: const Text('Login'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
} 