class CustomerCreateException implements Exception {
  final String message;
  final Map<String, String> fieldErrors;

  const CustomerCreateException({
    required this.message,
    this.fieldErrors = const {},
  });

  @override
  String toString() => message;
}
