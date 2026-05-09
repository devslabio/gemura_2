import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User, SupplierTransferStatus, MilkSaleStatus } from '@prisma/client';
import { ProcessTransferDto } from './dto/process-transfer.dto';

@Injectable()
export class TransfersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get incoming transfers for the MCC (user's default account)
   */
  async getIncomingTransfers(user: User, status?: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No default account found.',
      });
    }

    const whereClause: { mcc_account_id: string; status?: SupplierTransferStatus } = {
      mcc_account_id: user.default_account_id,
    };

    if (status && ['submitted', 'accepted', 'partially_accepted', 'rejected'].includes(status)) {
      whereClause.status = status as SupplierTransferStatus;
    }

    const transfers = await this.prisma.supplierTransfer.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            code: true,
          },
        },
      },
      orderBy: { submitted_at: 'desc' },
    });

    const data = transfers.map((t) => ({
      id: t.id,
      supplier: {
        id: t.supplier.id,
        name: t.supplier.name,
        phone: t.supplier.phone,
        code: t.supplier.code,
      },
      own_liters: Number(t.own_liters),
      external_liters: Number(t.external_liters),
      total_liters: Number(t.total_liters),
      status: t.status,
      rejection_reason: t.rejection_reason,
      accepted_liters: t.accepted_liters ? Number(t.accepted_liters) : null,
      rejected_liters: t.rejected_liters ? Number(t.rejected_liters) : null,
      supplier_notes: t.supplier_notes,
      notes: t.notes,
      submitted_at: t.submitted_at.toISOString(),
      processed_at: t.processed_at?.toISOString() || null,
      created_at: t.created_at.toISOString(),
    }));

    return { code: 200, status: 'success', message: 'OK', data };
  }

  /**
   * Get a single transfer by ID
   */
  async getTransferById(user: User, transferId: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No default account found.',
      });
    }

    const transfer = await this.prisma.supplierTransfer.findFirst({
      where: {
        id: transferId,
        mcc_account_id: user.default_account_id,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            code: true,
          },
        },
        milkSale: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Transfer not found.',
      });
    }

    const data = {
      id: transfer.id,
      supplier: {
        id: transfer.supplier.id,
        name: transfer.supplier.name,
        phone: transfer.supplier.phone,
        code: transfer.supplier.code,
      },
      own_liters: Number(transfer.own_liters),
      external_liters: Number(transfer.external_liters),
      total_liters: Number(transfer.total_liters),
      status: transfer.status,
      rejection_reason: transfer.rejection_reason,
      accepted_liters: transfer.accepted_liters ? Number(transfer.accepted_liters) : null,
      rejected_liters: transfer.rejected_liters ? Number(transfer.rejected_liters) : null,
      supplier_notes: transfer.supplier_notes,
      notes: transfer.notes,
      milk_sale_id: transfer.milk_sale_id,
      submitted_at: transfer.submitted_at.toISOString(),
      processed_at: transfer.processed_at?.toISOString() || null,
      created_at: transfer.created_at.toISOString(),
    };

    return { code: 200, status: 'success', message: 'OK', data };
  }

  /**
   * Process (accept/reject) an incoming transfer
   */
  async processTransfer(user: User, transferId: string, dto: ProcessTransferDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No default account found.',
      });
    }

    const transfer = await this.prisma.supplierTransfer.findFirst({
      where: {
        id: transferId,
        mcc_account_id: user.default_account_id,
      },
      include: {
        supplier: {
          include: {
            user_accounts: {
              where: { status: 'active' },
              include: { account: true },
            },
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Transfer not found.',
      });
    }

    if (transfer.status !== SupplierTransferStatus.submitted) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `Transfer already processed with status: ${transfer.status}`,
      });
    }

    if (dto.status === 'rejected' && !dto.rejection_reason) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Rejection reason is required when rejecting a transfer.',
      });
    }

    const totalLiters = Number(transfer.total_liters);
    const acceptedLiters = dto.status === 'accepted' ? (dto.accepted_liters ?? totalLiters) : 0;
    const rejectedLiters = totalLiters - acceptedLiters;

    let newStatus: SupplierTransferStatus;
    if (dto.status === 'rejected') {
      newStatus = SupplierTransferStatus.rejected;
    } else if (acceptedLiters < totalLiters && acceptedLiters > 0) {
      newStatus = SupplierTransferStatus.partially_accepted;
    } else {
      newStatus = SupplierTransferStatus.accepted;
    }

    let milkSaleId: string | null = null;

    // Create MilkSale record if any liters are accepted
    if (acceptedLiters > 0) {
      // Find the supplier's account to link to milk sale
      const supplierAccount = transfer.supplier.user_accounts.find(
        (ua) => ua.account_id !== user.default_account_id
      )?.account;

      if (!supplierAccount) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Supplier account not found for milk sale creation.',
        });
      }

      // Get the price per liter from SupplierCustomer relationship
      const supplierCustomer = await this.prisma.supplierCustomer.findFirst({
        where: {
          supplier_account_id: supplierAccount.id,
          customer_account_id: user.default_account_id,
          relationship_status: 'active',
        },
      });

      const unitPrice = supplierCustomer ? Number(supplierCustomer.price_per_liter) : 0;

      // Build notes with source breakdown
      const noteParts: string[] = [];
      if (dto.notes) noteParts.push(dto.notes);
      noteParts.push(`From transfer: Own farm ${Number(transfer.own_liters)}L, External ${Number(transfer.external_liters)}L`);
      if (dto.status === 'rejected' || rejectedLiters > 0) {
        noteParts.push(`[REJECTED_REASON: ${dto.rejection_reason || 'N/A'}]`);
      }

      const milkSale = await this.prisma.milkSale.create({
        data: {
          supplier_account_id: supplierAccount.id,
          customer_account_id: user.default_account_id,
          quantity: acceptedLiters,
          unit_price: unitPrice,
          status: MilkSaleStatus.accepted,
          sale_at: transfer.submitted_at,
          notes: noteParts.join(' | '),
          recorded_by: user.id,
          payment_status: 'unpaid',
        },
      });

      milkSaleId = milkSale.id;
    }

    // Update the transfer record
    const updatedTransfer = await this.prisma.supplierTransfer.update({
      where: { id: transferId },
      data: {
        status: newStatus,
        accepted_liters: acceptedLiters,
        rejected_liters: rejectedLiters,
        rejection_reason: dto.rejection_reason || null,
        notes: dto.notes || null,
        milk_sale_id: milkSaleId,
        processed_at: new Date(),
        processed_by: user.id,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            code: true,
          },
        },
      },
    });

    const data = {
      id: updatedTransfer.id,
      supplier: {
        id: updatedTransfer.supplier.id,
        name: updatedTransfer.supplier.name,
        phone: updatedTransfer.supplier.phone,
        code: updatedTransfer.supplier.code,
      },
      own_liters: Number(updatedTransfer.own_liters),
      external_liters: Number(updatedTransfer.external_liters),
      total_liters: Number(updatedTransfer.total_liters),
      status: updatedTransfer.status,
      rejection_reason: updatedTransfer.rejection_reason,
      accepted_liters: updatedTransfer.accepted_liters ? Number(updatedTransfer.accepted_liters) : null,
      rejected_liters: updatedTransfer.rejected_liters ? Number(updatedTransfer.rejected_liters) : null,
      supplier_notes: updatedTransfer.supplier_notes,
      notes: updatedTransfer.notes,
      milk_sale_id: updatedTransfer.milk_sale_id,
      submitted_at: updatedTransfer.submitted_at.toISOString(),
      processed_at: updatedTransfer.processed_at?.toISOString() || null,
      created_at: updatedTransfer.created_at.toISOString(),
    };

    return {
      code: 200,
      status: 'success',
      message: `Transfer ${newStatus === 'rejected' ? 'rejected' : 'accepted'} successfully.`,
      data,
    };
  }
}
