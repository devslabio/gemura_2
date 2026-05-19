import 'package:flutter_test/flutter_test.dart';
import 'package:gemura/features/customers/domain/customer_form_fields.dart';
import 'package:gemura/features/customers/domain/customer_validation_parser.dart';

void main() {
  test('maps phone validation to field key', () {
    final errors = CustomerValidationParser.mapMessagesToFields([
      'phone must be a string',
    ]);
    expect(errors[CustomerFormFields.phone], isNotNull);
  });
}
