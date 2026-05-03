/// Normalizes login/profile payloads into a single map compatible with [User.fromJson].
/// Separates **platform role** (UserAccount.role) from **user account_type** (signup type).

String? platformRoleFromAccountsList(dynamic accountsRaw) {
  if (accountsRaw is! List) return null;
  for (final item in accountsRaw) {
    if (item is Map && item['is_default'] == true) {
      final r = item['role']?.toString().trim();
      if (r != null && r.isNotEmpty) return r;
    }
  }
  if (accountsRaw.isNotEmpty && accountsRaw.first is Map) {
    final r = (accountsRaw.first as Map)['role']?.toString().trim();
    if (r != null && r.isNotEmpty) return r;
  }
  return null;
}

Map<String, dynamic> mergeAuthSessionUser({
  required Map<String, dynamic> user,
  Map<String, dynamic>? account,
  List<dynamic>? accounts,
}) {
  final out = Map<String, dynamic>.from(user);
  if (account != null) {
    final code = account['code']?.toString();
    final name = account['name']?.toString();
    if (code != null && code.isNotEmpty) {
      out['accountCode'] = out['accountCode'] ?? code;
      out['account_code'] = out['account_code'] ?? code;
    }
    if (name != null && name.isNotEmpty) {
      out['accountName'] = out['accountName'] ?? name;
      out['account_name'] = out['account_name'] ?? name;
    }
  }
  final existingRole = out['role']?.toString().trim();
  if (existingRole == null || existingRole.isEmpty) {
    final fromAcc = account?['role']?.toString().trim();
    if (fromAcc != null && fromAcc.isNotEmpty) {
      out['role'] = fromAcc;
    } else {
      final resolved = platformRoleFromAccountsList(accounts);
      if (resolved != null) out['role'] = resolved;
    }
  }
  return out;
}
