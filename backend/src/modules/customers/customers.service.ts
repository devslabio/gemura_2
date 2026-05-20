import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { composeUserFullName, splitIntoFirstLast } from '../../common/utils/user-name.util';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async createCustomer(user: User, createDto: CreateCustomerDto) {
    const { phone, email, nid, address, price_per_liter } = createDto;
    const fn = createDto.first_name.trim();
    const ln = createDto.last_name.trim();
    const userDisplayName = composeUserFullName(fn, ln);

    // Check if user has a valid default account
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    const supplierAccountId = user.default_account_id;

    // Normalize phone (remove non-digits) - Phone is the primary identifier
    const normalizedPhone = phone.replace(/\D/g, '');

    // Find existing user by phone (primary identifier)
    // Phone number is the unique identifier for users
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

    let customerAccountId: string;
    let customerAccountCode: string;
    let customerName: string;

    if (existingUser) {
      // User exists - use existing user
      customerName = existingUser.name;

      if (existingUser.user_accounts.length > 0) {
        // User has active account - use existing account
        customerAccountId = existingUser.user_accounts[0].account_id;
        customerAccountCode = existingUser.user_accounts[0].account.code || '';
      } else {
        // User exists but has no active accounts - create account for existing user
        const accountCode = `A_${randomBytes(3).toString('hex').toUpperCase()}`;
        const walletCode = `W_${randomBytes(3).toString('hex').toUpperCase()}`;

        // Create account for existing user
        const newAccount = await this.prisma.account.create({
          data: {
            code: accountCode,
            name: existingUser.name || userDisplayName,
            type: 'tenant',
            status: 'active',
            created_by: user.id,
          },
        });

        // Link existing user to new account
        await this.prisma.userAccount.create({
          data: {
            user_id: existingUser.id,
            account_id: newAccount.id,
            role: 'customer',
            status: 'active',
            created_by: user.id,
          },
        });

        // Set default account if user doesn't have one
        if (!existingUser.default_account_id) {
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: { default_account_id: newAccount.id },
          });
        }

        // Create wallet for the account
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

        customerAccountId = newAccount.id;
        customerAccountCode = accountCode;
      }
    } else {
      // User doesn't exist - create new user + account + wallet
      const userCode = `U_${randomBytes(3).toString('hex').toUpperCase()}`;
      const accountCode = `A_${randomBytes(3).toString('hex').toUpperCase()}`;
      const walletCode = `W_${randomBytes(3).toString('hex').toUpperCase()}`;
      const token = randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash('Pass123!', 10);

      // Create user
      const newUser = await this.prisma.user.create({
        data: {
          code: userCode,
          first_name: fn,
          last_name: ln,
          name: userDisplayName,
          phone: normalizedPhone,
          email: email?.toLowerCase(),
          nid,
          address,
          password_hash: passwordHash,
          token,
          status: 'active',
          account_type: 'customer',
          created_by: user.id,
        },
      });

      // Create account
      const newAccount = await this.prisma.account.create({
        data: {
          code: accountCode,
          name: userDisplayName,
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
          role: 'customer',
          status: 'active',
          created_by: user.id,
        },
      });

      // Set default account for new user
      await this.prisma.user.update({
        where: { id: newUser.id },
        data: { default_account_id: newAccount.id },
      });

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

      customerAccountId = newAccount.id;
      customerAccountCode = accountCode;
      customerName = userDisplayName;
    }

    // Create or update supplier-customer relationship
    const existingRelationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccountId,
        customer_account_id: customerAccountId,
      },
    });

    const finalPricePerLiter = price_per_liter || 0;

    if (existingRelationship) {
      // Update existing relationship
      await this.prisma.supplierCustomer.update({
        where: { id: existingRelationship.id },
        data: {
          price_per_liter: finalPricePerLiter,
          relationship_status: 'active',
          updated_by: user.id,
        },
      });
    } else {
      // Create new relationship
      await this.prisma.supplierCustomer.create({
        data: {
          supplier_account_id: supplierAccountId,
          customer_account_id: customerAccountId,
          price_per_liter: finalPricePerLiter,
          relationship_status: 'active',
          created_by: user.id,
        },
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Customer created/updated successfully.',
      data: {
        customer: {
          account_id: customerAccountId,
          account_code: customerAccountCode,
          name: customerName,
          phone: normalizedPhone,
          price_per_liter: finalPricePerLiter,
        },
      },
    };
  }

  async bulkCreateCustomers(
    user: User,
    rows: CreateCustomerDto[],
  ): Promise<{
    success: number;
    failed: number;
    errors: { row: number; phone: string; message: string }[];
  }> {
    const errors: { row: number; phone: string; message: string }[] = [];
    let success = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const phone = (row.phone || '').replace(/\D/g, '');
      try {
        await this.createCustomer(user, row);
        success++;
      } catch (e: unknown) {
        const message =
          (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          (e as Error)?.message ||
          'Unknown error';
        errors.push({ row: i + 1, phone: phone || '(empty)', message });
      }
    }

    return {
      success,
      failed: errors.length,
      errors,
    };
  }

  async getAllCustomers(user: User, accountIdParam?: string) {
    let supplierAccountId: string;

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
      supplierAccountId = accountIdParam;
    } else {
      if (!user.default_account_id) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'No valid default account found. Please set a default account.',
        });
      }
      supplierAccountId = user.default_account_id;
    }

    // Get all customer relationships for this supplier
    const relationships = await this.prisma.supplierCustomer.findMany({
      where: {
        supplier_account_id: supplierAccountId,
        relationship_status: 'active',
      },
      include: {
        customer_account: {
          include: {
            user_accounts: {
              where: { status: 'active' },
              include: {
                user: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    phone: true,
                    email: true,
                    nid: true,
                    address: true,
                    account_type: true,
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const customers = relationships.map((rel) => {
      const customerUser = rel.customer_account.user_accounts[0]?.user;
      return {
        relationship_id: rel.id,
        code: customerUser?.code || '',
        name: customerUser?.name || rel.customer_account.name,
        phone: customerUser?.phone || '',
        email: customerUser?.email || null,
        nid: customerUser?.nid || null,
        address: customerUser?.address || null,
        account: {
          id: rel.customer_account.id, // Include UUID for API calls
          code: rel.customer_account.code,
          name: rel.customer_account.name,
        },
        price_per_liter: Number(rel.price_per_liter),
        average_supply_quantity: Number(rel.average_supply_quantity),
        relationship_status: rel.relationship_status,
        created_at: rel.created_at,
        updated_at: rel.updated_at,
      };
    });

    return {
      code: 200,
      status: 'success',
      message: 'Customers fetched successfully.',
      data: customers,
    };
  }

  async getCustomer(user: User, customerAccountCode: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    const supplierAccountId = user.default_account_id;

    // Get customer account by code
    const customerAccount = await this.prisma.account.findUnique({
      where: { code: customerAccountCode },
      include: {
        user_accounts: {
          where: { status: 'active' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                nid: true,
                address: true,
                account_type: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!customerAccount) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Customer account not found.',
      });
    }

    // Get supplier-customer relationship
    const relationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccountId,
        customer_account_id: customerAccount.id,
      },
      include: {
        supplier_account: true,
        customer_account: true,
      },
    });

    const customerUser = customerAccount.user_accounts[0]?.user;

    return {
      code: 200,
      status: 'success',
      message: 'Customer fetched successfully.',
      data: {
        customer: {
          account_id: customerAccount.id,
          account_code: customerAccount.code,
          name: customerAccount.name,
          type: customerAccount.type,
          status: customerAccount.status,
          user: customerUser ? {
            id: customerUser.id,
            name: customerUser.name,
            phone: customerUser.phone,
            email: customerUser.email,
            nid: customerUser.nid,
            address: customerUser.address,
            account_type: customerUser.account_type,
          } : null,
          relationship: relationship ? {
            price_per_liter: Number(relationship.price_per_liter),
            average_supply_quantity: Number(relationship.average_supply_quantity),
            relationship_status: relationship.relationship_status,
            created_at: relationship.created_at,
            updated_at: relationship.updated_at,
          } : null,
        },
      },
    };
  }

  async getCustomerById(user: User, customerAccountId: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    const supplierAccountId = user.default_account_id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(customerAccountId)) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid customer account ID format. Must be a valid UUID.',
      });
    }

    // Get customer account by ID
    const customerAccount = await this.prisma.account.findUnique({
      where: { id: customerAccountId },
      include: {
        user_accounts: {
          where: { status: 'active' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                nid: true,
                address: true,
                account_type: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!customerAccount) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Customer account not found.',
      });
    }

    // Get supplier-customer relationship
    const relationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccountId,
        customer_account_id: customerAccount.id,
      },
      include: {
        supplier_account: true,
        customer_account: true,
      },
    });

    const customerUser = customerAccount.user_accounts[0]?.user;

    return {
      code: 200,
      status: 'success',
      message: 'Customer fetched successfully.',
      data: {
        customer: {
          account_id: customerAccount.id,
          account_code: customerAccount.code,
          name: customerAccount.name,
          type: customerAccount.type,
          status: customerAccount.status,
          user: customerUser ? {
            id: customerUser.id,
            name: customerUser.name,
            phone: customerUser.phone,
            email: customerUser.email,
            nid: customerUser.nid,
            address: customerUser.address,
            account_type: customerUser.account_type,
          } : null,
          relationship: relationship ? {
            price_per_liter: Number(relationship.price_per_liter),
            average_supply_quantity: Number(relationship.average_supply_quantity),
            relationship_status: relationship.relationship_status,
            created_at: relationship.created_at,
            updated_at: relationship.updated_at,
          } : null,
        },
      },
    };
  }

  async updateCustomer(user: User, updateDto: UpdateCustomerDto) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    const supplierAccountId = user.default_account_id;

    // Get customer account by code
    const customerAccount = await this.prisma.account.findUnique({
      where: { code: updateDto.customer_account_code },
      include: {
        user_accounts: {
          where: { status: 'active' },
          include: { user: true },
          take: 1,
        },
      },
    });

    if (!customerAccount) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Customer account not found.',
      });
    }

    // Find existing relationship
    const relationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccountId,
        customer_account_id: customerAccount.id,
      },
    });

    if (!relationship) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Customer relationship not found.',
      });
    }

    const customerUser = customerAccount.user_accounts[0]?.user;

    const wantsIdentity =
      updateDto.first_name !== undefined ||
      updateDto.last_name !== undefined ||
      updateDto.name !== undefined;

    let touchedIdentity = false;
    if (wantsIdentity) {
      let fn = '';
      let ln = '';
      if (customerUser) {
        fn =
          updateDto.first_name !== undefined ? updateDto.first_name.trim() : customerUser.first_name;
        ln =
          updateDto.last_name !== undefined ? updateDto.last_name.trim() : customerUser.last_name;
        if (
          updateDto.name !== undefined &&
          updateDto.first_name === undefined &&
          updateDto.last_name === undefined
        ) {
          const sp = splitIntoFirstLast(updateDto.name);
          fn = sp.first_name;
          ln = sp.last_name;
        }
      } else {
        if (updateDto.first_name !== undefined) fn = updateDto.first_name.trim();
        if (updateDto.last_name !== undefined) ln = updateDto.last_name.trim();
        if (
          updateDto.name !== undefined &&
          updateDto.first_name === undefined &&
          updateDto.last_name === undefined
        ) {
          const sp = splitIntoFirstLast(updateDto.name);
          fn = sp.first_name;
          ln = sp.last_name;
        }
      }
      const display = composeUserFullName(fn, ln);
      if (display) {
        await this.prisma.account.update({
          where: { id: customerAccount.id },
          data: { name: display, updated_by: user.id },
        });
        if (customerUser) {
          await this.prisma.user.update({
            where: { id: customerUser.id },
            data: {
              first_name: fn,
              last_name: ln,
              name: display,
              updated_by: user.id,
            },
          });
        }
        touchedIdentity = true;
      }
    }

    let touchedContact = false;
    if (customerUser) {
      const userUpdateData: any = {
        updated_by: user.id,
      };

      if (updateDto.phone) {
        userUpdateData.phone = updateDto.phone.replace(/\D/g, '');
      }
      if (updateDto.email) {
        userUpdateData.email = updateDto.email.toLowerCase();
      }
      if (updateDto.nid) {
        userUpdateData.nid = updateDto.nid;
      }
      if (updateDto.address) {
        userUpdateData.address = updateDto.address;
      }

      if (Object.keys(userUpdateData).length > 1) {
        await this.prisma.user.update({
          where: { id: customerUser.id },
          data: userUpdateData,
        });
        touchedContact = true;
      }
    }

    const relationshipUpdateData: any = {
      updated_by: user.id,
    };

    if (updateDto.price_per_liter !== undefined) {
      relationshipUpdateData.price_per_liter = updateDto.price_per_liter;
    }

    if (updateDto.relationship_status) {
      relationshipUpdateData.relationship_status = updateDto.relationship_status as any;
    }

    const hasRelationshipPatch = Object.keys(relationshipUpdateData).length > 1;

    if (!hasRelationshipPatch && !touchedIdentity && !touchedContact) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No fields to update.',
      });
    }

    const updatedRelationship = hasRelationshipPatch
      ? await this.prisma.supplierCustomer.update({
          where: { id: relationship.id },
          data: relationshipUpdateData,
          include: {
            supplier_account: true,
            customer_account: true,
          },
        })
      : await this.prisma.supplierCustomer.findUnique({
          where: { id: relationship.id },
          include: {
            supplier_account: true,
            customer_account: true,
          },
        });

    if (!updatedRelationship) {
      throw new InternalServerErrorException({
        code: 500,
        status: 'error',
        message: 'Failed to load customer relationship after update.',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Customer updated successfully.',
      data: {
        customer: {
          account_code: updatedRelationship.customer_account.code,
          price_per_liter: Number(updatedRelationship.price_per_liter),
          relationship_status: updatedRelationship.relationship_status,
        },
      },
    };
  }

  async deleteCustomer(user: User, customerAccountCode: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    const supplierAccountId = user.default_account_id;

    // Get customer account by code
    const customerAccount = await this.prisma.account.findUnique({
      where: { code: customerAccountCode },
    });

    if (!customerAccount) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Customer account not found.',
      });
    }

    // Find and delete relationship (soft delete by setting status to inactive)
    const relationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccountId,
        customer_account_id: customerAccount.id,
      },
    });

    if (!relationship) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Customer relationship not found.',
      });
    }

    // Set relationship status to inactive (soft delete)
    await this.prisma.supplierCustomer.update({
      where: { id: relationship.id },
      data: {
        relationship_status: 'inactive',
        updated_by: user.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Customer relationship deleted successfully.',
    };
  }
}

