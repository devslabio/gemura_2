// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'overview.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Overview _$OverviewFromJson(Map<String, dynamic> json) => Overview(
      summary:
          OverviewSummary.fromJson(json['summary'] as Map<String, dynamic>),
      breakdownType: json['breakdown_type'] as String,
      chartPeriod: json['chart_period'] as String?,
      breakdown: (json['breakdown'] as List<dynamic>?)
              ?.map(
                  (e) => OverviewBreakdown.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      recentTransactions: (json['recent_transactions'] as List<dynamic>?)
          ?.map((e) => OverviewTransaction.fromJson(e as Map<String, dynamic>))
          .toList(),
      dateRange: OverviewDateRange.fromJson(
          json['date_range'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$OverviewToJson(Overview instance) => <String, dynamic>{
      'summary': instance.summary,
      'breakdown_type': instance.breakdownType,
      'chart_period': instance.chartPeriod,
      'breakdown': instance.breakdown,
      'recent_transactions': instance.recentTransactions,
      'date_range': instance.dateRange,
    };

OverviewSummary _$OverviewSummaryFromJson(Map<String, dynamic> json) =>
    OverviewSummary(
      collection: OverviewCollection.fromJson(
          json['collection'] as Map<String, dynamic>),
      rejections: OverviewRejections.fromJson(
          json['rejections'] as Map<String, dynamic>),
      sales: OverviewSales.fromJson(json['sales'] as Map<String, dynamic>),
      suppliers:
          OverviewSuppliers.fromJson(json['suppliers'] as Map<String, dynamic>),
      customers:
          OverviewCustomers.fromJson(json['customers'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$OverviewSummaryToJson(OverviewSummary instance) =>
    <String, dynamic>{
      'collection': instance.collection,
      'rejections': instance.rejections,
      'sales': instance.sales,
      'suppliers': instance.suppliers,
      'customers': instance.customers,
    };

OverviewCollection _$OverviewCollectionFromJson(Map<String, dynamic> json) =>
    OverviewCollection(
      liters: (json['liters'] as num).toDouble(),
      value: (json['value'] as num).toDouble(),
      transactions: (json['transactions'] as num).toInt(),
    );

Map<String, dynamic> _$OverviewCollectionToJson(OverviewCollection instance) =>
    <String, dynamic>{
      'liters': instance.liters,
      'value': instance.value,
      'transactions': instance.transactions,
    };

OverviewRejections _$OverviewRejectionsFromJson(Map<String, dynamic> json) =>
    OverviewRejections(
      liters: (json['liters'] as num).toDouble(),
      value: (json['value'] as num).toDouble(),
      transactions: (json['transactions'] as num).toInt(),
    );

Map<String, dynamic> _$OverviewRejectionsToJson(OverviewRejections instance) =>
    <String, dynamic>{
      'liters': instance.liters,
      'value': instance.value,
      'transactions': instance.transactions,
    };

OverviewSales _$OverviewSalesFromJson(Map<String, dynamic> json) =>
    OverviewSales(
      liters: (json['liters'] as num).toDouble(),
      value: (json['value'] as num).toDouble(),
      transactions: (json['transactions'] as num).toInt(),
    );

Map<String, dynamic> _$OverviewSalesToJson(OverviewSales instance) =>
    <String, dynamic>{
      'liters': instance.liters,
      'value': instance.value,
      'transactions': instance.transactions,
    };

OverviewSuppliers _$OverviewSuppliersFromJson(Map<String, dynamic> json) =>
    OverviewSuppliers(
      active: (json['active'] as num).toInt(),
      inactive: (json['inactive'] as num).toInt(),
    );

Map<String, dynamic> _$OverviewSuppliersToJson(OverviewSuppliers instance) =>
    <String, dynamic>{
      'active': instance.active,
      'inactive': instance.inactive,
    };

OverviewCustomers _$OverviewCustomersFromJson(Map<String, dynamic> json) =>
    OverviewCustomers(
      active: (json['active'] as num).toInt(),
      inactive: (json['inactive'] as num).toInt(),
    );

Map<String, dynamic> _$OverviewCustomersToJson(OverviewCustomers instance) =>
    <String, dynamic>{
      'active': instance.active,
      'inactive': instance.inactive,
    };

OverviewBreakdown _$OverviewBreakdownFromJson(Map<String, dynamic> json) =>
    OverviewBreakdown(
      label: json['label'] as String,
      month: json['month'] as String?,
      date: json['date'] as String?,
      collection: OverviewBreakdownData.fromJson(
          json['collection'] as Map<String, dynamic>),
      sales:
          OverviewBreakdownData.fromJson(json['sales'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$OverviewBreakdownToJson(OverviewBreakdown instance) =>
    <String, dynamic>{
      'label': instance.label,
      'month': instance.month,
      'date': instance.date,
      'collection': instance.collection,
      'sales': instance.sales,
    };

OverviewBreakdownData _$OverviewBreakdownDataFromJson(
        Map<String, dynamic> json) =>
    OverviewBreakdownData(
      liters: (json['liters'] as num).toDouble(),
      value: (json['value'] as num).toDouble(),
    );

Map<String, dynamic> _$OverviewBreakdownDataToJson(
        OverviewBreakdownData instance) =>
    <String, dynamic>{
      'liters': instance.liters,
      'value': instance.value,
    };

OverviewTransaction _$OverviewTransactionFromJson(Map<String, dynamic> json) =>
    OverviewTransaction(
      id: json['id'] as String,
      quantity: (json['quantity'] as num).toDouble(),
      unitPrice: (json['unit_price'] as num).toDouble(),
      totalAmount: (json['total_amount'] as num).toDouble(),
      status: json['status'] as String,
      transactionAt: json['transaction_at'] as String,
      notes: json['notes'] as String?,
      createdAt: json['created_at'] as String,
      type: json['type'] as String,
      supplierAccount: json['supplier_account'] == null
          ? null
          : OverviewAccount.fromJson(
              json['supplier_account'] as Map<String, dynamic>),
      customerAccount: json['customer_account'] == null
          ? null
          : OverviewAccount.fromJson(
              json['customer_account'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$OverviewTransactionToJson(
        OverviewTransaction instance) =>
    <String, dynamic>{
      'id': instance.id,
      'quantity': instance.quantity,
      'unit_price': instance.unitPrice,
      'total_amount': instance.totalAmount,
      'status': instance.status,
      'transaction_at': instance.transactionAt,
      'notes': instance.notes,
      'created_at': instance.createdAt,
      'type': instance.type,
      'supplier_account': instance.supplierAccount,
      'customer_account': instance.customerAccount,
    };

OverviewAccount _$OverviewAccountFromJson(Map<String, dynamic> json) =>
    OverviewAccount(
      code: json['code'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
      status: json['status'] as String,
    );

Map<String, dynamic> _$OverviewAccountToJson(OverviewAccount instance) =>
    <String, dynamic>{
      'code': instance.code,
      'name': instance.name,
      'type': instance.type,
      'status': instance.status,
    };

OverviewDateRange _$OverviewDateRangeFromJson(Map<String, dynamic> json) =>
    OverviewDateRange(
      from: json['from'] as String,
      to: json['to'] as String,
    );

Map<String, dynamic> _$OverviewDateRangeToJson(OverviewDateRange instance) =>
    <String, dynamic>{
      'from': instance.from,
      'to': instance.to,
    };
