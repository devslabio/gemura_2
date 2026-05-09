import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationType } from '@prisma/client';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all provinces (top-level admin units).
   *
   * The DB may contain duplicate province rows with the same name but different codes
   * (e.g. code "1" from a full dsacco import and code "01" from seed-locations).
   * We deduplicate by name, keeping the row that has the **most direct children** (districts),
   * so downstream getChildren() calls always return the full list.
   */
  async getProvinces() {
    const rows = await this.prisma.location.findMany({
      where: { location_type: LocationType.PROVINCE },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, location_type: true, parent_id: true },
    });

    // Count direct children per province id in one query
    const childCounts = await this.prisma.location.groupBy({
      by: ['parent_id'],
      where: {
        location_type: LocationType.DISTRICT,
        parent_id: { in: rows.map((r) => r.id) },
      },
      _count: { id: true },
    });
    const countById = new Map(childCounts.map((c) => [c.parent_id as string, c._count.id]));

    // For each name group keep the row with the highest child count; tie-break: prefer shorter code
    const byName = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      const prev = byName.get(row.name);
      if (!prev) {
        byName.set(row.name, row);
        continue;
      }
      const prevCount = countById.get(prev.id) ?? 0;
      const curCount = countById.get(row.id) ?? 0;
      if (curCount > prevCount) {
        byName.set(row.name, row);
      } else if (curCount === prevCount && row.code.length < prev.code.length) {
        byName.set(row.name, row);
      }
    }

    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Get direct children of a location (e.g. districts of a province, sectors of a district). */
  async getChildren(parentId: string) {
    return this.prisma.location.findMany({
      where: { parent_id: parentId },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, location_type: true, parent_id: true },
    });
  }

  /** Get a single location by id (for validation / path display). */
  async getById(id: string) {
    return this.prisma.location.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, location_type: true, parent_id: true },
    });
  }

  /** Get path from location up to root (e.g. [village, cell, sector, district, province]) for display. */
  async getPath(id: string): Promise<{ id: string; code: string; name: string; location_type: string }[]> {
    const path: { id: string; code: string; name: string; location_type: string }[] = [];
    let current = await this.prisma.location.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, location_type: true, parent_id: true },
    });
    while (current) {
      path.unshift({
        id: current.id,
        code: current.code,
        name: current.name,
        location_type: current.location_type,
      });
      if (!current.parent_id) break;
      current = await this.prisma.location.findUnique({
        where: { id: current.parent_id },
        select: { id: true, code: true, name: true, location_type: true, parent_id: true },
      });
    }
    return path;
  }
}
