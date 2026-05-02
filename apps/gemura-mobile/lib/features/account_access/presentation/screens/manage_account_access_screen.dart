import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';

import '../../../../shared/widgets/custom_app_bar.dart';
import '../providers/account_access_provider.dart';
import '../../../../shared/models/account_access.dart';
import '../../../../shared/models/employee.dart';
import '../../../../features/home/presentation/providers/user_accounts_provider.dart';
import 'register_employee_screen.dart';

class ManageAccountAccessScreen extends ConsumerStatefulWidget {
  const ManageAccountAccessScreen({
    super.key,
  });

  @override
  ConsumerState<ManageAccountAccessScreen> createState() => _ManageAccountAccessScreenState();
}

class _ManageAccountAccessScreenState extends ConsumerState<ManageAccountAccessScreen> {
  
  @override
  Widget build(BuildContext context) {
    final accountUsersAsync = ref.watch(accountUsersProvider);

    return Scaffold(
      appBar: CustomAppBar(
        title: 'Manage Employees',
        actions: [
          IconButton(
            onPressed: () => _navigateToRegisterEmployee(),
            icon: Icon(
              Icons.person_add,
              color: AppTheme.primaryColor,
            ),
            tooltip: 'Register Employee',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          // Invalidate the provider to refresh data
          ref.invalidate(accountUsersProvider);
        },
        child: accountUsersAsync.when(
          data: (users) => _buildUsersList(users),
          loading: () => const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: AppTheme.spacing16),
                Text(
                  'Loading employees...',
                  style: AppTheme.bodyMedium,
                ),
              ],
            ),
          ),
          error: (error, stack) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 48,
                  color: AppTheme.errorColor,
                ),
                const SizedBox(height: AppTheme.spacing16),
                Text(
                  'Failed to load employees',
                  style: AppTheme.titleMedium.copyWith(
                    color: AppTheme.textPrimaryColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: AppTheme.spacing8),
                Text(
                  'Pull down to refresh',
                  style: AppTheme.bodySmall.copyWith(
                    color: AppTheme.textSecondaryColor,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildUsersList(List<Employee> employees) {
    if (employees.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.people_outline,
              size: 64,
              color: AppTheme.textSecondaryColor.withOpacity(0.5),
            ),
            const SizedBox(height: AppTheme.spacing16),
            Text(
              'No employees found',
              style: AppTheme.titleMedium.copyWith(
                color: AppTheme.textSecondaryColor,
              ),
            ),
            const SizedBox(height: AppTheme.spacing8),
            Text(
              'Tap the + icon to add an employee',
              style: AppTheme.bodySmall.copyWith(
                color: AppTheme.textSecondaryColor,
              ),
            ),
          ],
        ),
      );
    }
    
    return ListView.builder(
      padding: const EdgeInsets.all(AppTheme.spacing16),
      itemCount: employees.length,
      // Ensure the list is scrollable for pull-to-refresh
      physics: const AlwaysScrollableScrollPhysics(),
      itemBuilder: (context, index) {
        final employee = employees[index];
        return GestureDetector(
          onTap: () => _showEmployeeActionsBottomSheet(employee),
          child: Container(
          margin: const EdgeInsets.only(bottom: AppTheme.spacing12),
            decoration: BoxDecoration(
              color: AppTheme.surfaceColor,
              borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
              border: Border.all(
                color: AppTheme.thinBorderColor,
                width: AppTheme.thinBorderWidth,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppTheme.spacing16),
              child: Row(
                children: [
                  CircleAvatar(
              backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
              child: Text(
                      employee.name.isNotEmpty ? employee.name[0].toUpperCase() : 'E',
                style: TextStyle(
                  color: AppTheme.primaryColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
                  const SizedBox(width: AppTheme.spacing12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                    children: [
                            Expanded(
                              child: Text(
                                employee.name,
                                style: AppTheme.bodyMedium.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.textPrimaryColor,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppTheme.spacing8,
                                vertical: AppTheme.spacing4,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                                border: Border.all(
                                  color: AppTheme.primaryColor.withOpacity(0.3),
                                  width: 1,
                                ),
                              ),
                              child: Text(
                                employee.role.isNotEmpty ? employee.role : 'No role',
                                style: AppTheme.bodySmall.copyWith(
                                  color: AppTheme.primaryColor,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 10,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppTheme.spacing4),
                        Text(
                          employee.phone.isNotEmpty ? employee.phone : 'No phone',
                          style: AppTheme.bodySmall.copyWith(
                            color: AppTheme.textSecondaryColor,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _showEmployeeActionsBottomSheet(Employee employee) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: AppTheme.surfaceColor,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.textSecondaryColor.withOpacity(0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            
            // Employee info header
            Container(
              padding: const EdgeInsets.all(AppTheme.spacing20),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                    child: Text(
                      employee.name.isNotEmpty ? employee.name[0].toUpperCase() : 'E',
                      style: AppTheme.titleMedium.copyWith(
                        color: AppTheme.primaryColor,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacing16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          employee.name,
                          style: AppTheme.titleMedium.copyWith(
                            color: AppTheme.textPrimaryColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Code: ${employee.code}',
                          style: AppTheme.bodySmall.copyWith(
                            color: AppTheme.textSecondaryColor,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(
                              Icons.phone,
                              size: 16,
                              color: AppTheme.textSecondaryColor,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              employee.phone,
                              style: AppTheme.bodySmall.copyWith(
                                color: AppTheme.textSecondaryColor,
                              ),
                            ),
                          ],
                        ),
                        if (employee.email != null && employee.email!.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Icon(
                                Icons.email,
                                size: 16,
                                color: AppTheme.textSecondaryColor,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                employee.email!,
                                style: AppTheme.bodySmall.copyWith(
                                  color: AppTheme.textSecondaryColor,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacing12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                      border: Border.all(
                        color: AppTheme.primaryColor.withOpacity(0.3),
                        width: 1,
                      ),
                    ),
                    child: Text(
                      employee.role.isNotEmpty ? employee.role.toUpperCase() : 'NO ROLE',
                      style: AppTheme.bodySmall.copyWith(
                        color: AppTheme.primaryColor,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Employee stats section
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(AppTheme.spacing16),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                      ),
                      child: Column(
                        children: [
                          Text(
                            employee.permissions.length.toString(),
                            style: AppTheme.titleMedium.copyWith(
                              color: AppTheme.primaryColor,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'Permissions',
                            style: AppTheme.bodySmall.copyWith(
                              color: AppTheme.textSecondaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacing12),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(AppTheme.spacing16),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                      ),
                      child: Column(
                        children: [
                          Text(
                            employee.status,
                            style: AppTheme.titleMedium.copyWith(
                              color: employee.status == 'active' 
                                  ? Colors.green 
                                  : AppTheme.errorColor,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'Status',
                            style: AppTheme.bodySmall.copyWith(
                              color: AppTheme.textSecondaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppTheme.spacing20),

            // Action buttons
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
              child: Column(
                children: [
                  // Edit Access Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.of(context).pop();
                        _showEditAccessBottomSheet(employee);
                      },
                      icon: const Icon(Icons.edit, size: 20),
                      label: const Text('Edit Access'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppTheme.spacing24,
                          vertical: AppTheme.spacing16,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                        ),
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: AppTheme.spacing12),
                  
                  // Revoke Access Button
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.of(context).pop();
                        _showRevokeAccessBottomSheet(employee);
                      },
                      icon: const Icon(Icons.remove_circle, size: 20),
                      label: const Text('Revoke Access'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.errorColor,
                        side: BorderSide(color: AppTheme.errorColor, width: 1),
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppTheme.spacing24,
                          vertical: AppTheme.spacing16,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Bottom padding for safe area
            const SizedBox(height: AppTheme.spacing20),
          ],
        ),
      ),
    );
  }

  void _handleUserAction(String action, Employee employee) {
    switch (action) {
      case 'edit':
          _showEditAccessBottomSheet(employee);
        break;
      case 'revoke':
          _showRevokeAccessBottomSheet(employee);
        break;
    }
  }

  void _navigateToRegisterEmployee() {
    // Get current active account for display purposes
    final userAccountsState = ref.read(userAccountsNotifierProvider);
    final currentAccount = userAccountsState.value?.data.accounts
        .firstWhere((acc) => acc.isDefault, orElse: () => userAccountsState.value!.data.accounts.first);
    
    if (currentAccount != null) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => RegisterEmployeeScreen(
            accountId: currentAccount.accountId.toString(),
            accountName: currentAccount.accountName,
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        AppTheme.errorSnackBar(
          message: 'No active account found. Please switch to an account first.',
        ),
      );
    }
  }

  void _showEditAccessBottomSheet(Employee employee) {
    String selectedRole = employee.role.isNotEmpty ? employee.role : AccountAccess.roleViewer;
    if (selectedRole == AccountAccess.roleOwner || selectedRole == 'system_admin') {
      selectedRole = AccountAccess.roleSystemAdmin;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => Container(
        decoration: const BoxDecoration(
            color: AppTheme.surfaceColor,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
            ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Container(
                margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                  color: AppTheme.textSecondaryColor.withOpacity(0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
              
              // Header
              Container(
                padding: const EdgeInsets.all(AppTheme.spacing20),
                child: Column(
                  children: [
                    Icon(
                      Icons.edit,
                      size: 32,
                      color: AppTheme.primaryColor,
                    ),
                    const SizedBox(height: AppTheme.spacing12),
            Text(
                      'Edit ${employee.name}\'s Access',
              style: AppTheme.titleMedium.copyWith(
                fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimaryColor,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppTheme.spacing8),
                    Text(
                      'Update role and permissions',
                      style: AppTheme.bodySmall.copyWith(
                        color: AppTheme.textSecondaryColor,
              ),
              textAlign: TextAlign.center,
            ),
                  ],
                ),
              ),

              // Form content
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
                child: Column(
                  children: [
            DropdownButtonFormField<String>(
              value: selectedRole,
                      decoration: InputDecoration(
                labelText: 'Role',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                        ),
                        prefixIcon: const Icon(Icons.security),
                        filled: true,
                        fillColor: Colors.white,
              ),
              items: [
                DropdownMenuItem(
                  value: AccountAccess.roleSystemAdmin,
                  child: const Text('System admin — full control'),
                ),
                DropdownMenuItem(
                  value: AccountAccess.roleAdmin,
                  child: const Text('Admin - Full access'),
                ),
                DropdownMenuItem(
                  value: AccountAccess.roleManager,
                  child: const Text('Manager - Can edit data'),
                ),
                DropdownMenuItem(
                  value: AccountAccess.roleAgent,
                  child: const Text('Agent - Collect & sell milk'),
                ),
                DropdownMenuItem(
                  value: AccountAccess.roleViewer,
                  child: const Text('Viewer - Read only access'),
                ),
              ],
                      onChanged: (value) {
                        setState(() {
                          selectedRole = value!;
                        });
                      },
                    ),
                  ],
                ),
              ),

            const SizedBox(height: AppTheme.spacing24),

              // Action buttons
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
                child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppTheme.spacing24,
                            vertical: AppTheme.spacing16,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                          ),
                        ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: AppTheme.spacing12),
                Expanded(
                      child: ElevatedButton(
                    onPressed: () async {
                                              final success = await ref.read(accountAccessProvider.notifier).updateAccess(
                            accessId: employee.accessId,
                        role: selectedRole,
                        permissions: _getPermissionsForRole(selectedRole),
                      );
                      
                      if (success && mounted) {
                        Navigator.of(context).pop();
                        ref.invalidate(accountUsersProvider);
                        ScaffoldMessenger.of(context).showSnackBar(
                              AppTheme.successSnackBar(
                                message: '✅ ${employee.name}\'s role has been updated to ${_getRoleDisplayName(selectedRole)}',
                              ),
                            );
                          } else if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              AppTheme.errorSnackBar(
                                message: '❌ Failed to update ${employee.name}\'s access. Please try again.',
                              ),
                        );
                      }
                    },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primaryColor,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppTheme.spacing24,
                            vertical: AppTheme.spacing16,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                          ),
                        ),
                        child: const Text('Update Access'),
                  ),
                ),
              ],
            ),
              ),

              // Bottom padding for safe area
              const SizedBox(height: AppTheme.spacing20),
          ],
          ),
        ),
      ),
    );
  }

  void _showRevokeAccessBottomSheet(Employee employee) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: AppTheme.surfaceColor,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.textSecondaryColor.withOpacity(0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            
            // Warning icon and title
            Container(
              padding: const EdgeInsets.all(AppTheme.spacing20),
              child: Column(
                children: [
            Icon(
              Icons.warning_amber_rounded,
              size: 48,
                    color: AppTheme.errorColor,
            ),
            const SizedBox(height: AppTheme.spacing16),
            Text(
              'Revoke Access',
              style: AppTheme.titleMedium.copyWith(
                fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimaryColor,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppTheme.spacing12),
            Text(
                    'Are you sure you want to revoke ${employee.name}\'s access?',
              style: AppTheme.bodyMedium.copyWith(
                color: AppTheme.textSecondaryColor,
              ),
              textAlign: TextAlign.center,
            ),
                  const SizedBox(height: AppTheme.spacing8),
                  Text(
                    'This action cannot be undone.',
                    style: AppTheme.bodySmall.copyWith(
                      color: AppTheme.errorColor,
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

            // Action buttons
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
              child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppTheme.spacing24,
                          vertical: AppTheme.spacing16,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                        ),
                      ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: AppTheme.spacing12),
                Expanded(
                    child: ElevatedButton(
                    onPressed: () async {
                        final success = await ref.read(accountAccessProvider.notifier).revokeAccess(employee.accessId);
                      
                      if (success && mounted) {
                        Navigator.of(context).pop();
                        ref.invalidate(accountUsersProvider);
                        ScaffoldMessenger.of(context).showSnackBar(
                            AppTheme.successSnackBar(
                              message: '✅ ${employee.name}\'s access has been revoked from this account',
                            ),
                          );
                        } else if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            AppTheme.errorSnackBar(
                              message: '❌ Failed to revoke ${employee.name}\'s access. Please try again.',
                            ),
                        );
                      }
                    },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.errorColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppTheme.spacing24,
                          vertical: AppTheme.spacing16,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
                        ),
                      ),
                      child: const Text('Revoke Access'),
                    ),
                  ),
                ],
              ),
            ),

            // Bottom padding for safe area
            const SizedBox(height: AppTheme.spacing20),
          ],
        ),
      ),
    );
  }

  Map<String, dynamic> _getPermissionsForRole(String role) {
    switch (role) {
      case AccountAccess.roleSystemAdmin:
      case AccountAccess.roleOwner:
        return {
          'view': true,
          'edit': true,
          'delete': true,
          'share': true,
          'manage_users': true,
          'manage_account': true,
        };
      case AccountAccess.roleAdmin:
        return {
          'view': true,
          'edit': true,
          'delete': true,
          'share': true,
          'manage_users': true,
        };
      case AccountAccess.roleManager:
        return {
          'view': true,
          'edit': true,
          'delete': false,
          'share': false,
          'manage_users': false,
        };
      case AccountAccess.roleAgent:
        return {
          'view': true,
          'edit': true,
          'delete': false,
          'share': false,
          'manage_users': false,
          'collect_milk': true,
          'record_sales': true,
        };
      case AccountAccess.roleViewer:
      default:
        return {
          'view': true,
          'edit': false,
          'delete': false,
          'share': false,
          'manage_users': false,
        };
    }
  }

  String _getRoleDisplayName(String role) {
    switch (role) {
      case AccountAccess.roleSystemAdmin:
      case AccountAccess.roleOwner:
        return 'System admin';
      case AccountAccess.roleViewer:
        return 'Viewer';
      case 'umucunda':
        return 'Umucunda';
      case AccountAccess.roleAgent:
        return 'Agent';
      case AccountAccess.roleManager:
        return 'Manager';
      case AccountAccess.roleAdmin:
        return 'Admin';
      default:
        return 'Employee';
    }
  }
}
