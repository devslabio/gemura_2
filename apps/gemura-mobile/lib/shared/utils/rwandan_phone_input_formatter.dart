import 'package:flutter/services.dart';

/// Digits-only formatter for international phone fields (legacy).
class PhoneInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    String cleaned = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (cleaned.length > 15) {
      cleaned = cleaned.substring(0, 15);
    }
    return TextEditingValue(
      text: cleaned,
      selection: TextSelection.collapsed(offset: cleaned.length),
    );
  }
}

/// Rwanda national number: exactly 9 digits (after +250), digits only.
class RwandaLocalPhoneFormatter extends TextInputFormatter {
  static const int nationalDigitCount = 9;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var cleaned = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (cleaned.startsWith('250') && cleaned.length > nationalDigitCount) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.startsWith('0') && cleaned.length > nationalDigitCount) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.length > nationalDigitCount) {
      cleaned = cleaned.substring(0, nationalDigitCount);
    }
    return TextEditingValue(
      text: cleaned,
      selection: TextSelection.collapsed(offset: cleaned.length),
    );
  }
}
