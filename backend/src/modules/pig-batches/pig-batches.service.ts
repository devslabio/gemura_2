import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PigBatchStatus, Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const PIG_SPECIES_CODE = 'pig';

@Injectable()
export class PigBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  private getAccountId(user: User, accountId?: string): string {
    const id = accountId || user.default_account_id;
    if (!id) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'No valid default account found.' });
    }
    return id;
  }

  private async requirePigBreed(breedId: string | undefined) {
    if (!breedId) return;
    const b = await this.prisma.breed.findUnique({
      where: { id: breedId },
      include: { species: { select: { code: true } } },
    });
    if (!b) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'Invalid breed_id.' });
    }
    if (b.species.code !== PIG_SPECIES_CODE) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Batch breed must be a pig breed (species pig).',
      });
    }
  }

  async assertBatchAccount(batchId: string, accId: string) {
    const b = await this.prisma.pigBatch.findFirst({ where: { id: batchId, account_id: accId } });
    if (!b) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Batch not found' });
    }
    return b;
  }

  async assertFarrowingAccount(id: string, accId: string) {
    const f = await this.prisma.pigFarrowing.findFirst({ where: { id, account_id: accId } });
    if (!f) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Farrowing record not found' });
    }
    return f;
  }

  async listBatches(user: User, accountId?: string, farmId?: string) {
    const accId = this.getAccountId(user, accountId);
    const where: Prisma.PigBatchWhereInput = { account_id: accId };
    if (farmId) where.farm_id = farmId;
    return this.prisma.pigBatch.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        farm: { select: { id: true, name: true, code: true } },
        breed: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async getBatch(user: User, id: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const b = await this.prisma.pigBatch.findFirst({
      where: { id, account_id: accId },
      include: {
        farm: { select: { id: true, name: true, code: true } },
        breed: { select: { id: true, name: true, code: true } },
      },
    });
    if (!b) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Batch not found' });
    }
    return b;
  }

  async createBatch(
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
    await this.requirePigBreed(dto.breed_id);

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

    return this.prisma.pigBatch.create({
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

  async updateBatch(
    user: User,
    id: string,
    dto: {
      name?: string;
      farm_id?: string | null;
      breed_id?: string | null;
      status?: PigBatchStatus;
      notes?: string | null;
    },
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    await this.assertBatchAccount(id, accId);

    if (dto.breed_id) {
      await this.requirePigBreed(dto.breed_id);
    }

    if (dto.farm_id) {
      const farm = await this.prisma.farm.findFirst({ where: { id: dto.farm_id, account_id: accId } });
      if (!farm) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'Farm not found for this account.' });
      }
    }

    return this.prisma.pigBatch.update({
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

  async listWeights(user: User, batchId: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    await this.assertBatchAccount(batchId, accId);
    return this.prisma.pigBatchWeight.findMany({
      where: { batch_id: batchId },
      orderBy: { weighed_date: 'desc' },
    });
  }

  async upsertWeight(
    user: User,
    batchId: string,
    dto: {
      weighed_date: string;
      avg_weight_kg: number;
      min_weight_kg?: number;
      max_weight_kg?: number;
      animals_weighed?: number;
      weight_band?: string;
      notes?: string;
    },
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    await this.assertBatchAccount(batchId, accId);

    const d = new Date(dto.weighed_date);
    return this.prisma.pigBatchWeight.upsert({
      where: { batch_id_weighed_date: { batch_id: batchId, weighed_date: d } },
      create: {
        batch_id: batchId,
        weighed_date: d,
        avg_weight_kg: dto.avg_weight_kg,
        min_weight_kg: dto.min_weight_kg ?? undefined,
        max_weight_kg: dto.max_weight_kg ?? undefined,
        animals_weighed: dto.animals_weighed ?? undefined,
        weight_band: dto.weight_band ?? undefined,
        notes: dto.notes ?? undefined,
      },
      update: {
        avg_weight_kg: dto.avg_weight_kg,
        min_weight_kg: dto.min_weight_kg ?? undefined,
        max_weight_kg: dto.max_weight_kg ?? undefined,
        animals_weighed: dto.animals_weighed ?? undefined,
        weight_band: dto.weight_band ?? undefined,
        notes: dto.notes ?? undefined,
      },
    });
  }

  async deleteWeight(user: User, batchId: string, weightId: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    await this.assertBatchAccount(batchId, accId);
    const w = await this.prisma.pigBatchWeight.findFirst({
      where: { id: weightId, batch_id: batchId },
    });
    if (!w) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Weight record not found' });
    }
    await this.prisma.pigBatchWeight.delete({ where: { id: weightId } });
    return { message: 'Weight record deleted' };
  }

  async listFarrowings(user: User, accountId?: string, farmId?: string, batchId?: string) {
    const accId = this.getAccountId(user, accountId);
    const where: Prisma.PigFarrowingWhereInput = { account_id: accId };
    if (farmId) where.farm_id = farmId;
    if (batchId) where.pig_batch_id = batchId;

    return this.prisma.pigFarrowing.findMany({
      where,
      orderBy: { farrowing_date: 'desc' },
      include: {
        farm: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true, code: true } },
        sow: { select: { id: true, tag_number: true, name: true } },
      },
    });
  }

  async createFarrowing(
    user: User,
    dto: {
      farm_id?: string;
      pig_batch_id?: string;
      sow_animal_id?: string;
      farrowing_date: string;
      live_born?: number;
      stillborn?: number;
      mummified?: number;
      notes?: string;
      add_live_to_batch?: boolean;
    },
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);

    if (dto.farm_id) {
      const farm = await this.prisma.farm.findFirst({ where: { id: dto.farm_id, account_id: accId } });
      if (!farm) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'Farm not found.' });
      }
    }

    if (dto.pig_batch_id) {
      await this.assertBatchAccount(dto.pig_batch_id, accId);
    }

    if (dto.sow_animal_id) {
      const sow = await this.prisma.animal.findFirst({
        where: { id: dto.sow_animal_id, account_id: accId },
        include: { species: { select: { code: true } } },
      });
      if (!sow) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'Sow animal not found.' });
      }
      if (sow.species.code !== PIG_SPECIES_CODE) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'Sow must be a pig (species pig).' });
      }
    }

    const live = dto.live_born ?? 0;
    const still = dto.stillborn ?? 0;
    const mum = dto.mummified ?? 0;
    if (live < 0 || still < 0 || mum < 0) {
      throw new BadRequestException({ code: 400, status: 'error', message: 'Counts must be >= 0' });
    }

    const addToBatch = dto.add_live_to_batch !== false && dto.pig_batch_id && live > 0;

    return this.prisma.$transaction(async (tx) => {
      const f = await tx.pigFarrowing.create({
        data: {
          account: { connect: { id: accId } },
          farrowing_date: new Date(dto.farrowing_date),
          live_born: live,
          stillborn: still,
          mummified: mum,
          notes: dto.notes ?? undefined,
          created_by: user.id,
          ...(dto.farm_id && { farm: { connect: { id: dto.farm_id } } }),
          ...(dto.pig_batch_id && { batch: { connect: { id: dto.pig_batch_id } } }),
          ...(dto.sow_animal_id && { sow: { connect: { id: dto.sow_animal_id } } }),
        },
        include: {
          farm: { select: { id: true, name: true } },
          batch: { select: { id: true, name: true } },
          sow: { select: { id: true, tag_number: true, name: true } },
        },
      });

      if (addToBatch && dto.pig_batch_id) {
        await tx.pigBatch.update({
          where: { id: dto.pig_batch_id },
          data: {
            current_head_count: { increment: live },
          },
        });
      }

      return f;
    });
  }

  async deleteFarrowing(user: User, id: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const row = await this.prisma.pigFarrowing.findFirst({
      where: { id, account_id: accId },
      include: { batch: true },
    });
    if (!row) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Farrowing record not found' });
    }

    await this.prisma.$transaction(async (tx) => {
      if (row.pig_batch_id && row.live_born > 0) {
        await tx.pigBatch.update({
          where: { id: row.pig_batch_id },
          data: {
            current_head_count: { decrement: row.live_born },
          },
        });
      }
      await tx.pigFarrowing.delete({ where: { id } });
    });

    return { message: 'Farrowing record deleted' };
  }
}
