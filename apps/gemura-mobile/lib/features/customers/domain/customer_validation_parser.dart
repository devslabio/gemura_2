import 'customer_form_fields.dart';

class CustomerValidationParser {
  static List<String> messagesFromResponse(dynamic data) {
    if (data is! Map) return [];
    final message = data['message'];
    if (message is List) {
      return message.map((e) => e.toString()).where((s) => s.isNotEmpty).toList();
    }
    if (message is String && message.isNotEmpty) return [message];
    return [];
  }

  static Map<String, String> fieldErrorsFromResponse(dynamic data) {
    return mapMessagesToFields(messagesFromResponse(data));
  }

  static Map<String, String> mapMessagesToFields(Iterable<String> messages) {
    final out = <String, String>{};
    final general = <String>[];

    for (final raw in messages) {
      final msg = raw.trim();
      if (msg.isEmpty) continue;
      final key = _fieldKeyForMessage(msg);
      if (key != null) {
        out.putIfAbsent(key, () => msg);
      } else {
        general.add(msg);
      }
    }

    if (general.isNotEmpty && out.isEmpty) {
      out['_form'] = general.join(' ');
    }
    return out;
  }

  static String summaryMessage(Map<String, String> fieldErrors, {String? fallback}) {
    if (fieldErrors.isEmpty) {
      return fallback ?? 'Please check your input and try again.';
    }
    if (fieldErrors.containsKey('_form') && fieldErrors.length == 1) {
      return fieldErrors['_form']!;
    }
    final entries = fieldErrors.entries.where((e) => e.key != '_form').toList();
    if (entries.isEmpty) {
      return fieldErrors['_form'] ?? fallback ?? 'Please check your input.';
    }
    if (entries.length == 1) {
      return '${_labelForField(entries.first.key)}: ${entries.first.value}';
    }
    return entries.map((e) => '${_labelForField(e.key)} — ${e.value}').join('\n');
  }

  static String? _fieldKeyForMessage(String msg) {
    final lower = msg.toLowerCase();
    if (lower.contains('first name') || lower.startsWith('first_name')) {
      return CustomerFormFields.firstName;
    }
    if (lower.contains('last name') || lower.startsWith('last_name')) {
      return CustomerFormFields.lastName;
    }
    if (lower.contains('national id') ||
        lower.startsWith('nid') ||
        RegExp(r'\bnid\b').hasMatch(lower)) {
      return CustomerFormFields.nid;
    }
    if (lower.contains('price per liter') || lower.startsWith('price_per_liter')) {
      return CustomerFormFields.pricePerLiter;
    }
    if (lower.contains('email')) return CustomerFormFields.email;
    if (lower.contains('address')) return CustomerFormFields.address;
    if (lower.contains('phone')) return CustomerFormFields.phone;
    return null;
  }

  static String _labelForField(String key) {
    switch (key) {
      case CustomerFormFields.firstName:
        return 'First name';
      case CustomerFormFields.lastName:
        return 'Last name';
      case CustomerFormFields.phone:
        return 'Phone';
      case CustomerFormFields.nid:
        return 'National ID';
      case CustomerFormFields.pricePerLiter:
        return 'Price per liter';
      case CustomerFormFields.email:
        return 'Email';
      case CustomerFormFields.address:
        return 'Address';
      default:
        return key;
    }
  }
}
