import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:country_picker/country_picker.dart';
import '../../core/theme/app_theme.dart';
import '../utils/phone_validator.dart';
import '../utils/rwandan_phone_input_formatter.dart';

/// Phone input with an integrated country-code picker and national number field
/// in a single outlined control.
class PhoneInputField extends StatefulWidget {
  final TextEditingController controller;
  final GlobalKey<FormFieldState<String>>? fieldKey;
  final InputDecoration? decoration;
  final String? labelText;
  final String? Function(String?)? validator;
  final TextInputAction? textInputAction;
  final VoidCallback? onTap;
  final ValueChanged<String>? onChanged;
  final bool enabled;
  /// When true, only Rwanda (+250) is selectable and the national part is 9 digits.
  final bool rwandaOnly;
  final Widget? trailing;

  const PhoneInputField({
    super.key,
    required this.controller,
    this.fieldKey,
    this.decoration,
    this.labelText,
    this.validator,
    this.textInputAction,
    this.onTap,
    this.onChanged,
    this.enabled = true,
    this.rwandaOnly = false,
    this.trailing,
  });

  @override
  State<PhoneInputField> createState() => PhoneInputFieldState();
}

class PhoneInputFieldState extends State<PhoneInputField> {
  static final Country _rwanda = Country(
    phoneCode: PhoneValidator.rwandaDialCode,
    countryCode: 'RW',
    e164Sc: 0,
    geographic: true,
    level: 1,
    name: 'Rwanda',
    example: '250788123456',
    displayName: 'Rwanda (RW) [+250]',
    displayNameNoCountryCode: 'Rwanda (RW)',
    e164Key: '250-RW-0',
  );

  late Country _selectedCountry;

  @override
  void initState() {
    super.initState();
    _selectedCountry = _rwanda;
  }

  int get _nationalDigitLimit =>
      widget.rwandaOnly ? RwandaLocalPhoneFormatter.nationalDigitCount : 15;

  @override
  Widget build(BuildContext context) {
    final themeDecoration = widget.decoration ??
        InputDecoration(
          labelText: widget.labelText ?? 'Phone Number',
          hintText: widget.rwandaOnly ? '788123456' : 'Phone number',
          hintStyle: AppTheme.hintText,
        );

    final mergedDecoration = themeDecoration.copyWith(
      prefixIcon: _buildCountryPrefix(context),
      prefixIconConstraints: BoxConstraints(
        minWidth: widget.rwandaOnly ? 108 : 118,
        maxWidth: widget.rwandaOnly ? 120 : 130,
      ),
      suffixIcon: widget.trailing,
      counterText: widget.rwandaOnly ? '' : themeDecoration.counterText,
    );

    return TextFormField(
      key: widget.fieldKey,
      controller: widget.controller,
      enabled: widget.enabled,
      style: AppTheme.bodyMedium,
      keyboardType: TextInputType.phone,
      textInputAction: widget.textInputAction,
      onTap: widget.onTap,
      onChanged: widget.onChanged,
      maxLength: widget.rwandaOnly ? _nationalDigitLimit : null,
      inputFormatters: [
        if (widget.rwandaOnly)
          RwandaLocalPhoneFormatter()
        else
          PhoneInputFormatter(),
        LengthLimitingTextInputFormatter(_nationalDigitLimit),
      ],
      decoration: mergedDecoration,
      validator: widget.validator ??
          (widget.rwandaOnly
              ? PhoneValidator.validateLocalNineDigits
              : PhoneValidator.validateInternationalPhone),
    );
  }

  Widget _buildCountryPrefix(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: widget.enabled ? _showCountryPicker : null,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
        child: Padding(
          padding: const EdgeInsets.only(left: AppTheme.spacing12),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _selectedCountry.flagEmoji,
                style: AppTheme.bodyLarge,
              ),
              const SizedBox(width: AppTheme.spacing4),
              Text(
                '+${_selectedCountry.phoneCode}',
                style: AppTheme.bodyMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textPrimaryColor,
                ),
              ),
              Icon(
                Icons.arrow_drop_down,
                color: AppTheme.textSecondaryColor,
                size: 22,
              ),
              Container(
                height: 28,
                width: 1,
                margin: const EdgeInsets.only(left: AppTheme.spacing4),
                color: AppTheme.thinBorderColor,
              ),
              const SizedBox(width: AppTheme.spacing4),
            ],
          ),
        ),
      ),
    );
  }

  void _showCountryPicker() {
    showCountryPicker(
      context: context,
      showPhoneCode: true,
      countryFilter: widget.rwandaOnly ? const ['RW'] : null,
      countryListTheme: CountryListThemeData(
        flagSize: 25,
        backgroundColor: AppTheme.backgroundColor,
        textStyle: Theme.of(context).textTheme.bodyMedium!,
        bottomSheetHeight: 500,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
        inputDecoration: InputDecoration(
          labelText: 'Search',
          hintText: 'Start typing to search',
          prefixIcon: const Icon(Icons.search),
          border: OutlineInputBorder(
            borderSide: BorderSide(
              color: AppTheme.textHintColor.withValues(alpha: 0.2),
            ),
          ),
        ),
        searchTextStyle: Theme.of(context).textTheme.bodyMedium!,
      ),
      onSelect: (Country country) {
        if (widget.rwandaOnly && country.countryCode != 'RW') return;
        setState(() => _selectedCountry = country);
      },
    );
  }

  /// E.164-style number for APIs (`250788123456` when Rwanda-only).
  String get apiNormalizedPhone {
    final national = widget.controller.text.trim();
    if (national.isEmpty) return '';
    if (widget.rwandaOnly) {
      return PhoneValidator.normalizeForApi(national);
    }
    final digits = national.replaceAll(RegExp(r'[^\d]'), '');
    return '${_selectedCountry.phoneCode}$digits';
  }

  /// Legacy helper used by auth/profile screens.
  String get fullPhoneNumber {
    final national = widget.controller.text.trim();
    if (national.isEmpty) return '';
    return '+${_selectedCountry.phoneCode}$national';
  }

  void setPhoneFromContact(String raw) {
    if (widget.rwandaOnly) {
      widget.controller.text = PhoneValidator.localDigitsOnly(raw);
      return;
    }
    setPhoneNumber(raw);
  }

  void setPhoneNumber(String fullNumber) {
    final digits = fullNumber.replaceAll(RegExp(r'[^\d]'), '');
    if (digits.isEmpty) {
      widget.controller.text = '';
      return;
    }

    if (widget.rwandaOnly) {
      widget.controller.text = PhoneValidator.localDigitsOnly(digits);
      _selectedCountry = _rwanda;
      return;
    }

    if (fullNumber.startsWith('+') || digits.length > _nationalDigitLimit) {
      for (final country in CountryService().getAll()) {
        final code = country.phoneCode;
        if (digits.startsWith(code) && digits.length > code.length) {
          setState(() {
            _selectedCountry = country;
            widget.controller.text = digits.substring(code.length);
          });
          return;
        }
      }
    }
    widget.controller.text = digits;
  }
}
