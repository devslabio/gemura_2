import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ImmisService } from '../immis/immis.service';
import { RbacService } from '../rbac/rbac.service';
import { composeUserFullName, splitIntoFirstLast } from '../../common/utils/user-name.util';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private immisService: ImmisService,
    private rbac: RbacService,
  ) {}

  async getProfile(user: User) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'User not found.' });
    }
    user = dbUser;

    // Get user accounts (same as login)
    const userAccounts = await this.prisma.userAccount.findMany({
      where: {
        user_id: user.id,
        status: 'active',
      },
      include: {
        account: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const filteredUa = userAccounts.filter((ua) => ua.account && ua.account.status === 'active');
    const accounts = await Promise.all(
      filteredUa.map(async (ua) => ({
        account_id: ua.account!.id,
        account_code: ua.account!.code,
        account_name: ua.account!.name,
        account_type: String(user.account_type),
        account_status: ua.account!.status,
        account_created_at: ua.account!.created_at,
        role: ua.role,
        permissions: await this.rbac.formatPermissionsForApi({
          role: ua.role,
          platform_role_id: ua.platform_role_id,
          permissions: ua.permissions,
        }),
        user_account_status: ua.status,
        access_granted_at: ua.created_at,
        is_default: user.default_account_id === ua.account!.id,
        supplier_segment: user.supplier_segment ?? null,
      })),
    );

    // Find default account
    const defaultAccount = accounts.find((a) => a.is_default);
    const defaultAccountData = defaultAccount
      ? {
          id: defaultAccount.account_id,
          code: defaultAccount.account_code,
          name: defaultAccount.account_name,
          type: defaultAccount.account_type,
          role: defaultAccount.role,
          permissions: defaultAccount.permissions,
        }
      : null;

    // Calculate profile completion
    const profileFields = [
      'first_name',
      'email',
      'phone',
      'province',
      'district',
      'sector',
      'cell',
      'village',
      'id_number',
      'id_front_photo_url',
      'id_back_photo_url',
      'selfie_photo_url',
    ];

    let completedFields = 0;
    for (const field of profileFields) {
      if (user[field]) {
        completedFields++;
      }
    }

    const profileCompletion = Math.round((completedFields / profileFields.length) * 100);

    const mccOnboardings = await this.prisma.mccOnboardingSubmission.findMany({
      where: { linked_user_id: user.id },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        submission_code: true,
        business_name: true,
        common_name: true,
        review_status: true,
        final_decision: true,
        pass_count: true,
        created_at: true,
        reviewed_at: true,
        linked_account_id: true,
        linked_account: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          name: user.name,
          email: user.email,
          phone: user.phone,
          account_type: user.account_type,
          supplier_segment: user.supplier_segment ?? null,
          status: user.status,
          token: user.token,
          immis_member_id: user.immis_member_id ?? null,
          immis_linked_at: user.immis_linked_at ?? null,
          role: defaultAccount?.role ?? '',
          permissions: defaultAccount?.permissions ?? null,
          account_code: defaultAccount?.account_code ?? null,
          account_name: defaultAccount?.account_name ?? null,
        },
        account: defaultAccountData,
        accounts,
        total_accounts: accounts.length,
        profile_completion: profileCompletion,
        mcc_onboardings: mccOnboardings,
      },
    };
  }

  /**
   * Full MCC gate onboarding row linked to this user (admin linked `linked_user_id`).
   * Read-only; excludes internal google sheet fields from the default Prisma return shape is fine.
   */
  async getOwnLinkedMccOnboarding(user: User, submissionId: string) {
    const row = await this.prisma.mccOnboardingSubmission.findFirst({
      where: {
        id: submissionId,
        linked_user_id: user.id,
      },
      select: {
        id: true,
        submission_code: true,
        business_name: true,
        common_name: true,
        manager_first_name: true,
        manager_last_name: true,
        manager_phone: true,
        manager_id_number: true,
        location_province_id: true,
        location_district_id: true,
        location_sector_id: true,
        location_cell_id: true,
        location_village_id: true,
        final_decision: true,
        pass_count: true,
        section_payload: true,
        review_status: true,
        review_notes: true,
        reviewed_at: true,
        created_at: true,
        updated_at: true,
        linked_user_id: true,
        linked_account_id: true,
        linked_account: { select: { id: true, name: true, code: true, type: true } },
      },
    });

    if (!row) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Onboarding record not found or not linked to your account.',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Onboarding retrieved successfully.',
      data: row,
    };
  }

  async updateProfile(user: User, updateDto: UpdateProfileDto) {
    const updateData: any = {
      updated_by: user.id,
    };

    if (updateDto.first_name !== undefined) updateData.first_name = updateDto.first_name.trim();
    if (updateDto.last_name !== undefined) updateData.last_name = updateDto.last_name.trim();
    if (
      updateDto.name !== undefined &&
      updateDto.first_name === undefined &&
      updateDto.last_name === undefined
    ) {
      const sp = splitIntoFirstLast(updateDto.name);
      updateData.first_name = sp.first_name;
      updateData.last_name = sp.last_name;
    }
    if (
      updateData.first_name !== undefined ||
      updateData.last_name !== undefined ||
      updateDto.name !== undefined
    ) {
      const fn = (updateData.first_name ?? user.first_name ?? '').toString().trim();
      const ln = (updateData.last_name ?? user.last_name ?? '').toString().trim();
      updateData.name = composeUserFullName(fn, ln);
    }
    if (updateDto.email !== undefined) updateData.email = updateDto.email || null;
    if (updateDto.phone) {
      // Normalize phone (remove non-digits)
      updateData.phone = updateDto.phone.replace(/\D/g, '');
    }
    if (updateDto.nid !== undefined) updateData.nid = updateDto.nid || null;
    if (updateDto.address !== undefined) updateData.address = updateDto.address || null;

    // KYC fields
    if (updateDto.province !== undefined) updateData.province = updateDto.province || null;
    if (updateDto.district !== undefined) updateData.district = updateDto.district || null;
    if (updateDto.sector !== undefined) updateData.sector = updateDto.sector || null;
    if (updateDto.cell !== undefined) updateData.cell = updateDto.cell || null;
    if (updateDto.village !== undefined) updateData.village = updateDto.village || null;
    if (updateDto.id_number !== undefined) updateData.id_number = updateDto.id_number || null;
    if (updateDto.id_front_photo_url !== undefined)
      updateData.id_front_photo_url = updateDto.id_front_photo_url || null;
    if (updateDto.id_back_photo_url !== undefined)
      updateData.id_back_photo_url = updateDto.id_back_photo_url || null;
    if (updateDto.selfie_photo_url !== undefined)
      updateData.selfie_photo_url = updateDto.selfie_photo_url || null;

    // Update KYC status to pending if photos are uploaded
    if (
      updateDto.id_front_photo_url ||
      updateDto.id_back_photo_url ||
      updateDto.selfie_photo_url
    ) {
      updateData.kyc_status = 'pending';
    }

    // Validate required fields
    const resolvedFirst = (updateData.first_name ?? user.first_name ?? '').toString().trim();
    const resolvedPhone = (updateData.phone ?? user.phone ?? '').toString().trim();
    if (!resolvedFirst || !resolvedPhone) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'First name and phone are required.',
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Return updated profile (same structure as get)
    return this.getProfile(updatedUser);
  }

  async linkImmisMember(user: User, immisMemberId: number) {
    const exists = await this.immisService.immisMemberExists(immisMemberId);
    if (!exists) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'IMMIS member not found or could not be verified.',
      });
    }
    const taken = await this.prisma.user.findFirst({
      where: {
        immis_member_id: immisMemberId,
        NOT: { id: user.id },
        status: 'active',
      },
    });
    if (taken) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `This IMMIS member is already linked to Gemura user "${taken.name}".`,
      });
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        immis_member_id: immisMemberId,
        immis_linked_at: new Date(),
        updated_by: user.id,
      },
    });
    return this.getProfile(updated);
  }

  async unlinkImmisMember(user: User) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        immis_member_id: null,
        immis_linked_at: null,
        updated_by: user.id,
      },
    });
    return this.getProfile(updated);
  }
}

