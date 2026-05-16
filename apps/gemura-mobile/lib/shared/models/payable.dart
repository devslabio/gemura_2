import '../utils/json_parse.dart';
import 'receivable.dart';

class Payable {
  final String collectionId;
  final SupplierInfo supplier;
  final DateTime collectionDate;
  final double quantity;
  final double unitPrice;
  final double totalAmount;
  final double amountPaid;
  final double outstanding;
  final String paymentStatus;
  final int daysOutstanding;
  final String agingBucket;
  final String? notes;

  Payable({
    required this.collectionId,
    required this.supplier,
    required this.collectionDate,
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

  factory Payable.fromJson(Map<String, dynamic> json) {
    final supplierJson = json['supplier'];
    return Payable(
      collectionId: json['collection_id']?.toString() ?? '',
      supplier: supplierJson is Map<String, dynamic>
          ? SupplierInfo.fromJson(supplierJson)
          : SupplierInfo(id: '', code: '', name: 'Unknown'),
      collectionDate: jsonDateTime(json['collection_date']),
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

class SupplierInfo {
  final String id;
  final String code;
  final String name;

  SupplierInfo({
    required this.id,
    required this.code,
    required this.name,
  });

  factory SupplierInfo.fromJson(Map<String, dynamic> json) {
    return SupplierInfo(
      id: json['id'] as String,
      code: json['code'] as String,
      name: json['name'] as String,
    );
  }
}

class PayablesSummary {
  final double totalPayables;
  final int totalInvoices;
  final List<SupplierPayables> bySupplier;
  final AgingSummary agingSummary;
  final List<Payable> allPayables;

  PayablesSummary({
    required this.totalPayables,
    required this.totalInvoices,
    required this.bySupplier,
    required this.agingSummary,
    required this.allPayables,
  });

  factory PayablesSummary.fromJson(Map<String, dynamic> json) {
    final bySupplierRaw = json['by_supplier'];
    final allRaw = json['all_payables'];
    final agingRaw = json['aging_summary'];
    return PayablesSummary(
      totalPayables: jsonDouble(json['total_payables']),
      totalInvoices: jsonInt(json['total_invoices']),
      bySupplier: bySupplierRaw is List
          ? bySupplierRaw
              .whereType<Map>()
              .map((e) => SupplierPayables.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : [],
      agingSummary: agingRaw is Map<String, dynamic>
          ? AgingSummary.fromJson(agingRaw)
          : AgingSummary(current: 0, days31_60: 0, days61_90: 0, days90Plus: 0),
      allPayables: allRaw is List
          ? allRaw
              .whereType<Map>()
              .map((e) => Payable.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : [],
    );
  }
}

class SupplierPayables {
  final SupplierInfo supplier;
  final double totalOutstanding;
  final int invoiceCount;
  final List<Payable> invoices;

  SupplierPayables({
    required this.supplier,
    required this.totalOutstanding,
    required this.invoiceCount,
    required this.invoices,
  });

  factory SupplierPayables.fromJson(Map<String, dynamic> json) {
    final invoicesRaw = json['invoices'];
    final supplierJson = json['supplier'];
    return SupplierPayables(
      supplier: supplierJson is Map<String, dynamic>
          ? SupplierInfo.fromJson(supplierJson)
          : SupplierInfo(id: '', code: '', name: 'Unknown'),
      totalOutstanding: jsonDouble(json['total_outstanding']),
      invoiceCount: jsonInt(json['invoice_count']),
      invoices: invoicesRaw is List
          ? invoicesRaw
              .whereType<Map>()
              .map((e) => Payable.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : [],
    );
  }
}
