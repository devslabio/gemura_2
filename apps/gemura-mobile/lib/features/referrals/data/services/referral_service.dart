import 'package:dio/dio.dart';
import '../../../../core/services/authenticated_dio_service.dart';

class ReferralService {
  static final Dio _dio = AuthenticatedDioService.instance;

  /// Get user's referral code
  static Future<Map<String, dynamic>> getReferralCode() async {
    try {
      final response = await _dio.get(
        '/referrals/get-code',
      );

      return response.data;
    } on DioException catch (e) {
      if (e.response != null) {
        return e.response!.data;
      }
      rethrow;
    }
  }

  /// Use a referral code
  static Future<Map<String, dynamic>> useReferralCode({
    required String referralCode,
  }) async {
    try {
      final response = await _dio.post(
        '/referrals/use-code',
        data: {
          'referralCode': referralCode,
        },
      );

      return response.data;
    } on DioException catch (e) {
      if (e.response != null) {
        return e.response!.data;
      }
      rethrow;
    }
  }

  /// Get referral statistics
  static Future<Map<String, dynamic>> getReferralStats() async {
    try {
      final response = await _dio.get(
        '/referrals/stats',
      );

      return response.data;
    } on DioException catch (e) {
      if (e.response != null) {
        return e.response!.data;
      }
      rethrow;
    }
  }

  /// Get points balance
  static Future<Map<String, dynamic>> getPointsBalance() async {
    try {
      final response = await _dio.get(
        '/points/balance',
      );

      return response.data;
    } on DioException catch (e) {
      if (e.response != null) {
        return e.response!.data;
      }
      rethrow;
    }
  }

  /// Onboard a new user
  static Future<Map<String, dynamic>> onboardUser({
    required String firstName,
    required String lastName,
    required String phoneNumber,
    required String password,
    String? email,
    String? location,
  }) async {
    try {
      final response = await _dio.post(
        '/onboard/create-user',
        data: {
          'first_name': firstName,
          'last_name': lastName,
          'phone_number': phoneNumber,
          'password': password,
          if (email != null) 'email': email,
          if (location != null) 'location': location,
        },
      );

      return response.data;
    } on DioException catch (e) {
      if (e.response != null) {
        return e.response!.data;
      }
      rethrow;
    }
  }
}
