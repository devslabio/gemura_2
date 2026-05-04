import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../shared/models/customer.dart';
import '../../../../core/services/customers_service.dart';

final customersServiceProvider = Provider<CustomersService>((ref) {
  return CustomersService();
});

final customersProvider = FutureProvider<List<Customer>>((ref) async {
  final customersService = ref.read(customersServiceProvider);
  return await customersService.getCustomers();
});

final customersNotifierProvider = StateNotifierProvider<CustomersNotifier, AsyncValue<List<Customer>>>((ref) {
  final customersService = ref.read(customersServiceProvider);
  return CustomersNotifier(customersService);
});

class CustomersNotifier extends StateNotifier<AsyncValue<List<Customer>>> {
  final CustomersService _customersService;

  CustomersNotifier(this._customersService) : super(const AsyncValue.loading()) {
    loadCustomers();
  }

  Future<void> loadCustomers() async {
    try {
      state = const AsyncValue.loading();
      final customers = await _customersService.getCustomers();
      state = AsyncValue.data(customers);
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<void> refreshCustomers() async {
    await loadCustomers();
  }

  Future<void> createCustomer({
    required String firstName,
    required String lastName,
    required String phone,
    String? email,
    String? nid,
    String? address,
    required double pricePerLiter,
  }) async {
    try {
      // Create the customer via API
      await _customersService.createCustomer(
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        email: email,
        nid: nid,
        address: address,
        pricePerLiter: pricePerLiter,
      );
      
      // Add a small delay to ensure the backend has processed the creation
      await Future.delayed(const Duration(milliseconds: 500));
      
      // Refresh the customers list to get the updated data
      await loadCustomers();
    } catch (error) {
      // Don't set the entire state to error if customer creation fails
      // Just rethrow the error to be handled by the UI
      rethrow;
    }
  }

  Future<void> getCustomerDetails(String customerId) async {
    try {
      final customerDetails = await _customersService.getCustomerDetails(customerId);
      
      state.whenData((customers) {
        final updatedCustomers = customers.map((customer) {
          if (customer.relationshipId == customerId) {
            return customer.copyWith(
              pricePerLiter: customerDetails.pricePerLiter,
              averageSupplyQuantity: customerDetails.averageSupplyQuantity,
              relationshipStatus: customerDetails.relationshipStatus,
            );
          }
          return customer;
        }).toList();
        state = AsyncValue.data(updatedCustomers);
      });
    } catch (error) {
      state = AsyncValue.error(error, StackTrace.current);
    }
  }

  Future<void> updateCustomerPrice({
    required String customerAccountCode, // Changed to accept account code
    required double pricePerLiter,
  }) async {
    try {
      // Update the customer price via API
      await _customersService.updateCustomerPrice(
        customerAccountCode: customerAccountCode,
        pricePerLiter: pricePerLiter,
      );
      
      // Refresh the customers list to get the updated data
      await loadCustomers();
    } catch (error) {
      // Don't set the entire state to error if update fails
      // Just rethrow the error to be handled by the UI
      rethrow;
    }
  }

  Future<void> deleteCustomer({
    required String customerAccountCode, // Changed to accept account code
  }) async {
    try {
      // Delete the customer via API
      await _customersService.deleteCustomer(
        customerAccountCode: customerAccountCode,
      );
      
      // Refresh the customers list to get the updated data
      await loadCustomers();
    } catch (error) {
      // Don't set the entire state to error if deletion fails
      // Just rethrow the error to be handled by the UI
      rethrow;
    }
  }
}
