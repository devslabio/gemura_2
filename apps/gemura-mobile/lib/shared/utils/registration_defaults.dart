/// Defaults for POST /auth/register (aligned with backend + gemura-web).
class RegistrationDefaults {
  RegistrationDefaults._();

  /// Platform role slug for a new [userAccount] link from self-registration.
  static String platformRoleForAccountType(String accountType) {
    switch (accountType.trim().toLowerCase()) {
      case 'mcc':
        return 'manager';
      case 'agent':
        return 'agent';
      case 'collector':
        return 'collector';
      case 'veterinarian':
        return 'veterinary_officer';
      case 'supplier':
        return 'supplier';
      case 'customer':
      case 'farmer':
        return 'customer';
      case 'owner':
        return 'manager';
      default:
        return 'manager';
    }
  }

  /// Digits-only phone for API (Rwanda 250…); matches AuthService login normalization.
  static String normalizePhone(String phone) {
    return phone.replaceAll(RegExp(r'[^\d]'), '');
  }
}
