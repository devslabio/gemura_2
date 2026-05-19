import 'package:flutter_test/flutter_test.dart';
import 'package:gemura/features/suppliers/domain/supplier_form_fields.dart';
import 'package:gemura/features/suppliers/domain/supplier_validation_parser.dart';

void main() {
  test('maps Nest validation messages to field keys', () {
    final errors = SupplierValidationParser.mapMessagesToFields([
      'National ID is required',
      'Phone must be Rwandan format: 250 followed by 9 digits',
    ]);
    expect(errors[SupplierFormFields.nid], 'National ID is required');
    expect(errors[SupplierFormFields.phone], contains('Phone'));
  });

  test('summary lists multiple fields', () {
    final summary = SupplierValidationParser.summaryMessage({
      SupplierFormFields.nid: 'National ID is required',
      SupplierFormFields.phone: 'Phone number is required',
    });
    expect(summary, contains('National ID'));
    expect(summary, contains('Phone'));
  });
}
