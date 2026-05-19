import '../utils/registration_defaults.dart';

class RegistrationRequest {
  final String name;
  final String accountName;
  final String? email;
  final String phone;
  final String password;
  final String? nid;
  final String role;
  final String accountType; // New field for account type
  final Map<String, bool> permissions;
  final bool isAgentCandidate;

  RegistrationRequest({
    required this.name,
    required this.accountName,
    this.email,
    required this.phone,
    required this.password,
    this.nid,
    String? role,
    required this.accountType,
    required this.permissions,
    this.isAgentCandidate = false,
  }) : role = role ?? RegistrationDefaults.platformRoleForAccountType(accountType);

  Map<String, dynamic> toJson() {
    final trimmed = name.trim();
    final parts = trimmed.split(RegExp(r'\s+'));
    final firstName = parts.isNotEmpty ? parts.first : trimmed;
    final lastName = parts.length > 1 ? parts.sublist(1).join(' ') : firstName;

    return {
      'first_name': firstName,
      'last_name': lastName,
      'account_name': accountName,
      if (email != null) 'email': email,
      'phone': RegistrationDefaults.normalizePhone(phone),
      'password': password,
      if (nid != null) 'nid': nid,
      'role': role,
      'account_type': accountType,
      if (permissions.isNotEmpty) 'permissions': permissions,
    };
  }

  factory RegistrationRequest.fromJson(Map<String, dynamic> json) {
    return RegistrationRequest(
      name: json['name'] as String,
      accountName: json['account_name'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String,
      password: json['password'] as String,
      nid: json['nid'] as String?,
      role: json['role'] as String,
      accountType: json['account_type'] as String? ?? 'mcc', // New field with default
      permissions: Map<String, bool>.from(json['permissions'] as Map),
      isAgentCandidate: json['is_agent_candidate'] as bool? ?? false,
    );
  }
}
