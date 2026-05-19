import 'package:flutter_test/flutter_test.dart';
import 'package:gemura/shared/models/receivable.dart';

void main() {
  test('Receivable.fromJson accepts loan rows with null quantity and unit_price', () {
    final receivable = Receivable.fromJson({
      'sale_id': 'loan-abc',
      'source': 'loan',
      'customer': {'id': 'c1', 'code': 'C1', 'name': 'Farmer'},
      'sale_date': '2026-01-15T00:00:00.000Z',
      'quantity': null,
      'unit_price': null,
      'total_amount': 50000,
      'amount_paid': 10000,
      'outstanding': 40000,
      'payment_status': 'partial',
      'days_outstanding': 30,
      'aging_bucket': 'current',
    });

    expect(receivable.source, 'loan');
    expect(receivable.quantity, 0);
    expect(receivable.unitPrice, 0);
    expect(receivable.outstanding, 40000);
  });

  test('ReceivablesSummary.fromJson parses empty summary', () {
    final summary = ReceivablesSummary.fromJson({
      'total_receivables': 0,
      'total_invoices': 0,
      'by_customer': [],
      'aging_summary': {
        'current': 0,
        'days_31_60': 0,
        'days_61_90': 0,
        'days_90_plus': 0,
      },
      'all_receivables': [],
    });

    expect(summary.totalReceivables, 0);
    expect(summary.allReceivables, isEmpty);
  });
}
