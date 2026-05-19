import 'package:flutter_test/flutter_test.dart';
import 'package:gemura/shared/utils/national_id_validator.dart';
import 'package:gemura/shared/utils/phone_validator.dart';

void main() {
  group('PhoneValidator', () {
    test('normalizeForApi prepends 250 to 9 local digits', () {
      expect(PhoneValidator.normalizeForApi('788608674'), '250788608674');
    });

    test('validateLocalNineDigits accepts 9 digits', () {
      expect(PhoneValidator.validateLocalNineDigits('788608674'), isNull);
    });

    test('validateLocalNineDigits rejects incomplete number', () {
      expect(PhoneValidator.validateLocalNineDigits('78860'), isNotNull);
    });

    test('localDigitsOnly strips country code from contacts', () {
      expect(PhoneValidator.localDigitsOnly('250788608674'), '788608674');
    });
  });

  group('NationalIdValidator', () {
    test('requires 16 digits starting with 1', () {
      expect(NationalIdValidator.validate('1199080123456789'), isNull);
      expect(NationalIdValidator.validate(''), isNotNull);
      expect(NationalIdValidator.validate('2199080123456789'), isNotNull);
    });
  });
}
