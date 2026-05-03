import 'package:dio/dio.dart';
import '../../shared/models/overview.dart';
import 'authenticated_dio_service.dart';

class OverviewService {
  static final OverviewService _instance = OverviewService._internal();
  factory OverviewService() => _instance;
  OverviewService._internal();

  final Dio _dio = AuthenticatedDioService.instance;

  /// Get overview data for the authenticated user
  Future<Overview> getOverview({
    String? dateFrom,
    String? dateTo,
  }) async {
    try {
      final Map<String, dynamic> requestData = {};

      if (dateFrom != null) {
        requestData['date_from'] = dateFrom;
      }
      if (dateTo != null) {
        requestData['date_to'] = dateTo;
      }
      if (dateFrom != null && dateTo != null) {
        requestData['tz_offset_minutes'] = DateTime.now().timeZoneOffset.inMinutes;
      }

      print('📊 OverviewService: Fetching overview data');
      print('📊 OverviewService: Request data: $requestData');

      final response = await _dio.post(
        '/stats/overview',
        data: requestData,
      );

      print('📊 OverviewService: Response status: ${response.statusCode}');
      print('📊 OverviewService: Response data keys: ${response.data?.keys}');

      // Accept both 200 (OK) and 201 (Created) status codes
      // The important check is the response data structure
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        if (data['code'] == 200 || data['status'] == 'success') {
          print('📊 OverviewService: Parsing overview data...');
          try {
            print('📊 OverviewService: Data keys: ${data['data']?.keys}');
            print('📊 OverviewService: Data summary: ${data['data']?['summary']}');
            print('📊 OverviewService: Data breakdown: ${data['data']?['breakdown']}');
            print('📊 OverviewService: Data breakdown type: ${data['data']?['breakdown_type']}');
            print('📊 OverviewService: Data date_range: ${data['data']?['date_range']}');
            final overview = Overview.fromJson(data['data']);
            print('📊 OverviewService: Successfully parsed overview data');
            return overview;
          } catch (parseError, stackTrace) {
            print('❌ OverviewService: JSON parsing error: $parseError');
            print('❌ OverviewService: Stack trace: $stackTrace');
            print('❌ OverviewService: Full data structure: ${data['data']}');
            throw Exception('Failed to parse overview data: $parseError');
          }
        } else {
          print('❌ OverviewService: API returned error: ${data['message']}');
          throw Exception(data['message'] ?? 'Failed to get overview data');
        }
      } else {
        print('❌ OverviewService: Unexpected status code: ${response.statusCode}');
        throw Exception('Failed to get overview data: ${response.statusCode}');
      }
    } on DioException catch (e) {
      print('❌ OverviewService: DioException occurred');
      print('❌ OverviewService: Type: ${e.type}');
      print('❌ OverviewService: Status code: ${e.response?.statusCode}');
      print('❌ OverviewService: Response: ${e.response?.data}');
      print('❌ OverviewService: Message: ${e.message}');
      
      String errorMessage = 'Failed to get overview data. ';
      
      if (e.response?.statusCode == 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (e.response?.statusCode == 404) {
        errorMessage = 'Overview service not found.';
      } else if (e.response?.statusCode == 400) {
        // Check if it's the "no default account" error
        final backendMsg = e.response?.data?['message'] ?? '';
        if (backendMsg.contains('default account') || backendMsg.contains('No valid default account')) {
          errorMessage = 'No default account selected. Please select an account first.';
        } else {
          errorMessage = 'Invalid request. ${backendMsg.isNotEmpty ? backendMsg : "Please check your input."}';
        }
      } else if (e.response?.statusCode == 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (e.type == DioExceptionType.connectionTimeout ||
                 e.type == DioExceptionType.receiveTimeout ||
                 e.type == DioExceptionType.sendTimeout) {
        errorMessage = 'Connection timeout. Please check your internet connection.';
      } else if (e.type == DioExceptionType.connectionError) {
        errorMessage = 'No internet connection. Please check your network.';
      } else {
        final backendMsg = e.response?.data?['message'];
        errorMessage += backendMsg ?? 'Please try again.';
      }
      
      throw Exception(errorMessage);
    } catch (e, stackTrace) {
      print('❌ OverviewService: Unexpected error: $e');
      print('❌ OverviewService: Stack trace: $stackTrace');
      throw Exception('Unexpected error: $e');
    }
  }
}
