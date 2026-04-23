import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { SubmitMccOnboardingDto } from './dto/submit-mcc-onboarding.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class OnboardService {
  constructor(private prisma: PrismaService) {}

  private async generateVibeSubmissionCode(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const randomNumber = Math.floor(100000 + Math.random() * 900000);
      const code = `VIBE${year}${randomNumber}`;
      const exists = await tx.mccOnboardingSubmission.findUnique({
        where: { submission_code: code },
        select: { id: true },
      });

      if (!exists) {
        return code;
      }
    }

    throw new BadRequestException({
      code: 400,
      status: 'error',
      message: 'Unable to generate unique submission ID. Please retry.',
    });
  }

  private async sendToGoogleSheet(webhookUrl: string, payload: Record<string, unknown>) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Google Sheet webhook failed (${response.status}): ${raw}`);
    }

    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }

  async submitMccOnboarding(dto: SubmitMccOnboardingDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const submissionCode = await this.generateVibeSubmissionCode(tx);
      const decision = String((dto.section7?.decision as string) || 'UNKNOWN');
      const passCountValue = Number(dto.section7?.passCount ?? 0);
      const passCount = Number.isFinite(passCountValue) ? passCountValue : 0;

      const created = await tx.mccOnboardingSubmission.create({
        data: {
          submission_code: submissionCode,
          business_name: dto.businessName,
          common_name: dto.commonName,
          manager_first_name: dto.managerFirstName,
          manager_last_name: dto.managerLastName,
          manager_phone: dto.managerPhone,
          manager_id_number: dto.managerIdNumber,
          location_province_id: String(dto.section1Location?.provinceId || ''),
          location_district_id: String(dto.section1Location?.districtId || ''),
          location_sector_id: String(dto.section1Location?.sectorId || ''),
          location_cell_id: String(dto.section1Location?.cellId || ''),
          location_village_id: String(dto.section1Location?.villageId || ''),
          final_decision: decision,
          pass_count: passCount,
          section_payload: dto as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        id: created.id,
        submissionCode,
        createdAt: created.created_at,
      };
    });

    const webhookUrl = dto.googleSheetsWebhookUrl || process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    let sheetStatus: 'not_configured' | 'sent' | 'failed' = 'not_configured';
    let sheetError: string | null = null;
    let sheetResponse: unknown = null;

    if (webhookUrl) {
      try {
        sheetResponse = await this.sendToGoogleSheet(webhookUrl, {
          ...dto,
          submissionCode: result.submissionCode,
        });
        sheetStatus = 'sent';
      } catch (error) {
        sheetStatus = 'failed';
        sheetError = error instanceof Error ? error.message : 'Unknown Google Sheet relay error';
      }
    }

    await this.prisma.mccOnboardingSubmission.update({
      where: { id: result.id },
      data: {
        google_sheet_status: sheetStatus,
        google_sheet_error: sheetError,
        google_sheet_response: sheetResponse as Prisma.InputJsonValue,
      },
    });

    return {
      code: 201,
      status: 'success',
      message: 'MCC onboarding submitted successfully.',
      data: {
        id: result.id,
        submission_code: result.submissionCode,
        created_at: result.createdAt,
        google_sheet: {
          status: sheetStatus,
          error: sheetError,
        },
      },
    };
  }

  async createUser(onboarder: User, createUserDto: CreateUserDto) {
    // Normalize phone number (remove spaces, ensure + prefix)
    const normalizedPhone = createUserDto.phone_number.replace(/\s/g, '');

    // Check if phone number already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: normalizedPhone.replace(/^\+/, '') }, // Check without +
          { phone: `+${normalizedPhone}` }, // Check with +
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 400,
        status: 'error',
        message: 'Phone number already exists.',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Start transaction
    return await this.prisma.$transaction(async (tx) => {
      // Create new user
      const newUser = await tx.user.create({
        data: {
          name: createUserDto.name,
          phone: normalizedPhone,
          email: createUserDto.email,
          address: createUserDto.location,
          password_hash: passwordHash,
          onboarded_by: parseInt(onboarder.legacy_id?.toString() || '0'),
          registration_type: 'onboarded',
          status: 'active',
          token: token,
          created_by: onboarder.id,
        },
      });

      // Create onboarding record
      // Note: UserOnboarding schema uses user_id, step, completed
      // We'll use step to track the onboarder
      await tx.userOnboarding.create({
        data: {
          user_id: newUser.id,
          step: `onboarded`,
          completed: true,
        },
      });

      // Award points to onboarder
      await tx.userPoint.create({
        data: {
          user_id: onboarder.id,
          points: 1,
          reason: `onboarding:${newUser.id}`,
        },
      });

      // Update onboarder's stats
      await tx.user.update({
        where: { id: onboarder.id },
        data: {
          onboarded_count: { increment: 1 },
          total_points: { increment: 1 },
          available_points: { increment: 1 },
        },
      });

      return {
        code: 201,
        status: 'success',
        message: 'User onboarded successfully.',
        data: {
          onboarded_user: {
            id: newUser.id,
            name: newUser.name,
            phone_number: newUser.phone,
            email: newUser.email,
            location: newUser.address,
            token: newUser.token,
            created_at: newUser.created_at,
          },
          onboarder: {
            name: onboarder.name,
            points_earned: 1,
          },
          onboarded_at: newUser.created_at,
        },
      };
    });
  }
}
