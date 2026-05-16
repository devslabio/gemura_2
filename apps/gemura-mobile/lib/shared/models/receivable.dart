import '../utils/json_parse.dart';

class Receivable {
  final String saleId;
  /// Source of receivable: 'milk_sale' (milk collections) or 'inventory_sale' (inventory sold to suppliers on debt).
  /// Determines which API endpoint to use when recording payment.
  final String source;
  final CustomerInfo customer;
  final DateTime saleDate;
  final double quantity;
  final double unitPrice;
  final double totalAmount;
  final double amountPaid;
  final double outstanding;
  final String paymentStatus;
  final int daysOutstanding;
  final String agingBucket;
  final String? notes;

  Receivable({
    required this.saleId,
    this.source = 'milk_sale',
    required this.customer,
    required this.saleDate,
    required this.quantity,
    required this.unitPrice,
    required this.totalAmount,
    required this.amountPaid,
    required this.outstanding,
    required this.paymentStatus,
    required this.daysOutstanding,
    required this.agingBucket,
    this.notes,
  });

  factory Receivable.fromJson(Map<String, dynamic> json) {
    final customerJson = json['customer'];
    return Receivable(
      saleId: json['sale_id']?.toString() ?? '',
      source: json['source'] as String? ?? 'milk_sale',
      customer: customerJson is Map<String, dynamic>
          ? CustomerInfo.fromJson(customerJson)
          : CustomerInfo(id: '', code: '', name: 'Unknown'),
      saleDate: jsonDateTime(json['sale_date']),
      quantity: jsonDouble(json['quantity']),
      unitPrice: jsonDouble(json['unit_price']),
      totalAmount: jsonDouble(json['total_amount']),
      amountPaid: jsonDouble(json['amount_paid']),
      outstanding: jsonDouble(json['outstanding']),
      paymentStatus: json['payment_status']?.toString() ?? 'unpaid',
      daysOutstanding: jsonInt(json['days_outstanding']),
      agingBucket: json['aging_bucket']?.toString() ?? 'current',
      notes: json['notes'] as String?,
    );
  }
}

class CustomerInfo {
  final String id;
  final String code;
  final String name;

  CustomerInfo({
    required this.id,
    required this.code,
    required this.name,
  });

  factory CustomerInfo.fromJson(Map<String, dynamic> json) {
    return CustomerInfo(
      id: json['id'] as String,
      code: json['code'] as String,
      name: json['name'] as String,
    );
  }
}

class ReceivablesSummary {
  final double totalReceivables;
  final int totalInvoices;
  final List<CustomerReceivables> byCustomer;
  final AgingSummary agingSummary;
  final List<Receivable> allReceivables;

  ReceivablesSummary({
    required this.totalReceivables,
    required this.totalInvoices,
    required this.byCustomer,
    required this.agingSummary,
    required this.allReceivables,
  });

  factory ReceivablesSummary.fromJson(Map<String, dynamic> json) {
    final byCustomerRaw = json['by_customer'];
    final allRaw = json['all_receivables'];
    final agingRaw = json['aging_summary'];
    return ReceivablesSummary(
      totalReceivables: jsonDouble(json['total_receivables']),
      totalInvoices: jsonInt(json['total_invoices']),
      byCustomer: byCustomerRaw is List
          ? byCustomerRaw
              .whereType<Map>()
              .map((e) => CustomerReceivables.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : [],
      agingSummary: agingRaw is Map<String, dynamic>
          ? AgingSummary.fromJson(agingRaw)
          : AgingSummary(current: 0, days31_60: 0, days61_90: 0, days90Plus: 0),
      allReceivables: allRaw is List
          ? allRaw
              .whereType<Map>()
              .map((e) => Receivable.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : [],
    );
  }
}

class CustomerReceivables {
  final CustomerInfo customer;
  final double totalOutstanding;
  final int invoiceCount;
  final List<Receivable> invoices;

  CustomerReceivables({
    required this.customer,
    required this.totalOutstanding,
    required this.invoiceCount,
    required this.invoices,
  });

  factory CustomerReceivables.fromJson(Map<String, dynamic> json) {
    final invoicesRaw = json['invoices'];
    final customerJson = json['customer'];
    return CustomerReceivables(
      customer: customerJson is Map<String, dynamic>
          ? CustomerInfo.fromJson(customerJson)
          : CustomerInfo(id: '', code: '', name: 'Unknown'),
      totalOutstanding: jsonDouble(json['total_outstanding']),
      invoiceCount: jsonInt(json['invoice_count']),
      invoices: invoicesRaw is List
          ? invoicesRaw
              .whereType<Map>()
              .map((e) => Receivable.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : [],
    );
  }
}

class AgingSummary {
  final double current;
  final double days31_60;
  final double days61_90;
  final double days90Plus;

  AgingSummary({
    required this.current,
    required this.days31_60,
    required this.days61_90,
    required this.days90Plus,
  });

  factory AgingSummary.fromJson(Map<String, dynamic> json) {
    return AgingSummary(
      current: jsonDouble(json['current']),
      days31_60: jsonDouble(json['days_31_60']),
      days61_90: jsonDouble(json['days_61_90']),
      days90Plus: jsonDouble(json['days_90_plus']),
    );
  }
}
