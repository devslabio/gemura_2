import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../shared/models/account_access.dart';
import '../../../../shared/models/employee.dart';
import '../../../../core/services/employee_service.dart';

class AccountAccessNotifier extends StateNotifier<AsyncValue<List<AccountAccess>>> {
  AccountAccessNotifier() : super(const AsyncValue.loading());

  // Get all accounts user has access to
  Future<List<SharedAccount>> getUserAccounts(String userId) async {
    // TODO: Implement API call to get user's accessible accounts
    await Future.delayed(const Duration(seconds: 1));
    
    // Mock data for now
    return [
      SharedAccount(
        id: '1',
        originalOwnerId: userId,
        accountName: 'My Farm',
        accountType: 'primary',
        status: 'active',
        createdAt: DateTime.now(),
        accessList: [
          AccountAccess(
            id: '1',
            accountOwnerId: userId,
            grantedUserId: userId,
            role: AccountAccess.roleSystemAdmin,
            permissions: {
              'view': true,
              'edit': true,
              'delete': true,
              'share': true,
              'manage_users': true,
            },
            grantedAt: DateTime.now(),
          ),
        ],
      ),
    ];
  }

  // Grant access to another user
  Future<bool> grantAccess({
    required String accountId,
    required String targetUserId,
    required String role,
    required Map<String, dynamic> permissions,
    DateTime? expiresAt,
  }) async {
    try {
      // TODO: Implement API call to grant access
      await Future.delayed(const Duration(seconds: 1));
      
      // Mock success
      return true;
    } catch (e) {
      return false;
    }
  }

  // Revoke access
  Future<bool> revokeAccess(String accessId) async {
    try {
      return await EmployeeService().revokeEmployeeAccess(accessId);
    } catch (e) {
      print('Revoke access error: $e');
      return false;
    }
  }

  // Update access permissions
  Future<bool> updateAccess({
    required String accessId,
    required String role,
    required Map<String, dynamic> permissions,
  }) async {
    try {
      return await EmployeeService().updateEmployeeAccess(
        accessId: accessId,
        role: role,
        permissions: permissions.values.where((p) => p == true).map((p) => p.toString()).toList(),
      );
    } catch (e) {
      print('Update access error: $e');
      return false;
    }
  }

  // Get users who have access to the default account
  Future<List<Employee>> getAccountUsers() async {
    try {
      return await EmployeeService().getAccountEmployees();
    } catch (e) {
      print('Failed to get employees: $e');
      // Return empty list if API fails
      return [];
    }
  }

  // Register a new employee
  Future<bool> registerEmployee({
    required Map<String, dynamic> userData,
    required Map<String, dynamic> accountAccess,
  }) async {
    try {
      return await EmployeeService().registerEmployee(
        userData: userData,
        accountAccess: accountAccess,
      );
    } catch (e) {
      // Log error for debugging
      print('Employee registration error: $e');
      return false;
    }
  }
}

final accountAccessProvider = StateNotifierProvider<AccountAccessNotifier, AsyncValue<List<AccountAccess>>>(
  (ref) => AccountAccessNotifier(),
);

// Provider for current user's accessible accounts
final userAccountsProvider = FutureProvider.family<List<SharedAccount>, String>(
  (ref, userId) async {
    final notifier = ref.read(accountAccessProvider.notifier);
    return await notifier.getUserAccounts(userId);
  },
);

// Provider for account users
final accountUsersProvider = FutureProvider<List<Employee>>(
  (ref) async {
    final notifier = ref.read(accountAccessProvider.notifier);
    return await notifier.getAccountUsers();
  },
);
