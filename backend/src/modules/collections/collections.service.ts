import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CancelCollectionDto } from './dto/cancel-collection.dto';
import { TransactionsService } from '../accounting/transactions/transactions.service';
import { TransactionType } from '../accounting/transactions/dto/create-transaction.dto';
import { SmsService } from '../../common/services/sms.service';

@Injectable()
export class CollectionsService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private smsService: SmsService,
  ) {}

  async getRejectionReasons(includeInactive = false) {
    return this.prisma.milkRejectionReason.findMany({
      where: includeInactive ? {} : { is_active: true },
      orderBy: {
        sort_order: 'asc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async getRejectionReasonById(id: string) {
    const reason = await this.prisma.milkRejectionReason.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!reason) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Rejection reason not found',
      });
    }

    return reason;
  }

  /**
   * Get animals belonging to a supplier account. Only allowed when the supplier
   * has an active relationship with the user's default account (customer).
   */
  async getSupplierAnimals(user: User, supplier_account_code: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }
    const supplierAccount = await this.prisma.account.findUnique({
      where: { code: supplier_account_code },
    });
    if (!supplierAccount) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Supplier account not found.',
      });
    }
    const relationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccount.id,
        customer_account_id: user.default_account_id,
        relationship_status: 'active',
      },
    });
    if (!relationship) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Supplier is not linked to your account.',
      });
    }
    return this.prisma.animal.findMany({
      where: { account_id: supplierAccount.id },
      select: {
        id: true,
        tag_number: true,
        name: true,
        breed: { select: { id: true, name: true, code: true } },
        gender: true,
        status: true,
      },
      orderBy: { tag_number: 'asc' },
    });
  }

  async createRejectionReason(createDto: { name: string; description?: string; sort_order?: number }) {
    // Check if name already exists
    const existing = await this.prisma.milkRejectionReason.findUnique({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'A rejection reason with this name already exists',
      });
    }

    // Get max sort_order if not provided
    let sortOrder = createDto.sort_order;
    if (sortOrder === undefined) {
      const maxOrder = await this.prisma.milkRejectionReason.findFirst({
        orderBy: { sort_order: 'desc' },
        select: { sort_order: true },
      });
      sortOrder = (maxOrder?.sort_order ?? 0) + 1;
    }

    return this.prisma.milkRejectionReason.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        sort_order: sortOrder,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async updateRejectionReason(id: string, updateDto: { name?: string; description?: string; is_active?: boolean; sort_order?: number }) {
    // Check if reason exists
    await this.getRejectionReasonById(id);

    // If updating name, check if new name already exists
    if (updateDto.name) {
      const existing = await this.prisma.milkRejectionReason.findUnique({
        where: { name: updateDto.name },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'A rejection reason with this name already exists',
        });
      }
    }

    return this.prisma.milkRejectionReason.update({
      where: { id },
      data: updateDto,
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async deleteRejectionReason(id: string) {
    // Check if reason exists
    await this.getRejectionReasonById(id);

    // Soft delete by setting is_active to false
    return this.prisma.milkRejectionReason.update({
      where: { id },
      data: { is_active: false },
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async createCollection(user: User, createDto: CreateCollectionDto) {
    const { supplier_account_code, quantity, status, collection_at, notes, payment_status, animal_id, milk_production_id } = createDto;

    // Check if user has a valid default account
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    const customerAccountId = user.default_account_id;

    // Get supplier account by code
    const supplierAccount = await this.prisma.account.findUnique({
      where: { code: supplier_account_code },
    });

    if (!supplierAccount || supplierAccount.status !== 'active') {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Supplier account not found.',
      });
    }

    const supplierAccountId = supplierAccount.id;

    // Get unit price from supplier-customer relationship
    const relationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccountId,
        customer_account_id: customerAccountId,
        relationship_status: 'active',
      },
    });

    const unitPrice = relationship?.price_per_liter || 0;

    // If animal_id provided, validate it belongs to the supplier's account
    let validatedAnimalId: string | null = null;
    if (animal_id) {
      const animal = await this.prisma.animal.findFirst({
        where: { id: animal_id, account_id: supplierAccountId },
      });
      if (!animal) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Animal not found or does not belong to the selected supplier.',
        });
      }
      validatedAnimalId = animal_id;
    }

    // If milk_production_id provided, validate it exists and belongs to supplier account; ensure animal_id matches if production has one
    let validatedMilkProductionId: string | null = null;
    if (milk_production_id) {
      const production = await this.prisma.milkProduction.findFirst({
        where: { id: milk_production_id, account_id: supplierAccountId },
        select: { id: true, animal_id: true },
      });
      if (!production) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Milk production record not found or does not belong to the selected supplier.',
        });
      }
      if (production.animal_id && validatedAnimalId && production.animal_id !== validatedAnimalId) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'animal_id does not match the animal on the selected milk production record.',
        });
      }
      validatedMilkProductionId = milk_production_id;
    }

    // Create milk sale (collection)
    try {
      const totalAmount = quantity * Number(unitPrice);
      const amountPaid = payment_status === 'paid' ? totalAmount : 0;
      const finalPaymentStatus = payment_status || 'unpaid';
      const paymentHistory = [];

      const milkSale = await this.prisma.milkSale.create({
        data: {
          supplier_account_id: supplierAccountId,
          customer_account_id: customerAccountId,
          animal_id: validatedAnimalId,
          milk_production_id: validatedMilkProductionId,
          quantity: quantity,
          unit_price: unitPrice,
          status: (status || 'accepted') as any,
          sale_at: new Date(collection_at),
          notes: notes || null,
          amount_paid: amountPaid,
          payment_status: finalPaymentStatus,
          payment_history: paymentHistory,
          recorded_by: user.id,
          created_by: user.id,
        },
      });

      // Create accounting entries based on payment status
      if (totalAmount > 0) {
        try {
          if (finalPaymentStatus === 'paid') {
            // Paid: Direct to Expense and Cash
            await this.transactionsService.createTransaction(user, {
              type: TransactionType.EXPENSE,
              amount: totalAmount,
              description: `Milk collection from ${supplierAccount.name} - ${quantity}L @ ${unitPrice} Frw/L`,
              transaction_date: new Date(collection_at).toISOString().split('T')[0],
            });
          } else {
            // Unpaid: Create AP entry (DR Expense, CR AP)
            await this.createAccountsPayableEntry(user, {
              collection_id: milkSale.id,
              supplier_account_id: supplierAccountId,
              supplier_name: supplierAccount.name,
              amount: totalAmount,
              description: `Milk collection from ${supplierAccount.name} - ${quantity}L @ ${unitPrice} Frw/L`,
              collection_date: new Date(collection_at),
            });
          }
        } catch (error) {
          // Log error but don't fail the collection creation
          console.error('Failed to create finance transaction for collection:', error);
        }
      }

      // Try to send SMS notification to supplier (best-effort, non-blocking for core flow)
      try {
        const supplierUserAccount = await this.prisma.userAccount.findFirst({
          where: {
            account_id: supplierAccountId,
            status: 'active',
          },
          include: {
            user: {
              select: {
                phone: true,
                name: true,
              },
            },
          },
        });

        const supplierPhone = supplierUserAccount?.user?.phone;

        if (supplierPhone) {
          const formattedQuantity = quantity.toFixed(2).replace(/\.00$/, '');
          const formattedDateTime = collection_at;
          
          // Build status-specific message in Kinyarwanda
          let statusText = '';
          let statusEmoji = '';
          
          switch (status) {
            case 'accepted':
              statusText = 'yemewe';
              statusEmoji = '✅';
              break;
            case 'pending':
              statusText = 'arategereje';
              statusEmoji = '⏳';
              break;
            case 'rejected':
              statusText = 'ntiyemewe';
              statusEmoji = '❌';
              break;
            case 'cancelled':
              statusText = 'yahagaritswe';
              statusEmoji = '🚫';
              break;
            default:
              statusText = status || 'yanditswe';
              statusEmoji = '📝';
          }
          
          const message = `${statusEmoji} Muraho ${supplierUserAccount.user.name || 'muhinzi'}, amata yanyu ${formattedQuantity}L mwagemuye kuri ${unitPrice} RWF/L kuwa ${formattedDateTime} ${statusText}. Igiciro: ${totalAmount} RWF. Murakoze.`;
          await this.smsService.sendSMS(supplierPhone, message);
        }
      } catch (smsError) {
        // Intentionally swallow SMS errors so they don't break collection creation
        console.error('Failed to send milk collection SMS notification:', smsError);
      }

      return {
        code: 200,
        status: 'success',
        message: 'Milk collection recorded successfully.',
        data: {
          collection_id: milkSale.id,
          supplier_account_code: supplier_account_code,
          customer_account_id: customerAccountId,
          quantity: quantity,
          unit_price: unitPrice,
          total_amount: totalAmount,
          status: status || 'accepted',
          collection_at: collection_at,
          amount_paid: amountPaid,
          payment_status: finalPaymentStatus,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException({
        code: 500,
        status: 'error',
        message: 'Failed to record milk collection.',
        error: error.message,
      });
    }
  }

  async bulkCreateCollections(
    user: User,
    rows: CreateCollectionDto[],
  ): Promise<{
    success: number;
    failed: number;
    errors: { row: number; phone: string; message: string }[];
  }> {
    const errors: { row: number; phone: string; message: string }[] = [];
    let success = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const identifier = row.supplier_account_code || '(no supplier)';
      try {
        await this.createCollection(user, row);
        success++;
      } catch (e: unknown) {
        const message =
          (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          (e as Error)?.message ||
          'Unknown error';
        errors.push({ row: i + 1, phone: identifier, message });
      }
    }

    return { success, failed: errors.length, errors };
  }

  /**
   * Create Accounts Payable journal entry for unpaid collections
   * DR Expense, CR Accounts Payable
   */
  private async createAccountsPayableEntry(
    user: User,
    data: {
      collection_id: string;
      supplier_account_id: string;
      supplier_name: string;
      amount: number;
      description: string;
      collection_date: Date;
    },
  ) {
    // Get user's default account
    const defaultAccount = await this.prisma.account.findUnique({
      where: { id: user.default_account_id },
    });

    if (!defaultAccount) {
      throw new BadRequestException('Default account not found');
    }

    // Get or create AP account
    const apAccountCode = `AP-${defaultAccount.code || defaultAccount.id.substring(0, 8).toUpperCase()}`;
    let apAccount = await this.prisma.chartOfAccount.findFirst({
      where: {
        code: apAccountCode,
        account_type: 'Liability',
        is_active: true,
      },
    });

    if (!apAccount) {
      apAccount = await this.prisma.chartOfAccount.create({
        data: {
          code: apAccountCode,
          name: `Accounts Payable - ${defaultAccount.name}`,
          account_type: 'Liability',
          is_active: true,
        },
      });
    }

    // Get or create Expense account
    const expenseAccountCode = `EXP-${defaultAccount.code || defaultAccount.id.substring(0, 8).toUpperCase()}`;
    let expenseAccount = await this.prisma.chartOfAccount.findFirst({
      where: {
        code: expenseAccountCode,
        account_type: 'Expense',
        is_active: true,
      },
    });

    if (!expenseAccount) {
      expenseAccount = await this.prisma.chartOfAccount.create({
        data: {
          code: expenseAccountCode,
          name: `General Expense - ${defaultAccount.name}`,
          account_type: 'Expense',
          is_active: true,
        },
      });
    }

    // Create journal entry: DR Expense, CR AP
    await this.prisma.accountingTransaction.create({
      data: {
        transaction_date: data.collection_date,
        description: data.description,
        total_amount: data.amount,
        created_by: user.id,
        entries: {
          create: [
            {
              account_id: expenseAccount.id,
              debit_amount: data.amount,
              credit_amount: null,
              description: `Expense: ${data.description}`,
            },
            {
              account_id: apAccount.id,
              credit_amount: data.amount,
              debit_amount: null,
              description: `AP: ${data.description}`,
            },
          ],
        },
      },
    });
  }

  /**
   * Record payment for a collection (reduces AP)
   * DR Accounts Payable, CR Cash
   */
  async recordPayment(user: User, collectionId: string, paymentDto: { amount: number; payment_date?: string; notes?: string }) {
    const collection = await this.prisma.milkSale.findFirst({
      where: {
        id: collectionId,
        customer_account_id: user.default_account_id, // Verify ownership
      },
      include: {
        supplier_account: true,
      },
    });

    if (!collection) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Collection not found or you do not have permission to record payment for this collection.',
      });
    }

    const totalAmount = Number(collection.quantity) * Number(collection.unit_price);
    const currentPaid = Number(collection.amount_paid || 0);
    const newPayment = Number(paymentDto.amount);

    if (newPayment <= 0) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Payment amount must be greater than 0.',
      });
    }

    const newTotalPaid = currentPaid + newPayment;

    if (newTotalPaid > totalAmount) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `Payment amount exceeds outstanding balance. Outstanding: ${totalAmount - currentPaid}`,
      });
    }

    // Calculate payment status
    const paymentStatus = newTotalPaid >= totalAmount ? 'paid' : newTotalPaid > 0 ? 'partial' : 'unpaid';

    // Update payment history
    const paymentHistory = (collection.payment_history as any[]) || [];
    paymentHistory.push({
      date: paymentDto.payment_date || new Date().toISOString(),
      amount: newPayment,
      notes: paymentDto.notes || null,
    });

    // Update collection
    await this.prisma.milkSale.update({
      where: { id: collectionId },
      data: {
        amount_paid: newTotalPaid,
        payment_status: paymentStatus,
        payment_history: paymentHistory,
      },
    });

    // Get user's default account
    const defaultAccount = await this.prisma.account.findUnique({
      where: { id: user.default_account_id },
    });

    if (!defaultAccount) {
      throw new BadRequestException('Default account not found');
    }

    // Get or create AP account
    const apAccountCode = `AP-${defaultAccount.code || defaultAccount.id.substring(0, 8).toUpperCase()}`;
    let apAccount = await this.prisma.chartOfAccount.findFirst({
      where: { 
        code: apAccountCode, 
        account_type: 'Liability',
        is_active: true,
      },
    });

    if (!apAccount) {
      // Create AP account if it doesn't exist (e.g., if collection was created as paid initially)
      apAccount = await this.prisma.chartOfAccount.create({
        data: {
          code: apAccountCode,
          name: `Accounts Payable - ${defaultAccount.name}`,
          account_type: 'Liability',
          is_active: true,
        },
      });
    }

    const cashAccountCode = `CASH-${defaultAccount.code || defaultAccount.id.substring(0, 8).toUpperCase()}`;
    let cashAccount = await this.prisma.chartOfAccount.findFirst({
      where: { code: cashAccountCode, account_type: 'Asset' },
    });

    if (!cashAccount) {
      cashAccount = await this.prisma.chartOfAccount.create({
        data: {
          code: cashAccountCode,
          name: `Cash - ${defaultAccount.name}`,
          account_type: 'Asset',
          is_active: true,
        },
      });
    }

    // Create journal entry: DR AP, CR Cash
    const paymentDate = paymentDto.payment_date ? new Date(paymentDto.payment_date) : new Date();
    await this.prisma.accountingTransaction.create({
      data: {
        transaction_date: paymentDate,
        description: `Payment made to ${collection.supplier_account.name} for collection ${collectionId}${paymentDto.notes ? ` - ${paymentDto.notes}` : ''}`,
        total_amount: newPayment,
        created_by: user.id,
        entries: {
          create: [
            {
              account_id: apAccount.id,
              debit_amount: newPayment,
              credit_amount: null,
              description: `AP reduced for collection ${collectionId}`,
            },
            {
              account_id: cashAccount.id,
              credit_amount: newPayment,
              debit_amount: null,
              description: `Cash paid: ${paymentDto.notes || ''}`,
            },
          ],
        },
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Payment recorded successfully',
      data: {
        collection_id: collectionId,
        amount_paid: newTotalPaid,
        outstanding: totalAmount - newTotalPaid,
        payment_status: paymentStatus,
      },
    };
  }

  async getCollections(user: User, filters?: {
    supplier_name?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    quantity_min?: number;
    quantity_max?: number;
    price_min?: number;
    price_max?: number;
  }, accountIdParam?: string) {
    let customerAccountId: string;

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
      customerAccountId = accountIdParam;
    } else {
      if (!user.default_account_id) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'No valid default account found. Please set a default account.',
        });
      }
      customerAccountId = user.default_account_id;
    }

    // Build query with filters
    const where: any = {
      customer_account_id: customerAccountId,
      status: { not: 'deleted' },
    };

    if (filters) {
      if (filters.supplier_name) {
        where.supplier_account = {
          is: {
            name: {
              contains: filters.supplier_name.trim(),
              mode: 'insensitive',
            },
          },
        };
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.date_from || filters.date_to) {
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

      if (filters.quantity_min !== undefined || filters.quantity_max !== undefined) {
        where.quantity = {};
        if (filters.quantity_min !== undefined) {
          where.quantity.gte = filters.quantity_min;
        }
        if (filters.quantity_max !== undefined) {
          where.quantity.lte = filters.quantity_max;
        }
      }

      if (filters.price_min !== undefined || filters.price_max !== undefined) {
        where.unit_price = {};
        if (filters.price_min !== undefined) {
          where.unit_price.gte = filters.price_min;
        }
        if (filters.price_max !== undefined) {
          where.unit_price.lte = filters.price_max;
        }
      }
    }

    const collections = await this.prisma.milkSale.findMany({
      where,
      include: {
        supplier_account: true,
        customer_account: true,
        recorded_by_user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        sale_at: 'desc',
      },
    });

    const formattedCollections = collections.map((collection) => ({
      id: collection.id,
      quantity: Number(collection.quantity),
      unit_price: Number(collection.unit_price),
      total_amount: Number(collection.quantity) * Number(collection.unit_price),
      status: collection.status,
      sale_at: collection.sale_at,
      collection_at: collection.sale_at,
      notes: collection.notes,
      created_at: collection.created_at,
      updated_at: collection.updated_at,
      supplier_account: {
        id: collection.supplier_account.id,
        code: collection.supplier_account.code,
        name: collection.supplier_account.name,
        type: collection.supplier_account.type,
        status: collection.supplier_account.status,
      },
      customer_account: {
        id: collection.customer_account.id,
        code: collection.customer_account.code,
        name: collection.customer_account.name,
        type: collection.customer_account.type,
        status: collection.customer_account.status,
      },
      recorded_by: {
        id: collection.recorded_by_user.id,
        name: collection.recorded_by_user.name,
        phone: collection.recorded_by_user.phone,
      },
    }));

    return {
      code: 200,
      status: 'success',
      message: 'Collections fetched successfully.',
      data: formattedCollections,
    };
  }

  async getCollection(user: User, collectionId: string, accountIdParam?: string) {
    let customerAccountId: string;

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
      customerAccountId = accountIdParam;
    } else {
      if (!user.default_account_id) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'No valid default account found. Please set a default account.',
        });
      }
      customerAccountId = user.default_account_id;
    }

    const collection = await this.prisma.milkSale.findFirst({
      where: {
        id: collectionId,
        customer_account_id: customerAccountId,
        status: { not: 'deleted' },
      },
      include: {
        supplier_account: true,
        customer_account: true,
        animal: { select: { id: true, tag_number: true, name: true } },
        recorded_by_user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Collection not found or not authorized.',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Collection fetched successfully.',
      data: {
        id: collection.id,
        quantity: Number(collection.quantity),
        unit_price: Number(collection.unit_price),
        total_amount: Number(collection.quantity) * Number(collection.unit_price),
        status: collection.status,
        collection_at: collection.sale_at,
        notes: collection.notes,
        created_at: collection.created_at,
        updated_at: collection.updated_at,
        animal_id: collection.animal_id ?? undefined,
        animal: collection.animal
          ? { id: collection.animal.id, tag_number: collection.animal.tag_number, name: collection.animal.name }
          : undefined,
        supplier_account: {
          id: collection.supplier_account.id,
          code: collection.supplier_account.code,
          name: collection.supplier_account.name,
          type: collection.supplier_account.type,
          status: collection.supplier_account.status,
        },
        customer_account: {
          id: collection.customer_account.id,
          code: collection.customer_account.code,
          name: collection.customer_account.name,
          type: collection.customer_account.type,
          status: collection.customer_account.status,
        },
        recorded_by: {
          id: collection.recorded_by_user.id,
          name: collection.recorded_by_user.name,
          phone: collection.recorded_by_user.phone,
        },
      },
    };
  }

  async updateCollection(user: User, updateDto: UpdateCollectionDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    // Validate collection_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(updateDto.collection_id)) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid collection ID format. Collection ID must be a valid UUID.',
      });
    }

    const customerAccountId = user.default_account_id;

    try {
      // Check if collection exists and belongs to customer
      const collection = await this.prisma.milkSale.findFirst({
        where: {
          id: updateDto.collection_id,
          customer_account_id: customerAccountId,
          status: { not: 'deleted' },
        },
      });

      if (!collection) {
        throw new NotFoundException({
          code: 404,
          status: 'error',
          message: 'Collection not found or not authorized.',
        });
      }

      // Build update data
      const updateData: any = {
        updated_by: user.id,
      };

      if (updateDto.quantity !== undefined) {
        updateData.quantity = updateDto.quantity;
      }

      if (updateDto.status) {
        // Validate status is a valid enum value
        const validStatuses = ['pending', 'accepted', 'rejected', 'cancelled'];
        if (!validStatuses.includes(updateDto.status as string)) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          });
        }
        updateData.status = updateDto.status as any;
      }

      if (updateDto.collection_at) {
        updateData.sale_at = new Date(updateDto.collection_at);
      }

      if (updateDto.notes !== undefined) {
        updateData.notes = updateDto.notes;
      }

      if (updateDto.animal_id !== undefined) {
        if (updateDto.animal_id === null || updateDto.animal_id === '') {
          updateData.animal_id = null;
        } else {
          const animal = await this.prisma.animal.findFirst({
            where: { id: updateDto.animal_id, account_id: collection.supplier_account_id },
          });
          if (!animal) {
            throw new BadRequestException({
              code: 400,
              status: 'error',
              message: 'Animal not found or does not belong to the collection supplier.',
            });
          }
          updateData.animal_id = updateDto.animal_id;
        }
      }

      if (Object.keys(updateData).length === 1) {
        // Only updated_by, no actual fields to update
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'No fields to update.',
        });
      }

      const updatedCollection = await this.prisma.milkSale.update({
        where: { id: updateDto.collection_id },
        data: updateData,
        include: {
          supplier_account: true,
          customer_account: true,
        },
      });

      return {
        code: 200,
        status: 'success',
        message: 'Collection updated successfully.',
        data: {
          id: updatedCollection.id,
          quantity: Number(updatedCollection.quantity),
          unit_price: Number(updatedCollection.unit_price),
          total_amount: Number(updatedCollection.quantity) * Number(updatedCollection.unit_price),
          status: updatedCollection.status,
          collection_at: updatedCollection.sale_at,
          notes: updatedCollection.notes,
        },
      };
    } catch (error) {
      // If it's already a known exception, rethrow it
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      // Log the error for debugging
      console.error('Error updating collection:', error);

      // Return a proper error response
      throw new InternalServerErrorException({
        code: 500,
        status: 'error',
        message: 'Failed to update collection.',
        error: error.message || 'Unknown error occurred',
      });
    }
  }

  async cancelCollection(user: User, cancelDto: CancelCollectionDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    const customerAccountId = user.default_account_id;

    // Check if collection exists and belongs to customer
    const collection = await this.prisma.milkSale.findFirst({
      where: {
        id: cancelDto.collection_id,
        customer_account_id: customerAccountId,
        status: { not: 'deleted' },
      },
    });

    if (!collection) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Collection not found or not authorized.',
      });
    }

    // Update status to cancelled
    await this.prisma.milkSale.update({
      where: { id: cancelDto.collection_id },
      data: {
        status: 'cancelled',
        updated_by: user.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Collection cancelled successfully.',
    };
  }

  async deleteCollection(user: User, collectionId: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    // Validate collection_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(collectionId)) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid collection ID format. Collection ID must be a valid UUID.',
      });
    }

    const customerAccountId = user.default_account_id;

    // Check if collection exists and belongs to customer
    const collection = await this.prisma.milkSale.findFirst({
      where: {
        id: collectionId,
        customer_account_id: customerAccountId,
        status: { not: 'deleted' },
      },
    });

    if (!collection) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Collection not found or not authorized.',
      });
    }

    // Soft delete by setting status to deleted
    await this.prisma.milkSale.update({
      where: { id: collectionId },
      data: {
        status: 'deleted',
        updated_by: user.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Collection deleted successfully.',
    };
  }
}

