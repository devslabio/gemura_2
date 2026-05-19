/// Thrown when POST /suppliers/create fails with validation or business errors.
class SupplierCreateException implements Exception {
  final String message;
  final Map<String, String> fieldErrors;

  const SupplierCreateException({
    required this.message,
    this.fieldErrors = const {},
  });

  @override
  String toString() => message;
}
