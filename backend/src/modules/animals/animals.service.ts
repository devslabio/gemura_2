import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { CreateAnimalWeightDto } from './dto/create-animal-weight.dto';
import { CreateAnimalHealthDto } from './dto/create-animal-health.dto';
import { CreateAnimalBreedingDto } from './dto/create-animal-breeding.dto';
import { CreateAnimalCalvingDto } from './dto/create-animal-calving.dto';
import { AnimalStatus, Prisma } from '@prisma/client';

export interface AnimalsListFilters {
  status?: AnimalStatus;
  breed_id?: string;
  gender?: string;
  search?: string;
  farm_id?: string;
}

@Injectable()
export class AnimalsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getAnimals(
    user: User,
    filters?: AnimalsListFilters,
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    const where: Prisma.AnimalWhereInput = { account_id: accId };

    if (filters?.status) where.status = filters.status;
    if (filters?.breed_id) where.breed_id = filters.breed_id;
    if (filters?.gender) where.gender = filters.gender as any;
    if (filters?.farm_id) where.farm_id = filters.farm_id;
    if (filters?.search) {
      where.OR = [
        { tag_number: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
        { breed: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const animals = await this.prisma.animal.findMany({
      where,
      include: {
        species: { select: { id: true, code: true, name: true } },
        breed: { select: { id: true, name: true, code: true } },
        farm: { select: { id: true, name: true } },
        mother: { select: { id: true, tag_number: true, name: true, breed: { select: { id: true, name: true } } } },
        father: { select: { id: true, tag_number: true, name: true, breed: { select: { id: true, name: true } } } },
      },
      orderBy: [{ tag_number: 'asc' }],
    });
    return animals;
  }

  async getAnimal(user: User, id: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const animal = await this.prisma.animal.findFirst({
      where: { id, account_id: accId },
      include: {
        species: { select: { id: true, code: true, name: true } },
        breed: { select: { id: true, name: true, code: true, description: true } },
        farm: { select: { id: true, name: true } },
        mother: { select: { id: true, tag_number: true, name: true, breed: { select: { id: true, name: true } } } },
        father: { select: { id: true, tag_number: true, name: true, breed: { select: { id: true, name: true } } } },
        weights: { orderBy: { recorded_at: 'desc' }, take: 50 },
        health_records: { orderBy: { event_date: 'desc' }, take: 50 },
      },
    });
    if (!animal) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Animal not found',
      });
    }
    return animal;
  }

  async getAnimalHistory(user: User, id: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const animal = await this.prisma.animal.findFirst({
      where: { id, account_id: accId },
      select: { id: true, tag_number: true, name: true },
    });
    if (!animal) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Animal not found',
      });
    }
    const [weights, health_records] = await Promise.all([
      this.prisma.animalWeight.findMany({
        where: { animal_id: id },
        orderBy: { recorded_at: 'desc' },
      }),
      this.prisma.animalHealth.findMany({
        where: { animal_id: id },
        orderBy: { event_date: 'desc' },
      }),
    ]);
    return { ...animal, weights, health_records };
  }

  async createAnimal(
    user: User,
    dto: CreateAnimalDto,
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);

    const breedExists = await this.prisma.breed.findUnique({
      where: { id: dto.breed_id },
      select: { id: true, species_id: true },
    });
    if (!breedExists) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid breed_id. Use GET /api/breeds to list valid breeds.',
      });
    }

    const farm = await this.prisma.farm.findFirst({
      where: { id: dto.farm_id, account_id: accId },
    });
    if (!farm) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Farm not found or does not belong to this account. Animal must be registered to one farm.',
      });
    }

    const existing = await this.prisma.animal.findUnique({
      where: {
        account_id_tag_number: { account_id: accId, tag_number: dto.tag_number },
      },
    });
    if (existing) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `An animal with tag number "${dto.tag_number}" already exists in this account.`,
      });
    }

    const data: Prisma.AnimalCreateInput = {
      account: { connect: { id: accId } },
      species: { connect: { id: breedExists.species_id } },
      breed: { connect: { id: dto.breed_id } },
      tag_number: dto.tag_number,
      name: dto.name ?? undefined,
      gender: dto.gender as any,
      date_of_birth: new Date(dto.date_of_birth),
      source: dto.source as any,
      purchase_date: dto.purchase_date ? new Date(dto.purchase_date) : undefined,
      purchase_price: dto.purchase_price != null ? dto.purchase_price : undefined,
      status: (dto.status as any) ?? 'active',
      photo_url: dto.photo_url ?? undefined,
      notes: dto.notes ?? undefined,
      created_by: user.id,
    };
    if (dto.mother_id) data.mother = { connect: { id: dto.mother_id } };
    if (dto.father_id) data.father = { connect: { id: dto.father_id } };
    data.farm = { connect: { id: dto.farm_id } };

    return this.prisma.animal.create({
      data,
      include: {
        species: { select: { id: true, code: true, name: true } },
        breed: { select: { id: true, name: true, code: true } },
        farm: { select: { id: true, name: true } },
        mother: { select: { id: true, tag_number: true, name: true } },
        father: { select: { id: true, tag_number: true, name: true } },
      },
    });
  }

  async updateAnimal(
    user: User,
    id: string,
    dto: UpdateAnimalDto,
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    await this.getAnimal(user, id, accountId);

    let breedForUpdate: { id: string; species_id: string } | null = null;
    if (dto.breed_id != null) {
      breedForUpdate = await this.prisma.breed.findUnique({
        where: { id: dto.breed_id },
        select: { id: true, species_id: true },
      });
      if (!breedForUpdate) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Invalid breed_id. Use GET /api/breeds to list valid breeds.',
        });
      }
    }

    if (dto.tag_number) {
      const existing = await this.prisma.animal.findFirst({
        where: {
          account_id: accId,
          tag_number: dto.tag_number,
          id: { not: id },
        },
      });
      if (existing) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `An animal with tag number "${dto.tag_number}" already exists.`,
        });
      }
    }

    if (dto.farm_id !== undefined && dto.farm_id) {
      const farm = await this.prisma.farm.findFirst({
        where: { id: dto.farm_id, account_id: accId },
      });
      if (!farm) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Farm not found or does not belong to this account.',
        });
      }
    }

    const data: Prisma.AnimalUpdateInput = {
      ...(dto.tag_number != null && { tag_number: dto.tag_number }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.breed_id != null &&
        breedForUpdate && {
          breed: { connect: { id: dto.breed_id } },
          species: { connect: { id: breedForUpdate.species_id } },
        }),
      ...(dto.gender != null && { gender: dto.gender as any }),
      ...(dto.date_of_birth != null && { date_of_birth: new Date(dto.date_of_birth) }),
      ...(dto.source != null && { source: dto.source as any }),
      ...(dto.purchase_date !== undefined && {
        purchase_date: dto.purchase_date ? new Date(dto.purchase_date) : null,
      }),
      ...(dto.purchase_price !== undefined && { purchase_price: dto.purchase_price }),
      ...(dto.mother_id !== undefined && {
        mother: dto.mother_id ? { connect: { id: dto.mother_id } } : { disconnect: true },
      }),
      ...(dto.father_id !== undefined && {
        father: dto.father_id ? { connect: { id: dto.father_id } } : { disconnect: true },
      }),
      ...(dto.status != null && { status: dto.status as any }),
      ...(dto.photo_url !== undefined && { photo_url: dto.photo_url }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.farm_id !== undefined && {
        farm: dto.farm_id ? { connect: { id: dto.farm_id } } : { disconnect: true },
      }),
    };

    return this.prisma.animal.update({
      where: { id },
      data,
      include: {
        species: { select: { id: true, code: true, name: true } },
        breed: { select: { id: true, name: true, code: true } },
        farm: { select: { id: true, name: true } },
        mother: { select: { id: true, tag_number: true, name: true } },
        father: { select: { id: true, tag_number: true, name: true } },
      },
    });
  }

  async deleteAnimal(user: User, id: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const animal = await this.prisma.animal.findFirst({
      where: { id, account_id: accId },
    });
    if (!animal) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Animal not found',
      });
    }
    await this.prisma.animal.delete({ where: { id } });
    return { message: 'Animal deleted successfully' };
  }

  // --- Weights ---
  async addWeight(
    user: User,
    animalId: string,
    dto: CreateAnimalWeightDto,
    accountId?: string,
  ) {
    await this.getAnimal(user, animalId, accountId);
    return this.prisma.animalWeight.create({
      data: {
        animal_id: animalId,
        weight_kg: dto.weight_kg,
        recorded_at: new Date(dto.recorded_at),
        notes: dto.notes ?? undefined,
        created_by: user.id,
      },
    });
  }

  async getWeights(user: User, animalId: string, accountId?: string) {
    await this.getAnimal(user, animalId, accountId);
    return this.prisma.animalWeight.findMany({
      where: { animal_id: animalId },
      orderBy: { recorded_at: 'desc' },
    });
  }

  async deleteWeight(
    user: User,
    animalId: string,
    weightId: string,
    accountId?: string,
  ) {
    await this.getAnimal(user, animalId, accountId);
    const w = await this.prisma.animalWeight.findFirst({
      where: { id: weightId, animal_id: animalId },
    });
    if (!w) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Weight record not found',
      });
    }
    await this.prisma.animalWeight.delete({ where: { id: weightId } });
    return { message: 'Weight record deleted successfully' };
  }

  // --- Health ---
  async addHealth(
    user: User,
    animalId: string,
    dto: CreateAnimalHealthDto,
    accountId?: string,
  ) {
    await this.getAnimal(user, animalId, accountId);

    let vetUserId: string | undefined;
    let vetPhoneNormalized: string | undefined;

    if (dto.vet_phone) {
      let digits = dto.vet_phone.replace(/\D/g, '');
      if (digits.startsWith('07') && digits.length === 10) {
        // Normalize local Rwandan format 07xx... -> 2507xx...
        digits = `250${digits.slice(1)}`;
      }
      if (digits.startsWith('250') && digits.length === 12) {
        vetPhoneNormalized = digits;
      } else if (digits.length >= 9) {
        // Fallback: store raw digits if it looks like a phone
        vetPhoneNormalized = digits;
      }
    }

    if (vetPhoneNormalized) {
      let vetUser = await this.prisma.user.findFirst({
        where: { phone: vetPhoneNormalized },
      });

      if (!vetUser) {
        const userCode = `U_${randomBytes(3).toString('hex').toUpperCase()}`;
        const passwordHash = await bcrypt.hash('Pass123!', 10);
        const name = [dto.vet_first_name, dto.vet_last_name].filter(Boolean).join(' ').trim() || 'Veterinary';

        vetUser = await this.prisma.user.create({
          data: {
            code: userCode,
            name,
            phone: vetPhoneNormalized,
            password_hash: passwordHash,
            status: 'active',
            account_type: 'mcc',
            created_by: user.id,
          },
        });
      }

      vetUserId = vetUser.id;
    }

    return this.prisma.animalHealth.create({
      data: {
        animal_id: animalId,
        event_type: dto.event_type as any,
        event_date: new Date(dto.event_date),
        description: dto.description,
        diagnosis: dto.diagnosis ?? undefined,
        treatment: dto.treatment ?? undefined,
        medicine_name: dto.medicine_name ?? undefined,
        dosage: dto.dosage ?? undefined,
        administered_by: dto.administered_by ?? undefined,
        vet_user_id: vetUserId,
        vet_first_name: dto.vet_first_name ?? undefined,
        vet_last_name: dto.vet_last_name ?? undefined,
        vet_phone: vetPhoneNormalized ?? dto.vet_phone ?? undefined,
        next_due_date: dto.next_due_date ? new Date(dto.next_due_date) : undefined,
        cost: dto.cost != null ? dto.cost : undefined,
        notes: dto.notes ?? undefined,
        created_by: user.id,
      },
    });
  }

  async getHealth(
    user: User,
    animalId: string,
    accountId?: string,
    eventType?: string,
  ) {
    await this.getAnimal(user, animalId, accountId);
    const where: Prisma.AnimalHealthWhereInput = { animal_id: animalId };
    if (eventType) where.event_type = eventType as any;
    return this.prisma.animalHealth.findMany({
      where,
      orderBy: { event_date: 'desc' },
    });
  }

  async deleteHealth(
    user: User,
    animalId: string,
    healthId: string,
    accountId?: string,
  ) {
    await this.getAnimal(user, animalId, accountId);
    const h = await this.prisma.animalHealth.findFirst({
      where: { id: healthId, animal_id: animalId },
    });
    if (!h) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Health record not found',
      });
    }
    await this.prisma.animalHealth.delete({ where: { id: healthId } });
    return { message: 'Health record deleted successfully' };
  }

  // --- Breeding ---
  async addBreeding(
    user: User,
    animalId: string,
    dto: CreateAnimalBreedingDto,
    accountId?: string,
  ) {
    await this.getAnimal(user, animalId, accountId);
    return this.prisma.animalBreeding.create({
      data: {
        animal_id: animalId,
        breeding_date: new Date(dto.breeding_date),
        heat_date: dto.heat_date ? new Date(dto.heat_date) : undefined,
        method: dto.method as any,
        bull_animal_id: dto.bull_animal_id ?? undefined,
        bull_name: dto.bull_name ?? undefined,
        semen_code: dto.semen_code ?? undefined,
        expected_calving_date: dto.expected_calving_date ? new Date(dto.expected_calving_date) : undefined,
        outcome: (dto.outcome as any) ?? 'unknown',
        notes: dto.notes ?? undefined,
        created_by: user.id,
      },
      include: {
        bull_animal: { select: { id: true, tag_number: true, name: true } },
      },
    });
  }

  async getBreeding(user: User, animalId: string, accountId?: string) {
    await this.getAnimal(user, animalId, accountId);
    return this.prisma.animalBreeding.findMany({
      where: { animal_id: animalId },
      orderBy: { breeding_date: 'desc' },
      include: {
        bull_animal: { select: { id: true, tag_number: true, name: true } },
      },
    });
  }

  async deleteBreeding(
    user: User,
    animalId: string,
    breedingId: string,
    accountId?: string,
  ) {
    await this.getAnimal(user, animalId, accountId);
    const b = await this.prisma.animalBreeding.findFirst({
      where: { id: breedingId, animal_id: animalId },
    });
    if (!b) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Breeding record not found',
      });
    }
    await this.prisma.animalBreeding.delete({ where: { id: breedingId } });
    return { message: 'Breeding record deleted successfully' };
  }

  // --- Calving ---
  async addCalving(
    user: User,
    animalId: string,
    dto: CreateAnimalCalvingDto,
    accountId?: string,
  ) {
    await this.getAnimal(user, animalId, accountId);
    return this.prisma.animalCalving.create({
      data: {
        mother_id: animalId,
        calving_date: new Date(dto.calving_date),
        calf_id: dto.calf_id ?? undefined,
        outcome: dto.outcome as any,
        gender: dto.gender as any,
        weight_kg: dto.weight_kg != null ? dto.weight_kg : undefined,
        notes: dto.notes ?? undefined,
        created_by: user.id,
      },
      include: {
        calf: { select: { id: true, tag_number: true, name: true, gender: true } },
      },
    });
  }

  async getCalvings(user: User, animalId: string, accountId?: string) {
    await this.getAnimal(user, animalId, accountId);
    return this.prisma.animalCalving.findMany({
      where: { mother_id: animalId },
      orderBy: { calving_date: 'desc' },
      include: {
        calf: { select: { id: true, tag_number: true, name: true, gender: true, date_of_birth: true } },
      },
    });
  }

  async deleteCalving(
    user: User,
    animalId: string,
    calvingId: string,
    accountId?: string,
  ) {
    await this.getAnimal(user, animalId, accountId);
    const c = await this.prisma.animalCalving.findFirst({
      where: { id: calvingId, mother_id: animalId },
    });
    if (!c) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Calving record not found',
      });
    }
    await this.prisma.animalCalving.delete({ where: { id: calvingId } });
    return { message: 'Calving record deleted successfully' };
  }

  // --- Vaccination log & due alerts ---
  async getVaccinationsDue(
    user: User,
    accountId?: string,
    overdueOnly?: boolean,
  ) {
    const accId = this.getAccountId(user, accountId);
    const where: Prisma.AnimalHealthWhereInput = {
      animal: { account_id: accId },
      event_type: 'vaccination',
      next_due_date: overdueOnly ? { lt: new Date() } : { not: null },
    };
    return this.prisma.animalHealth.findMany({
      where,
      include: {
        animal: { select: { id: true, tag_number: true, name: true } },
      },
      orderBy: { next_due_date: 'asc' },
    });
  }
}
