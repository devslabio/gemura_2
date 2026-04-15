import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '@prisma/client';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionType } from '../transactions/dto/create-transaction.dto';

@Injectable()
export class ReceivablesPayablesService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
  ) {}

  /**
   * Get all Receivables (unpaid sales where user is supplier)
   * Includes: MilkSale (milk collections) + InventorySale (inventory sold to suppliers on debt)
   */
  async getReceivables(user: User, filters?: {
    customer_account_id?: string;
    date_from?: string;
    date_to?: string;
    payment_status?: string;
  }) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account first.',
      });
    }

    // --- MilkSale receivables (user supplies milk to customers who owe) ---
    const milkWhere: any = {
      supplier_account_id: user.default_account_id,
      payment_status: { not: 'paid' },
      status: 'accepted',
    };

    if (filters?.customer_account_id) {
      milkWhere.customer_account_id = filters.customer_account_id;
    }
    if (filters?.payment_status) {
      milkWhere.payment_status = filters.payment_status;
    }
    if (filters?.date_from || filters?.date_to) {
      milkWhere.sale_at = {};
      if (filters.date_from) {
        milkWhere.sale_at.gte = new Date(filters.date_from);
      }
      if (filters.date_to) {
        const dateTo = new Date(filters.date_to);
        dateTo.setHours(23, 59, 59, 999);
        milkWhere.sale_at.lte = dateTo;
      }
    }

    const milkSales = await this.prisma.milkSale.findMany({
      where: milkWhere,
      include: {
        customer_account: true,
      },
      orderBy: { sale_at: 'desc' },
    });

    // --- InventorySale receivables (user sells inventory to suppliers on debt) ---
    const invWhere: any = {
      buyer_type: 'supplier',
      payment_status: { not: 'paid' },
      buyer_account_id: { not: null },
      product: {
        account_id: user.default_account_id,
      },
    };

    if (filters?.customer_account_id) {
      invWhere.buyer_account_id = filters.customer_account_id;
    }
    if (filters?.payment_status) {
      invWhere.payment_status = filters.payment_status;
    }
    if (filters?.date_from || filters?.date_to) {
      invWhere.sale_date = {};
      if (filters.date_from) {
        invWhere.sale_date.gte = new Date(filters.date_from);
      }
      if (filters.date_to) {
        const dateTo = new Date(filters.date_to);
        dateTo.setHours(23, 59, 59, 999);
        invWhere.sale_date.lte = dateTo;
      }
    }

    const inventorySales = await this.prisma.inventorySale.findMany({
      where: invWhere,
      include: {
        buyer_account: true,
        product: true,
      },
      orderBy: { sale_date: 'desc' },
    });

    // Map MilkSales to receivables format
    const milkReceivables = milkSales.map((sale) => {
      const totalAmount = Number(sale.quantity) * Number(sale.unit_price);
      const amountPaid = Number(sale.amount_paid || 0);
      const outstanding = totalAmount - amountPaid;
      const daysOutstanding = Math.floor(
        (new Date().getTime() - sale.sale_at.getTime()) / (1000 * 60 * 60 * 24)
      );

      let agingBucket = 'current';
      if (daysOutstanding > 90) {
        agingBucket = '90+';
      } else if (daysOutstanding > 60) {
        agingBucket = '61-90';
      } else if (daysOutstanding > 30) {
        agingBucket = '31-60';
      }

      return {
        sale_id: sale.id,
        source: 'milk_sale' as const,
        customer: {
          id: sale.customer_account.id,
          code: sale.customer_account.code,
          name: sale.customer_account.name,
        },
        sale_date: sale.sale_at,
        quantity: Number(sale.quantity),
        unit_price: Number(sale.unit_price),
        total_amount: totalAmount,
        amount_paid: amountPaid,
        outstanding: outstanding,
        payment_status: sale.payment_status || 'unpaid',
        days_outstanding: daysOutstanding,
        aging_bucket: agingBucket,
        notes: sale.notes,
      };
    });

    // Map InventorySales (supplier debt) to receivables format
    const invReceivables = inventorySales.map((sale) => {
      const totalAmount = Number(sale.total_amount);
      const amountPaid = Number(sale.amount_paid || 0);
      const outstanding = totalAmount - amountPaid;
      const saleDate = sale.sale_date;
      const daysOutstanding = Math.floor(
        (new Date().getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let agingBucket = 'current';
      if (daysOutstanding > 90) {
        agingBucket = '90+';
      } else if (daysOutstanding > 60) {
        agingBucket = '61-90';
      } else if (daysOutstanding > 30) {
        agingBucket = '31-60';
      }

      return {
        sale_id: sale.id,
        source: 'inventory_sale' as const,
        customer: sale.buyer_account
          ? {
              id: sale.buyer_account.id,
              code: sale.buyer_account.code,
              name: sale.buyer_account.name,
            }
          : { id: '', code: '', name: sale.buyer_name || 'Unknown' },
        sale_date: saleDate,
        quantity: Number(sale.quantity),
        unit_price: Number(sale.unit_price),
        total_amount: totalAmount,
        amount_paid: amountPaid,
        outstanding: outstanding,
        payment_status: sale.payment_status || 'unpaid',
        days_outstanding: daysOutstanding,
        aging_bucket: agingBucket,
        notes: sale.notes,
      };
    });

    // Loans receivable (money lent – outstanding principal)
    const activeLoans = await this.prisma.loan.findMany({
      where: {
        lender_account_id: user.default_account_id,
        status: 'active',
      },
      include: {
        borrower_account: { select: { id: true, code: true, name: true } },
      },
    });
    const loanReceivables = activeLoans
      .filter((loan) => Number(loan.principal) - Number(loan.amount_repaid || 0) > 0)
      .map((loan) => {
        const totalAmount = Number(loan.principal);
        const amountPaid = Number(loan.amount_repaid || 0);
        const outstanding = totalAmount - amountPaid;
        const saleDate = loan.disbursement_date;
        const daysOutstanding = Math.floor(
          (new Date().getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        let agingBucket = 'current';
        if (daysOutstanding > 90) agingBucket = '90+';
        else if (daysOutstanding > 60) agingBucket = '61-90';
        else if (daysOutstanding > 30) agingBucket = '31-60';
        return {
          sale_id: loan.id,
          loan_id: loan.id,
          source: 'loan' as const,
          customer: loan.borrower_account
            ? { id: loan.borrower_account.id, code: loan.borrower_account.code, name: loan.borrower_account.name }
            : { id: '', code: '', name: loan.borrower_name || 'Other' },
          sale_date: saleDate,
          quantity: null,
          unit_price: null,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          outstanding,
          payment_status: amountPaid >= totalAmount ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid',
          days_outstanding: daysOutstanding,
          aging_bucket: agingBucket,
          notes: loan.notes,
        };
      });

    // Combine and sort by sale_date desc
    const receivables = [...milkReceivables, ...invReceivables, ...loanReceivables].sort(
      (a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()
    );

    // Group by customer
    const byCustomer = receivables.reduce((acc, rec) => {
      const customerId = rec.customer.id;
      if (!acc[customerId]) {
        acc[customerId] = {
          customer: rec.customer,
          total_outstanding: 0,
          invoice_count: 0,
          invoices: [],
        };
      }
      acc[customerId].total_outstanding += rec.outstanding;
      acc[customerId].invoice_count += 1;
      acc[customerId].invoices.push(rec);
      return acc;
    }, {} as Record<string, any>);

    // Calculate aging summary (ensure numbers for JSON / chart)
    const agingSummary = {
      current: Number(receivables.filter((r) => r.days_outstanding <= 30).reduce((sum, r) => sum + r.outstanding, 0)),
      days_31_60: Number(receivables.filter((r) => r.days_outstanding > 30 && r.days_outstanding <= 60).reduce((sum, r) => sum + r.outstanding, 0)),
      days_61_90: Number(receivables.filter((r) => r.days_outstanding > 60 && r.days_outstanding <= 90).reduce((sum, r) => sum + r.outstanding, 0)),
      days_90_plus: Number(receivables.filter((r) => r.days_outstanding > 90).reduce((sum, r) => sum + r.outstanding, 0)),
    };

    return {
      code: 200,
      status: 'success',
      message: 'Receivables fetched successfully',
      data: {
        total_receivables: receivables.reduce((sum, r) => sum + r.outstanding, 0),
        total_invoices: receivables.length,
        by_customer: Object.values(byCustomer),
        aging_summary: agingSummary,
        all_receivables: receivables,
      },
    };
  }

  /**
   * Get all Payables (unpaid collections where user is customer)
   */
  async getPayables(user: User, filters?: {
    supplier_account_id?: string;
    date_from?: string;
    date_to?: string;
    payment_status?: string;
  }) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account first.',
      });
    }

    const where: any = {
      customer_account_id: user.default_account_id,
      payment_status: { not: 'paid' },
      status: 'accepted',
    };

    // Apply filters
    if (filters?.supplier_account_id) {
      where.supplier_account_id = filters.supplier_account_id;
    }

    if (filters?.payment_status) {
      where.payment_status = filters.payment_status;
    }

    if (filters?.date_from || filters?.date_to) {
      where.sale_at = {};
      if (filters.date_from) {
        where.sale_at.gte = new Date(filters.date_from);
      }
      if (filters.date_to) {
        const dateTo = new Date(filters.date_to);
        dateTo.setHours(23, 59, 59, 999);
        where.sale_at.lte = dateTo;
      }
    }

    const collections = await this.prisma.milkSale.findMany({
      where,
      include: {
        supplier_account: true,
      },
      orderBy: { sale_at: 'desc' },
    });

    // Calculate outstanding amounts and aging
    const payables = collections.map((collection) => {
      const totalAmount = Number(collection.quantity) * Number(collection.unit_price);
      const amountPaid = Number(collection.amount_paid || 0);
      const outstanding = totalAmount - amountPaid;
      const daysOutstanding = Math.floor(
        (new Date().getTime() - collection.sale_at.getTime()) / (1000 * 60 * 60 * 24)
      );

      let agingBucket = 'current';
      if (daysOutstanding > 90) {
        agingBucket = '90+';
      } else if (daysOutstanding > 60) {
        agingBucket = '61-90';
      } else if (daysOutstanding > 30) {
        agingBucket = '31-60';
      }

      return {
        collection_id: collection.id,
        supplier: {
          id: collection.supplier_account.id,
          code: collection.supplier_account.code,
          name: collection.supplier_account.name,
        },
        collection_date: collection.sale_at,
        quantity: Number(collection.quantity),
        unit_price: Number(collection.unit_price),
        total_amount: totalAmount,
        amount_paid: amountPaid,
        outstanding: outstanding,
        payment_status: collection.payment_status || 'unpaid',
        days_outstanding: daysOutstanding,
        aging_bucket: agingBucket,
        notes: collection.notes,
      };
    });

    // Group by supplier
    const bySupplier = payables.reduce((acc, pay) => {
      const supplierId = pay.supplier.id;
      if (!acc[supplierId]) {
        acc[supplierId] = {
          supplier: pay.supplier,
          total_outstanding: 0,
          invoice_count: 0,
          invoices: [],
        };
      }
      acc[supplierId].total_outstanding += pay.outstanding;
      acc[supplierId].invoice_count += 1;
      acc[supplierId].invoices.push(pay);
      return acc;
    }, {} as Record<string, any>);

    // Calculate aging summary (ensure numbers for JSON / chart)
    const agingSummary = {
      current: Number(payables.filter((p) => p.days_outstanding <= 30).reduce((sum, p) => sum + p.outstanding, 0)),
      days_31_60: Number(payables.filter((p) => p.days_outstanding > 30 && p.days_outstanding <= 60).reduce((sum, p) => sum + p.outstanding, 0)),
      days_61_90: Number(payables.filter((p) => p.days_outstanding > 60 && p.days_outstanding <= 90).reduce((sum, p) => sum + p.outstanding, 0)),
      days_90_plus: Number(payables.filter((p) => p.days_outstanding > 90).reduce((sum, p) => sum + p.outstanding, 0)),
    };

    return {
      code: 200,
      status: 'success',
      message: 'Payables fetched successfully',
      data: {
        total_payables: payables.reduce((sum, p) => sum + p.outstanding, 0),
        total_invoices: payables.length,
        by_supplier: Object.values(bySupplier),
        aging_summary: agingSummary,
        all_payables: payables,
      },
    };
  }

  /**
   * Record payment against a receivable (InventorySale - supplier debt).
   * Used when a supplier pays off their inventory debt directly (not via payroll deduction).
   * Updates InventorySale amount_paid and payment_status - getReceivables will reflect the change.
   */
  async recordPaymentForReceivable(
    user: User,
    inventorySaleId: string,
    paymentDto: RecordPaymentDto,
  ) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    const invSale = await this.prisma.inventorySale.findFirst({
      where: {
        id: inventorySaleId,
        buyer_type: 'supplier',
        buyer_account_id: { not: null },
        product: {
          account_id: user.default_account_id,
        },
      },
      include: { buyer_account: true },
    });

    if (!invSale) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Inventory sale receivable not found or you do not have permission.',
      });
    }

    const totalAmount = Number(invSale.total_amount);
    const currentPaid = Number(invSale.amount_paid || 0);
    const newPayment = Number(paymentDto.amount);
    const outstanding = totalAmount - currentPaid;

    if (newPayment <= 0) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Payment amount must be greater than 0.',
      });
    }

    if (newPayment > outstanding) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `Payment exceeds outstanding balance. Outstanding: ${outstanding}`,
      });
    }

    const newTotalPaid = currentPaid + newPayment;
    const paymentStatus = newTotalPaid >= totalAmount ? 'paid' : 'partial';

    await this.prisma.inventorySale.update({
      where: { id: inventorySaleId },
      data: {
        amount_paid: newTotalPaid,
        payment_status: paymentStatus,
      },
    });

    // Create revenue transaction (so it appears in transactions as revenue)
    const buyerName = invSale.buyer_account?.name || invSale.buyer_name || 'Supplier';
    const paymentDate = paymentDto.payment_date || new Date().toISOString().split('T')[0];
    try {
      await this.transactionsService.createTransaction(user, {
        type: TransactionType.REVENUE,
        amount: newPayment,
        description: `Payment received from ${buyerName} for inventory sale${paymentDto.notes ? ` - ${paymentDto.notes}` : ''}`,
        transaction_date: paymentDate,
      });
    } catch (error) {
      // Log but don't fail - payment was recorded on InventorySale
      console.error('Failed to create finance transaction for inventory receivable payment:', error);
    }

    return {
      code: 200,
      status: 'success',
      message: 'Payment recorded successfully. Receivables will reflect the update.',
      data: {
        inventory_sale_id: inventorySaleId,
        amount_paid: newPayment,
        total_paid: newTotalPaid,
        outstanding: totalAmount - newTotalPaid,
        payment_status: paymentStatus,
      },
    };
  }
}
