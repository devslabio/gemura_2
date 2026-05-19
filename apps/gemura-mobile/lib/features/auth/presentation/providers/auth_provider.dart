import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:async';

import '../../../../core/services/auth_service.dart';
import '../../../../core/utils/auth_session_merge.dart';
import '../../../../core/services/secure_storage_service.dart';
import '../../../../shared/models/user.dart';
import '../../../../shared/models/registration_request.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AsyncValue<User?>>((ref) {
  return AuthNotifier();
});

class AuthNotifier extends StateNotifier<AsyncValue<User?>> {
  final AuthService _authService = AuthService();
  
  AuthNotifier() : super(const AsyncValue.loading()) {
    _init();
    _startTokenVerificationTimer();
  }

  Timer? _tokenVerificationTimer;

  void _startTokenVerificationTimer() {
    _tokenVerificationTimer?.cancel();
    _tokenVerificationTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      final isValid = await verifyToken();
      if (!isValid) {
        await signOut();
      }
    });
  }

  @override
  void dispose() {
    _tokenVerificationTimer?.cancel();
    super.dispose();
  }

  Future<void> _init() async {
    try {
      final isLoggedIn = SecureStorageService.getLoginState();
      final userData = SecureStorageService.getUserData();
      
      if (userData != null && isLoggedIn) {
        final user = User.fromJson(userData);
        
        // Only load the user if they are truly logged in (not a guest)
        if (!user.id.startsWith('guest_')) {
                  // Try to get fresh profile data from API to ensure we have the latest role and account info
        try {
          final profileResponse = await _authService.getProfile();
                                // print('🔍 DEBUG: Profile API Response: $profileResponse');
          if (profileResponse['data'] != null && profileResponse['data']['user'] != null) {
            final data = Map<String, dynamic>.from(profileResponse['data'] as Map);
            final rawUser = Map<String, dynamic>.from(data['user'] as Map);
            final merged = mergeAuthSessionUser(
              user: rawUser,
              account: data['account'] != null ? Map<String, dynamic>.from(data['account'] as Map) : null,
              accounts: data['accounts'] is List ? List<dynamic>.from(data['accounts'] as List) : null,
            );
            final updatedUser = User.fromJson(merged);
                      // print('🔍 DEBUG: Updated User Role: ${updatedUser.role}');
          // print('🔍 DEBUG: Updated User AccountCode: ${updatedUser.accountCode}');
            state = AsyncValue.data(updatedUser);
          } else {
            // print('🔍 DEBUG: No profile data, using cached user');
            state = AsyncValue.data(user);
          }
        } catch (e) {
          // If API call fails, use cached data
          // print('🔍 DEBUG: Profile API failed, using cached user: $e');
          state = AsyncValue.data(user);
        }
        } else {
          state = const AsyncValue.data(null);
        }
      } else {
        state = const AsyncValue.data(null);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> signInWithEmailAndPassword(String emailOrPhone, String password) async {
    try {
      state = const AsyncValue.loading();
      
      final response = await _authService.login(emailOrPhone, password);
      
      // Create user from API response
      final data = response['data'] as Map<String, dynamic>;
      final userData = Map<String, dynamic>.from(data['user'] as Map);
      final accountData = data['account'] != null ? Map<String, dynamic>.from(data['account'] as Map) : null;
      final accountsRaw = data['accounts'] is List ? List<dynamic>.from(data['accounts'] as List) : null;
      final merged = mergeAuthSessionUser(user: userData, account: accountData, accounts: accountsRaw);
      final user = User.fromJson(merged);
      
      // User data and token are already saved by AuthService
      
      // Login response already contains complete profile data, so we can use it directly
      state = AsyncValue.data(user);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
      rethrow;
    }
  }

  Future<void> signUpWithEmailAndPassword(
    String name,
    String accountName,
    String? email,
    String phoneNumber,
    String password,
    String role,
    String accountType, // New parameter
    String? nid,
  ) async {
    try {
      state = const AsyncValue.loading();
      
      // Create registration request (permissions will be set by API)
      final registrationRequest = RegistrationRequest(
        name: name,
        accountName: accountName.isNotEmpty ? accountName : name,
        email: email,
        phone: phoneNumber,
        password: password,
        nid: nid,
        role: role,
        accountType: accountType,
        permissions: const {},
      );
      
      await _authService.register(registrationRequest);
      
      // Registration successful, do not log in automatically
      state = const AsyncValue.data(null);
      
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
      rethrow;
    }
  }

  Future<void> signOut() async {
    try {
      await _authService.logout();
      state = const AsyncValue.data(null);
    } catch (e) {
      // Even if logout fails, clear local state
      state = const AsyncValue.data(null);
    }
  }

  Future<String?> getUserRole() async {
    final user = state.value;
    return user?.role;
  }

  Future<Map<String, dynamic>> requestPasswordReset({String? phone, String? email}) async {
    try {
      final response = await _authService.requestPasswordReset(phone: phone, email: email);
      return response;
    } catch (e) {
      rethrow;
    }
  }

  Future<void> resetPasswordWithCode(int userId, String code, String newPassword) async {
    try {
      await _authService.resetPasswordWithCode(userId, code, newPassword);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> updateUserProfile({
    String? name,
    String? email,
    String? password,
    String? about,
    String? profilePicture,
    String? profileCover,
    String? phoneNumber,
    String? address,
    String? profileImg,
    String? coverImg,
    // KYC Fields
    String? province,
    String? district,
    String? sector,
    String? cell,
    String? village,
    String? idNumber,
  }) async {
    try {
      print('🔧 AuthProvider: Starting updateUserProfile...');
      print('🔧 AuthProvider: Parameters - name: $name, email: $email, phone: $phoneNumber, address: $address');
      
      final currentUser = state.value;
      if (currentUser == null) {
        print('🔧 AuthProvider: No user logged in');
        throw Exception('No user logged in');
      }
      print('🔧 AuthProvider: Current user: ${currentUser.name}');

      final profileData = <String, dynamic>{};
      if (name != null && name.isNotEmpty) profileData['name'] = name;
      if (about != null && about.isNotEmpty) profileData['about'] = about;
      if (address != null && address.isNotEmpty) profileData['address'] = address;
      if (phoneNumber != null && phoneNumber.isNotEmpty) profileData['phone'] = phoneNumber;
      if (profileImg != null && profileImg.isNotEmpty) profileData['profile_img'] = profileImg;
      if (coverImg != null && coverImg.isNotEmpty) profileData['cover_img'] = coverImg;
      if (email != null && email.isNotEmpty) profileData['email'] = email;
      
      // KYC Fields
      if (province != null && province.isNotEmpty) profileData['province'] = province;
      if (district != null && district.isNotEmpty) profileData['district'] = district;
      if (sector != null && sector.isNotEmpty) profileData['sector'] = sector;
      if (cell != null && cell.isNotEmpty) profileData['cell'] = cell;
      if (village != null && village.isNotEmpty) profileData['village'] = village;
      if (idNumber != null && idNumber.isNotEmpty) profileData['id_number'] = idNumber;

      print('🔧 AuthProvider: Profile data to send: $profileData');

      final response = await _authService.updateProfile(profileData);
      print('🔧 AuthProvider: Service response: $response');
      
      // Update local user data
      if (response['data'] != null) {
        try {
          final userData = response['data']['user'] ?? response['data'];
          print('🔧 AuthProvider: User data from response: $userData');
          
          // Get account name from default account in response
          final accountData = response['data']['account'];
          if (accountData != null && accountData['name'] != null) {
            userData['accountName'] = accountData['name'];
            print('🔧 AuthProvider: Updated accountName from API: ${accountData['name']}');
          } else {
            // Fallback to current user's account name if not in response
            userData['accountName'] = currentUser.accountName;
            print('🔧 AuthProvider: Preserved accountName: ${currentUser.accountName}');
          }
          
          print('🔧 AuthProvider: About to call User.fromJson with data: $userData');
          User updatedUser = User.fromJson(userData);
          print('🔧 AuthProvider: Successfully created updated user: ${updatedUser.name}');
          
          // Validate the user object
          if (updatedUser.name.isEmpty) {
            print('🔧 AuthProvider: Warning - User name is empty, using fallback');
            // Create a fallback user with required fields
            final fallbackUser = updatedUser.copyWith(
              name: currentUser.name.isNotEmpty ? currentUser.name : 'User',
              email: updatedUser.email ?? currentUser.email ?? '',
              phoneNumber: updatedUser.phoneNumber ?? currentUser.phoneNumber ?? '',
              accountName: updatedUser.accountName ?? currentUser.accountName ?? '',
            );
            print('🔧 AuthProvider: Using fallback user: ${fallbackUser.name}');
            updatedUser = fallbackUser;
          }
          print('🔧 AuthProvider: Updated user details - email: ${updatedUser.email}, phone: ${updatedUser.phoneNumber}, accountName: ${updatedUser.accountName}');
          
          // Update the state with error handling
          try {
            print('🔧 AuthProvider: About to update state with user: ${updatedUser.name}');
            state = AsyncValue.data(updatedUser);
            print('🔧 AuthProvider: State updated successfully');
            
            // Add a small delay to ensure state propagation
            await Future.delayed(const Duration(milliseconds: 50));
            print('🔧 AuthProvider: State propagation delay completed');
          } catch (e) {
            print('🔧 AuthProvider: Error updating state: $e');
            // Keep the current state if update fails
            print('🔧 AuthProvider: Keeping current state');
          }
        } catch (e, stackTrace) {
          print('🔧 AuthProvider: Error parsing user data: $e');
          print('🔧 AuthProvider: Stack trace: $stackTrace');
          // If parsing fails, keep the current user and don't change state
          print('🔧 AuthProvider: Keeping current user: ${currentUser.name}');
          // Don't update state - keep the current user data
        }
      } else {
        print('🔧 AuthProvider: No data in response, keeping current user');
      }
      
      print('🔧 AuthProvider: Profile update completed successfully');
    } catch (e) {
      print('🔧 AuthProvider: Error updating profile: $e');
      // Don't change state to error - just rethrow the exception
      // This keeps the UI in the data state and lets the calling code handle the error
      rethrow;
    }
  }

  Future<void> deleteAccount() async {
    try {
      await SecureStorageService.clearAllCachedData();
      state = const AsyncValue.data(null);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }

  Future<void> clearAllData() async {
    try {
      await SecureStorageService.clearAllCachedData();
      state = const AsyncValue.data(null);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }

  Future<bool> isUserLoggedIn() async {
    try {
      return SecureStorageService.getLoginState();
    } catch (e) {
      return false;
    }
  }

  bool isGuestUser(User? user) {
    return user == null || user.id.startsWith('guest_');
  }

  Future<void> checkAuthState() async {
    // Implementation of checkAuthState method
  }

  Future<bool> verifyToken() async {
    try {
      final token = SecureStorageService.getAuthToken();
      if (token == null || token.isEmpty) return false;
      
      // Try to get profile to verify token is still valid
      await _authService.getProfile();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> refreshProfile() async {
    try {
      // Force refresh from API, ignore cache
      final profileResponse = await _authService.refreshProfile();
      print('🔧 AuthProvider: Profile response: $profileResponse');
      
      if (profileResponse['data'] != null && profileResponse['data']['user'] != null) {
        final userData = profileResponse['data']['user'];
        print('🔧 AuthProvider: User data from API: $userData');
        
        // Get account data from response if available
        final accountData = profileResponse['data']['account'];
        if (accountData != null) {
          userData['accountName'] = accountData['name']?.toString() ?? '';
          userData['accountCode'] = accountData['code']?.toString() ?? '';
          print('🔧 AuthProvider: Account data from API: ${accountData['name']}');
        }
        
        final updatedUser = User.fromJson(userData);
        print('🔧 AuthProvider: Parsed user: ${updatedUser.name} - ${updatedUser.phoneNumber} - ${updatedUser.email} - ${updatedUser.accountName}');
        
        // Force state update to trigger UI rebuild
        state = AsyncValue.data(updatedUser);
        print('✅ Profile refreshed successfully: ${updatedUser.name} with account: ${updatedUser.accountName}');
      } else {
        print('❌ AuthProvider: No user data in profile response');
      }
    } catch (e) {
      // If refresh fails, keep current user data but log the error
      print('❌ Failed to refresh profile: $e');
    }
  }
} 