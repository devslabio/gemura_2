import { Injectable, BadRequestException, ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { canonicalPlatformRoleSlug, isPlatformSuperAdminRole } from '../admin/roles-permissions.config';
import { User } from '@prisma/client';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { composeUserFullName } from '../../common/utils/user-name.util';

@Injectable()
export class SuppliersService {
  constructor(
    private prisma: PrismaService,
    private rbac: RbacService,
  ) {}

  async createOrUpdateSupplier(user: User, createDto: CreateSupplierDto) {
    const { phone, price_per_liter, email, nid, address, bank_name, bank_account_number } = createDto;
    const fn = createDto.first_name.trim();
    const ln = createDto.last_name.trim();
    const userDisplayName = composeUserFullName(fn, ln);
    const normalizedBankName = bank_name?.trim() || null;
    const normalizedBankAccountNumber = bank_account_number?.trim() || null;

    // Check if user has a valid default account
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    const customerAccountId = user.default_account_id;

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

    let supplierAccountId: string;
    let supplierAccountCode: string;
    let supplierName: string;
    let supplierUserId: string;

    if (existingUser) {
      supplierUserId = existingUser.id;
      // User exists - use existing user
      supplierName = existingUser.name;

      if (existingUser.user_accounts.length > 0) {
        // User has active account - use existing account
        supplierAccountId = existingUser.user_accounts[0].account_id;
        supplierAccountCode = existingUser.user_accounts[0].account.code || '';
      } else {
        // User exists but has no active accounts - create account for existing user
        const accountCode = `A_${randomBytes(3).toString('hex').toUpperCase()}`;
        const walletCode = `W_${randomBytes(3).toString('hex').toUpperCase()}`;

        // Create account for existing user
        const newAccount = await this.prisma.account.create({
          data: {
            code: accountCode,
            name: existingUser.name || userDisplayName,
            bank_name: normalizedBankName,
            bank_account_number: normalizedBankAccountNumber,
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
            role: 'supplier',
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

        supplierAccountId = newAccount.id;
        supplierAccountCode = accountCode;
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
          account_type: 'supplier',
          created_by: user.id,
        },
      });

      // Create account
      const newAccount = await this.prisma.account.create({
        data: {
          code: accountCode,
          name: userDisplayName,
          bank_name: normalizedBankName,
          bank_account_number: normalizedBankAccountNumber,
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
          role: 'supplier',
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

      supplierAccountId = newAccount.id;
      supplierAccountCode = accountCode;
      supplierName = userDisplayName;
      supplierUserId = newUser.id;
    }

    if (normalizedBankName || normalizedBankAccountNumber) {
      await this.prisma.account.update({
        where: { id: supplierAccountId },
        data: {
          ...(normalizedBankName ? { bank_name: normalizedBankName } : {}),
          ...(normalizedBankAccountNumber ? { bank_account_number: normalizedBankAccountNumber } : {}),
          updated_by: user.id,
        },
      });
    }

    // Create or update supplier-customer relationship
    const existingRelationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccountId,
        customer_account_id: customerAccountId,
      },
    });

    if (existingRelationship) {
      // Update existing relationship
      await this.prisma.supplierCustomer.update({
        where: { id: existingRelationship.id },
        data: {
          price_per_liter: price_per_liter,
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
          price_per_liter: price_per_liter,
          relationship_status: 'active',
          created_by: user.id,
        },
      });
    }

    const mccAffiliation = await this.applySupplierMccAffiliation(
      user,
      customerAccountId,
      supplierUserId,
      createDto,
    );

    return {
      code: 200,
      status: 'success',
      message: 'Supplier created/updated successfully.',
      data: {
        supplier: {
          account_id: supplierAccountId,
          account_code: supplierAccountCode,
          name: supplierName,
          phone: normalizedPhone,
          price_per_liter: price_per_liter,
          bank_name: normalizedBankName,
          bank_account_number: normalizedBankAccountNumber,
        },
        mcc_affiliation: mccAffiliation,
      },
    };
  }

  private async ensureAssignableStaffRole(rawRole: string): Promise<string> {
    await this.rbac.ensureCatalogFromConfig();
    const slug = canonicalPlatformRoleSlug(rawRole.trim().slice(0, 64));
    if (!slug) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid staff role.',
      });
    }
    const row = await this.prisma.platformRole.findUnique({ where: { slug } });
    if (!row?.is_active) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Unknown or inactive role.',
      });
    }
    if (!row.is_assignable) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'This role cannot be assigned from supplier registration.',
      });
    }
    return slug;
  }

  private async applySupplierMccAffiliation(
    actor: User,
    mccAccountId: string,
    supplierUserId: string,
    dto: CreateSupplierDto,
  ): Promise<{
    cooperative_member_recorded: boolean;
    mcc_staff: 'created' | 'skipped_already_linked' | 'not_requested';
    mcc_staff_role?: string;
  }> {
    const wantsMember = dto.add_as_cooperative_member === true;
    const wantsStaff = dto.grant_mcc_staff_access === true;

    let cooperative_member_recorded = false;
    let mcc_staff: 'created' | 'skipped_already_linked' | 'not_requested' = 'not_requested';
    let mcc_staff_role: string | undefined;

    if (wantsMember) {
      const existingMem = await this.prisma.accountMembership.findFirst({
        where: { account_id: mccAccountId, user_id: supplierUserId },
      });
      if (existingMem) {
        await this.prisma.accountMembership.update({
          where: { id: existingMem.id },
          data: {
            status: 'active',
            updated_by: actor.id,
          },
        });
      } else {
        await this.prisma.accountMembership.create({
          data: {
            account_id: mccAccountId,
            user_id: supplierUserId,
            status: 'active',
            member_since: new Date(),
            created_by: actor.id,
            updated_by: actor.id,
          },
        });
      }
      cooperative_member_recorded = true;
    }

    if (wantsStaff) {
      const roleSlug = await this.ensureAssignableStaffRole(dto.mcc_staff_role || '');
      mcc_staff_role = roleSlug;
      await this.rbac.ensureCatalogFromConfig();
      const platformRoleId = await this.rbac.resolvePlatformRoleIdFromSlug(roleSlug);
      if (!platformRoleId) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Could not resolve platform role for staff assignment.',
        });
      }

      const existingUa = await this.prisma.userAccount.findFirst({
        where: {
          user_id: supplierUserId,
          account_id: mccAccountId,
        },
      });

      if (existingUa) {
        mcc_staff = 'skipped_already_linked';
      } else {
        await this.prisma.userAccount.create({
          data: {
            user_id: supplierUserId,
            account_id: mccAccountId,
            role: roleSlug,
            platform_role_id: platformRoleId,
            permissions: null,
            status: 'active',
            created_by: actor.id,
          },
        });
        mcc_staff = 'created';
      }
    }

    return {
      cooperative_member_recorded,
      mcc_staff,
      ...(mcc_staff_role ? { mcc_staff_role } : {}),
    };
  }

  async bulkCreateSuppliers(
    user: User,
    rows: CreateSupplierDto[],
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
        await this.createOrUpdateSupplier(user, row);
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

  async getAllSuppliers(user: User, accountIdParam?: string) {
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

    const ua = await this.prisma.userAccount.findFirst({
      where: { user_id: user.id, account_id: customerAccountId, status: 'active' },
    });
    if (!ua) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No active membership on this account.',
      });
    }

    const roleLc = (ua.role || '').toLowerCase();
    const codes = await this.rbac.getEffectivePermissionCodes(ua);
    const seesFullSupplierList =
      isPlatformSuperAdminRole(roleLc) ||
      codes.includes('view_suppliers') ||
      codes.includes('mcc_view_operations') ||
      codes.includes('mcc_floor_operations');

    const scopedGateSupplierOnly =
      !seesFullSupplierList &&
      (codes.includes('mcc_view_own_operations') || codes.includes('mcc_manage_own_operations'));

    let supplierAccountFilter: string | undefined;
    if (scopedGateSupplierOnly) {
      const sid = ua.linked_umucunda_supplier_account_id;
      if (!sid) {
        return {
          code: 200,
          status: 'success',
          message:
            'No Umucunda route supplier linked for this user. Ask an admin to set linked Umucunda supplier on your team membership.',
          data: [],
        };
      }
      supplierAccountFilter = sid;
    } else if (!seesFullSupplierList) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'Insufficient permissions to list suppliers.',
      });
    }

    const relationships = await this.prisma.supplierCustomer.findMany({
      where: {
        customer_account_id: customerAccountId,
        relationship_status: 'active',
        ...(supplierAccountFilter ? { supplier_account_id: supplierAccountFilter } : {}),
      },
      include: {
        supplier_account: {
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

    const suppliers = relationships.map((rel) => {
      const supplierUser = rel.supplier_account.user_accounts[0]?.user;
      return {
        relationship_id: rel.id,
        code: supplierUser?.code || '',
        name: supplierUser?.name || rel.supplier_account.name,
        phone: supplierUser?.phone || '',
        email: supplierUser?.email || null,
        nid: supplierUser?.nid || null,
        address: supplierUser?.address || null,
        account: {
          id: rel.supplier_account.id,
          code: rel.supplier_account.code,
          name: rel.supplier_account.name,
        },
        bank_name: rel.supplier_account.bank_name,
        bank_account_number: rel.supplier_account.bank_account_number,
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
      message: 'Suppliers fetched successfully.',
      data: suppliers,
    };
  }

  async getSupplier(user: User, supplierAccountCode: string) {
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
      where: { code: supplierAccountCode },
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

    if (!supplierAccount) {
      throw new BadRequestException({
        code: 404,
        status: 'error',
        message: 'Supplier account not found.',
      });
    }

    // Get supplier-customer relationship
    const relationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccount.id,
        customer_account_id: customerAccountId,
      },
      include: {
        supplier_account: true,
        customer_account: true,
      },
    });

    const supplierUser = supplierAccount.user_accounts[0]?.user;

    return {
      code: 200,
      status: 'success',
      message: 'Supplier fetched successfully.',
      data: {
        supplier: {
          account_id: supplierAccount.id,
          account_code: supplierAccount.code,
          name: supplierAccount.name,
          bank_name: supplierAccount.bank_name,
          bank_account_number: supplierAccount.bank_account_number,
          type: supplierAccount.type,
          status: supplierAccount.status,
          user: supplierUser ? {
            id: supplierUser.id,
            name: supplierUser.name,
            phone: supplierUser.phone,
            email: supplierUser.email,
            nid: supplierUser.nid,
            address: supplierUser.address,
            account_type: supplierUser.account_type,
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

  async getSupplierById(user: User, supplierAccountId: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    const customerAccountId = user.default_account_id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(supplierAccountId)) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid supplier account ID format. Must be a valid UUID.',
      });
    }

    // Get supplier account by ID
    const supplierAccount = await this.prisma.account.findUnique({
      where: { id: supplierAccountId },
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

    if (!supplierAccount) {
      throw new BadRequestException({
        code: 404,
        status: 'error',
        message: 'Supplier account not found.',
      });
    }

    // Get supplier-customer relationship
    const relationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccount.id,
        customer_account_id: customerAccountId,
      },
      include: {
        supplier_account: true,
        customer_account: true,
      },
    });

    const supplierUser = supplierAccount.user_accounts[0]?.user;

    return {
      code: 200,
      status: 'success',
      message: 'Supplier fetched successfully.',
      data: {
        supplier: {
          account_id: supplierAccount.id,
          account_code: supplierAccount.code,
          name: supplierAccount.name,
          bank_name: supplierAccount.bank_name,
          bank_account_number: supplierAccount.bank_account_number,
          type: supplierAccount.type,
          status: supplierAccount.status,
          user: supplierUser ? {
            id: supplierUser.id,
            name: supplierUser.name,
            phone: supplierUser.phone,
            email: supplierUser.email,
            nid: supplierUser.nid,
            address: supplierUser.address,
            account_type: supplierUser.account_type,
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

  async updateSupplier(user: User, updateDto: UpdateSupplierDto) {
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
      where: { code: updateDto.supplier_account_code },
    });

    if (!supplierAccount) {
      throw new BadRequestException({
        code: 404,
        status: 'error',
        message: 'Supplier account not found.',
      });
    }

    // Find existing relationship
    const relationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccount.id,
        customer_account_id: customerAccountId,
      },
    });

    if (!relationship) {
      throw new BadRequestException({
        code: 404,
        status: 'error',
        message: 'Supplier relationship not found.',
      });
    }

    // Build relationship update data
    const updateData: any = {
      updated_by: user.id,
    };

    // Build supplier account update data
    const accountUpdateData: any = {
      updated_by: user.id,
    };

    if (updateDto.price_per_liter !== undefined) {
      updateData.price_per_liter = updateDto.price_per_liter;
    }

    if (updateDto.relationship_status) {
      updateData.relationship_status = updateDto.relationship_status as any;
    }

    if (updateDto.bank_name !== undefined) {
      accountUpdateData.bank_name = updateDto.bank_name?.trim() || null;
    }

    if (updateDto.bank_account_number !== undefined) {
      accountUpdateData.bank_account_number = updateDto.bank_account_number?.trim() || null;
    }

    const hasRelationshipUpdate = Object.keys(updateData).length > 1;
    const hasAccountUpdate = Object.keys(accountUpdateData).length > 1;

    if (!hasRelationshipUpdate && !hasAccountUpdate) {
      // Only updated_by, no actual fields to update
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No fields to update.',
      });
    }

    if (hasAccountUpdate) {
      await this.prisma.account.update({
        where: { id: supplierAccount.id },
        data: accountUpdateData,
      });
    }

    const updatedRelationship = hasRelationshipUpdate
      ? await this.prisma.supplierCustomer.update({
          where: { id: relationship.id },
          data: updateData,
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
        message: 'Failed to update supplier.',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Supplier updated successfully.',
      data: {
        supplier: {
          account_code: updatedRelationship.supplier_account.code,
          bank_name: updatedRelationship.supplier_account.bank_name,
          bank_account_number: updatedRelationship.supplier_account.bank_account_number,
          price_per_liter: Number(updatedRelationship.price_per_liter),
          relationship_status: updatedRelationship.relationship_status,
        },
      },
    };
  }

  async deleteSupplier(user: User, supplierAccountCode: string) {
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
      where: { code: supplierAccountCode },
    });

    if (!supplierAccount) {
      throw new BadRequestException({
        code: 404,
        status: 'error',
        message: 'Supplier account not found.',
      });
    }

    // Find and delete relationship (soft delete by setting status to inactive)
    const relationship = await this.prisma.supplierCustomer.findFirst({
      where: {
        supplier_account_id: supplierAccount.id,
        customer_account_id: customerAccountId,
      },
    });

    if (!relationship) {
      throw new BadRequestException({
        code: 404,
        status: 'error',
        message: 'Supplier relationship not found.',
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
      message: 'Supplier relationship deleted successfully.',
    };
  }
}

