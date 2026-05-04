import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ToggleListingDto } from './dto/toggle-listing.dto';
import { CreateInventorySaleDto, InventorySaleBuyerType, InventorySalePaymentStatus } from './dto/create-inventory-sale.dto';
import { TransactionsService } from '../accounting/transactions/transactions.service';
import { TransactionType } from '../accounting/transactions/dto/create-transaction.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { composeUserFullName, splitIntoFirstLast } from '../../common/utils/user-name.util';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
  ) {}

  async getInventory(user: User, filters?: { status?: string; low_stock?: boolean }, accountIdParam?: string) {
    let accountId: string;

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
      accountId = accountIdParam;
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

    const where: any = {
      account_id: accountId,
    };

    // By default, exclude inactive items (soft-deleted items)
    // Only include inactive items if explicitly requested via status filter
    if (filters?.status) {
      where.status = filters.status;
    } else {
      // Exclude inactive items by default
      where.status = { not: 'inactive' };
    }

    // Note: Low stock filtering will be done in application logic
    // Prisma doesn't easily support comparing two columns in where clause

    const products = await this.prisma.product.findMany({
      where,
      include: {
        categories: { include: { category: true } },
        images: { where: { is_primary: true }, take: 1 },
      },
      orderBy: { created_at: 'desc' },
    });

    let filteredProducts = products;

    // Filter low stock items if requested
    if (filters?.low_stock) {
      filteredProducts = products.filter((p) => {
        if (p.min_stock_level !== null) {
          return p.stock_quantity <= p.min_stock_level;
        }
        return p.stock_quantity <= 0;
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Inventory fetched successfully.',
      data: filteredProducts.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        stock_quantity: p.stock_quantity,
        min_stock_level: p.min_stock_level,
        status: p.status,
        is_listed_in_marketplace: p.is_listed_in_marketplace,
        categories: p.categories.map((c) => c.category),
        image: p.images[0]?.image_url || null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })),
    };
  }

  async getInventoryItem(user: User, productId: string, accountIdParam?: string) {
    let accountId: string;

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
      accountId = accountIdParam;
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

    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        account_id: accountId,
      },
      include: {
        categories: { include: { category: true } },
        images: { orderBy: { sort_order: 'asc' } },
      },
    });

    if (!product) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Inventory item not found.',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Inventory item fetched successfully.',
      data: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        stock_quantity: product.stock_quantity,
        min_stock_level: product.min_stock_level,
        status: product.status,
        is_listed_in_marketplace: product.is_listed_in_marketplace,
        categories: product.categories.map((c) => c.category),
        images: product.images.map((img) => ({
          id: img.id,
          image_url: img.image_url,
          is_primary: img.is_primary,
        })),
        created_at: product.created_at,
        updated_at: product.updated_at,
      },
    };
  }

  async createInventoryItem(user: User, createDto: CreateInventoryDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    let name: string;
    let description: string | null = createDto.description ?? null;
    let inventory_item_id: string | null = null;

    if (createDto.inventory_item_id) {
      const inventoryItem = await this.prisma.inventoryItem.findFirst({
        where: { id: createDto.inventory_item_id, is_active: true },
      });
      if (!inventoryItem) {
        throw new NotFoundException({
          code: 404,
          status: 'error',
          message: 'Predefined inventory item not found or inactive.',
        });
      }
      name = inventoryItem.name;
      description = inventoryItem.description ?? description;
      inventory_item_id = inventoryItem.id; // link product to predefined item
    } else if (createDto.name) {
      name = createDto.name;
    } else {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Either name or inventory_item_id is required.',
      });
    }

    // Determine status based on stock
    let status: 'active' | 'inactive' | 'out_of_stock' = 'active';
    if ((createDto.stock_quantity || 0) === 0) {
      status = 'out_of_stock';
    }

    const product = await this.prisma.product.create({
      data: {
        name,
        description,
        price: createDto.price,
        stock_quantity: createDto.stock_quantity || 0,
        min_stock_level: createDto.min_stock_level || null,
        status: status as any,
        account_id: user.default_account_id,
        inventory_item_id,
        is_listed_in_marketplace: createDto.is_listed_in_marketplace || false,
        created_by: user.id,
        updated_by: user.id,
      },
    });

    // Add categories if provided
    if (createDto.category_ids && createDto.category_ids.length > 0) {
      await Promise.all(
        createDto.category_ids.map((catId) =>
          this.prisma.productCategory.create({
            data: {
              product_id: product.id,
              category_id: catId,
            },
          }),
        ),
      );
    }

    return {
      code: 200,
      status: 'success',
      message: 'Inventory item created successfully.',
      data: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        stock_quantity: product.stock_quantity,
        min_stock_level: product.min_stock_level,
        status: product.status,
        is_listed_in_marketplace: product.is_listed_in_marketplace,
      },
    };
  }

  async bulkCreateInventoryItems(
    user: User,
    rows: CreateInventoryDto[],
  ): Promise<{
    success: number;
    failed: number;
    errors: { row: number; phone: string; message: string }[];
  }> {
    const errors: { row: number; phone: string; message: string }[] = [];
    let success = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const identifier = (row.name || '').trim() || '(empty)';
      try {
        await this.createInventoryItem(user, row);
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

  async updateInventoryItem(user: User, productId: string, updateDto: UpdateInventoryDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    // Verify ownership
    const existing = await this.prisma.product.findFirst({
      where: {
        id: productId,
        account_id: user.default_account_id,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Inventory item not found.',
      });
    }

    // Determine status if stock_quantity is being updated
    let status = updateDto.status || existing.status;
    if (updateDto.stock_quantity !== undefined) {
      if (updateDto.stock_quantity === 0) {
        status = 'out_of_stock';
      } else if (status === 'out_of_stock' && updateDto.stock_quantity > 0) {
        status = 'active';
      }
    }

    // Can't list if out of stock
    if (updateDto.is_listed_in_marketplace && 
        (updateDto.stock_quantity !== undefined ? updateDto.stock_quantity === 0 : existing.stock_quantity === 0)) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Cannot list item in marketplace when stock is 0.',
      });
    }

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(updateDto.name && { name: updateDto.name }),
        ...(updateDto.description !== undefined && { description: updateDto.description }),
        ...(updateDto.price !== undefined && { price: updateDto.price }),
        ...(updateDto.stock_quantity !== undefined && { stock_quantity: updateDto.stock_quantity }),
        ...(updateDto.min_stock_level !== undefined && { min_stock_level: updateDto.min_stock_level }),
        ...(updateDto.is_listed_in_marketplace !== undefined && { is_listed_in_marketplace: updateDto.is_listed_in_marketplace }),
        ...(status && { status: status as any }),
        updated_by: user.id,
      },
    });

    // Record inventory movement when stock changed via edit
    if (updateDto.stock_quantity !== undefined) {
      const delta = updateDto.stock_quantity - existing.stock_quantity;
      if (delta > 0) {
        await this.prisma.inventoryMovement.create({
          data: {
            product_id: productId,
            movement_type: 'adjustment_in',
            quantity: delta,
            movement_date: new Date(),
            reference_type: 'stock_adjustment',
            reference_id: null,
            description: 'Stock updated (edit)',
            unit_price: existing.price,
            created_by: user.id,
          },
        });
      } else if (delta < 0) {
        await this.prisma.inventoryMovement.create({
          data: {
            product_id: productId,
            movement_type: 'adjustment_out',
            quantity: Math.abs(delta),
            movement_date: new Date(),
            reference_type: 'stock_adjustment',
            reference_id: null,
            description: 'Stock updated (edit)',
            unit_price: existing.price,
            created_by: user.id,
          },
        });
      }
    }

    // Update categories if provided
    if (updateDto.category_ids !== undefined) {
      // Delete existing categories
      await this.prisma.productCategory.deleteMany({
        where: { product_id: productId },
      });

      // Add new categories
      if (updateDto.category_ids.length > 0) {
        await Promise.all(
          updateDto.category_ids.map((catId) =>
            this.prisma.productCategory.create({
              data: {
                product_id: productId,
                category_id: catId,
              },
            }),
          ),
        );
      }
    }

    return {
      code: 200,
      status: 'success',
      message: 'Inventory item updated successfully.',
      data: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        stock_quantity: product.stock_quantity,
        min_stock_level: product.min_stock_level,
        status: product.status,
        is_listed_in_marketplace: product.is_listed_in_marketplace,
      },
    };
  }

  async updateStock(user: User, productId: string, updateStockDto: UpdateStockDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    // Verify ownership
    const existing = await this.prisma.product.findFirst({
      where: {
        id: productId,
        account_id: user.default_account_id,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Inventory item not found.',
      });
    }

    // Determine status based on new stock
    let status = existing.status;
    if (updateStockDto.stock_quantity === 0) {
      status = 'out_of_stock';
    } else if (existing.status === 'out_of_stock' && updateStockDto.stock_quantity > 0) {
      status = 'active';
    }

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        stock_quantity: updateStockDto.stock_quantity,
        status: status as any,
        updated_by: user.id,
      },
    });

    // Record inventory movement(s) for adjustment
    const delta = updateStockDto.stock_quantity - existing.stock_quantity;
    const notes = updateStockDto.notes?.trim() || null;
    if (delta > 0) {
      await this.prisma.inventoryMovement.create({
        data: {
          product_id: productId,
          movement_type: 'adjustment_in',
          quantity: delta,
          movement_date: new Date(),
          reference_type: 'stock_adjustment',
          reference_id: null,
          description: notes || 'Stock adjustment (increase)',
          unit_price: existing.price,
          created_by: user.id,
        },
      });
    } else if (delta < 0) {
      await this.prisma.inventoryMovement.create({
        data: {
          product_id: productId,
          movement_type: 'adjustment_out',
          quantity: Math.abs(delta),
          movement_date: new Date(),
          reference_type: 'stock_adjustment',
          reference_id: null,
          description: notes || 'Stock adjustment (decrease)',
          unit_price: existing.price,
          created_by: user.id,
        },
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Stock updated successfully.',
      data: {
        id: product.id,
        stock_quantity: product.stock_quantity,
        status: product.status,
      },
    };
  }

  async getMovements(
    user: User,
    productId: string,
    options?: { page?: number; limit?: number; movement_type?: string; date_from?: string; date_to?: string; account_id?: string },
  ) {
    let accountId: string;
    if (options?.account_id) {
      const hasAccess = await this.prisma.userAccount.findFirst({
        where: {
          user_id: user.id,
          account_id: options.account_id,
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
      accountId = options.account_id;
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

    // Verify product belongs to user's account
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        account_id: accountId,
      },
    });
    if (!product) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Inventory item not found.',
      });
    }

    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = { product_id: productId };
    if (options?.movement_type) {
      where.movement_type = options.movement_type;
    }
    if (options?.date_from || options?.date_to) {
      where.movement_date = {};
      if (options.date_from) where.movement_date.gte = new Date(options.date_from);
      if (options.date_to) {
        const d = new Date(options.date_to);
        d.setHours(23, 59, 59, 999);
        where.movement_date.lte = d;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }],
        skip,
        take: limit,
        include: {
          created_by_user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Movements retrieved successfully.',
      data: {
        items: items.map((m) => ({
          id: m.id,
          product_id: m.product_id,
          movement_type: m.movement_type,
          quantity: m.quantity,
          reference_type: m.reference_type,
          reference_id: m.reference_id,
          description: m.description,
          unit_price: m.unit_price != null ? Number(m.unit_price) : null,
          movement_date: m.movement_date,
          created_at: m.created_at,
          created_by: m.created_by_user ? { id: m.created_by_user.id, name: m.created_by_user.name } : null,
        })),
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    };
  }

  async getMovementsAll(
    user: User,
    options?: { page?: number; limit?: number; product_id?: string; movement_type?: string; date_from?: string; date_to?: string; account_id?: string },
  ) {
    let accountId: string;
    if (options?.account_id) {
      const hasAccess = await this.prisma.userAccount.findFirst({
        where: {
          user_id: user.id,
          account_id: options.account_id,
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
      accountId = options.account_id;
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

    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {
      product: { account_id: accountId },
    };
    if (options?.product_id) where.product_id = options.product_id;
    if (options?.movement_type) where.movement_type = options.movement_type;
    if (options?.date_from || options?.date_to) {
      where.movement_date = {};
      if (options.date_from) where.movement_date.gte = new Date(options.date_from);
      if (options.date_to) {
        const d = new Date(options.date_to);
        d.setHours(23, 59, 59, 999);
        where.movement_date.lte = d;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }],
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true } },
          created_by_user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Movements retrieved successfully.',
      data: {
        items: items.map((m) => ({
          id: m.id,
          product_id: m.product_id,
          product_name: m.product?.name ?? null,
          movement_type: m.movement_type,
          quantity: m.quantity,
          reference_type: m.reference_type,
          reference_id: m.reference_id,
          description: m.description,
          unit_price: m.unit_price != null ? Number(m.unit_price) : null,
          movement_date: m.movement_date,
          created_at: m.created_at,
          created_by: m.created_by_user ? { id: m.created_by_user.id, name: m.created_by_user.name } : null,
        })),
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    };
  }

  async toggleMarketplaceListing(user: User, productId: string, toggleDto: ToggleListingDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    // Verify ownership
    const existing = await this.prisma.product.findFirst({
      where: {
        id: productId,
        account_id: user.default_account_id,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Inventory item not found.',
      });
    }

    // Can't list if out of stock
    if (toggleDto.is_listed_in_marketplace && existing.stock_quantity === 0) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Cannot list item in marketplace when stock is 0.',
      });
    }

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        is_listed_in_marketplace: toggleDto.is_listed_in_marketplace,
        updated_by: user.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: toggleDto.is_listed_in_marketplace
        ? 'Item listed in marketplace successfully.'
        : 'Item removed from marketplace successfully.',
      data: {
        id: product.id,
        is_listed_in_marketplace: product.is_listed_in_marketplace,
      },
    };
  }

  async deleteInventoryItem(user: User, productId: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    // Verify ownership
    const existing = await this.prisma.product.findFirst({
      where: {
        id: productId,
        account_id: user.default_account_id,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Inventory item not found.',
      });
    }

    // Soft delete by setting status to inactive
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        status: 'inactive',
        is_listed_in_marketplace: false,
        updated_by: user.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Inventory item deleted successfully.',
    };
  }

  async getInventoryStats(user: User, accountIdParam?: string) {
    let accountId: string;

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
      accountId = accountIdParam;
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

    const [totalItems, activeItems, outOfStockItems, listedItems, lowStockItems, valueAgg] = await Promise.all([
      this.prisma.product.count({
        where: { account_id: accountId, status: { not: 'inactive' } },
      }),
      this.prisma.product.count({
        where: { account_id: accountId, status: 'active' },
      }),
      this.prisma.product.count({
        where: { account_id: accountId, status: 'out_of_stock' },
      }),
      this.prisma.product.count({
        where: {
          account_id: accountId,
          is_listed_in_marketplace: true,
          status: { not: 'inactive' },
        },
      }),
      (async () => {
        const allProducts = await this.prisma.product.findMany({
          where: {
            account_id: accountId,
            status: { not: 'inactive' },
          },
          select: { stock_quantity: true, min_stock_level: true },
        });
        return allProducts.filter((p) => {
          if (p.min_stock_level !== null) {
            return p.stock_quantity <= p.min_stock_level;
          }
          return p.stock_quantity <= 0;
        }).length;
      })(),
      this.prisma.product.aggregate({
        where: { account_id: accountId, status: { not: 'inactive' } },
        _sum: { stock_quantity: true },
      }),
    ]);

    const productsForValue = await this.prisma.product.findMany({
      where: { account_id: accountId, status: { not: 'inactive' } },
      select: { price: true, stock_quantity: true },
    });
    const totalStockValue = productsForValue.reduce(
      (sum, p) => sum + Number(p.price) * p.stock_quantity,
      0
    );
    const totalStockQuantity = valueAgg._sum.stock_quantity ?? 0;

    return {
      code: 200,
      status: 'success',
      message: 'Inventory statistics fetched successfully.',
      data: {
        total_items: totalItems,
        active_items: activeItems,
        out_of_stock_items: outOfStockItems,
        listed_in_marketplace: listedItems,
        low_stock_items: lowStockItems,
        total_stock_value: Math.round(totalStockValue),
        total_stock_quantity: totalStockQuantity,
      },
    };
  }

  /**
   * Valuation over time: returns daily snapshots. Without a snapshot table we return
   * current value as single point (date = today).
   */
  async getValuationOverTime(
    user: User,
    dateFrom: string,
    dateTo: string,
    accountIdParam?: string,
  ) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    const products = await this.prisma.product.findMany({
      where: { account_id: accountId, status: { not: 'inactive' } },
      select: { price: true, stock_quantity: true },
    });
    const totalValue = products.reduce((s, p) => s + Number(p.price) * p.stock_quantity, 0);
    const totalQty = products.reduce((s, p) => s + p.stock_quantity, 0);
    const today = new Date().toISOString().slice(0, 10);
    return {
      code: 200,
      status: 'success',
      message: 'Valuation over time (current snapshot; historical API can be added).',
      data: {
        series: [{ date: today, total_value: Math.round(totalValue), total_quantity: totalQty }],
      },
    };
  }

  /**
   * Top products by stock value (price * quantity), limit N.
   */
  async getTopByValue(user: User, limit: number, accountIdParam?: string) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    const products = await this.prisma.product.findMany({
      where: { account_id: accountId, status: { not: 'inactive' } },
      select: { id: true, name: true, price: true, stock_quantity: true },
      orderBy: { updated_at: 'desc' },
    });
    const withValue = products
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        stock_quantity: p.stock_quantity,
        stock_value: Number(p.price) * p.stock_quantity,
      }))
      .sort((a, b) => b.stock_value - a.stock_value)
      .slice(0, limit);
    return {
      code: 200,
      status: 'success',
      message: 'Top items by value.',
      data: { items: withValue },
    };
  }

  /**
   * Stock movement: stock out (sales) by date. Stock in not tracked in schema yet.
   */
  async getStockMovement(user: User, dateFrom: string, dateTo: string, accountIdParam?: string) {
    const accountId = await this.resolveAccountId(user, accountIdParam);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    const sales = await this.prisma.inventorySale.findMany({
      where: {
        product: { account_id: accountId },
        sale_date: { gte: from, lte: to },
      },
      select: { sale_date: true, quantity: true },
    });
    const byDate = sales.reduce((acc, s) => {
      const d = s.sale_date.toISOString().slice(0, 10);
      if (!acc[d]) acc[d] = { date: d, stock_in: 0, stock_out: 0 };
      acc[d].stock_out += Number(s.quantity);
      return acc;
    }, {} as Record<string, { date: string; stock_in: number; stock_out: number }>);
    const series = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    return {
      code: 200,
      status: 'success',
      message: 'Stock movement (out from sales).',
      data: { series },
    };
  }

  private async resolveAccountId(user: User, accountIdParam?: string): Promise<string> {
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
      return accountIdParam;
    }
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }
    return user.default_account_id;
  }

  async sellInventoryItem(user: User, productId: string, createSaleDto: CreateInventorySaleDto) {
    console.log('📦 [Inventory Sale] Starting sale process');
    console.log('📦 [Inventory Sale] Product ID:', productId);
    console.log('📦 [Inventory Sale] Buyer type:', createSaleDto.buyer_type);
    console.log('📦 [Inventory Sale] Buyer account ID/code:', createSaleDto.buyer_account_id);
    console.log('📦 [Inventory Sale] Buyer name:', createSaleDto.buyer_name);
    console.log('📦 [Inventory Sale] Buyer phone:', createSaleDto.buyer_phone);
    console.log('📦 [Inventory Sale] Quantity:', createSaleDto.quantity);
    console.log('📦 [Inventory Sale] Unit price:', createSaleDto.unit_price);
    console.log('📦 [Inventory Sale] Amount paid:', createSaleDto.amount_paid);

    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    // 1. Validate product exists and belongs to user
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        account_id: user.default_account_id,
      },
    });

    if (!product) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Inventory item not found.',
      });
    }

    // 2. Validate product is listed in marketplace
    if (!product.is_listed_in_marketplace) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Item must be listed in marketplace to sell.',
      });
    }

    // 3. Validate stock availability
    if (product.stock_quantity < createSaleDto.quantity) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `Insufficient stock. Available: ${product.stock_quantity}, Requested: ${createSaleDto.quantity}`,
      });
    }

    // 4. Handle new customer/supplier creation on-the-fly if phone provided
    let finalBuyerAccountId = createSaleDto.buyer_account_id;
    let buyerAccount = null;

    // If buyer_account_id is not provided but phone is provided, try to create/find account
    if (!finalBuyerAccountId && createSaleDto.buyer_phone) {
      const normalizedPhone = createSaleDto.buyer_phone.replace(/\D/g, '');

      // Find existing user by phone
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

      if (existingUser && existingUser.user_accounts.length > 0) {
        // User exists with account - use it
        finalBuyerAccountId = existingUser.user_accounts[0].account_id;
        buyerAccount = existingUser.user_accounts[0].account;
      } else if (createSaleDto.buyer_name) {
        // Create new customer account (for 'other' buyers, we create as customer)
        // For 'supplier' or 'customer' types, we also create if phone/name provided
        const accountCode = `A_${randomBytes(3).toString('hex').toUpperCase()}`;
        const walletCode = `W_${randomBytes(3).toString('hex').toUpperCase()}`;
        const token = randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash('Pass123!', 10);

        let newUser;
        if (existingUser) {
          // User exists but no account - create account for existing user
          newUser = existingUser;
        } else {
          // Create new user
          const userCode = `U_${randomBytes(3).toString('hex').toUpperCase()}`;
          let { first_name: uFirst, last_name: uLast } = splitIntoFirstLast(
            (createSaleDto.buyer_name ?? '').trim(),
          );
          let userDisplayName = composeUserFullName(uFirst, uLast) || (createSaleDto.buyer_name ?? '').trim();
          if (!userDisplayName) {
            uFirst = 'Customer';
            uLast = '';
            userDisplayName = 'Customer';
          }
          newUser = await this.prisma.user.create({
            data: {
              code: userCode,
              first_name: uFirst,
              last_name: uLast,
              name: userDisplayName,
              phone: normalizedPhone,
              password_hash: passwordHash,
              token,
              status: 'active',
              account_type: createSaleDto.buyer_type === InventorySaleBuyerType.SUPPLIER ? 'supplier' : 'customer',
              created_by: user.id,
            },
          });
        }

        // Create account
        const newAccount = await this.prisma.account.create({
          data: {
            code: accountCode,
            name: createSaleDto.buyer_name,
            type: 'tenant',
            status: 'active',
            created_by: user.id,
          },
        });

        // Link user to account
        await this.prisma.userAccount.create({
          data: {
            user_id: newUser.id,
            account_id: newAccount.id,
            role: createSaleDto.buyer_type === InventorySaleBuyerType.SUPPLIER ? 'supplier' : 'customer',
            status: 'active',
            created_by: user.id,
          },
        });

        // Set default account if user doesn't have one
        if (!newUser.default_account_id) {
          await this.prisma.user.update({
            where: { id: newUser.id },
            data: { default_account_id: newAccount.id },
          });
        }

        // Create wallet
        await this.prisma.wallet.create({
          data: {
            code: walletCode,
            account_id: newAccount.id,
            type: 'regular',
            is_default: true,
            balance: 0,
            currency: 'RWF',
            status: 'active',
            created_by: user.id,
          },
        });

        finalBuyerAccountId = newAccount.id;
        buyerAccount = newAccount;
      }
    }

    // 5. Validate buyer_account_id is required for suppliers
    if (createSaleDto.buyer_type === InventorySaleBuyerType.SUPPLIER && !finalBuyerAccountId) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'buyer_account_id is required when buyer_type is supplier. Provide buyer_account_id or buyer_phone with buyer_name.',
      });
    }

    // 6. Validate buyer account exists if we have an ID
    // Handle both UUID and account code (don't pass non-UUID to id column - Prisma throws)
    if (finalBuyerAccountId && !buyerAccount) {
      console.log('📦 [Inventory Sale] Looking up buyer account:', finalBuyerAccountId);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalBuyerAccountId);
      buyerAccount = await this.prisma.account.findFirst({
        where: isUuid
          ? { OR: [{ id: finalBuyerAccountId }, { code: finalBuyerAccountId }] }
          : { code: finalBuyerAccountId },
      });

      if (!buyerAccount) {
        console.log('📦 [Inventory Sale] ❌ Buyer account not found:', finalBuyerAccountId);
        throw new NotFoundException({
          code: 404,
          status: 'error',
          message: 'Buyer account not found.',
        });
      }
      
      console.log('📦 [Inventory Sale] ✅ Found buyer account:', buyerAccount.code, buyerAccount.id);
      // Update finalBuyerAccountId to use the UUID
      finalBuyerAccountId = buyerAccount.id;
    }

    // 7. Calculate total amount and payment status
    const totalAmount = createSaleDto.quantity * createSaleDto.unit_price;
    const amountPaid = createSaleDto.amount_paid || 0;
    let paymentStatus: InventorySalePaymentStatus;

    if (amountPaid >= totalAmount) {
      paymentStatus = InventorySalePaymentStatus.PAID;
    } else if (amountPaid > 0) {
      paymentStatus = InventorySalePaymentStatus.PARTIAL;
    } else {
      paymentStatus = InventorySalePaymentStatus.UNPAID;
    }

    // 8. Validate payment rules
    // Only suppliers can take debt (unpaid/partial payment)
    // Customers and others must pay full amount upfront
    if (createSaleDto.buyer_type !== InventorySaleBuyerType.SUPPLIER) {
      if (amountPaid < totalAmount) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Customers and other buyers must pay the full amount upfront. Only suppliers can buy on credit.',
        });
      }
    }

    // 9. Parse sale date
    const saleDate = createSaleDto.sale_date 
      ? new Date(createSaleDto.sale_date) 
      : new Date();

    try {
      console.log('📦 [Inventory Sale] Creating inventory sale record...');
      console.log('📦 [Inventory Sale] Final buyer account ID:', finalBuyerAccountId);
      
      // 10. Create inventory sale record
      const inventorySale = await this.prisma.inventorySale.create({
        data: {
          product_id: productId,
          buyer_type: createSaleDto.buyer_type as any,
          buyer_account_id: finalBuyerAccountId || null,
          buyer_name: createSaleDto.buyer_name || null,
          buyer_phone: createSaleDto.buyer_phone || null,
          quantity: createSaleDto.quantity,
          unit_price: createSaleDto.unit_price,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          payment_status: paymentStatus as any,
          sale_date: saleDate,
          notes: createSaleDto.notes || null,
          created_by: user.id,
        },
        include: {
          product: true,
          buyer_account: true,
        },
      });

      // 11. Reduce product stock
      const newStockQuantity = product.stock_quantity - createSaleDto.quantity;
      let newStatus = product.status;
      
      if (newStockQuantity === 0) {
        newStatus = 'out_of_stock';
        // Also unlist from marketplace if stock reaches 0
        await this.prisma.product.update({
          where: { id: productId },
          data: {
            stock_quantity: newStockQuantity,
            status: newStatus as any,
            is_listed_in_marketplace: false,
            updated_by: user.id,
          },
        });
      } else {
        await this.prisma.product.update({
          where: { id: productId },
          data: {
            stock_quantity: newStockQuantity,
            status: newStatus as any,
            updated_by: user.id,
          },
        });
      }

      // 11b. Record inventory movement (sale out)
      const buyerLabel = inventorySale.buyer_account?.name || createSaleDto.buyer_name || createSaleDto.buyer_phone || 'Unknown';
      await this.prisma.inventoryMovement.create({
        data: {
          product_id: productId,
          movement_type: 'sale_out',
          quantity: createSaleDto.quantity,
          movement_date: saleDate,
          reference_type: 'inventory_sale',
          reference_id: inventorySale.id,
          description: `Sale to ${buyerLabel}`,
          unit_price: createSaleDto.unit_price,
          created_by: user.id,
        },
      });

      // 12. Create finance transaction if amount_paid > 0
      if (amountPaid > 0) {
        try {
          const buyerName = buyerAccount?.name || createSaleDto.buyer_name || 'Unknown Buyer';
          await this.transactionsService.createTransaction(user, {
            type: TransactionType.REVENUE,
            amount: amountPaid,
            description: `Sale of ${product.name} - ${createSaleDto.quantity} units to ${buyerName}`,
            transaction_date: saleDate.toISOString().split('T')[0],
          });
        } catch (error) {
          // Log error but don't fail the sale creation
          console.error('Failed to create finance transaction for inventory sale:', error);
        }
      }

      return {
        code: 200,
        status: 'success',
        message: 'Inventory item sold successfully.',
        data: {
          id: inventorySale.id,
          product_id: inventorySale.product_id,
          product_name: inventorySale.product.name,
          buyer_type: inventorySale.buyer_type,
          buyer_account_id: inventorySale.buyer_account_id,
          buyer_name: inventorySale.buyer_name,
          buyer_phone: inventorySale.buyer_phone,
          quantity: Number(inventorySale.quantity),
          unit_price: Number(inventorySale.unit_price),
          total_amount: Number(inventorySale.total_amount),
          amount_paid: Number(inventorySale.amount_paid),
          payment_status: inventorySale.payment_status,
          sale_date: inventorySale.sale_date,
          notes: inventorySale.notes,
          remaining_stock: newStockQuantity,
        },
      };
    } catch (error) {
      console.error('📦 [Inventory Sale] ❌ Error creating inventory sale:', error);
      console.error('📦 [Inventory Sale] Error stack:', error.stack);
      throw new InternalServerErrorException({
        code: 500,
        status: 'error',
        message: 'Failed to create inventory sale.',
        error: error.message,
      });
    }
  }
}
