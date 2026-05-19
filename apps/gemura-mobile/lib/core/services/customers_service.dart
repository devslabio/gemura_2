import 'package:dio/dio.dart';
import '../../features/customers/domain/customer_create_exception.dart';
import '../../features/customers/domain/customer_validation_parser.dart';
import '../../shared/models/customer.dart';
import '../../shared/utils/phone_validator.dart';
import 'authenticated_dio_service.dart';

class CustomersService {
  static final CustomersService _instance = CustomersService._internal();
  factory CustomersService() => _instance;
  CustomersService._internal();

  final Dio _dio = AuthenticatedDioService.instance;

  /// Get all customers for the authenticated user
  Future<List<Customer>> getCustomers() async {
    try {
      final response = await _dio.post(
        '/customers/get',
        data: {}, // NestJS uses POST but doesn't need token in body
      );

      if (response.statusCode == 200) {
        final data = response.data;
        // Check if the API response indicates success
        if (data['code'] == 200 || data['status'] == 'success') {
          final List<dynamic> customersData = data['data'] ?? [];
          return customersData.map((json) => Customer.fromApiResponse(json)).toList();
        } else {
          final errorMessage = data['message'] ?? 'Failed to get customers';
          // Check if the message contains success info but is still an error
          if (errorMessage.toString().toLowerCase().contains('successfully') && data['status'] != 'success') {
            throw Exception('Customer created but failed to refresh list. Please try again.');
          }
          throw Exception(errorMessage);
        }
      } else {
        throw Exception('Failed to get customers: ${response.statusCode}');
      }
    } on DioException catch (e) {
      String errorMessage = 'Failed to get customers. ';
      
      if (e.response?.statusCode == 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (e.response?.statusCode == 404) {
        errorMessage = 'Customers service not found.';
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
    } catch (e) {
      throw Exception('Unexpected error: $e');
    }
  }

  /// Create a new customer
  Future<void> createCustomer({
    required String firstName,
    required String lastName,
    required String phone,
    String? email,
    String? nid,
    String? address,
    double? pricePerLiter,
  }) async {
    try {
      final normalizedPhone = PhoneValidator.normalizeForApi(phone);
      final response = await _dio.post(
        '/customers',
        data: {
          'first_name': firstName,
          'last_name': lastName,
          'phone': normalizedPhone,
          if (email != null && email.isNotEmpty) 'email': email,
          if (nid != null && nid.isNotEmpty) 'nid': nid,
          if (address != null && address.isNotEmpty) 'address': address,
          if (pricePerLiter != null) 'price_per_liter': pricePerLiter,
        },
      );

      // Accept both 200 (OK) and 201 (Created) as success status codes
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        // Check if the API response indicates success
        if (data['code'] == 200 || data['code'] == 201 || data['status'] == 'success') {
          // API returns success, no need to return customer data
          return;
        } else {
          final fieldErrors = CustomerValidationParser.fieldErrorsFromResponse(data);
          throw CustomerCreateException(
            message: CustomerValidationParser.summaryMessage(
              fieldErrors,
              fallback: data['message']?.toString(),
            ),
            fieldErrors: fieldErrors,
          );
        }
      } else {
        throw const CustomerCreateException(
          message: 'Failed to create customer. Please try again.',
        );
      }
    } on CustomerCreateException {
      rethrow;
    } on DioException catch (e) {
      if (e.response?.statusCode == 400) {
        final fieldErrors = CustomerValidationParser.fieldErrorsFromResponse(e.response?.data);
        throw CustomerCreateException(
          message: CustomerValidationParser.summaryMessage(
            fieldErrors,
            fallback: 'Invalid customer data. Please check the highlighted fields.',
          ),
          fieldErrors: fieldErrors,
        );
      }

      final message = switch (e.response?.statusCode) {
        401 => 'Authentication failed. Please login again.',
        500 => 'Server error. Please try again later.',
        _ => null,
      };
      if (message != null) {
        throw CustomerCreateException(message: message);
      }
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        throw const CustomerCreateException(
          message: 'Connection timeout. Please check your internet connection.',
        );
      }
      if (e.type == DioExceptionType.connectionError) {
        throw const CustomerCreateException(
          message: 'No internet connection. Please check your network.',
        );
      }
      final backendMsg = e.response?.data?['message'];
      throw CustomerCreateException(
        message: backendMsg?.toString() ?? 'Failed to create customer. Please try again.',
      );
    } catch (e) {
      if (e is CustomerCreateException) rethrow;
      throw CustomerCreateException(message: 'Unexpected error: $e');
    }
  }

  /// Get customer details
  Future<Customer> getCustomerDetails(String customerCode) async {
    try {
      // NestJS uses GET /customers/:code
      final response = await _dio.get(
        '/customers/$customerCode',
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['code'] == 200 && data['status'] == 'success') {
          return Customer.fromApiResponse(data['data']);
        } else {
          throw Exception(data['message'] ?? 'Failed to get customer details');
        }
      } else {
        throw Exception('Failed to get customer details: ${response.statusCode}');
      }
    } on DioException catch (e) {
      String errorMessage = 'Failed to get customer details. ';
      
      if (e.response?.statusCode == 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (e.response?.statusCode == 404) {
        errorMessage = 'Customer not found.';
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
    } catch (e) {
      throw Exception('Unexpected error: $e');
    }
  }

  /// Update customer price per liter
  /// Note: customerAccountCode should be the customer account code (string), not relationship ID
  Future<void> updateCustomerPrice({
    required String customerAccountCode, // Changed from int relationId to String accountCode
    required double pricePerLiter,
  }) async {
    try {
      final response = await _dio.put(
        '/customers/update',
        data: {
          'customer_account_code': customerAccountCode,
          'price_per_liter': pricePerLiter,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['code'] == 200 && data['status'] == 'success') {
          return;
        } else {
          throw Exception(data['message'] ?? 'Failed to update customer');
        }
      } else {
        throw Exception('Failed to update customer: ${response.statusCode}');
      }
    } on DioException catch (e) {
      String errorMessage = 'Failed to update customer. ';
      
      if (e.response?.statusCode == 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (e.response?.statusCode == 404) {
        errorMessage = 'Customer relationship not found or not owned by this customer.';
      } else if (e.response?.statusCode == 400) {
        errorMessage = 'Invalid update data. Please check your input.';
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
    } catch (e) {
      throw Exception('Unexpected error: $e');
    }
  }

  /// Delete customer relationship
  /// Note: customerAccountCode should be the customer account code (string), not relationship ID
  Future<void> deleteCustomer({
    required String customerAccountCode, // Changed from int relationshipId to String accountCode
  }) async {
    try {
      // NestJS uses DELETE /customers/:code
      final response = await _dio.delete(
        '/customers/$customerAccountCode',
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['code'] == 200 && data['status'] == 'success') {
          return;
        } else {
          throw Exception(data['message'] ?? 'Failed to delete customer');
        }
      } else {
        throw Exception('Failed to delete customer: ${response.statusCode}');
      }
    } on DioException catch (e) {
      String errorMessage = 'Failed to delete customer. ';
      
      if (e.response?.statusCode == 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (e.response?.statusCode == 404) {
        errorMessage = 'Customer relationship not found or already inactive.';
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
    } catch (e) {
      throw Exception('Unexpected error: $e');
    }
  }
}
