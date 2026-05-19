import 'package:dio/dio.dart';
import '../../features/suppliers/domain/supplier_create_exception.dart';
import '../../features/suppliers/domain/supplier_validation_parser.dart';
import '../../shared/models/supplier.dart';
import '../../shared/utils/phone_validator.dart';
import 'authenticated_dio_service.dart';

class SuppliersService {
  static final SuppliersService _instance = SuppliersService._internal();
  factory SuppliersService() => _instance;
  SuppliersService._internal();

  final Dio _dio = AuthenticatedDioService.instance;

  /// Get all suppliers for the authenticated user
  Future<List<Supplier>> getSuppliers() async {
    try {
      final response = await _dio.post(
        '/suppliers/get',
        data: {}, // NestJS uses POST but doesn't need token in body
      );

      if (response.statusCode == 200) {
        final data = response.data;
        // Check if the API response indicates success
        if (data['code'] == 200 || data['status'] == 'success') {
          final List<dynamic> suppliersData = data['data'] ?? [];
          return suppliersData.map((json) => Supplier.fromApiResponse(json)).toList();
        } else {
          final errorMessage = data['message'] ?? 'Failed to get suppliers';
          // Check if the message contains success info but is still an error
          if (errorMessage.toString().toLowerCase().contains('successfully') && data['status'] != 'success') {
            throw Exception('Supplier created but failed to refresh list. Please try again.');
          }
          throw Exception(errorMessage);
        }
      } else {
        throw Exception('Failed to get suppliers: ${response.statusCode}');
      }
    } on DioException catch (e) {
      String errorMessage = 'Failed to get suppliers. ';
      
      if (e.response?.statusCode == 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (e.response?.statusCode == 404) {
        errorMessage = 'Suppliers service not found.';
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

  /// Create a new supplier
  Future<void> createSupplier({
    required String firstName,
    required String lastName,
    required String phone,
    String? email,
    required String nid,
    String? address,
    required double pricePerLiter,
  }) async {
    try {
      final normalizedPhone = PhoneValidator.normalizeForApi(phone);
      final response = await _dio.post(
        '/suppliers/create',
        data: {
          'first_name': firstName,
          'last_name': lastName,
          'phone': normalizedPhone,
          if (email != null && email.isNotEmpty) 'email': email,
          'nid': nid,
          if (address != null && address.isNotEmpty) 'address': address,
          'price_per_liter': pricePerLiter,
        },
      );

      // Accept both 200 (OK) and 201 (Created) as success status codes
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        // Check if the API response indicates success
        if (data['code'] == 200 || data['code'] == 201 || data['status'] == 'success') {
          // API returns success, no need to return supplier data
          return;
        } else {
          final fieldErrors = SupplierValidationParser.fieldErrorsFromResponse(data);
          throw SupplierCreateException(
            message: SupplierValidationParser.summaryMessage(
              fieldErrors,
              fallback: data['message']?.toString(),
            ),
            fieldErrors: fieldErrors,
          );
        }
      } else {
        throw const SupplierCreateException(
          message: 'Failed to create supplier. Please try again.',
        );
      }
    } on SupplierCreateException {
      rethrow;
    } on DioException catch (e) {
      if (e.response?.statusCode == 400) {
        final fieldErrors = SupplierValidationParser.fieldErrorsFromResponse(e.response?.data);
        throw SupplierCreateException(
          message: SupplierValidationParser.summaryMessage(
            fieldErrors,
            fallback: 'Invalid supplier data. Please check the highlighted fields.',
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
        throw SupplierCreateException(message: message);
      }
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        throw const SupplierCreateException(
          message: 'Connection timeout. Please check your internet connection.',
        );
      }
      if (e.type == DioExceptionType.connectionError) {
        throw const SupplierCreateException(
          message: 'No internet connection. Please check your network.',
        );
      }
      final backendMsg = e.response?.data?['message'];
      throw SupplierCreateException(
        message: backendMsg?.toString() ?? 'Failed to create supplier. Please try again.',
      );
    } catch (e) {
      if (e is SupplierCreateException) rethrow;
      throw SupplierCreateException(message: 'Unexpected error: $e');
    }
  }

  /// Get supplier details
  Future<Supplier> getSupplierDetails(String supplierCode) async {
    try {
      // NestJS uses GET /suppliers/:code
      final response = await _dio.get(
        '/suppliers/$supplierCode',
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['code'] == 200 && data['status'] == 'success') {
          return Supplier.fromApiResponse(data['data']);
        } else {
          throw Exception(data['message'] ?? 'Failed to get supplier details');
        }
      } else {
        throw Exception('Failed to get supplier details: ${response.statusCode}');
      }
    } on DioException catch (e) {
      String errorMessage = 'Failed to get supplier details. ';
      
      if (e.response?.statusCode == 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (e.response?.statusCode == 404) {
        errorMessage = 'Supplier not found.';
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

  /// Update supplier price per liter
  /// Note: relationId should be the supplier account code (string), not relationship ID
  Future<void> updateSupplierPrice({
    required String supplierAccountCode, // Changed from int relationId to String accountCode
    required double pricePerLiter,
  }) async {
    try {
      final response = await _dio.put(
        '/suppliers/update',
        data: {
          'supplier_account_code': supplierAccountCode,
          'price_per_liter': pricePerLiter,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['code'] == 200 && data['status'] == 'success') {
          return;
        } else {
          throw Exception(data['message'] ?? 'Failed to update supplier');
        }
      } else {
        throw Exception('Failed to update supplier: ${response.statusCode}');
      }
    } on DioException catch (e) {
      String errorMessage = 'Failed to update supplier. ';
      
      if (e.response?.statusCode == 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (e.response?.statusCode == 404) {
        errorMessage = 'Supplier relationship not found or not owned by this customer.';
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

  /// Delete supplier relationship
  /// Note: supplierAccountCode should be the supplier account code (string), not relationship ID
  Future<void> deleteSupplier({
    required String supplierAccountCode, // Changed from int relationshipId to String accountCode
  }) async {
    try {
      // NestJS uses DELETE /suppliers/:code
      final response = await _dio.delete(
        '/suppliers/$supplierAccountCode',
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['code'] == 200 && data['status'] == 'success') {
          return;
        } else {
          throw Exception(data['message'] ?? 'Failed to delete supplier');
        }
      } else {
        throw Exception('Failed to delete supplier: ${response.statusCode}');
      }
    } on DioException catch (e) {
      String errorMessage = 'Failed to delete supplier. ';
      
      if (e.response?.statusCode == 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (e.response?.statusCode == 404) {
        errorMessage = 'Supplier relationship not found or already inactive.';
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
