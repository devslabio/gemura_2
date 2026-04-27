import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BreedsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(speciesId?: string) {
    return this.prisma.breed.findMany({
      where: speciesId ? { species_id: speciesId } : undefined,
      orderBy: [{ species: { sort_order: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        species_id: true,
        species: { select: { id: true, code: true, name: true } },
      },
    });
  }
}
