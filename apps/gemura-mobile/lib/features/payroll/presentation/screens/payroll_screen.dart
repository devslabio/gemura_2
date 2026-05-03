import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../providers/payroll_provider.dart';
import '../../../suppliers/presentation/providers/suppliers_provider.dart';
import '../../../../shared/widgets/primary_button.dart';
import 'payroll_list_screen.dart';

class PayrollScreen extends ConsumerStatefulWidget {
  const PayrollScreen({super.key});

  @override
  ConsumerState<PayrollScreen> createState() => _PayrollScreenState();
}

class _PayrollScreenState extends ConsumerState<PayrollScreen> {
  DateTime _periodStart = DateTime.now().subtract(const Duration(days: 30));
  DateTime _periodEnd = DateTime.now();
  late TextEditingController _runNameController;
  Set<String> _selectedSupplierCodes = {};
  bool _isGenerating = false;
  Map<String, dynamic>? _payrollResult;

  String _formatDate(DateTime date) {
    return DateFormat('MMM dd, yyyy').format(date);
  }

  /// Suggested run name from date range (e.g. "13 Jan 2026 – 12 Feb 2026").
  String get _suggestedRunName {
    final fmt = DateFormat('d MMM yyyy');
    return '${fmt.format(_periodStart)} – ${fmt.format(_periodEnd)}';
  }

  @override
  void initState() {
    super.initState();
    _runNameController = TextEditingController(text: _suggestedRunName);
  }

  @override
  void dispose() {
    _runNameController.dispose();
    super.dispose();
  }

  String _formatAmount(num amount) {
    final formatter = NumberFormat('#,##0', 'en_US');
    return formatter.format(amount);
  }

  Future<void> _selectDateRange(BuildContext context) async {
    final now = DateTime.now();
    final firstDate = DateTime(2020);
    
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: firstDate,
      lastDate: now,
      initialDateRange: DateTimeRange(start: _periodStart, end: _periodEnd),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.light(
              primary: AppTheme.primaryColor,
              primaryContainer: AppTheme.primaryColor.withOpacity(0.25),
              onPrimary: Colors.white,
              onPrimaryContainer: AppTheme.primaryColor,
              surface: Colors.white,
              onSurface: AppTheme.textPrimaryColor,
            ),
            datePickerTheme: DatePickerThemeData(
              rangeSelectionBackgroundColor: AppTheme.primaryColor.withOpacity(0.25),
              rangeSelectionOverlayColor: WidgetStateProperty.all(
                AppTheme.primaryColor.withOpacity(0.2),
              ),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _periodStart = picked.start;
        _periodEnd = picked.end;
        _runNameController.text = _suggestedRunName;
        _payrollResult = null;
      });
    }
  }

  Future<void> _generatePayroll() async {
    if (_selectedSupplierCodes.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        AppTheme.errorSnackBar(message: 'Please select at least one supplier'),
      );
      return;
    }

    setState(() {
      _isGenerating = true;
      _payrollResult = null;
    });

    try {
      final runNameText = _runNameController.text.trim();
      final runNameToSend = runNameText.isEmpty ? _suggestedRunName : runNameText;
      final result = await ref.read(generatePayrollProvider(GeneratePayrollParams(
        supplierAccountCodes: _selectedSupplierCodes.toList(),
        periodStart: _periodStart,
        periodEnd: _periodEnd,
        runName: runNameToSend.isEmpty ? null : runNameToSend,
      )).future);

      if (!mounted) return;
      
      setState(() {
        _payrollResult = result;
        _isGenerating = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        AppTheme.successSnackBar(
          message: 'Payroll generated successfully for ${result['suppliers_processed']} supplier(s)',
        ),
      );
    } catch (e) {
      if (!mounted) return;
      
      setState(() {
        _isGenerating = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        AppTheme.errorSnackBar(message: 'Error: ${e.toString()}'),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final suppliersAsync = ref.watch(suppliersNotifierProvider);

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Payroll'),
        backgroundColor: AppTheme.surfaceColor,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimaryColor),
        titleTextStyle: AppTheme.titleMedium.copyWith(color: AppTheme.textPrimaryColor),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const PayrollListScreen()),
              );
            },
            tooltip: 'View All Payrolls',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppTheme.spacing16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Date Range Section (tap to open range picker)
            Text(
              'Date Range',
              style: AppTheme.titleSmall.copyWith(
                color: AppTheme.textPrimaryColor,
              ),
            ),
            const SizedBox(height: AppTheme.spacing2),
            Text(
              'Tap to select the period for milk sales to include',
              style: AppTheme.labelSmall.copyWith(
                color: AppTheme.textSecondaryColor,
              ),
            ),
            const SizedBox(height: AppTheme.spacing8),
            InkWell(
              onTap: () => _selectDateRange(context),
              borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacing12,
                  vertical: AppTheme.spacing12,
                ),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceColor,
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                  border: Border.all(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today, color: AppTheme.primaryColor, size: 18),
                    const SizedBox(width: AppTheme.spacing12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'From: ${_formatDate(_periodStart)}',
                            style: AppTheme.bodySmall.copyWith(
                              color: AppTheme.textPrimaryColor,
                            ),
                          ),
                          const SizedBox(height: AppTheme.spacing2),
                          Text(
                            'To: ${_formatDate(_periodEnd)}',
                            style: AppTheme.bodySmall.copyWith(
                              color: AppTheme.textPrimaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_drop_down, color: AppTheme.textHintColor, size: 20),
                  ],
                ),
              ),
            ),

            const SizedBox(height: AppTheme.spacing16),

            // Run name (prefilled from date range, user can edit)
            Text(
              'Run name',
              style: AppTheme.titleSmall.copyWith(
                color: AppTheme.textPrimaryColor,
              ),
            ),
            const SizedBox(height: AppTheme.spacing8),
            TextField(
              controller: _runNameController,
              decoration: InputDecoration(
                hintText: 'e.g. January 2025',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                  borderSide: const BorderSide(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                  borderSide: const BorderSide(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
                ),
                filled: true,
                fillColor: AppTheme.surfaceColor,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacing12,
                  vertical: AppTheme.spacing12,
                ),
              ),
              style: AppTheme.bodySmall.copyWith(color: AppTheme.textPrimaryColor),
            ),
            const SizedBox(height: AppTheme.spacing4),
            Text(
              'Prefilled from the date range; you can change it to any name you like.',
              style: AppTheme.labelSmall.copyWith(color: AppTheme.textSecondaryColor),
            ),

            const SizedBox(height: AppTheme.spacing16),

            // Suppliers Selection Section
            Text(
              'Select Suppliers',
              style: AppTheme.titleSmall.copyWith(
                color: AppTheme.textPrimaryColor,
              ),
            ),
            const SizedBox(height: AppTheme.spacing8),
            Container(
              padding: const EdgeInsets.all(AppTheme.spacing12),
              decoration: BoxDecoration(
                color: AppTheme.surfaceColor,
                borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                border: Border.all(color: AppTheme.thinBorderColor, width: AppTheme.thinBorderWidth),
              ),
              child: suppliersAsync.when(
                loading: () => const Center(
                  child: Padding(
                    padding: EdgeInsets.all(AppTheme.spacing16),
                    child: CircularProgressIndicator(),
                  ),
                ),
                error: (error, stack) => SizedBox(
                  width: double.infinity,
                  child: Padding(
                    padding: const EdgeInsets.all(AppTheme.spacing12),
                    child: Column(
                      children: [
                        const Icon(Icons.error_outline, color: AppTheme.errorColor, size: 40),
                        const SizedBox(height: AppTheme.spacing8),
                        Text(
                          'Error loading suppliers',
                          style: AppTheme.bodySmall.copyWith(color: AppTheme.errorColor),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
                data: (suppliers) {
                  if (suppliers.isEmpty) {
                    return SizedBox(
                      width: double.infinity,
                      child: Padding(
                        padding: const EdgeInsets.all(AppTheme.spacing12),
                        child: Text(
                          'No suppliers available',
                          style: AppTheme.bodySmall.copyWith(color: AppTheme.textSecondaryColor),
                        ),
                      ),
                    );
                  }

                  return Column(
                    children: [
                      // Select All / Deselect All
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${_selectedSupplierCodes.length} of ${suppliers.length} selected',
                            style: AppTheme.bodySmall.copyWith(
                              color: AppTheme.textSecondaryColor,
                            ),
                          ),
                          TextButton(
                            onPressed: () {
                              setState(() {
                                if (_selectedSupplierCodes.length == suppliers.length) {
                                  _selectedSupplierCodes.clear();
                                } else {
                                  _selectedSupplierCodes = suppliers.map((s) => s.accountCode).toSet();
                                }
                                _payrollResult = null;
                              });
                            },
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing8),
                              minimumSize: const Size(0, 32),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: Text(
                              _selectedSupplierCodes.length == suppliers.length
                                  ? 'Deselect All'
                                  : 'Select All',
                              style: AppTheme.bodySmall.copyWith(
                                color: AppTheme.primaryColor,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 1),
                      const SizedBox(height: AppTheme.spacing4),
                      // Supplier List
                      ...suppliers.map((supplier) {
                        final isSelected = _selectedSupplierCodes.contains(supplier.accountCode);
                        void toggle(bool? value) {
                          setState(() {
                            if (value == true) {
                              _selectedSupplierCodes.add(supplier.accountCode);
                            } else {
                              _selectedSupplierCodes.remove(supplier.accountCode);
                            }
                            _payrollResult = null;
                          });
                        }

                        return InkWell(
                          onTap: () => toggle(!isSelected),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: AppTheme.spacing4),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Checkbox(
                                  value: isSelected,
                                  onChanged: toggle,
                                  activeColor: AppTheme.primaryColor,
                                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  visualDensity: VisualDensity.compact,
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        supplier.name,
                                        style: AppTheme.bodySmall.copyWith(
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                      Text(
                                        supplier.accountCode,
                                        style: AppTheme.labelSmall.copyWith(
                                          color: AppTheme.textSecondaryColor,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    ],
                  );
                },
              ),
            ),

            const SizedBox(height: AppTheme.spacing16),

            // Generate Button
            PrimaryButton(
              label: _isGenerating ? 'Generating...' : 'Generate Payroll',
              onPressed: _isGenerating ? null : _generatePayroll,
              isLoading: _isGenerating,
            ),

            // Results Section
            if (_payrollResult != null) ...[
              const SizedBox(height: AppTheme.spacing16),
              Container(
                padding: const EdgeInsets.all(AppTheme.spacing12),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceColor,
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                  border: Border.all(color: AppTheme.successColor.withOpacity(0.3), width: 1),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.check_circle, color: AppTheme.successColor, size: 20),
                        const SizedBox(width: AppTheme.spacing8),
                        Text(
                          'Payroll Generated',
                          style: AppTheme.titleSmall.copyWith(
                            color: AppTheme.successColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppTheme.spacing12),
                    _buildResultRow('Period', '${_formatDate(_periodStart)} - ${_formatDate(_periodEnd)}'),
                    _buildResultRow('Suppliers Processed', '${_payrollResult!['suppliers_processed']}'),
                    _buildResultRow('Total Amount', '${_formatAmount(_payrollResult!['total_amount'] as num)} Frw'),
                    const SizedBox(height: AppTheme.spacing12),
                    const Divider(height: 1),
                    const SizedBox(height: AppTheme.spacing8),
                    Text(
                      'Payslips',
                      style: AppTheme.titleSmall.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacing8),
                    ...(_payrollResult!['payslips'] as List<dynamic>).map<Widget>((payslip) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: AppTheme.spacing4),
                        padding: const EdgeInsets.all(AppTheme.spacing8),
                        decoration: BoxDecoration(
                          color: AppTheme.backgroundColor,
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              payslip['supplier'] ?? payslip['supplier_code'] ?? 'Unknown',
                              style: AppTheme.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: AppTheme.spacing4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '${payslip['milk_sales_count']} collections',
                                  style: AppTheme.labelSmall.copyWith(
                                    color: AppTheme.textSecondaryColor,
                                  ),
                                ),
                                Text(
                                  '${_formatAmount(payslip['net_amount'] as num)} Frw',
                                  style: AppTheme.bodySmall.copyWith(
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.primaryColor,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildResultRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacing4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTheme.bodySmall.copyWith(
              color: AppTheme.textSecondaryColor,
            ),
          ),
          Text(
            value,
            style: AppTheme.bodySmall.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
