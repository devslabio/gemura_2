import 'package:json_annotation/json_annotation.dart';

part 'account_access.g.dart';

@JsonSerializable()
class AccountAccess {
  final String id;
  final String accountOwnerId;
  final String grantedUserId;
  final String role;
  final Map<String, dynamic> permissions;
  final DateTime grantedAt;
  final DateTime? expiresAt;
  final bool isActive;

  const AccountAccess({
    required this.id,
    required this.accountOwnerId,
    required this.grantedUserId,
    required this.role,
    required this.permissions,
    required this.grantedAt,
    this.expiresAt,
    this.isActive = true,
  });

  factory AccountAccess.fromJson(Map<String, dynamic> json) =>
      _$AccountAccessFromJson(json);

  Map<String, dynamic> toJson() => _$AccountAccessToJson(this);

  /// Canonical full-control platform role (legacy stored value may be [roleOwner]).
  static const String roleSystemAdmin = 'system_admin';
  // Predefined roles — legacy alias for API/store compatibility
  static const String roleOwner = 'owner';
  static const String roleAdmin = 'admin';
  static const String roleManager = 'manager';
  static const String roleAgent = 'agent';
  static const String roleViewer = 'viewer';

  // Check if access is still valid
  bool get isValid {
    if (!isActive) return false;
    if (expiresAt != null && DateTime.now().isAfter(expiresAt!)) {
      return false;
    }
    return true;
  }

  // Check specific permission
  bool hasPermission(String permission) {
    return permissions[permission] == true;
  }
}

@JsonSerializable()
class SharedAccount {
  final String id;
  final String originalOwnerId;
  final String accountName;
  final String accountType;
  final String status;
  final DateTime createdAt;
  final List<AccountAccess> accessList;

  const SharedAccount({
    required this.id,
    required this.originalOwnerId,
    required this.accountName,
    required this.accountType,
    required this.status,
    required this.createdAt,
    required this.accessList,
  });

  factory SharedAccount.fromJson(Map<String, dynamic> json) =>
      _$SharedAccountFromJson(json);

  Map<String, dynamic> toJson() => _$SharedAccountToJson(this);

  // Get active access permissions
  List<AccountAccess> get activeAccess => 
      accessList.where((access) => access.isValid).toList();
}
