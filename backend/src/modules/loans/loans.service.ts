import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { RecordRepaymentDto } from './dto/record-repayment.dto';
import { TransactionsService } from '../accounting/transactions/transactions.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { composeUserFullName, splitIntoFirstLast } from '../../common/utils/user-name.util';

@Injectable()
export class LoansService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
  ) {}

  async create(user: User, dto: CreateLoanDto) {
    let accountId = user.default_account_id;
    if (dto.account_id) {
      const hasAccess = await this.prisma.userAccount.findFirst({
        where: {
          user_id: user.id,
          account_id: dto.account_id,
          status: 'active',
        },
      });
      if (hasAccess) accountId = dto.account_id;
    }
    if (!accountId) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    let borrowerAccountId: string | null = dto.borrower_account_id || null;
    let borrowerName: string | null = dto.borrower_name || null;

    if (dto.borrower_type !== 'other') {
      if (!dto.borrower_account_id) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'borrower_account_id is required when borrower_type is supplier or customer.',
        });
      }
    } else {
      // "Other": phone is required so we can find or create their account
      const phone = dto.borrower_phone?.trim();
      if (!phone) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Borrower phone is required when borrower type is "other".',
        });
      }
      const name = (dto.borrower_name || 'Other borrower').trim();
      borrowerAccountId = await this.findOrCreateAccountByPhone(user.id, phone, name);
      borrowerName = name;
    }

    const disbursementDate = new Date(dto.disbursement_date);
    const dueDate = dto.due_date ? new Date(dto.due_date) : null;

    const loan = await this.prisma.loan.create({
      data: {
        lender_account_id: accountId,
        borrower_type: dto.borrower_type,
        borrower_account_id: borrowerAccountId,
        borrower_name: borrowerName,
        principal: dto.principal,
        amount_repaid: 0,
        currency: dto.currency || 'RWF',
        status: 'active',
        disbursement_date: disbursementDate,
        due_date: dueDate,
        notes: dto.notes || null,
        created_by: user.id,
      },
      include: {
        borrower_account: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // Finance: record loan disbursement (DR Loans Receivable, CR Cash) – not an expense
    try {
      const borrowerLabel =
        loan.borrower_account?.name || loan.borrower_name || loan.borrower_account?.code || 'Borrower';
      await this.transactionsService.createLoanDisbursementEntry(
        user.id,
        accountId,
        dto.principal,
        `Loan to ${borrowerLabel} (${loan.id.substring(0, 8)})`,
        disbursementDate,
      );
    } catch (err) {
      await this.prisma.loan.delete({ where: { id: loan.id } });
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Loan created but failed to record in accounting. Please try again.',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Loan created successfully.',
      data: this.toLoanResponse(loan),
    };
  }

  async getMany(
    user: User,
    filters?: {
      account_id?: string;
      borrower_type?: string;
      status?: string;
      search?: string;
      date_from?: string;
      date_to?: string;
    },
  ) {
    let accountId = user.default_account_id;
    if (filters?.account_id) {
      const hasAccess = await this.prisma.userAccount.findFirst({
        where: {
          user_id: user.id,
          account_id: filters.account_id,
          status: 'active',
        },
      });
      if (hasAccess) accountId = filters.account_id;
    }
    if (!accountId) {
      return {
        code: 200,
        status: 'success',
        message: 'No default account set. Select an account to view loans.',
        data: [],
      };
    }

    const where: any = { lender_account_id: accountId };

    if (filters?.borrower_type) where.borrower_type = filters.borrower_type;
    if (filters?.status) where.status = filters.status;

    if (filters?.date_from || filters?.date_to) {
      where.disbursement_date = {};
      if (filters.date_from) where.disbursement_date.gte = new Date(filters.date_from);
      if (filters.date_to) {
        const d = new Date(filters.date_to);
        d.setHours(23, 59, 59, 999);
        where.disbursement_date.lte = d;
      }
    }

    if (filters?.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { borrower_name: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        {
          borrower_account: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const loans = await this.prisma.loan.findMany({
      where,
      include: {
        borrower_account: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const list = loans.map((l) => this.toLoanResponse(l));

    return {
      code: 200,
      status: 'success',
      message: 'Loans fetched successfully.',
      data: list,
    };
  }

  async getById(user: User, id: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    const loan = await this.prisma.loan.findFirst({
      where: {
        id,
        lender_account_id: user.default_account_id,
      },
      include: {
        borrower_account: {
          select: { id: true, code: true, name: true },
        },
        repayments: { orderBy: { repayment_date: 'desc' } },
      },
    });

    if (!loan) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Loan not found.',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Loan fetched successfully.',
      data: this.toLoanResponse(loan),
    };
  }

  async update(user: User, id: string, dto: UpdateLoanDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    const existing = await this.prisma.loan.findFirst({
      where: {
        id,
        lender_account_id: user.default_account_id,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Loan not found.',
      });
    }

    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.due_date !== undefined) data.due_date = dto.due_date ? new Date(dto.due_date) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const loan = await this.prisma.loan.update({
      where: { id },
      data,
      include: {
        borrower_account: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Loan updated successfully.',
      data: this.toLoanResponse(loan),
    };
  }

  async recordRepayment(user: User, id: string, dto: RecordRepaymentDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    const loan = await this.prisma.loan.findFirst({
      where: {
        id,
        lender_account_id: user.default_account_id,
      },
    });

    if (!loan) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Loan not found.',
      });
    }

    const principal = Number(loan.principal);
    const amountRepaid = Number(loan.amount_repaid || 0);
    const outstanding = principal - amountRepaid;
    if (dto.amount > outstanding) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `Repayment amount (${dto.amount}) cannot exceed outstanding balance (${outstanding}).`,
      });
    }

    const newAmountRepaid = amountRepaid + dto.amount;
    const status = newAmountRepaid >= principal ? 'closed' : loan.status;

    const repaymentDate = dto.repayment_date ? new Date(dto.repayment_date) : new Date();

    const updated = await this.prisma.loan.update({
      where: { id },
      data: {
        amount_repaid: newAmountRepaid,
        status,
      },
      include: {
        borrower_account: {
          select: { id: true, code: true, name: true },
        },
        repayments: { orderBy: { repayment_date: 'desc' } },
      },
    });

    const borrowerLabel =
      updated.borrower_account?.name || updated.borrower_name || updated.borrower_account?.code || 'Borrower';

    const repaymentRecord = await this.prisma.loanRepayment.create({
      data: {
        loan_id: id,
        amount: dto.amount,
        repayment_date: repaymentDate,
        notes: dto.notes || null,
        source: 'direct',
      },
    });

    try {
      await this.transactionsService.createLoanRepaymentEntry(
        user.id,
        loan.lender_account_id,
        dto.amount,
        `Loan repayment from ${borrowerLabel} (${id.substring(0, 8)})${dto.notes ? ` - ${dto.notes}` : ''}`,
        repaymentDate,
      );
    } catch (err) {
      await this.prisma.loanRepayment.delete({ where: { id: repaymentRecord.id } });
      await this.prisma.loan.update({
        where: { id },
        data: { amount_repaid: amountRepaid, status: loan.status },
      });
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Repayment failed to record in accounting. Please try again.',
      });
    }

    // Return loan with repayments list including the one we just created
    const refreshed = await this.prisma.loan.findFirst({
      where: { id, lender_account_id: user.default_account_id },
      include: {
        borrower_account: { select: { id: true, code: true, name: true } },
        repayments: { orderBy: { repayment_date: 'desc' } },
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Repayment recorded successfully.',
      data: this.toLoanResponse(refreshed ?? updated),
    };
  }

  async bulkCreate(
    user: User,
    rows: CreateLoanDto[],
  ): Promise<{ success: number; failed: number; errors: { row: number; message: string }[] }> {
    const errors: { row: number; message: string }[] = [];
    let success = 0;

    for (let i = 0; i < rows.length; i++) {
      try {
        await this.create(user, rows[i]);
        success++;
      } catch (e: unknown) {
        const message =
          (e as { response?: { message?: string | string[] } })?.response?.message ||
          (e as Error)?.message ||
          'Unknown error';
        errors.push({
          row: i + 1,
          message: Array.isArray(message) ? message.join(', ') : String(message),
        });
      }
    }

    return { success, failed: errors.length, errors };
  }

  getTemplateCsv(): string {
    const header =
      'borrower_type,borrower_account_id,borrower_name,borrower_phone,principal,currency,disbursement_date,due_date,notes';
    const example =
      'supplier,550e8400-e29b-41d4-a716-446655440000,,,100000,RWF,2025-02-12,2025-03-12,Working capital';
    const exampleOther = 'other,,John Doe,250788123456,100000,RWF,2025-02-12,2025-03-12,';
    return header + '\n' + example + '\n' + exampleOther;
  }

  private toLoanResponse(loan: any) {
    const principal = Number(loan.principal);
    const amountRepaid = Number(loan.amount_repaid || 0);
    const outstanding = principal - amountRepaid;
    const borrowerLabel =
      loan.borrower_account?.name ||
      loan.borrower_name ||
      loan.borrower_account?.code ||
      'Other';

    const repayments = (loan.repayments || []).map((r: any) => ({
      id: r.id,
      amount: Number(r.amount),
      repayment_date: r.repayment_date,
      notes: r.notes,
      source: r.source,
      created_at: r.created_at,
    }));

    return {
      id: loan.id,
      lender_account_id: loan.lender_account_id,
      borrower_type: loan.borrower_type,
      borrower_account_id: loan.borrower_account_id,
      borrower_account: loan.borrower_account
        ? {
            id: loan.borrower_account.id,
            code: loan.borrower_account.code,
            name: loan.borrower_account.name,
          }
        : null,
      borrower_name: loan.borrower_name,
      borrower_label: borrowerLabel,
      principal,
      amount_repaid: amountRepaid,
      outstanding,
      currency: loan.currency,
      status: loan.status,
      disbursement_date: loan.disbursement_date,
      due_date: loan.due_date,
      notes: loan.notes,
      created_at: loan.created_at,
      updated_at: loan.updated_at,
      repayments,
    };
  }

  /** Used by payroll: get outstanding loan balance for an account (borrower). */
  async getOutstandingBalanceForBorrower(lenderAccountId: string, borrowerAccountId: string): Promise<number> {
    const loans = await this.prisma.loan.findMany({
      where: {
        lender_account_id: lenderAccountId,
        borrower_account_id: borrowerAccountId,
        status: 'active',
      },
    });

    return loans.reduce((sum, l) => {
      const principal = Number(l.principal);
      const repaid = Number(l.amount_repaid || 0);
      return sum + (principal - repaid);
    }, 0);
  }

  /** Used by payroll: get active loans for a borrower account, oldest first, for allocation. */
  async getActiveLoansForBorrower(
    lenderAccountId: string,
    borrowerAccountId: string,
  ): Promise<{ id: string; principal: number; amount_repaid: number }[]> {
    const loans = await this.prisma.loan.findMany({
      where: {
        lender_account_id: lenderAccountId,
        borrower_account_id: borrowerAccountId,
        status: 'active',
      },
      orderBy: { disbursement_date: 'asc' },
    });

    return loans
      .map((l) => ({
        id: l.id,
        principal: Number(l.principal),
        amount_repaid: Number(l.amount_repaid || 0),
      }))
      .filter((l) => l.principal - l.amount_repaid > 0);
  }

  /**
   * Find or create a User and Account by phone (for "other" borrowers).
   * Returns the account id to use as borrower_account_id.
   */
  private async findOrCreateAccountByPhone(createdBy: string, phone: string, name: string): Promise<string> {
    let { first_name: fn, last_name: ln } = splitIntoFirstLast((name || '').trim());
    if (!fn && !ln) {
      fn = 'Borrower';
    }
    const displayName = composeUserFullName(fn, ln);

    const normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'A valid phone number is required to create an account for the borrower.',
      });
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: {
        user_accounts: {
          where: { status: 'active' },
          include: { account: true },
          take: 1,
        },
      },
    });

    if (existingUser) {
      if (existingUser.user_accounts.length > 0) {
        return existingUser.user_accounts[0].account_id;
      }
      // User exists but no account – create account and link
      const accountCode = `A_${randomBytes(3).toString('hex').toUpperCase()}`;
      const walletCode = `W_${randomBytes(3).toString('hex').toUpperCase()}`;
      const newAccount = await this.prisma.account.create({
        data: {
          code: accountCode,
          name: existingUser.name || name,
          type: 'tenant',
          status: 'active',
          created_by: createdBy,
        },
      });
      await this.prisma.userAccount.create({
        data: {
          user_id: existingUser.id,
          account_id: newAccount.id,
          role: 'supplier',
          status: 'active',
          created_by: createdBy,
        },
      });
      if (!existingUser.default_account_id) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { default_account_id: newAccount.id },
        });
      }
      await this.prisma.wallet.create({
        data: {
          code: walletCode,
          account_id: newAccount.id,
          type: 'regular',
          is_default: true,
          balance: 0,
          currency: 'RWF',
          status: 'active',
          created_by: createdBy,
        },
      });
      return newAccount.id;
    }

    // Create new user + account + user_account + wallet
    const userCode = `U_${randomBytes(3).toString('hex').toUpperCase()}`;
    const accountCode = `A_${randomBytes(3).toString('hex').toUpperCase()}`;
    const walletCode = `W_${randomBytes(3).toString('hex').toUpperCase()}`;
    const token = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash('Pass123!', 10);

    const newUser = await this.prisma.user.create({
      data: {
        code: userCode,
        first_name: fn,
        last_name: ln,
        name: displayName,
        phone: normalizedPhone,
        password_hash: passwordHash,
        token,
        status: 'active',
        account_type: 'supplier',
        created_by: createdBy,
      },
    });

    const newAccount = await this.prisma.account.create({
      data: {
        code: accountCode,
        name: displayName,
        type: 'tenant',
        status: 'active',
        created_by: createdBy,
      },
    });

    await this.prisma.userAccount.create({
      data: {
        user_id: newUser.id,
        account_id: newAccount.id,
        role: 'supplier',
        status: 'active',
        created_by: createdBy,
      },
    });

    await this.prisma.user.update({
      where: { id: newUser.id },
      data: { default_account_id: newAccount.id },
    });

    await this.prisma.wallet.create({
      data: {
        code: walletCode,
        account_id: newAccount.id,
        type: 'regular',
        is_default: true,
        balance: 0,
        currency: 'RWF',
        status: 'active',
        created_by: createdBy,
      },
    });

    return newAccount.id;
  }
}
