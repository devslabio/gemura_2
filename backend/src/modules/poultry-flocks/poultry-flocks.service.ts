import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FlockMovementType, Prisma, PoultryFlockStatus, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const POULTRY_SPECIES_CODE = 'poultry';

@Injectable()
export class PoultryFlocksService {
  constructor(private readonly prisma: PrismaService) {}

  private getAccountId(user: User, accountId?: string): string {
    const id = accountId || user.default_account_id;
    if (!id) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'No valid default account found.' });
    }
    return id;
  }

  private async requirePoultryBreed(breedId: string | undefined) {
    if (!breedId) return;
    const b = await this.prisma.breed.findUnique({
      where: { id: breedId },
      include: { species: { select: { code: true } } },
    });
    if (!b) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'Invalid breed_id.' });
    }
    if (b.species.code !== POULTRY_SPECIES_CODE) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Flock breed must be a poultry breed (species poultry).',
      });
    }
  }

  private async assertFlockAccount(flockId: string, accId: string) {
    const f = await this.prisma.poultryFlock.findFirst({ where: { id: flockId, account_id: accId } });
    if (!f) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Flock not found' });
    }
    return f;
  }

  private movementDelta(type: FlockMovementType, quantity: number): number {
    switch (type) {
      case FlockMovementType.intake:
      case FlockMovementType.transfer_in:
        return quantity;
      case FlockMovementType.sale:
      case FlockMovementType.transfer_out:
        return -quantity;
      case FlockMovementType.adjustment:
        return quantity;
      default:
        return 0;
    }
  }

  async list(user: User, accountId?: string, farmId?: string) {
    const accId = this.getAccountId(user, accountId);
    const where: Prisma.PoultryFlockWhereInput = { account_id: accId };
    if (farmId) where.farm_id = farmId;
    return this.prisma.poultryFlock.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        farm: { select: { id: true, name: true, code: true } },
        breed: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async getOne(user: User, id: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const f = await this.prisma.poultryFlock.findFirst({
      where: { id, account_id: accId },
      include: {
        farm: { select: { id: true, name: true, code: true } },
        breed: { select: { id: true, name: true, code: true } },
      },
    });
    if (!f) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Flock not found' });
    }
    return f;
  }

  async create(
    user: User,
    dto: {
      name: string;
      farm_id?: string;
      breed_id?: string;
      started_at: string;
      opening_head_count: number;
      notes?: string;
    },
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    await this.requirePoultryBreed(dto.breed_id);

    if (dto.farm_id) {
      const farm = await this.prisma.farm.findFirst({ where: { id: dto.farm_id, account_id: accId } });
      if (!farm) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'Farm not found for this account.' });
      }
    }

    const opening = dto.opening_head_count;
    if (opening < 0) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'opening_head_count must be >= 0' });
    }

    return this.prisma.poultryFlock.create({
      data: {
        account: { connect: { id: accId } },
        name: dto.name.trim(),
        started_at: new Date(dto.started_at),
        opening_head_count: opening,
        current_head_count: opening,
        notes: dto.notes ?? undefined,
        created_by: user.id,
        ...(dto.farm_id && { farm: { connect: { id: dto.farm_id } } }),
        ...(dto.breed_id && { breed: { connect: { id: dto.breed_id } } }),
      },
      include: {
        farm: { select: { id: true, name: true, code: true } },
        breed: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async update(
    user: User,
    id: string,
    dto: {
      name?: string;
      farm_id?: string | null;
      breed_id?: string | null;
      status?: PoultryFlockStatus;
      notes?: string | null;
    },
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    await this.assertFlockAccount(id, accId);

    if (dto.breed_id !== undefined && dto.breed_id !== null) {
      await this.requirePoultryBreed(dto.breed_id);
    }

    if (dto.farm_id !== undefined && dto.farm_id !== null) {
      const farm = await this.prisma.farm.findFirst({ where: { id: dto.farm_id, account_id: accId } });
      if (!farm) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'Farm not found for this account.' });
      }
    }

    return this.prisma.poultryFlock.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes ?? undefined }),
        ...(dto.farm_id !== undefined &&
          (dto.farm_id ? { farm: { connect: { id: dto.farm_id } } } : { farm: { disconnect: true } })),
        ...(dto.breed_id !== undefined &&
          (dto.breed_id ? { breed: { connect: { id: dto.breed_id } } } : { breed: { disconnect: true } })),
      },
      include: {
        farm: { select: { id: true, name: true, code: true } },
        breed: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async listDaily(user: User, flockId: string, accountId?: string, from?: string, to?: string) {
    const accId = this.getAccountId(user, accountId);
    await this.assertFlockAccount(flockId, accId);
    const where: Prisma.FlockDailyRecordWhereInput = { flock_id: flockId };
    if (from || to) {
      where.record_date = {};
      if (from) where.record_date.gte = new Date(from);
      if (to) where.record_date.lte = new Date(to);
    }
    return this.prisma.flockDailyRecord.findMany({
      where,
      orderBy: { record_date: 'desc' },
    });
  }

  async upsertDaily(
    user: User,
    flockId: string,
    dto: { record_date: string; eggs_collected?: number; mortality_count?: number; notes?: string },
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    const flock = await this.assertFlockAccount(flockId, accId);

    const eggs = dto.eggs_collected ?? 0;
    const mort = dto.mortality_count ?? 0;
    if (eggs < 0 || mort < 0) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'Counts must be >= 0' });
    }

    const recordDate = new Date(dto.record_date);
    const existing = await this.prisma.flockDailyRecord.findUnique({
      where: { flock_id_record_date: { flock_id: flockId, record_date: recordDate } },
    });

    const prevMort = existing?.mortality_count ?? 0;
    const deltaMort = mort - prevMort;

    const row = await this.prisma.flockDailyRecord.upsert({
      where: { flock_id_record_date: { flock_id: flockId, record_date: recordDate } },
      create: {
        flock_id: flockId,
        record_date: recordDate,
        eggs_collected: eggs,
        mortality_count: mort,
        notes: dto.notes ?? undefined,
      },
      update: {
        eggs_collected: eggs,
        mortality_count: mort,
        notes: dto.notes ?? undefined,
      },
    });

    if (deltaMort !== 0) {
      const next = flock.current_head_count - deltaMort;
      if (next < 0) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Mortality would make flock head count negative. Adjust numbers or movements.',
        });
      }
      await this.prisma.poultryFlock.update({
        where: { id: flockId },
        data: { current_head_count: next },
      });
    }

    return row;
  }

  async deleteDaily(user: User, flockId: string, recordId: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const flock = await this.assertFlockAccount(flockId, accId);
    const rec = await this.prisma.flockDailyRecord.findFirst({
      where: { id: recordId, flock_id: flockId },
    });
    if (!rec) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Daily record not found' });
    }

    await this.prisma.flockDailyRecord.delete({ where: { id: recordId } });

    await this.prisma.poultryFlock.update({
      where: { id: flockId },
      data: { current_head_count: flock.current_head_count + rec.mortality_count },
    });

    return { message: 'Daily record deleted' };
  }

  async listMovements(user: User, flockId: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    await this.assertFlockAccount(flockId, accId);
    return this.prisma.flockMovement.findMany({
      where: { flock_id: flockId },
      orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }],
    });
  }

  async addMovement(
    user: User,
    flockId: string,
    dto: { movement_date: string; type: FlockMovementType; quantity: number; notes?: string },
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    const flock = await this.assertFlockAccount(flockId, accId);

    let qty = dto.quantity;
    if (dto.type !== FlockMovementType.adjustment && qty <= 0) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'quantity must be positive for this movement type' });
    }

    const delta = this.movementDelta(dto.type, qty);
    const next = flock.current_head_count + delta;
    if (next < 0) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'Movement would make head count negative.' });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const m = await tx.flockMovement.create({
        data: {
          flock_id: flockId,
          movement_date: new Date(dto.movement_date),
          type: dto.type,
          quantity: qty,
          notes: dto.notes ?? undefined,
          created_by: user.id,
        },
      });
      await tx.poultryFlock.update({
        where: { id: flockId },
        data: { current_head_count: next },
      });
      return m;
    });

    return created;
  }
}
