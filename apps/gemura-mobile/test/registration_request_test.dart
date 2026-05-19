import 'package:flutter_test/flutter_test.dart';
import 'package:gemura/shared/models/registration_request.dart';
import 'package:gemura/shared/utils/registration_defaults.dart';

void main() {
  group('RegistrationDefaults', () {
    test('MCC maps to manager', () {
      expect(RegistrationDefaults.platformRoleForAccountType('mcc'), 'manager');
    });

    test('supplier and farmer map to customer role slug', () {
      expect(RegistrationDefaults.platformRoleForAccountType('supplier'), 'supplier');
      expect(RegistrationDefaults.platformRoleForAccountType('farmer'), 'customer');
    });

    test('veterinarian maps to veterinary_officer', () {
      expect(
        RegistrationDefaults.platformRoleForAccountType('veterinarian'),
        'veterinary_officer',
      );
    });
  });

  group('RegistrationRequest.toJson', () {
    test('sends first_name, last_name, role manager for mcc', () {
      final req = RegistrationRequest(
        name: 'MCC Nyamata',
        accountName: 'MCC Nyamata',
        email: 'test@example.com',
        phone: '+250 788 123 456',
        password: 'Pass123!',
        accountType: 'mcc',
        permissions: const {},
      );

      final json = req.toJson();
      expect(json['first_name'], 'MCC');
      expect(json['last_name'], 'Nyamata');
      expect(json['role'], 'manager');
      expect(json['account_type'], 'mcc');
      expect(json['phone'], '250788123456');
      expect(json.containsKey('name'), isFalse);
    });

    test('single-word name duplicates as last_name', () {
      final req = RegistrationRequest(
        name: 'Hubert',
        accountName: 'Hubert',
        phone: '250788606765',
        password: 'secret',
        accountType: 'mcc',
        permissions: const {},
      );
      final json = req.toJson();
      expect(json['first_name'], 'Hubert');
      expect(json['last_name'], 'Hubert');
    });
  });
}
