import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '@prisma/client';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayrollRunDto } from './dto/update-payroll-run.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { MarkPayrollPaidDto } from './dto/mark-payroll-paid.dto';
import { TransactionsService } from '../../accounting/transactions/transactions.service';
import { TransactionType } from '../../accounting/transactions/dto/create-transaction.dto';
import { LoansService } from '../../loans/loans.service';
import { ChargesService } from '../../charges/charges.service';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
const PDFDocument = require('pdfkit');

@Injectable()
export class PayrollRunsService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private loansService: LoansService,
    private chargesService: ChargesService,
  ) {}

  async createRun(user: User, createDto: CreatePayrollRunDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    // If period_id is provided, verify it exists
    if (createDto.period_id) {
      const period = await this.prisma.payrollPeriod.findUnique({
        where: { id: createDto.period_id },
      });

      if (!period) {
        throw new NotFoundException({
          code: 404,
          status: 'error',
          message: 'Payroll period not found.',
        });
      }
    }

    const run = await this.prisma.payrollRun.create({
      data: {
        account_id: user.default_account_id,
        period_id: createDto.period_id || null,
        run_date: new Date(createDto.run_date || new Date()),
        period_start: createDto.period_start ? new Date(createDto.period_start) : null,
        period_end: createDto.period_end ? new Date(createDto.period_end) : null,
        payment_terms_days: createDto.payment_terms_days || null,
        total_amount: 0,
        status: 'draft',
        created_by: user.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Payroll run created successfully.',
      data: {
        id: run.id,
        period_id: run.period_id,
        run_date: run.run_date,
        period_start: run.period_start,
        period_end: run.period_end,
        payment_terms_days: run.payment_terms_days,
        status: run.status,
      },
    };
  }

  async getRuns(user: User, periodId?: string, accountIdParam?: string) {
    const accountId = accountIdParam || user.default_account_id;
    if (!accountId) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }
    // If explicit account_id provided, verify user has access
    if (accountIdParam) {
      const hasAccess = await this.prisma.userAccount.findFirst({
        where: {
          user_id: user.id,
          account_id: accountIdParam,
          status: 'active',
        },
        include: { account: true },
      });
      if (!hasAccess?.account || hasAccess.account.status !== 'active') {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Account not found or access denied.',
        });
      }
    }
    // Scope runs to this account; include legacy runs (null account_id) created by this user
    const where: any = {
      OR: [
        { account_id: accountId },
        { account_id: null, created_by: user.id },
      ],
    };
    if (periodId) where.period_id = periodId;
    const runs = await this.prisma.payrollRun.findMany({
      where,
      include: {
        period: true,
        payslips: {
          include: {
            supplier_account: {
              select: {
                id: true,
                code: true,
                name: true,
                bank_name: true,
                bank_account_number: true,
              },
            },
          },
        },
      },
      orderBy: { run_date: 'desc' },
    });

    const milkSalesMap = new Map<string, number>();

    for (const run of runs) {
      for (const payslip of run.payslips) {
        const totalLitersResult = await this.prisma.milkSale.aggregate({
          _sum: {
            quantity: true,
          },
          where: {
            supplier_account_id: payslip.supplier_account_id,
            sale_at: {
              gte: payslip.period_start,
              lte: payslip.period_end,
            },
          },
        });
        
        const totalLiters = totalLitersResult._sum.quantity 
          ? Number(totalLitersResult._sum.quantity) 
          : 0;
        milkSalesMap.set(payslip.id, totalLiters);
      }
    }

    return {
      code: 200,
      status: 'success',
      message: 'Payroll runs fetched successfully.',
      data: runs.map((r) => ({
        id: r.id,
        period_name: r.run_name || r.period?.period_name || 'Flexible Run',
        run_date: r.run_date,
        period_start: r.period_start,
        period_end: r.period_end,
        payment_terms_days: r.payment_terms_days,
        total_amount: Number(r.total_amount),
        status: r.status,
        payslips_count: r.payslips.length,
        payslips: r.payslips.map((p) => ({
          id: p.id,
          supplier: p.supplier_account.name,
          supplier_code: p.supplier_account.code,
          bank_name: p.supplier_account.bank_name,
          bank_account_number: p.supplier_account.bank_account_number,
          gross_amount: Number(p.gross_amount),
          total_deductions: Number(p.total_deductions),
          net_amount: Number(p.net_amount),
          milk_sales_count: p.milk_sales_count,
          total_liters: milkSalesMap.get(p.id) || 0,
          period_start: p.period_start,
          period_end: p.period_end,
          status: p.status,
        })),
      })),
    };
  }

  /** Get a single payslip with full detail: deductions (with reason/source) and milk collections (earnings source). */
  async getPayslipDetail(user: User, runId: string, payslipId: string, accountIdParam?: string) {
    const accountId = accountIdParam || user.default_account_id;
    if (!accountId) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }
    if (accountIdParam) {
      const hasAccess = await this.prisma.userAccount.findFirst({
        where: { user_id: user.id, account_id: accountIdParam, status: 'active' },
        include: { account: true },
      });
      if (!hasAccess?.account || hasAccess.account.status !== 'active') {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Account not found or access denied.',
        });
      }
    }
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: runId,
        OR: [
          { account_id: accountId },
          { account_id: null, created_by: user.id },
        ],
      },
    });
    if (!run) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Payroll run not found.',
      });
    }
    const p = await this.prisma.payrollPayslip.findFirst({
      where: { id: payslipId, run_id: runId },
      include: {
        supplier_account: {
          select: {
            id: true,
            code: true,
            name: true,
            bank_name: true,
            bank_account_number: true,
          },
        },
        deductions: {
          include: {
            charge: { select: { id: true, name: true, description: true } },
            loan: { select: { id: true, principal: true } },
            inventory_sale: { select: { id: true, sale_date: true } },
          },
        },
      },
    });
    if (!p) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Payslip not found.',
      });
    }
    const periodStart = p.period_start;
    const periodEnd = p.period_end;
    const milkSales = await this.prisma.milkSale.findMany({
      where: {
        supplier_account_id: p.supplier_account_id,
        sale_at: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { sale_at: 'asc' },
      select: {
        id: true,
        sale_at: true,
        quantity: true,
        unit_price: true,
        notes: true,
      },
    });
    const earnings = milkSales.map((m) => ({
      id: m.id,
      date: m.sale_at,
      quantity: Number(m.quantity),
      unit_price: Number(m.unit_price),
      amount: Number(m.quantity) * Number(m.unit_price),
      notes: m.notes ?? undefined,
    }));
    const deductions = p.deductions.map((d) => {
      let reason = d.description ?? d.deduction_type;
      if (d.deduction_type === 'fee' && d.charge) reason = d.charge.name;
      else if (d.deduction_type === 'loan_repayment' && d.loan) reason = `Loan repayment`;
      else if (d.deduction_type === 'inventory_debt' && d.inventory_sale) reason = `Inventory (sale ${d.inventory_sale.sale_date?.toISOString().slice(0, 10) ?? d.inventory_sale.id})`;
      return {
        id: d.id,
        type: d.deduction_type,
        amount: Number(d.amount),
        reason,
      };
    });
    const totalLiters = milkSales.reduce((sum, m) => sum + Number(m.quantity), 0);
    return {
      code: 200,
      status: 'success',
      message: 'Payslip detail fetched.',
      data: {
        id: p.id,
        supplier: p.supplier_account.name,
        supplier_code: p.supplier_account.code,
        bank_name: p.supplier_account.bank_name,
        bank_account_number: p.supplier_account.bank_account_number,
        gross_amount: Number(p.gross_amount),
        total_deductions: Number(p.total_deductions),
        net_amount: Number(p.net_amount),
        milk_sales_count: p.milk_sales_count,
        total_liters: totalLiters,
        period_start: periodStart,
        period_end: periodEnd,
        status: p.status,
        earnings,
        deductions,
      },
    };
  }

  private async assertRunBelongsToAccount(user: User, run: { account_id: string | null; created_by: string | null }) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }
    const belongs =
      run.account_id === user.default_account_id ||
      (run.account_id == null && run.created_by === user.id);
    if (!belongs) {
      throw new BadRequestException({
        code: 403,
        status: 'error',
        message: 'You do not have permission to access this payroll run.',
      });
    }
  }

  async updateRun(user: User, runId: string, updateDto: UpdatePayrollRunDto) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Payroll run not found.',
      });
    }
    await this.assertRunBelongsToAccount(user, run);

    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: updateDto.status || run.status,
        total_amount: updateDto.total_amount !== undefined ? updateDto.total_amount : run.total_amount,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Payroll run updated successfully.',
      data: updated,
    };
  }

  async processPayroll(user: User, runId: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        period: true,
      },
    });

    if (!run) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Payroll run not found.',
      });
    }
    await this.assertRunBelongsToAccount(user, run);

    // Determine date range for milk sales
    const endDate = run.period_end || new Date();
    const paymentTermsDays = run.payment_terms_days || 15;
    const startDate = run.period_start || new Date(endDate.getTime() - paymentTermsDays * 24 * 60 * 60 * 1000);

    // Get all active payroll suppliers
    const payrollSuppliers = await this.prisma.payrollSupplier.findMany({
      where: {
        is_active: true,
      },
      include: {
        supplier_account: true,
      },
    });

    let totalAmount = 0;
    const payslipsCreated = [];

    // Process each supplier
    for (const payrollSupplier of payrollSuppliers) {
      const supplierPaymentTerms = payrollSupplier.payment_terms_days || paymentTermsDays;
      const supplierEndDate = run.period_end || new Date();
      const supplierStartDate = run.period_start || new Date(supplierEndDate.getTime() - supplierPaymentTerms * 24 * 60 * 60 * 1000);

      // Get milk sales for this supplier - exclude already paid (in paid payslips)
      const milkSales = await this.prisma.milkSale.findMany({
        where: {
          supplier_account_id: payrollSupplier.supplier_account_id,
          customer_account_id: user.default_account_id,
          sale_at: {
            gte: supplierStartDate,
            lte: supplierEndDate,
          },
          status: { not: 'deleted' },
          payment_status: { not: 'paid' },
        },
        orderBy: {
          sale_at: 'asc',
        },
      });

      if (milkSales.length === 0) {
        continue; // Skip suppliers with no milk sales in this period
      }

      // Calculate gross amount (total from milk sales)
      const grossAmount = milkSales.reduce((sum, sale) => {
        return sum + Number(sale.quantity) * Number(sale.unit_price);
      }, 0);

      // Get supplier's unpaid inventory debt (InventorySales where supplier bought on debt)
      const inventoryDebtSales = await this.prisma.inventorySale.findMany({
        where: {
          buyer_account_id: payrollSupplier.supplier_account_id,
          buyer_type: 'supplier',
          payment_status: { not: 'paid' },
          product: {
            account_id: user.default_account_id,
          },
        },
        orderBy: { sale_date: 'asc' },
      });

      const totalInventoryDebt = inventoryDebtSales.reduce((sum, sale) => {
        const total = Number(sale.total_amount);
        const paid = Number(sale.amount_paid || 0);
        return sum + (total - paid);
      }, 0);

      const totalLoanDebt = user.default_account_id
        ? await this.loansService.getOutstandingBalanceForBorrower(
            user.default_account_id,
            payrollSupplier.supplier_account_id,
          )
        : 0;

      const totalDeductions = Math.min(
        grossAmount,
        totalInventoryDebt + totalLoanDebt,
      );
      const netAmount = Math.max(0, grossAmount - totalDeductions);

      if (netAmount <= 0 && grossAmount <= 0) {
        continue;
      }

      // Create payslip
      const payslip = await this.prisma.payrollPayslip.create({
        data: {
          run_id: runId,
          supplier_account_id: payrollSupplier.supplier_account_id,
          gross_amount: grossAmount,
          total_deductions: totalDeductions,
          net_amount: netAmount,
          milk_sales_count: milkSales.length,
          period_start: supplierStartDate,
          period_end: supplierEndDate,
          status: 'generated',
        },
      });

      let remainingToAllocate = totalDeductions;
      if (inventoryDebtSales.length > 0 && remainingToAllocate > 0) {
        for (const invSale of inventoryDebtSales) {
          if (remainingToAllocate <= 0) break;
          const outstanding = Number(invSale.total_amount) - Number(invSale.amount_paid || 0);
          if (outstanding <= 0) continue;
          const deductAmount = Math.min(remainingToAllocate, outstanding);
          remainingToAllocate -= deductAmount;
          await this.prisma.payrollDeduction.create({
            data: {
              payslip_id: payslip.id,
              deduction_type: 'inventory_debt',
              amount: deductAmount,
              description: `Inventory debt - Sale ${invSale.id.substring(0, 8)}`,
              inventory_sale_id: invSale.id,
            },
          });
        }
      }
      if (remainingToAllocate > 0 && user.default_account_id) {
        const activeLoans = await this.loansService.getActiveLoansForBorrower(
          user.default_account_id,
          payrollSupplier.supplier_account_id,
        );
        for (const loan of activeLoans) {
          if (remainingToAllocate <= 0) break;
          const outstanding = loan.principal - loan.amount_repaid;
          if (outstanding <= 0) continue;
          const deductAmount = Math.min(remainingToAllocate, outstanding);
          remainingToAllocate -= deductAmount;
          await this.prisma.payrollDeduction.create({
            data: {
              payslip_id: payslip.id,
              deduction_type: 'loan_repayment',
              amount: deductAmount,
              description: `Loan repayment - Loan ${loan.id.substring(0, 8)}`,
              loan_id: loan.id,
            },
          });
        }
      }

      totalAmount += netAmount;
      payslipsCreated.push({
        supplier: payrollSupplier.supplier_account.name,
        net_amount: netAmount,
        milk_sales_count: milkSales.length,
      });
    }

    // Update run with total amount
    await this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        total_amount: totalAmount,
        status: 'completed',
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Payroll processed successfully.',
      data: {
        run_id: runId,
        suppliers_processed: payslipsCreated.length,
        total_amount: totalAmount,
        payslips: payslipsCreated,
      },
    };
  }

  async generatePayroll(user: User, generateDto: GeneratePayrollDto) {
    let run: any = null;
    try {
      // Use account from request (UI-selected) so run and data always match the account the user is viewing
      let accountId: string;
      if (generateDto.account_id) {
        const hasAccess = await this.prisma.userAccount.findFirst({
          where: {
            user_id: user.id,
            account_id: generateDto.account_id,
            status: 'active',
          },
          include: { account: true },
        });
        if (!hasAccess?.account || hasAccess.account.status !== 'active') {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'Account not found or access denied.',
          });
        }
        accountId = generateDto.account_id;
      } else {
        if (!user.default_account_id) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'No valid default account found.',
          });
        }
        accountId = user.default_account_id;
      }

      // Create payroll run (scoped to the account we're generating for)
      run = await this.prisma.payrollRun.create({
      data: {
        account_id: accountId,
        period_id: null,
        run_name: generateDto.run_name?.trim() || null,
        run_date: new Date(),
        period_start: new Date(generateDto.period_start),
        period_end: new Date(generateDto.period_end),
        payment_terms_days: generateDto.payment_terms_days || 15,
        total_amount: 0,
        status: 'draft',
        created_by: user.id,
      },
    });

      // Get supplier account IDs if specific suppliers are selected
      let supplierAccountIds: string[] | undefined;
      if (generateDto.supplier_account_codes && generateDto.supplier_account_codes.length > 0) {
        console.log('Looking for supplier accounts with codes:', generateDto.supplier_account_codes);
        const accounts = await this.prisma.account.findMany({
          where: {
            code: { in: generateDto.supplier_account_codes },
          },
          select: { id: true, code: true },
        });
        console.log('Found accounts:', accounts.length, accounts.map(a => a.code));
        supplierAccountIds = accounts.map((a) => a.id);

        if (supplierAccountIds.length === 0) {
          // Delete the run if no valid accounts found
          await this.prisma.payrollRun.delete({ where: { id: run.id } });
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'No valid supplier accounts found for the provided account codes.',
          });
        }

        // Automatically create PayrollSupplier records for suppliers that don't exist
        const paymentTermsDays = generateDto.payment_terms_days || 15;
        for (const accountId of supplierAccountIds) {
          await this.prisma.payrollSupplier.upsert({
            where: { supplier_account_id: accountId },
            update: {
              is_active: true,
              payment_terms_days: paymentTermsDays,
            },
            create: {
              supplier_account_id: accountId,
              payment_terms_days: paymentTermsDays,
              is_active: true,
            },
          });
        }
      }

    // Get payroll suppliers - filter by selected suppliers if provided
    const payrollSuppliersWhere: any = {
      is_active: true,
    };

    if (supplierAccountIds && supplierAccountIds.length > 0) {
      payrollSuppliersWhere.supplier_account_id = { in: supplierAccountIds };
    }

    console.log('Finding payroll suppliers with where clause:', JSON.stringify(payrollSuppliersWhere));
    const payrollSuppliers = await this.prisma.payrollSupplier.findMany({
      where: payrollSuppliersWhere,
      include: {
        supplier_account: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
      },
    });
    console.log('Found payroll suppliers:', payrollSuppliers.length);

    if (payrollSuppliers.length === 0) {
      // Delete the run if no suppliers found
      await this.prisma.payrollRun.delete({ where: { id: run.id } });
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No active suppliers found for the selected criteria.',
      });
    }

    const startDate = new Date(generateDto.period_start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(generateDto.period_end);
    endDate.setHours(23, 59, 59, 999); // Include the entire end date
    
    const paymentTermsDays = generateDto.payment_terms_days || 15;

    let totalAmount = 0;
    const payslipsCreated = [];

    // Process each supplier
    for (const payrollSupplier of payrollSuppliers) {
      // Skip if supplier account is missing or inactive
      if (!payrollSupplier.supplier_account || payrollSupplier.supplier_account.status !== 'active') {
        console.warn(`Skipping supplier ${payrollSupplier.id}: account missing or inactive`);
        continue;
      }

      console.log(`Processing supplier: ${payrollSupplier.supplier_account.name} (${payrollSupplier.supplier_account.code})`);
      const supplierPaymentTerms = payrollSupplier.payment_terms_days || paymentTermsDays;

      // Get milk sales for this supplier
      // Exclude deleted sales, but include pending, accepted, rejected, and cancelled
      // (rejected and cancelled might need to be reviewed, but we include them for now)
      console.log(`Querying milk sales for supplier ${payrollSupplier.supplier_account_id}, customer ${accountId}, dates ${startDate.toISOString()} to ${endDate.toISOString()}`);
      const milkSales = await this.prisma.milkSale.findMany({
        where: {
          supplier_account_id: payrollSupplier.supplier_account_id,
          customer_account_id: accountId,
          sale_at: {
            gte: startDate,
            lte: endDate,
          },
          status: { not: 'deleted' },
          payment_status: { not: 'paid' },
        },
        orderBy: {
          sale_at: 'asc',
        },
      });

      console.log(`Found ${milkSales.length} milk sales for supplier ${payrollSupplier.supplier_account.name}`);

      if (milkSales.length === 0) {
        // Still create a payslip with 0 amount to show the supplier was processed
        const payslip = await this.prisma.payrollPayslip.create({
          data: {
            run_id: run.id,
            supplier_account_id: payrollSupplier.supplier_account_id,
            payroll_supplier_id: payrollSupplier.id,
            gross_amount: 0,
            total_deductions: 0,
            net_amount: 0,
            milk_sales_count: 0,
            period_start: startDate,
            period_end: endDate,
            status: 'generated',
          },
        });

        payslipsCreated.push({
          supplier: payrollSupplier.supplier_account?.name || 'Unknown',
          supplier_code: payrollSupplier.supplier_account?.code || 'Unknown',
          net_amount: 0,
          gross_amount: 0,
          milk_sales_count: 0,
        });
        continue; // Skip to next supplier
      }

      // Calculate gross amount (total from milk sales)
      const grossAmount = milkSales.reduce((sum, sale) => {
        return sum + Number(sale.quantity) * Number(sale.unit_price);
      }, 0);

      // Get supplier's unpaid inventory debt (InventorySales where supplier bought on debt)
      const inventoryDebtSales = await this.prisma.inventorySale.findMany({
        where: {
          buyer_account_id: payrollSupplier.supplier_account_id,
          buyer_type: 'supplier',
          payment_status: { not: 'paid' },
          product: {
            account_id: accountId,
          },
        },
        orderBy: { sale_date: 'asc' },
      });

      const totalInventoryDebt = inventoryDebtSales.reduce((sum, sale) => {
        const total = Number(sale.total_amount);
        const paid = Number(sale.amount_paid || 0);
        return sum + (total - paid);
      }, 0);

      // Outstanding loan balance for this supplier (they borrowed from us)
      const totalLoanDebt = accountId
        ? await this.loansService.getOutstandingBalanceForBorrower(
            accountId,
            payrollSupplier.supplier_account_id,
          )
        : 0;

      // Applicable supplier charges (one-time or recurring, from Charges module)
      const applicableCharges = accountId
        ? await this.chargesService.getApplicableChargesForPayroll(
            accountId,
            payrollSupplier.supplier_account_id,
            startDate,
            endDate,
            grossAmount,
          )
        : [];
      const totalChargeAmount = applicableCharges.reduce((sum, c) => sum + c.amount, 0);

      // Can only deduct up to gross (inventory + loans + charges)
      const totalDeductions = Math.min(
        grossAmount,
        totalInventoryDebt + totalLoanDebt + totalChargeAmount,
      );
      const netAmount = Math.max(0, grossAmount - totalDeductions);

      if (netAmount <= 0 && grossAmount <= 0) {
        continue; // Skip if no milk sales and no payout
      }

      // Create payslip
      const payslip = await this.prisma.payrollPayslip.create({
        data: {
          run_id: run.id,
          supplier_account_id: payrollSupplier.supplier_account_id,
          payroll_supplier_id: payrollSupplier.id,
          gross_amount: grossAmount,
          total_deductions: totalDeductions,
          net_amount: netAmount,
          milk_sales_count: milkSales.length,
          period_start: startDate,
          period_end: endDate,
          status: 'generated',
        },
      });

      // Allocate deductions: first inventory, then loans, then charges
      let remainingToAllocate = totalDeductions;

      // PayrollDeduction - inventory debt (oldest first)
      if (inventoryDebtSales.length > 0 && remainingToAllocate > 0) {
        for (const invSale of inventoryDebtSales) {
          if (remainingToAllocate <= 0) break;
          const outstanding = Number(invSale.total_amount) - Number(invSale.amount_paid || 0);
          if (outstanding <= 0) continue;
          const deductAmount = Math.min(remainingToAllocate, outstanding);
          remainingToAllocate -= deductAmount;
          await this.prisma.payrollDeduction.create({
            data: {
              payslip_id: payslip.id,
              deduction_type: 'inventory_debt',
              amount: deductAmount,
              description: `Inventory debt - Sale ${invSale.id.substring(0, 8)}`,
              inventory_sale_id: invSale.id,
            },
          });
        }
      }

      // PayrollDeduction - loan repayment (oldest first)
      if (remainingToAllocate > 0 && accountId) {
        const activeLoans = await this.loansService.getActiveLoansForBorrower(
          accountId,
          payrollSupplier.supplier_account_id,
        );
        for (const loan of activeLoans) {
          if (remainingToAllocate <= 0) break;
          const outstanding = loan.principal - loan.amount_repaid;
          if (outstanding <= 0) continue;
          const deductAmount = Math.min(remainingToAllocate, outstanding);
          remainingToAllocate -= deductAmount;
          await this.prisma.payrollDeduction.create({
            data: {
              payslip_id: payslip.id,
              deduction_type: 'loan_repayment',
              amount: deductAmount,
              description: `Loan repayment - Loan ${loan.id.substring(0, 8)}`,
              loan_id: loan.id,
            },
          });
        }
      }

      // PayrollDeduction - supplier charges (fee)
      for (const ch of applicableCharges) {
        if (remainingToAllocate <= 0) break;
        const deductAmount = Math.min(remainingToAllocate, ch.amount);
        if (deductAmount <= 0) continue;
        remainingToAllocate -= deductAmount;
        await this.prisma.payrollDeduction.create({
          data: {
            payslip_id: payslip.id,
            deduction_type: 'fee',
            amount: deductAmount,
            description: ch.name,
            charge_id: ch.chargeId,
          },
        });
        if (ch.kind === 'one_time') {
          await this.chargesService.recordChargeApplication(
            ch.chargeId,
            payrollSupplier.supplier_account_id,
            payslip.id,
            deductAmount,
          );
        }
      }

      totalAmount += netAmount;
      const remainingDebt = Math.max(
        0,
        totalInventoryDebt + totalLoanDebt - totalDeductions,
      );
      payslipsCreated.push({
        supplier: payrollSupplier.supplier_account?.name || 'Unknown',
        supplier_code: payrollSupplier.supplier_account?.code || 'Unknown',
        net_amount: netAmount,
        gross_amount: grossAmount,
        milk_sales_count: milkSales.length,
        inventory_debt_deducted: totalDeductions,
        remaining_debt: remainingDebt > 0 ? remainingDebt : undefined,
      });
    }

    // Update run with total amount
    await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        total_amount: totalAmount,
        status: 'completed',
      },
    });

    return {
      code: 200,
      status: 'success',
      message: payslipsCreated.length > 0
        ? `Payroll generated successfully for ${payslipsCreated.length} supplier(s).`
        : `Payroll generated but no milk sales found for selected suppliers in the date range.`,
      data: {
        run_id: run.id,
        period_start: generateDto.period_start,
        period_end: generateDto.period_end,
        suppliers_processed: payslipsCreated.length,
        total_amount: totalAmount,
        payslips: payslipsCreated,
      },
    };
    } catch (error) {
      console.error('Error in generatePayroll:', error);
      console.error('Error stack:', error?.stack);
      console.error('Error message:', error?.message);
      // If a run was created, try to delete it
      if (run?.id) {
        try {
          await this.prisma.payrollRun.delete({ where: { id: run.id } }).catch(() => {});
        } catch (e) {
          // Ignore deletion errors
        }
      }
      throw error;
    }
  }

  async markAsPaid(user: User, runId: string, markPaidDto: MarkPayrollPaidDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    // Find the payroll run
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        payslips: {
          include: {
            supplier_account: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Payroll run not found.',
      });
    }
    await this.assertRunBelongsToAccount(user, run);

    const paymentDate = markPaidDto.payment_date 
      ? new Date(markPaidDto.payment_date) 
      : new Date();

    // If payslip_id is provided, mark only that payslip as paid
    if (markPaidDto.payslip_id) {
      const payslip = run.payslips.find((p) => p.id === markPaidDto.payslip_id);
      
      if (!payslip) {
        throw new NotFoundException({
          code: 404,
          status: 'error',
          message: 'Payslip not found in this payroll run.',
        });
      }

      if (payslip.status === 'paid') {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Payslip is already marked as paid.',
        });
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.payrollPayslip.update({
          where: { id: payslip.id },
          data: {
            status: 'paid',
            payment_date: paymentDate,
            paid_by: user.id,
          },
        });

        const inventoryDeductions = await tx.payrollDeduction.findMany({
          where: {
            payslip_id: payslip.id,
            deduction_type: 'inventory_debt',
            inventory_sale_id: { not: null },
          },
        });
        for (const ded of inventoryDeductions) {
          if (ded.inventory_sale_id) {
            const invSale = await tx.inventorySale.findUnique({
              where: { id: ded.inventory_sale_id },
            });
            if (invSale) {
              const newAmountPaid = Number(invSale.amount_paid || 0) + Number(ded.amount);
              const total = Number(invSale.total_amount);
              const paymentStatus = newAmountPaid >= total ? 'paid' : 'partial';
              await tx.inventorySale.update({
                where: { id: invSale.id },
                data: {
                  amount_paid: newAmountPaid,
                  payment_status: paymentStatus,
                },
              });
            }
          }
        }

        // Apply loan repayment deductions to Loan.amount_repaid
        const loanDeductions = await tx.payrollDeduction.findMany({
          where: {
            payslip_id: payslip.id,
            deduction_type: 'loan_repayment',
            loan_id: { not: null },
          },
        });
        for (const ded of loanDeductions) {
          if (ded.loan_id) {
            const loan = await tx.loan.findUnique({ where: { id: ded.loan_id } });
            if (loan) {
              const newRepaid = Number(loan.amount_repaid || 0) + Number(ded.amount);
              const principal = Number(loan.principal);
              await tx.loan.update({
                where: { id: loan.id },
                data: {
                  amount_repaid: newRepaid,
                  status: newRepaid >= principal ? 'closed' : loan.status,
                },
              });
              await tx.loanRepayment.create({
                data: {
                  loan_id: loan.id,
                  amount: ded.amount,
                  repayment_date: paymentDate,
                  source: 'payroll',
                },
              });
            }
          }
        }

        const milkSalesToSettle = await tx.milkSale.findMany({
          where: {
            supplier_account_id: payslip.supplier_account_id,
            customer_account_id: user.default_account_id,
            sale_at: {
              gte: payslip.period_start,
              lte: payslip.period_end,
            },
            status: { not: 'deleted' },
            payment_status: { not: 'paid' },
          },
        });
        for (const milkSale of milkSalesToSettle) {
          const totalAmount = Number(milkSale.quantity) * Number(milkSale.unit_price);
          await tx.milkSale.update({
            where: { id: milkSale.id },
            data: {
              amount_paid: totalAmount,
              payment_status: 'paid',
            },
          });
        }
      });

      // Create expense transaction in finance (outside tx - don't rollback payroll if finance fails)
      const netAmount = Number(payslip.net_amount);
      if (netAmount > 0) {
        try {
          await this.transactionsService.createTransaction(user, {
            type: TransactionType.EXPENSE,
            amount: netAmount,
            description: `Payroll payment to ${payslip.supplier_account?.name || 'Supplier'} - Period: ${payslip.period_start.toISOString().split('T')[0]} to ${payslip.period_end.toISOString().split('T')[0]}`,
            transaction_date: paymentDate.toISOString().split('T')[0],
          });
        } catch (error) {
          console.error('Failed to create finance transaction for payroll payment:', error);
          // Don't fail the payment marking if finance transaction fails
        }
      }

      return {
        code: 200,
        status: 'success',
        message: 'Payslip marked as paid successfully.',
        data: {
          payslip_id: payslip.id,
          supplier: payslip.supplier_account?.name,
          net_amount: netAmount,
          payment_date: paymentDate,
        },
      };
    }

    // Otherwise, mark all unpaid payslips in the run as paid
    const unpaidPayslips = run.payslips.filter((p) => p.status !== 'paid');
    
    if (unpaidPayslips.length === 0) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'All payslips in this run are already marked as paid.',
      });
    }

    let totalPaid = 0;
    const updatedPayslips = [];

    // Update all unpaid payslips (each payslip in its own transaction for atomicity)
    for (const payslip of unpaidPayslips) {
      const netAmount = Number(payslip.net_amount);

      await this.prisma.$transaction(async (tx) => {
        await tx.payrollPayslip.update({
          where: { id: payslip.id },
          data: {
            status: 'paid',
            payment_date: paymentDate,
            paid_by: user.id,
          },
        });

        const inventoryDeductions = await tx.payrollDeduction.findMany({
          where: {
            payslip_id: payslip.id,
            deduction_type: 'inventory_debt',
            inventory_sale_id: { not: null },
          },
        });
        for (const ded of inventoryDeductions) {
          if (ded.inventory_sale_id) {
            const invSale = await tx.inventorySale.findUnique({
              where: { id: ded.inventory_sale_id },
            });
            if (invSale) {
              const newAmountPaid = Number(invSale.amount_paid || 0) + Number(ded.amount);
              const total = Number(invSale.total_amount);
              const paymentStatus = newAmountPaid >= total ? 'paid' : 'partial';
              await tx.inventorySale.update({
                where: { id: invSale.id },
                data: {
                  amount_paid: newAmountPaid,
                  payment_status: paymentStatus,
                },
              });
            }
          }
        }

        const loanDeductions = await tx.payrollDeduction.findMany({
          where: {
            payslip_id: payslip.id,
            deduction_type: 'loan_repayment',
            loan_id: { not: null },
          },
        });
        for (const ded of loanDeductions) {
          if (ded.loan_id) {
            const loan = await tx.loan.findUnique({ where: { id: ded.loan_id } });
            if (loan) {
              const newRepaid = Number(loan.amount_repaid || 0) + Number(ded.amount);
              const principal = Number(loan.principal);
              await tx.loan.update({
                where: { id: loan.id },
                data: {
                  amount_repaid: newRepaid,
                  status: newRepaid >= principal ? 'closed' : loan.status,
                },
              });
              await tx.loanRepayment.create({
                data: {
                  loan_id: loan.id,
                  amount: ded.amount,
                  repayment_date: paymentDate,
                  source: 'payroll',
                },
              });
            }
          }
        }

        const milkSalesToSettle = await tx.milkSale.findMany({
          where: {
            supplier_account_id: payslip.supplier_account_id,
            customer_account_id: user.default_account_id,
            sale_at: {
              gte: payslip.period_start,
              lte: payslip.period_end,
            },
            status: { not: 'deleted' },
            payment_status: { not: 'paid' },
          },
        });
        for (const milkSale of milkSalesToSettle) {
          const totalAmount = Number(milkSale.quantity) * Number(milkSale.unit_price);
          await tx.milkSale.update({
            where: { id: milkSale.id },
            data: {
              amount_paid: totalAmount,
              payment_status: 'paid',
            },
          });
        }
      });

      // Create expense transaction for each payslip (outside tx)
      if (netAmount > 0) {
        try {
          await this.transactionsService.createTransaction(user, {
            type: TransactionType.EXPENSE,
            amount: netAmount,
            description: `Payroll payment to ${payslip.supplier_account?.name || 'Supplier'} - Period: ${payslip.period_start.toISOString().split('T')[0]} to ${payslip.period_end.toISOString().split('T')[0]}`,
            transaction_date: paymentDate.toISOString().split('T')[0],
          });
        } catch (error) {
          console.error(`Failed to create finance transaction for payslip ${payslip.id}:`, error);
          // Don't fail the payment marking if finance transaction fails
        }
      }

      totalPaid += netAmount;
      updatedPayslips.push({
        payslip_id: payslip.id,
        supplier: payslip.supplier_account?.name,
        net_amount: netAmount,
      });
    }

    return {
      code: 200,
      status: 'success',
      message: `${updatedPayslips.length} payslip(s) marked as paid successfully.`,
      data: {
        run_id: run.id,
        payslips_paid: updatedPayslips.length,
        total_amount: totalPaid,
        payment_date: paymentDate,
        payslips: updatedPayslips,
      },
    };
  }

  async exportPayroll(user: User, runId: string, format: string, res: Response) {
    // Find the payroll run
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        period: true,
        payslips: {
          include: {
            supplier_account: {
              select: {
                id: true,
                code: true,
                name: true,
                bank_name: true,
                bank_account_number: true,
              },
            },
            deductions: true,
          },
          orderBy: {
            supplier_account: {
              name: 'asc',
            },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Payroll run not found.',
      });
    }
    await this.assertRunBelongsToAccount(user, run);

    const exportFormat = (format || 'excel').toLowerCase();
    const periodName = run.run_name || run.period?.period_name || 'Flexible Run';
    const periodStart = run.period_start 
      ? new Date(run.period_start).toLocaleDateString() 
      : 'N/A';
    const periodEnd = run.period_end 
      ? new Date(run.period_end).toLocaleDateString() 
      : 'N/A';
    const runDate = new Date(run.run_date).toLocaleDateString();

    const totalLitersByPayslip = new Map<string, number>();
    for (const payslip of run.payslips) {
      const litersAgg = await this.prisma.milkSale.aggregate({
        _sum: { quantity: true },
        where: {
          supplier_account_id: payslip.supplier_account_id,
          customer_account_id: run.account_id ?? undefined,
          sale_at: {
            gte: payslip.period_start,
            lte: payslip.period_end,
          },
          status: { not: 'deleted' },
        },
      });
      totalLitersByPayslip.set(payslip.id, Number(litersAgg._sum.quantity || 0));
    }

    if (exportFormat === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const filename = `payroll_${run.id.substring(0, 8)}_${Date.now()}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      doc.pipe(res);

      doc.fontSize(20).text('Payroll Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Period: ${periodName}`, { align: 'center' });
      doc.text(`Date Range: ${periodStart} - ${periodEnd}`, { align: 'center' });
      doc.text(`Run Date: ${runDate}`, { align: 'center' });
      doc.text(`Status: ${run.status}`, { align: 'center' });
      doc.text(`Total Amount: ${Number(run.total_amount).toLocaleString()} Frw`, { align: 'center' });
      doc.moveDown(2);

      let yPos = doc.y;
      doc.fontSize(10);

      doc.text('Supplier', 40, yPos, { width: 100 });
      doc.text('Code', 140, yPos, { width: 70 });
      doc.text('Bank', 210, yPos, { width: 110 });
      doc.text('Bank Account', 320, yPos, { width: 90 });
      doc.text('Liters', 410, yPos, { width: 55, align: 'right' });
      doc.text('Gross', 465, yPos, { width: 85, align: 'right' });
      doc.text('Deductions', 550, yPos, { width: 85, align: 'right' });
      doc.text('Net Amount', 635, yPos, { width: 85, align: 'right' });
      doc.text('Status', 725, yPos, { width: 70 });
      
      yPos += 20;
      doc.moveTo(40, yPos).lineTo(800, yPos).stroke();
      yPos += 10;

      for (const payslip of run.payslips) {
        if (yPos > 540) {
          doc.addPage();
          yPos = 40;
        }

        const supplierName = payslip.supplier_account?.name || 'Unknown';
        const supplierCode = payslip.supplier_account?.code || 'N/A';
        const bankName = payslip.supplier_account?.bank_name || 'N/A';
        const bankAccount = payslip.supplier_account?.bank_account_number || 'N/A';
        const totalLiters = totalLitersByPayslip.get(payslip.id) || 0;
        const grossAmount = Number(payslip.gross_amount).toLocaleString();
        const deductions = Number(payslip.total_deductions).toLocaleString();
        const netAmount = Number(payslip.net_amount).toLocaleString();

        doc.text(supplierName.substring(0, 22), 40, yPos, { width: 100 });
        doc.text(supplierCode.substring(0, 10), 140, yPos, { width: 70 });
        doc.text(bankName.substring(0, 18), 210, yPos, { width: 110 });
        doc.text(bankAccount.substring(0, 18), 320, yPos, { width: 90 });
        doc.text(totalLiters.toLocaleString(undefined, { maximumFractionDigits: 2 }), 410, yPos, { width: 55, align: 'right' });
        doc.text(grossAmount, 465, yPos, { width: 85, align: 'right' });
        doc.text(deductions, 550, yPos, { width: 85, align: 'right' });
        doc.text(netAmount, 635, yPos, { width: 85, align: 'right' });
        doc.text(payslip.status, 725, yPos, { width: 70 });

        yPos += 20;
      }

      yPos += 10;
      doc.moveTo(40, yPos).lineTo(800, yPos).stroke();
      yPos += 15;
      doc.fontSize(12);
      doc.text(`Total: ${Number(run.total_amount).toLocaleString()} Frw`, 635, yPos, { width: 85, align: 'right' });

      doc.end();
    } else {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Payroll Report');

      worksheet.mergeCells('A1:J1');
      worksheet.getCell('A1').value = 'Payroll Report';
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.getCell('A2').value = 'Period:';
      worksheet.getCell('B2').value = periodName;
      worksheet.getCell('A3').value = 'Date Range:';
      worksheet.getCell('B3').value = `${periodStart} - ${periodEnd}`;
      worksheet.getCell('A4').value = 'Run Date:';
      worksheet.getCell('B4').value = runDate;
      worksheet.getCell('A5').value = 'Status:';
      worksheet.getCell('B5').value = run.status;
      worksheet.getCell('A6').value = 'Total Amount:';
      worksheet.getCell('B6').value = Number(run.total_amount);
      worksheet.getCell('B6').numFmt = '#,##0.00';

      const headerRow = worksheet.getRow(8);
      headerRow.values = ['Supplier', 'Code', 'Bank', 'Bank Account', 'Total Liters (L)', 'Gross Amount', 'Deductions', 'Net Amount', 'Milk Sales', 'Status', 'Payment Date'];
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      worksheet.getColumn(1).width = 30;
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 20;
      worksheet.getColumn(4).width = 22;
      worksheet.getColumn(5).width = 15;
      worksheet.getColumn(6).width = 15;
      worksheet.getColumn(7).width = 15;
      worksheet.getColumn(8).width = 15;
      worksheet.getColumn(9).width = 12;
      worksheet.getColumn(10).width = 12;
      worksheet.getColumn(11).width = 15;

      let rowIndex = 9;
      for (const payslip of run.payslips) {
        const row = worksheet.getRow(rowIndex);
        row.values = [
          payslip.supplier_account?.name || 'Unknown',
          payslip.supplier_account?.code || 'N/A',
          payslip.supplier_account?.bank_name || 'N/A',
          payslip.supplier_account?.bank_account_number || 'N/A',
          totalLitersByPayslip.get(payslip.id) || 0,
          Number(payslip.gross_amount),
          Number(payslip.total_deductions),
          Number(payslip.net_amount),
          payslip.milk_sales_count,
          payslip.status,
          payslip.payment_date ? new Date(payslip.payment_date).toLocaleDateString() : '',
        ];

        // Format amount columns
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(8).numFmt = '#,##0.00';

        rowIndex++;
      }

      // Total row
      const totalRow = worksheet.getRow(rowIndex + 1);
      totalRow.getCell(1).value = 'TOTAL';
      totalRow.getCell(1).font = { bold: true };
      totalRow.getCell(8).value = Number(run.total_amount);
      totalRow.getCell(8).numFmt = '#,##0.00';
      totalRow.getCell(8).font = { bold: true };

      const filename = `payroll_${run.id.substring(0, 8)}_${Date.now()}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
    }
  }
}
