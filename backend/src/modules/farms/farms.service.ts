import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmProductionMode, FarmStatus, Prisma, User } from '@prisma/client';

export interface FarmsListFilters {
  status?: FarmStatus;
  search?: string;
}

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  private dedupeSpeciesFocus(rows: { species_id: string; modes: FarmProductionMode[] }[]) {
    const map = new Map<string, FarmProductionMode[]>();
    for (const r of rows) {
      map.set(r.species_id, r.modes);
    }
    return [...map.entries()].map(([species_id, modes]) => ({ species_id, modes }));
  }

  private farmWithSpeciesFocusInclude(): Prisma.FarmInclude {
    return {
      _count: { select: { animals: true } },
      locationRef: { select: { id: true, code: true, name: true, location_type: true } },
      farm_species_focus: {
        include: {
          species: { select: { id: true, code: true, name: true } },
        },
      },
    };
  }

  private getAccountId(user: User, accountId?: string): string {
    const id = accountId || user.default_account_id;
    if (!id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }
    return id;
  }

  async listFarms(user: User, filters?: FarmsListFilters, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const where: Prisma.FarmWhereInput = { account_id: accId };

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.farm.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      include: this.farmWithSpeciesFocusInclude(),
    });
  }

  async getFarm(user: User, id: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const farm = await this.prisma.farm.findFirst({
      where: { id, account_id: accId },
      include: this.farmWithSpeciesFocusInclude(),
    });
    if (!farm) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Farm not found',
      });
    }
    return farm;
  }

  async createFarm(
    user: User,
    dto: {
      name: string;
      location_id?: string;
      description?: string;
      location?: string;
      species_focus?: { species_id: string; modes: FarmProductionMode[] }[];
    },
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);

    const nextCode = await this.generateNextFarmCode(accId);

    const focusRows = dto.species_focus?.length ? this.dedupeSpeciesFocus(dto.species_focus) : [];

    return this.prisma.farm.create({
      data: {
        account: { connect: { id: accId } },
        name: dto.name,
        code: nextCode,
        description: dto.description ?? undefined,
        location: dto.location ?? undefined,
        ...(dto.location_id && { locationRef: { connect: { id: dto.location_id } } }),
        status: FarmStatus.active,
        created_by: user.id,
        ...(focusRows.length > 0 && {
          farm_species_focus: {
            create: focusRows.map((f) => ({
              species_id: f.species_id,
              modes: f.modes,
            })),
          },
        }),
      },
      include: this.farmWithSpeciesFocusInclude(),
    });
  }

  private async generateNextFarmCode(accountId: string): Promise<string> {
    // Find the highest farm number across all farms (not just this account)
    const allFarms = await this.prisma.farm.findMany({
      select: { code: true },
      orderBy: { code: 'desc' },
    });
    
    let maxNum = 0;
    for (const farm of allFarms) {
      const match = farm.code?.match(/^FARM-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    
    // Try to find an available code
    let nextNum = maxNum + 1;
    let attempts = 0;
    while (attempts < 100) {
      const code = `FARM-${String(nextNum).padStart(4, '0')}`;
      const exists = await this.prisma.farm.findUnique({ where: { code } });
      if (!exists) {
        return code;
      }
      nextNum++;
      attempts++;
    }
    
    // Fallback: use timestamp-based code
    return `FARM-${Date.now().toString().slice(-8)}`;
  }

  async updateFarm(
    user: User,
    id: string,
    dto: {
      name?: string;
      location_id?: string;
      description?: string;
      location?: string;
      status?: FarmStatus;
      species_focus?: { species_id: string; modes: FarmProductionMode[] }[];
    },
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    const existing = await this.prisma.farm.findFirst({
      where: { id, account_id: accId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Farm not found',
      });
    }

    const farmData: Prisma.FarmUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.location_id !== undefined && {
        locationRef: dto.location_id ? { connect: { id: dto.location_id } } : { disconnect: true },
      }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.location !== undefined && { location: dto.location }),
      ...(dto.status !== undefined && { status: dto.status }),
    };

    const includeBlock = this.farmWithSpeciesFocusInclude();

    if (dto.species_focus !== undefined) {
      const rows = dto.species_focus.length ? this.dedupeSpeciesFocus(dto.species_focus) : [];
      return this.prisma.$transaction(async (tx) => {
        await tx.farmSpeciesFocus.deleteMany({ where: { farm_id: id } });
        if (rows.length > 0) {
          await tx.farmSpeciesFocus.createMany({
            data: rows.map((f) => ({
              farm_id: id,
              species_id: f.species_id,
              modes: f.modes,
            })),
          });
        }
        return tx.farm.update({
          where: { id },
          data: farmData,
          include: includeBlock,
        });
      });
    }

    return this.prisma.farm.update({
      where: { id },
      data: farmData,
      include: includeBlock,
    });
  }

  async deleteFarm(user: User, id: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const farm = await this.prisma.farm.findFirst({
      where: { id, account_id: accId },
      include: { _count: { select: { animals: true } } },
    });
    if (!farm) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Farm not found',
      });
    }

    if (farm._count.animals > 0) {
      // For safety, we soft-delete by marking inactive instead of removing when animals exist.
      await this.prisma.farm.update({
        where: { id },
        data: { status: FarmStatus.inactive },
      });
      return { message: 'Farm deactivated because it still has animals attached.' };
    }

    await this.prisma.farm.delete({ where: { id } });
    return { message: 'Farm deleted successfully' };
  }
}

