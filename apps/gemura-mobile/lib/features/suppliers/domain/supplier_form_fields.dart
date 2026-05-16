/// API / form field keys for supplier create (aligned with CreateSupplierDto).
abstract final class SupplierFormFields {
  static const firstName = 'first_name';
  static const lastName = 'last_name';
  static const phone = 'phone';
  static const nid = 'nid';
  static const pricePerLiter = 'price_per_liter';
  static const email = 'email';
  static const address = 'address';

  static const allRequired = [
    firstName,
    lastName,
    phone,
    nid,
    pricePerLiter,
  ];
}
