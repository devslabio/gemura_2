import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SpeciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.species.findMany({
      orderBy: { sort_order: 'asc' },
      select: { id: true, code: true, name: true, description: true, sort_order: true },
    });
  }
}
