import { Injectable } from '@nestjs/common';
import { AccountType, Prisma, PrismaClient, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { AdminService } from '../admin/admin.service';

type ScopeLocation = { id: string; code: string; name: string };

@Injectable()
export class SupervisorService {
  constructor(
    private prisma: PrismaService,
    private locations: LocationsService,
    private admin: AdminService,
  ) {}

  private async scopedDistrictIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.regionalSupervisorDistrict.findMany({
      where: { user_id: userId },
      select: { district_location_id: true },
    });
    return [...new Set(rows.map((r) => r.district_location_id).filter(Boolean))] as string[];
  }

  private async effectiveDistrictIds(userId: string, opts: { district_location_id?: string; region_id?: string }) {
    const scoped = await this.scopedDistrictIds(userId);
    if (scoped.length === 0) return [];

    if (opts.district_location_id) {
      return scoped.includes(opts.district_location_id) ? [opts.district_location_id] : [];
    }

    if (opts.region_id) {
      const districts = await this.prisma.location.findMany({
        where: { id: { in: scoped }, parent_id: opts.region_id, location_type: 'DISTRICT' },
        select: { id: true },
      });
      return districts.map((d) => d.id);
    }

    return scoped;
  }

  async getScope(user: User, platformAccountId: string) {
    // Permission enforcement happens via @RequirePermission guard.
    // Scope itself is always derived from regional_supervisor_districts.
    const districtIds = await this.scopedDistrictIds(user.id);
    if (districtIds.length === 0) {
      return {
        code: 200,
        status: 'success',
        message: 'Scope retrieved.',
        data: { provinces: [] as ScopeLocation[], districts: [] as (ScopeLocation & { province_id: string })[] },
      };
    }

    const districtsRaw = await this.prisma.location.findMany({
      where: { id: { in: districtIds }, location_type: 'DISTRICT' },
      select: { id: true, code: true, name: true, parent_id: true },
      orderBy: { name: 'asc' },
    });
    const districts = districtsRaw.filter((d): d is typeof d & { parent_id: string } => !!d.parent_id);
    const provinceIds = [...new Set(districts.map((d) => d.parent_id))];
    const provinces = await this.prisma.location.findMany({
      where: { id: { in: provinceIds }, location_type: 'PROVINCE' },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Scope retrieved.',
      data: {
        provinces,
        districts: districts.map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          province_id: d.parent_id,
        })),
      },
    };
  }

  async listAccounts(
    user: User,
    platformAccountId: string,
    opts: {
      page: number;
      limit: number;
      search?: string;
      account_type?: 'tenant' | 'branch' | 'admin' | 'all';
      district_location_id?: string;
      region_id?: string;
    },
  ) {
    // Reuse the existing admin listing logic (it already applies supervisor scope via view_regional_accounts).
    // For region filtering (province), we request the scoped list and then filter by district ids in that province.
    const base = await this.admin.listTenantAccountsForAdmin(user, platformAccountId, {
      page: opts.page,
      limit: opts.limit,
      search: opts.search,
      account_type: opts.account_type ?? 'all',
      district_location_id: opts.region_id ? undefined : opts.district_location_id,
    });

    if (opts.region_id && base.code === 200 && base.data?.rows) {
      const eff = await this.effectiveDistrictIds(user.id, { region_id: opts.region_id });
      const rows = base.data.rows.filter((r: { operational_district_id?: string | null }) =>
        r.operational_district_id ? eff.includes(r.operational_district_id) : false,
      );
      return {
        ...base,
        data: {
          ...base.data,
          rows,
          pagination: {
            ...base.data.pagination,
            total: rows.length,
            totalPages: 1,
            page: 1,
          },
        },
      };
    }

    return base;
  }

  async getSummary(
    user: User,
    platformAccountId: string,
    opts: { district_location_id?: string; region_id?: string },
  ) {
    const districtIds = await this.effectiveDistrictIds(user.id, opts);
    if (districtIds.length === 0) {
      return {
        code: 200,
        status: 'success',
        message: 'Summary retrieved.',
        data: {
          mcc_count: 0,
          members: 0,
          suppliers: 0,
          customers: 0,
          farms: 0,
          sales: 0,
          collections: 0,
        },
      };
    }

    const accounts = await this.prisma.account.findMany({
      where: {
        type: { in: [AccountType.tenant, AccountType.branch] },
        operational_district_id: { in: districtIds },
      },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return {
        code: 200,
        status: 'success',
        message: 'Summary retrieved.',
        data: {
          mcc_count: 0,
          members: 0,
          suppliers: 0,
          customers: 0,
          farms: 0,
          sales: 0,
          collections: 0,
        },
      };
    }

    const [
      membersByAccount,
      suppliersByCustomerAccount,
      customersBySupplierAccount,
      salesBySupplierAccount,
      collectionsByCustomerAccount,
      farmsByAccount,
    ] = await Promise.all([
      this.prisma.userAccount.groupBy({
        by: ['account_id'],
        where: { account_id: { in: accountIds }, status: 'active' },
        _count: true,
      }),
      this.prisma.supplierCustomer.groupBy({
        by: ['customer_account_id'],
        where: { customer_account_id: { in: accountIds }, relationship_status: 'active' },
        _count: true,
      }),
      this.prisma.supplierCustomer.groupBy({
        by: ['supplier_account_id'],
        where: { supplier_account_id: { in: accountIds }, relationship_status: 'active' },
        _count: true,
      }),
      this.prisma.milkSale.groupBy({
        by: ['supplier_account_id'],
        where: { supplier_account_id: { in: accountIds }, status: { not: 'deleted' } },
        _count: true,
      }),
      this.prisma.milkSale.groupBy({
        by: ['customer_account_id'],
        where: { customer_account_id: { in: accountIds }, status: { not: 'deleted' } },
        _count: true,
      }),
      this.prisma.farm.groupBy({
        by: ['account_id'],
        where: { account_id: { in: accountIds } },
        _count: true,
      }),
    ]);

    const normalize = (row: { _count?: number | { _all?: number } }) =>
      typeof row._count === 'number' ? row._count : row._count?._all ?? 0;

    const sum = (rows: Array<{ _count?: number | { _all?: number } }>) => rows.reduce((acc, r) => acc + normalize(r), 0);

    return {
      code: 200,
      status: 'success',
      message: 'Summary retrieved.',
      data: {
        mcc_count: accountIds.length,
        members: sum(membersByAccount),
        suppliers: sum(suppliersByCustomerAccount),
        customers: sum(customersBySupplierAccount),
        farms: sum(farmsByAccount),
        sales: sum(salesBySupplierAccount),
        collections: sum(collectionsByCustomerAccount),
      },
    };
  }
}

