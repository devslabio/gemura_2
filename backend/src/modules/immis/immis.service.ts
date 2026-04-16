import { Injectable, Logger, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';

export interface ImmisApiResponse {
  status: number;
  message: string;
  data?: unknown;
}

@Injectable()
export class ImmisService {
  private readonly logger = new Logger(ImmisService.name);
  private readonly baseUrl = 'https://immis.rw/api/integration';

  constructor(private readonly prisma: PrismaService) {}

  async listMembers(page?: number, limit?: number): Promise<ImmisApiResponse> {
    const apiKey = await this.getImmisApiKey();
    const query = new URLSearchParams();
    if (typeof page === 'number') query.append('page', page.toString());
    if (typeof limit === 'number') query.append('limit', limit.toString());
    const path = `/members${query.toString() ? `?${query.toString()}` : ''}`;

    return this.performRequest<ImmisApiResponse>('GET', path, apiKey);
  }

  async getMember(memberId: string): Promise<ImmisApiResponse> {
    const apiKey = await this.getImmisApiKey();
    const path = `/members/${encodeURIComponent(memberId)}`;
    return this.performRequest<ImmisApiResponse>('GET', path, apiKey);
  }

  private async getImmisApiKey(): Promise<string> {
    const apiKeyRecord = await this.prisma.apiKey.findFirst({
      where: {
        name: {
          contains: 'immis',
          mode: 'insensitive',
        },
        is_active: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!apiKeyRecord) {
      this.logger.error('IMMIS API key not found or inactive in api_keys table (name contains "immis")');
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'IMMIS integration API key is not configured. Please create an API key record for IMMIS.',
      });
    }

    return apiKeyRecord.key;
  }

  private async performRequest<T>(method: 'GET', path: string, apiKey: string): Promise<T> {
    const options: https.RequestOptions = {
      hostname: 'immis.rw',
      port: 443,
      path: `/api/integration${path}`,
      method,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };

    return new Promise<T>((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = responseData ? JSON.parse(responseData) : {};
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed as T);
            } else if (res.statusCode === 401) {
              this.logger.warn(`IMMIS returned 401 Unauthorized: ${responseData}`);
              reject(
                new UnauthorizedException({
                  code: 401,
                  status: 'error',
                  message: parsed?.message || 'IMMIS API key is invalid or unauthorized.',
                }),
              );
            } else {
              this.logger.error(`IMMIS request failed: HTTP ${res.statusCode}, Response: ${responseData}`);
              reject(
                new InternalServerErrorException({
                  code: 500,
                  status: 'error',
                  message: parsed?.message || 'Failed to fetch data from IMMIS.',
                }),
              );
            }
          } catch (error) {
            this.logger.error(`Failed to parse IMMIS response: ${responseData}`);
            reject(
              new InternalServerErrorException({
                code: 500,
                status: 'error',
                message: 'Failed to parse IMMIS response.',
              }),
            );
          }
        });
      });

      req.on('error', (error) => {
        this.logger.error(`IMMIS request error: ${error.message}`, error.stack);
        reject(
          new InternalServerErrorException({
            code: 500,
            status: 'error',
            message: 'IMMIS request failed.',
          }),
        );
      });

      req.on('timeout', () => {
        req.destroy();
        this.logger.error('IMMIS request timeout');
        reject(
          new InternalServerErrorException({
            code: 500,
            status: 'error',
            message: 'IMMIS request timeout.',
          }),
        );
      });

      req.end();
    });
  }

  /** Gemura users linked to these IMMIS member IDs (active users only). */
  async getMemberLinkMap(
    memberIds: number[],
  ): Promise<Record<number, { user_id: string; name: string; phone: string | null }>> {
    const unique = [...new Set(memberIds.filter((n) => Number.isFinite(n)))];
    if (unique.length === 0) return {};
    const users = await this.prisma.user.findMany({
      where: {
        immis_member_id: { in: unique },
        status: 'active',
      },
      select: { id: true, name: true, phone: true, immis_member_id: true },
    });
    const map: Record<number, { user_id: string; name: string; phone: string | null }> = {};
    for (const u of users) {
      if (u.immis_member_id != null) {
        map[u.immis_member_id] = { user_id: u.id, name: u.name, phone: u.phone };
      }
    }
    return map;
  }

  async immisMemberExists(memberId: number): Promise<boolean> {
    try {
      const res = await this.getMember(String(memberId));
      const d = res.data as Record<string, unknown> | null | undefined;
      return res.status === 200 && d != null && typeof d === 'object' && typeof d.id === 'number';
    } catch {
      return false;
    }
  }
}

