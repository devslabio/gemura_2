import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';
import '../utils/auth_session_merge.dart';
import '../../shared/models/registration_request.dart';
import 'secure_storage_service.dart';
import 'authenticated_dio_service.dart';
import 'conversation_storage_service.dart';

class AuthService {
  final Dio _dio;
  final Dio _authenticatedDio;

  AuthService() 
    : _dio = AppConfig.dioInstance(),
      _authenticatedDio = AuthenticatedDioService.instance;

  /// Register a new user
  Future<Map<String, dynamic>> register(RegistrationRequest request) async {
    try {
      final response = await _dio.post(
        AppConfig.authEndpoint + '/register',
        data: request.toJson(),
      );
      
      // Cache user data and token if registration is successful
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data['data'];
        if (data != null) {
          // Save auth token
          if (data['user']?['token'] != null) {
            await SecureStorageService.saveAuthToken(data['user']['token']);
          }
          
          if (data['user'] != null) {
            final userMap = Map<String, dynamic>.from(data['user'] as Map);
            if (data['account'] != null) {
              final acc = Map<String, dynamic>.from(data['account'] as Map);
              userMap['accountCode'] = userMap['accountCode'] ?? acc['code'];
              userMap['accountName'] = userMap['accountName'] ?? acc['name'];
            }
            await SecureStorageService.saveUserData(userMap);
          }
          
          // Save login state
          await SecureStorageService.saveLoginState(true);
          
          // Refresh authenticated Dio instance with new token
          AuthenticatedDioService.refreshInstance();
        }
      }
      
      return response.data;
    } on DioException catch (e) {
      throw _handleDioError(e);
    } catch (e) {
      throw Exception('Registration failed: $e');
    }
  }

  /// Login user
  Future<Map<String, dynamic>> login(String emailOrPhone, String password) async {
    try {
      // Normalize phone number - remove + if present, backend will handle it
      String identifier = emailOrPhone;
      if (!identifier.contains('@')) {
        // It's a phone number - remove + and spaces, keep only digits
        identifier = identifier.replaceAll(RegExp(r'[^\d]'), '');
      }
      
      // Use identifier field as per API specification
      final loginData = {
        'identifier': identifier,
        'password': password,
      };
      
      if (kDebugMode) {
        print('🔧 AuthService: Login attempt with identifier: $identifier');
      }
      
      final response = await _dio.post(
        AppConfig.authEndpoint + '/login',
        data: loginData,
      );
      
      // Cache user data and token if login is successful
      if (response.statusCode == 200) {
        final data = response.data['data'];
        if (data != null) {
          // Save auth token
          if (data['user']?['token'] != null) {
            await SecureStorageService.saveAuthToken(data['user']['token']);
          }
          
          // Save merged user map: platform role from UserAccount + codes from default Account
          if (data['user'] != null) {
            final accountsList = data['accounts'] is List ? List<dynamic>.from(data['accounts'] as List) : null;
            final accountMap = data['account'] != null ? Map<String, dynamic>.from(data['account'] as Map) : null;
            final merged = mergeAuthSessionUser(
              user: Map<String, dynamic>.from(data['user'] as Map),
              account: accountMap,
              accounts: accountsList,
            );
            await SecureStorageService.saveUserData(merged);
          }
          
          // Save login state
          await SecureStorageService.saveLoginState(true);
          
          // Refresh authenticated Dio instance with new token
          AuthenticatedDioService.refreshInstance();
        }
      }
      
      return response.data;
    } on DioException catch (e) {
      if (kDebugMode) {
        print('🔧 AuthService: Login DioException: ${e.type}');
        print('🔧 AuthService: Message: ${e.message}');
        if (e.type == DioExceptionType.connectionTimeout || 
            e.type == DioExceptionType.connectionError) {
          print('🔧 AuthService: Server may be unreachable. Check network connection.');
        }
      }
      throw _handleDioError(e);
    } catch (e) {
      if (kDebugMode) {
        print('🔧 AuthService: Login general exception: $e');
      }
      throw Exception('Login failed: $e');
    }
  }

  /// Request password reset
  Future<Map<String, dynamic>> requestPasswordReset({String? phone, String? email}) async {
    try {
      final data = <String, dynamic>{};
      if (phone != null && phone.isNotEmpty) data['phone'] = phone;
      if (email != null && email.isNotEmpty) data['email'] = email;
      
      final response = await _dio.post(
        AppConfig.authEndpoint + '/forgot-password',
        data: data,
      );
      
      return response.data;
    } on DioException catch (e) {
      throw _handleDioError(e);
    } catch (e) {
      throw Exception('Request password reset failed: $e');
    }
  }

  /// Reset password with code
  Future<Map<String, dynamic>> resetPasswordWithCode(int userId, String resetCode, String newPassword) async {
    try {
      final response = await _dio.post(
        AppConfig.authEndpoint + '/reset-password',
        data: {
          'user_id': userId,
          'reset_code': resetCode,
          'new_password': newPassword,
        },
      );
      
      return response.data;
    } on DioException catch (e) {
      throw _handleDioError(e);
    } catch (e) {
      throw Exception('Reset password failed: $e');
    }
  }

  /// Logout user
  Future<void> logout() async {
    try {
      // Call logout endpoint with authenticated request
      await _authenticatedDio.post(AppConfig.authEndpoint + '/logout');
    } on DioException catch (e) {
      // Even if logout fails, clear local data
      await _clearLocalData();
      throw _handleDioError(e);
    } catch (e) {
      // Clear local data on any error
      await _clearLocalData();
      throw Exception('Logout failed: $e');
    }
  }
  
  /// Clear local data (token, user data, cache)
  Future<void> _clearLocalData() async {
    await SecureStorageService.removeAuthToken();
    await SecureStorageService.removeUserData();
    await SecureStorageService.removeLoginState();
    await SecureStorageService.clearAllCachedData();
    await ConversationStorageService.clearConversation();
    AuthenticatedDioService.clearInstance();
  }

  /// Get user profile
  Future<Map<String, dynamic>> getProfile() async {
    try {
      // Always fetch from API to ensure we have the latest data
      final response = await _authenticatedDio.get(
        AppConfig.apiBaseUrl + '/profile/get',
        options: Options(
          sendTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
        ),
      );
      
      // Cache the profile data
      if (response.statusCode == 200 && response.data['data'] != null) {
        final data = response.data['data'] as Map<String, dynamic>;
        final rawUser = data['user'];
        if (rawUser is Map<String, dynamic>) {
          final accountsList = data['accounts'] is List ? List<dynamic>.from(data['accounts'] as List) : null;
          final accountMap = data['account'] != null ? Map<String, dynamic>.from(data['account'] as Map) : null;
          final merged = mergeAuthSessionUser(
            user: Map<String, dynamic>.from(rawUser),
            account: accountMap,
            accounts: accountsList,
          );
          await SecureStorageService.saveUserData(merged);
        }
      }

      return response.data;
    } on DioException catch (e) {
      // If API call fails, try to get from cache as fallback
      final cachedUserData = SecureStorageService.getUserData();
      if (cachedUserData != null) {
        return {'data': cachedUserData};
      }
      throw _handleDioError(e);
    } catch (e) {
      throw Exception('Get profile failed: $e');
    }
  }

  /// Force refresh user profile from API (ignores cache)
  Future<Map<String, dynamic>> refreshProfile() async {
    try {
      // Get token for request body
      final token = SecureStorageService.getAuthToken();
      if (token == null || token.isEmpty) {
        if (kDebugMode) {
          print('🔧 AuthService: No authentication token found for profile refresh');
        }
        throw Exception('No authentication token found');
      }
      if (kDebugMode) {
        print('🔧 AuthService: Token found for profile refresh');
      }

      // Always fetch from API, ignore cache
      final response = await _authenticatedDio.get(
        AppConfig.apiBaseUrl + '/profile/get',
        options: Options(
          sendTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
        ),
      );
      
      // Cache the fresh profile data
      if (response.statusCode == 200 && response.data['data'] != null) {
        final data = response.data['data'] as Map<String, dynamic>;
        final rawUser = data['user'];
        if (rawUser is Map<String, dynamic>) {
          final accountsList = data['accounts'] is List ? List<dynamic>.from(data['accounts'] as List) : null;
          final accountMap = data['account'] != null ? Map<String, dynamic>.from(data['account'] as Map) : null;
          final merged = mergeAuthSessionUser(
            user: Map<String, dynamic>.from(rawUser),
            account: accountMap,
            accounts: accountsList,
          );
          await SecureStorageService.saveUserData(merged);
        }
      }

      return response.data;
    } on DioException catch (e) {
      print('Refresh profile DioException: ${e.message}');
      throw _handleDioError(e);
    } catch (e) {
      print('Refresh profile error: $e');
      throw Exception('Refresh profile failed: $e');
    }
  }

  /// Update user profile
  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> profileData) async {
    try {
      print('🔧 AuthService: Starting profile update...');
      print('🔧 AuthService: Profile data: $profileData');
      
      // v2 PHP APIs expect token in body
      final token = SecureStorageService.getAuthToken();
      if (token == null || token.isEmpty) {
        if (kDebugMode) {
          print('🔧 AuthService: No authentication token found');
        }
        throw Exception('No authentication token found');
      }
      if (kDebugMode) {
        print('🔧 AuthService: Token found');
      }

      // Token is in header via AuthenticatedDioService, not in body
      print('🔧 AuthService: Request body: $profileData');

      print('🔧 AuthService: Making API call to: ${AppConfig.apiBaseUrl}/profile/update');
      final response = await _authenticatedDio.put(
        AppConfig.apiBaseUrl + '/profile/update',
        data: profileData, // NestJS doesn't need token in body, it's in header
      );
      
      print('🔧 AuthService: Response status: ${response.statusCode}');
      print('🔧 AuthService: Response data: ${response.data}');
      
      if (response.statusCode == 200 && response.data['data'] != null) {
        final data = response.data['data'] as Map<String, dynamic>;
        final rawUser = data['user'];
        if (rawUser is Map<String, dynamic>) {
          final accountsList = data['accounts'] is List ? List<dynamic>.from(data['accounts'] as List) : null;
          final accountMap = data['account'] != null ? Map<String, dynamic>.from(data['account'] as Map) : null;
          final merged = mergeAuthSessionUser(
            user: Map<String, dynamic>.from(rawUser),
            account: accountMap,
            accounts: accountsList,
          );
          await SecureStorageService.saveUserData(merged);
        }
      }
      
      print('🔧 AuthService: Profile update completed successfully');
      return response.data;
    } on DioException catch (e) {
      print('🔧 AuthService: DioException occurred: ${e.message}');
      print('🔧 AuthService: DioException type: ${e.type}');
      print('🔧 AuthService: DioException response: ${e.response?.data}');
      print('🔧 AuthService: DioException status: ${e.response?.statusCode}');
      throw _handleDioError(e);
    } catch (e) {
      print('🔧 AuthService: General exception: $e');
      throw Exception('Update profile failed: $e');
    }
  }

  /// Handle Dio errors
  Exception _handleDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return Exception(AppConfig.networkErrorMessage);
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        final message = e.response?.data?['message'] ?? 'Server error';
        
        switch (statusCode) {
          case 400:
            return Exception('Bad request: $message');
          case 401:
            return Exception(AppConfig.authErrorMessage);
          case 403:
            return Exception('Access denied: $message');
          case 404:
            return Exception('Resource not found: $message');
          case 422:
            return Exception('Validation error: $message');
          case 500:
            return Exception(AppConfig.serverErrorMessage);
          default:
            return Exception('Error $statusCode: $message');
        }
      case DioExceptionType.cancel:
        return Exception('Request cancelled');
      case DioExceptionType.connectionError:
        return Exception(AppConfig.networkErrorMessage);
      default:
        return Exception('Network error: ${e.message}');
    }
  }
}
