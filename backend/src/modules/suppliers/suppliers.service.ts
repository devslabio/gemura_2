import { Injectable, BadRequestException, ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { canonicalPlatformRoleSlug, isPlatformSuperAdminRole } from '../admin/roles-permissions.config';
import { User, UserAccountType, SupplierTransferStatus } from '@prisma/client';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import {
  RegisterSupplierOnboardingDto,
  UpdateSupplierMilkOnboardingDto,
  CreateManagedFarmDto,
  UpdateManagedFarmDto,
  DeleteManagedFarmDto,
  CreateManagedCollectionDto,
  CreateManagedProductionDto,
  CreateManagedTransferDto,
  SubmitManagedTransferDto,
} from './dto/register-supplier-onboarding.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { composeUserFullName, splitIntoFirstLast } from '../../common/utils/user-name.util';

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

  /**
   * Milk onboarding JSON for a supplier tenant account linked to the caller’s MCC.
   */
  async getSupplierOnboardingByAccount(user: User, supplierAccountId: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }

    const customerAccountId = user.default_account_id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(supplierAccountId)) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid supplier account ID format. Must be a valid UUID.',
      });
    }

    const supplierAccount = await this.prisma.account.findUnique({
      where: { id: supplierAccountId },
      include: {
        user_accounts: {
          where: { status: 'active' },
          include: { user: true },
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

    const supplierUser = supplierAccount.user_accounts[0]?.user;
    if (!supplierUser) {
      return {
        code: 200,
        status: 'success',
        message: 'No user linked to this supplier account.',
        data: { onboarding: null, updated_at: null },
      };
    }

    const row = await this.prisma.supplierMilkOnboarding.findUnique({
      where: { user_id: supplierUser.id },
    });

    if (!row) {
      return {
        code: 200,
        status: 'success',
        message: 'No onboarding record.',
        data: { onboarding: null, updated_at: null },
      };
    }

    return {
      code: 200,
      status: 'success',
      message: 'OK',
      data: {
        onboarding: row.payload,
        updated_at: row.updated_at.toISOString(),
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

  private async assertUserCanActForMcc(user: User, mccAccountId: string): Promise<void> {
    if (user.default_account_id === mccAccountId) {
      return;
    }
    const ua = await this.prisma.userAccount.findFirst({
      where: { user_id: user.id, account_id: mccAccountId, status: 'active' },
    });
    if (ua) {
      return;
    }
    throw new ForbiddenException({
      code: 403,
      status: 'error',
      message: 'Not allowed to onboard suppliers for this MCC account.',
    });
  }

  /**
   * MCC user completes the “onboard new supplier” wizard: create login + account + MCC link + store onboarding JSON.
   */
  async registerFromOnboarding(agentUser: User, dto: RegisterSupplierOnboardingDto) {
    await this.assertUserCanActForMcc(agentUser, dto.mcc_account_id);

    if (dto.account_type === 'supplier' && !dto.supplier_segment) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'supplier_segment is required for milk collectors (farmer_collector or pure_collector).',
      });
    }

    const normalizedPhone = dto.phone.replace(/\D/g, '');

    if (dto.email) {
      const e = await this.prisma.user.findFirst({ where: { email: dto.email.toLowerCase().trim() } });
      if (e) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Email already exists.',
        });
      }
    }

    const existingPhone = await this.prisma.user.findFirst({ where: { phone: normalizedPhone } });
    if (existingPhone) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Phone number already registered.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userCode = `U_${randomBytes(3).toString('hex').toUpperCase()}`;
    const accountCode = `A_${randomBytes(3).toString('hex').toUpperCase()}`;
    const walletCode = `W_${randomBytes(3).toString('hex').toUpperCase()}`;
    const token = randomBytes(32).toString('hex');

    const appAccountType: UserAccountType =
      dto.account_type === 'farmer' ? UserAccountType.farmer : UserAccountType.supplier;
    const segment: string | null =
      dto.account_type === 'farmer'
        ? (dto.supplier_segment || 'direct_farmer')
        : (dto.supplier_segment ?? null);

    const normalizedAddress = dto.address?.trim() || null;
    const normalizedBankName = dto.bank_name?.trim() || null;
    const normalizedBankAccountNumber = dto.bank_account_number?.trim() || null;
    const pricePerLiter = Number(dto.price_per_liter);

    const { first_name, last_name } = splitIntoFirstLast(dto.name.trim());

    const { newUser, account } = await this.prisma.$transaction(async (tx) => {
      const nu = await tx.user.create({
        data: {
          code: userCode,
          first_name,
          last_name,
          name: composeUserFullName(first_name, last_name) || dto.name.trim(),
          phone: normalizedPhone,
          nid: dto.nid,
          address: normalizedAddress,
          email: dto.email?.toLowerCase().trim() || null,
          password_hash: passwordHash,
          token,
          status: 'active',
          account_type: appAccountType,
          supplier_segment: segment,
          registration_type: 'onboarded',
          default_account_id: null,
          created_by: agentUser.id,
        },
      });

      const acc = await tx.account.create({
        data: {
          code: accountCode,
          name: dto.name.trim(),
          bank_name: normalizedBankName,
          bank_account_number: normalizedBankAccountNumber,
          type: 'tenant',
          status: 'active',
          created_by: agentUser.id,
        },
      });

      await tx.userAccount.create({
        data: {
          user_id: nu.id,
          account_id: acc.id,
          /** Use supplier (same as /suppliers/create) — "owner" is reserved for MCC org admins in the web app. */
          role: 'supplier',
          status: 'active',
          created_by: agentUser.id,
        },
      });

      await tx.user.update({ where: { id: nu.id }, data: { default_account_id: acc.id } });

      await tx.wallet.create({
        data: {
          code: walletCode,
          account_id: acc.id,
          type: 'regular',
          is_default: true,
          balance: 0,
          currency: 'RWF',
          status: 'active',
          created_by: agentUser.id,
        },
      });

      await tx.supplierCustomer.create({
        data: {
          supplier_account_id: acc.id,
          customer_account_id: dto.mcc_account_id,
          price_per_liter: pricePerLiter,
          relationship_status: 'active',
          created_by: agentUser.id,
        },
      });

      await tx.supplierMilkOnboarding.create({
        data: {
          user_id: nu.id,
          payload: dto.onboarding as object,
          mcc_account_id: dto.mcc_account_id,
        },
      });

      return { newUser: nu, account: acc };
    });

    return {
      code: 201,
      status: 'success',
      message: 'Supplier account created. They can sign in with phone and password.',
      data: {
        user_id: newUser.id,
        account_id: account.id,
      },
    };
  }

  async getMyOnboarding(user: User) {
    const row = await this.prisma.supplierMilkOnboarding.findUnique({
      where: { user_id: user.id },
    });
    if (!row) {
      return {
        code: 200,
        status: 'success',
        message: 'No onboarding record.',
        data: { onboarding: null, updated_at: null },
      };
    }
    return {
      code: 200,
      status: 'success',
      message: 'OK',
      data: {
        onboarding: row.payload,
        updated_at: row.updated_at,
      },
    };
  }

  async putMyOnboarding(user: User, dto: UpdateSupplierMilkOnboardingDto) {
    const row = await this.prisma.supplierMilkOnboarding.findUnique({
      where: { user_id: user.id },
    });
    if (!row) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'No onboarding record to update. Complete MCC onboarding first.',
      });
    }
    const payload = (row.payload || {}) as Record<string, unknown>;
    const currentDraft = (typeof payload.draft === 'object' && payload.draft) ? (payload.draft as Record<string, unknown>) : {};
    const nextPayload = {
      ...payload,
      draft: { ...currentDraft, ...dto.draft },
    };
    const updated = await this.prisma.supplierMilkOnboarding.update({
      where: { user_id: user.id },
      data: { payload: nextPayload as object },
    });
    return {
      code: 200,
      status: 'success',
      message: 'Onboarding draft updated.',
      data: { onboarding: updated.payload, updated_at: updated.updated_at },
    };
  }

  private async getOpsRowOrThrow(userId: string) {
    const row = await this.prisma.supplierMilkOnboarding.findUnique({
      where: { user_id: userId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'No onboarding record found. Please complete onboarding first.',
      });
    }
    return row;
  }

  private getOpsState(payload: Record<string, unknown>) {
    const mg = (payload.management ?? {}) as Record<string, unknown>;
    const farms = Array.isArray(mg.farms) ? mg.farms : [];
    const collections = Array.isArray(mg.collections) ? mg.collections : [];
    const production = Array.isArray(mg.production) ? mg.production : [];
    const transfers = Array.isArray(mg.transfers) ? mg.transfers : [];
    return { farms, collections, production, transfers };
  }

  private async saveOpsState(
    userId: string,
    payload: Record<string, unknown>,
    state: { farms: unknown[]; collections: unknown[]; production: unknown[]; transfers: unknown[] },
  ) {
    const nextPayload = {
      ...payload,
      management: {
        ...((payload.management as Record<string, unknown>) || {}),
        farms: state.farms,
        collections: state.collections,
        production: state.production,
        transfers: state.transfers,
      },
    };
    return this.prisma.supplierMilkOnboarding.update({
      where: { user_id: userId },
      data: { payload: nextPayload as object },
    });
  }

  async getOpsSummary(user: User) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const { farms, collections, production, transfers } = this.getOpsState(payload);

    const ownCollected = collections
      .filter((c) => (c as { source_type?: string }).source_type === 'own_farm')
      .reduce((a, c) => a + (Number((c as { liters?: number }).liters) || 0), 0);
    const externalCollected = collections
      .filter((c) => (c as { source_type?: string }).source_type === 'external_farm')
      .reduce((a, c) => a + (Number((c as { liters?: number }).liters) || 0), 0);
    const totalCollected = ownCollected + externalCollected;
    const totalProduction = production.reduce((a, p) => a + (Number((p as { liters?: number }).liters) || 0), 0);
    const pendingTransfers = transfers.filter((t) => (t as { status?: string }).status !== 'submitted').length;

    return {
      code: 200,
      status: 'success',
      message: 'OK',
      data: {
        farms_total: farms.length,
        own_collected_liters: ownCollected,
        external_collected_liters: externalCollected,
        total_collected_liters: totalCollected,
        own_production_liters: totalProduction,
        pending_transfers: pendingTransfers,
      },
    };
  }

  async getMyFarms(user: User) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const { farms } = this.getOpsState(payload);
    return { code: 200, status: 'success', message: 'OK', data: farms };
  }

  async createMyFarm(user: User, dto: CreateManagedFarmDto) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const state = this.getOpsState(payload);
    const now = new Date().toISOString();
    const farm = {
      id: randomUUID(),
      name: dto.name.trim(),
      location: dto.location?.trim() || '',
      status: dto.status || 'active',
      created_at: now,
      updated_at: now,
    };
    state.farms.push(farm);
    await this.saveOpsState(user.id, payload, state);
    return { code: 201, status: 'success', message: 'Farm added.', data: farm };
  }

  async updateMyFarm(user: User, dto: UpdateManagedFarmDto) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const state = this.getOpsState(payload);
    const idx = state.farms.findIndex((f) => (f as { id?: string }).id === dto.id);
    if (idx < 0) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Farm not found.' });
    }
    const prev = state.farms[idx] as Record<string, unknown>;
    state.farms[idx] = {
      ...prev,
      ...(dto.name != null ? { name: dto.name.trim() } : {}),
      ...(dto.location != null ? { location: dto.location.trim() } : {}),
      ...(dto.status != null ? { status: dto.status } : {}),
      updated_at: new Date().toISOString(),
    };
    await this.saveOpsState(user.id, payload, state);
    return { code: 200, status: 'success', message: 'Farm updated.', data: state.farms[idx] };
  }

  async deleteMyFarm(user: User, dto: DeleteManagedFarmDto) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const state = this.getOpsState(payload);
    const next = state.farms.filter((f) => (f as { id?: string }).id !== dto.id);
    if (next.length === state.farms.length) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Farm not found.' });
    }
    state.farms = next;
    await this.saveOpsState(user.id, payload, state);
    return { code: 200, status: 'success', message: 'Farm removed.' };
  }

  async getMyCollections(user: User) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const { collections } = this.getOpsState(payload);
    return { code: 200, status: 'success', message: 'OK', data: collections };
  }

  async createMyCollection(user: User, dto: CreateManagedCollectionDto) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const state = this.getOpsState(payload);
    const now = new Date().toISOString();
    const collection = {
      id: randomUUID(),
      farm_id: dto.farm_id,
      farm_name: dto.farm_name || '',
      source_type: dto.source_type,
      liters: Number(dto.liters) || 0,
      quality_grade: dto.quality_grade || '',
      notes: dto.notes || '',
      status: 'recorded',
      transferred: false,
      collected_at: dto.collected_at,
      created_at: now,
      updated_at: now,
    };
    state.collections.push(collection);
    await this.saveOpsState(user.id, payload, state);
    return { code: 201, status: 'success', message: 'Collection added.', data: collection };
  }

  async getMyProduction(user: User) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const { production } = this.getOpsState(payload);
    return { code: 200, status: 'success', message: 'OK', data: production };
  }

  async createMyProduction(user: User, dto: CreateManagedProductionDto) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const state = this.getOpsState(payload);
    const now = new Date().toISOString();
    const prod = {
      id: randomUUID(),
      liters: Number(dto.liters) || 0,
      produced_at: dto.produced_at,
      notes: dto.notes || '',
      created_at: now,
      updated_at: now,
    };
    state.production.push(prod);
    await this.saveOpsState(user.id, payload, state);
    return { code: 201, status: 'success', message: 'Production added.', data: prod };
  }

  async getMyTransfers(user: User) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const state = this.getOpsState(payload);
    const { transfers } = state;

    // Auto-sync submitted transfers that don't have db_transfer_id
    const mccAccountId = row.mcc_account_id;
    let needsSave = false;
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i] as Record<string, unknown>;
      if (t.status === 'submitted' && !t.db_transfer_id && mccAccountId) {
        const dbTransfer = await this.prisma.supplierTransfer.create({
          data: {
            supplier_user_id: user.id,
            mcc_account_id: mccAccountId,
            own_liters: Number(t.own_liters) || 0,
            external_liters: Number(t.external_liters) || 0,
            total_liters: Number(t.total_liters) || 0,
            status: SupplierTransferStatus.submitted,
            supplier_notes: String(t.notes || ''),
            submitted_at: t.submitted_at ? new Date(t.submitted_at as string) : new Date(),
          },
        });
        transfers[i] = { ...t, db_transfer_id: dbTransfer.id };
        needsSave = true;
      }
    }
    if (needsSave) {
      await this.saveOpsState(user.id, payload, state);
    }

    // Fetch database transfer records to get MCC processing status
    const dbTransfers = await this.prisma.supplierTransfer.findMany({
      where: { supplier_user_id: user.id },
      orderBy: { submitted_at: 'desc' },
    });

    // Create a map of db transfers by ID for quick lookup
    const dbTransferMap = new Map(dbTransfers.map((t) => [t.id, t]));

    // Merge JSON transfers with database status
    const enrichedTransfers = transfers.map((t) => {
      const jsonTransfer = t as Record<string, unknown>;
      const dbId = jsonTransfer.db_transfer_id as string | undefined;
      if (dbId && dbTransferMap.has(dbId)) {
        const dbRecord = dbTransferMap.get(dbId)!;
        return {
          ...jsonTransfer,
          mcc_status: dbRecord.status,
          mcc_rejection_reason: dbRecord.rejection_reason,
          mcc_accepted_liters: dbRecord.accepted_liters ? Number(dbRecord.accepted_liters) : null,
          mcc_rejected_liters: dbRecord.rejected_liters ? Number(dbRecord.rejected_liters) : null,
          mcc_processed_at: dbRecord.processed_at?.toISOString() || null,
          mcc_notes: dbRecord.notes,
        };
      }
      return jsonTransfer;
    });

    return { code: 200, status: 'success', message: 'OK', data: enrichedTransfers };
  }

  async createMyTransfer(user: User, dto: CreateManagedTransferDto) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const state = this.getOpsState(payload);
    const selected = state.collections.filter((c) => {
      const cc = c as { id?: string; transferred?: boolean };
      if (cc.transferred) return false;
      if (!dto.collection_ids?.length) return true;
      return dto.collection_ids.includes(cc.id || '');
    });
    if (selected.length === 0) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'No eligible collections to transfer.' });
    }
    const own = selected
      .filter((c) => (c as { source_type?: string }).source_type === 'own_farm')
      .reduce((a, c) => a + (Number((c as { liters?: number }).liters) || 0), 0);
    const external = selected
      .filter((c) => (c as { source_type?: string }).source_type === 'external_farm')
      .reduce((a, c) => a + (Number((c as { liters?: number }).liters) || 0), 0);
    const now = new Date().toISOString();
    const transfer = {
      id: randomUUID(),
      mcc_account_id: row.mcc_account_id,
      collection_ids: selected.map((c) => (c as { id: string }).id),
      own_liters: own,
      external_liters: external,
      total_liters: own + external,
      notes: dto.notes || '',
      status: 'draft',
      created_at: now,
      updated_at: now,
      submitted_at: null,
    };
    state.transfers.push(transfer);
    await this.saveOpsState(user.id, payload, state);
    return { code: 201, status: 'success', message: 'Transfer manifest created.', data: transfer };
  }

  async submitMyTransfer(user: User, dto: SubmitManagedTransferDto) {
    const row = await this.getOpsRowOrThrow(user.id);
    const payload = (row.payload || {}) as Record<string, unknown>;
    const state = this.getOpsState(payload);
    const idx = state.transfers.findIndex((t) => (t as { id?: string }).id === dto.id);
    if (idx < 0) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Transfer not found.' });
    }
    const now = new Date().toISOString();
    const transfer = state.transfers[idx] as Record<string, unknown>;
    
    // If already submitted but missing db_transfer_id, sync to database
    if (transfer.status === 'submitted' && !transfer.db_transfer_id) {
      const mccAccountId = row.mcc_account_id;
      if (mccAccountId) {
        const dbTransfer = await this.prisma.supplierTransfer.create({
          data: {
            supplier_user_id: user.id,
            mcc_account_id: mccAccountId,
            own_liters: Number(transfer.own_liters) || 0,
            external_liters: Number(transfer.external_liters) || 0,
            total_liters: Number(transfer.total_liters) || 0,
            status: SupplierTransferStatus.submitted,
            supplier_notes: String(transfer.notes || ''),
            submitted_at: transfer.submitted_at ? new Date(transfer.submitted_at as string) : new Date(),
          },
        });
        state.transfers[idx] = { ...transfer, db_transfer_id: dbTransfer.id };
        await this.saveOpsState(user.id, payload, state);
        return { code: 200, status: 'success', message: 'Transfer synced to MCC.', data: state.transfers[idx] };
      }
    }
    
    if (transfer.status === 'submitted') {
      return { code: 200, status: 'success', message: 'Transfer already submitted.', data: transfer };
    }
    const lineIds = Array.isArray(transfer.collection_ids) ? (transfer.collection_ids as string[]) : [];
    state.collections = state.collections.map((c) => {
      const cc = c as Record<string, unknown>;
      if (lineIds.includes(String(cc.id || ''))) {
        return { ...cc, transferred: true, updated_at: now };
      }
      return cc;
    });

    // Create a SupplierTransfer record in the database for MCC to process
    const mccAccountId = row.mcc_account_id;
    if (!mccAccountId) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'No MCC account linked to this supplier.' });
    }

    const dbTransfer = await this.prisma.supplierTransfer.create({
      data: {
        supplier_user_id: user.id,
        mcc_account_id: mccAccountId,
        own_liters: Number(transfer.own_liters) || 0,
        external_liters: Number(transfer.external_liters) || 0,
        total_liters: Number(transfer.total_liters) || 0,
        status: SupplierTransferStatus.submitted,
        supplier_notes: String(transfer.notes || ''),
        submitted_at: new Date(),
      },
    });

    state.transfers[idx] = {
      ...transfer,
      status: 'submitted',
      submitted_at: now,
      updated_at: now,
      db_transfer_id: dbTransfer.id,
    };
    await this.saveOpsState(user.id, payload, state);
    return { code: 200, status: 'success', message: 'Transfer submitted to MCC.', data: state.transfers[idx] };
  }
}

