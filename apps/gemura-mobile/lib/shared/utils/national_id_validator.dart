/// Rwandan National ID validation (matches backend CreateSupplierDto).
class NationalIdValidator {
  static final RegExp _rwNid = RegExp(r'^1[0-9]{15}$');

  static String digitsOnly(String? value) =>
      (value ?? '').replaceAll(RegExp(r'\D'), '');

  /// Returns null if valid, error message if invalid.
  static String? validate(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'National ID is required';
    }
    final digits = digitsOnly(value);
    if (digits.length != 16) {
      return 'National ID must be exactly 16 digits';
    }
    if (!_rwNid.hasMatch(digits)) {
      return 'National ID must be 16 digits and start with 1';
    }
    return null;
  }

  /// Optional NID: empty is OK; if provided, must match Rwandan rules.
  static String? validateOptional(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    return validate(value);
  }
}
