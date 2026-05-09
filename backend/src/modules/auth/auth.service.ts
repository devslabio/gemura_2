import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../../common/services/sms.service';
import { EmailService } from '../../common/services/email.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, LoginResponseDataDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
    private emailService: EmailService,
  ) {}

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto> {
    const { identifier, password } = loginDto;

    // Determine if identifier is email or phone
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const field = isEmail ? 'email' : 'phone';
    const value = isEmail ? identifier.toLowerCase() : identifier.replace(/\D/g, '');

    // Find user (phone numbers should be unique now)
    const user = await this.prisma.user.findFirst({
      where: {
        [field]: value,
        status: 'active',
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'No account found with this phone number or email.',
      });
    }

    // Verify password
    // PHP bcrypt uses $2y$; Node bcrypt accepts $2a$ (same algorithm, compatible)
    const hashToCompare = user.password_hash.startsWith('$2y$')
      ? user.password_hash.replace(/^\$2y\$/, '$2a$')
      : user.password_hash;
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'Incorrect password.',
      });
    }

    // Get user accounts (same query as PHP)
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

    // Format accounts (matching PHP response structure)
    const accounts = userAccounts
      .filter((ua) => ua.account && ua.account.status === 'active')
      .map((ua) => ({
        account_id: ua.account!.id,
        account_code: ua.account!.code,
        account_name: ua.account!.name,
        /** App routing (farmer, supplier, mcc): use the user’s type, not Account.type (tenant). */
        account_type: String(user.account_type),
        account_status: ua.account!.status,
        account_created_at: ua.account!.created_at,
        role: ua.role,
        permissions: ua.permissions ? (typeof ua.permissions === 'string' ? JSON.parse(ua.permissions) : ua.permissions) : null,
        user_account_status: ua.status,
        access_granted_at: ua.created_at,
        is_default: user.default_account_id === ua.account!.id,
        supplier_segment: user.supplier_segment ?? null,
      }));

    // Find default account
    const defaultAccount = accounts.find((a) => a.is_default);
    const defaultAccountData = defaultAccount
      ? {
          id: defaultAccount.account_id,
          code: defaultAccount.account_code,
          name: defaultAccount.account_name,
          type: defaultAccount.account_type,
        }
      : null;

    // Calculate profile completion (same fields as PHP)
    const profileFields = [
      'name',
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

    // Team members invited via employees flow may not have a token set yet.
    // Ensure a token exists so frontend auth state can be established.
    const authToken = user.token || `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        last_login: new Date(),
        last_login_ip: ipAddress,
        last_login_device: userAgent,
        token: authToken,
      },
    });

    // Return response matching PHP format
    return {
      code: 200,
      status: 'success',
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          account_type: user.account_type,
          supplier_segment: user.supplier_segment ?? null,
          status: user.status,
          token: authToken,
        },
        account: defaultAccountData,
        accounts,
        total_accounts: accounts.length,
        profile_completion: profileCompletion,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<any> {
    const { name, phone, email, password, account_name, account_type, nid, role, permissions, wallet } = registerDto;

    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, '');
    const normalizedEmail = email ? email.toLowerCase().trim() : null;
    
    // Extract account name: use business name (account_name) if provided and not empty,
    // otherwise extract from full name (name)
    const finalAccountName = (account_name && account_name.trim().length > 0) 
      ? account_name.trim() 
      : name.trim();

    // Check if user exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          ...(nid ? [{ nid }] : []),
        ],
      },
      include: {
        user_accounts: {
          where: { status: 'active' },
          include: { account: true },
          take: 1,
        },
      },
    });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Default permissions
    const defaultPermissions = {
      can_collect: true,
      can_add_supplier: true,
      can_view_reports: true,
    };
    const userPermissions = permissions || defaultPermissions;

    // If user exists, update their profile instead of throwing error
    // This handles cases where users were registered by customers or referrals
    if (existingUser) {
      const result = await this.prisma.$transaction(async (tx) => {
        // Update existing user profile
        const updatedUser = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: name.trim(),
            email: normalizedEmail || existingUser.email,
            phone: normalizedPhone,
            nid: nid?.trim() || existingUser.nid,
            password_hash: passwordHash, // Update password
            account_type: account_type || existingUser.account_type,
            status: 'active', // Ensure status is active
          },
        });

        // Check if user has an active account
        const existingUserAccount = existingUser.user_accounts?.[0];
        let account = existingUserAccount?.account;
        
        if (!account) {
          // Create account if user doesn't have one
          const accountCode = `A_${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
          account = await tx.account.create({
            data: {
              code: accountCode,
              name: finalAccountName,
              type: 'tenant',
              status: 'active',
              created_by: updatedUser.id,
            },
          });

          // Link user to account
          await tx.userAccount.create({
            data: {
              user_id: updatedUser.id,
              account_id: account.id,
              role: role || 'owner',
              permissions: userPermissions,
              status: 'active',
              created_by: updatedUser.id,
            },
          });

          // Set default account
          await tx.user.update({
            where: { id: updatedUser.id },
            data: { default_account_id: account.id },
          });
        } else {
          // Update account name if provided
          if (finalAccountName && finalAccountName !== account.name) {
            account = await tx.account.update({
              where: { id: account.id },
              data: { name: finalAccountName },
            });
          }

          // Update user_account role and permissions only when explicitly provided.
          if (existingUserAccount && (role || permissions)) {
            const updateData: any = {
              role: role || existingUserAccount.role,
            };
            
            // Only update permissions if explicitly provided in the request
            // Otherwise preserve existing permissions
            if (permissions) {
              updateData.permissions = userPermissions;
            }
            // If permissions not provided, keep existing permissions (don't update)
            
            await tx.userAccount.update({
              where: { id: existingUserAccount.id },
              data: updateData,
            });
          }
        }

        // Check if account has a default wallet
        let walletData = await tx.wallet.findFirst({
          where: {
            account_id: account.id,
            is_default: true,
            status: 'active',
          },
        });

        if (!walletData) {
          // Create wallet if account doesn't have one
          const walletCode = `W_${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
          walletData = await tx.wallet.create({
            data: {
              code: walletCode,
              account_id: account.id,
              type: wallet?.type || 'regular',
              is_joint: wallet?.is_joint || false,
              is_default: true,
              balance: 0,
              currency: 'RWF',
              status: 'active',
              created_by: updatedUser.id,
            },
          });
        }

        return { user: updatedUser, account, wallet: walletData };
      });

      // Return same success response format
      return {
        code: 201,
        status: 'success',
        message: 'Registration successful.',
        data: {
          user: {
            code: result.user.code,
            name: result.user.name,
            email: result.user.email,
            phone: result.user.phone,
            nid: result.user.nid,
            account_type: result.user.account_type,
            status: result.user.status,
            token: result.user.token,
          },
          account: {
            code: result.account.code,
            name: result.account.name,
            type: result.account.type,
            status: result.account.status,
          },
          wallet: {
            code: result.wallet.code,
            type: result.wallet.type,
            is_joint: result.wallet.is_joint,
            is_default: result.wallet.is_default,
            balance: result.wallet.balance,
            currency: result.wallet.currency,
            status: result.wallet.status,
          },
          sms_sent: false, // TODO: Implement SMS service
        },
      };
    }

    // Generate codes for new user
    const userCode = `U_${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const accountCode = `A_${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const walletCode = `W_${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const token = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create user, account, wallet in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          code: userCode,
          name: name.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          nid: nid?.trim() || null,
          password_hash: passwordHash,
          token,
          account_type: account_type || 'mcc',
          status: 'active',
        },
      });

      // Create account
      const account = await tx.account.create({
        data: {
          code: accountCode,
          name: finalAccountName,
          type: 'tenant',
          status: 'active',
          created_by: user.id,
        },
      });

      // Link user to account
      await tx.userAccount.create({
        data: {
          user_id: user.id,
          account_id: account.id,
          role: role || 'owner',
          permissions: userPermissions,
          status: 'active',
          created_by: user.id,
        },
      });

      // Set default account
      await tx.user.update({
        where: { id: user.id },
        data: { default_account_id: account.id },
      });

      // Create wallet
      const walletData = await tx.wallet.create({
        data: {
          code: walletCode,
          account_id: account.id,
          type: wallet?.type || 'regular',
          is_joint: wallet?.is_joint || false,
          is_default: true,
          balance: 0,
          currency: 'RWF',
          status: 'active',
          created_by: user.id,
        },
      });

      return { user, account, wallet: walletData };
    });

    return {
      code: 201,
      status: 'success',
      message: 'Registration successful.',
      data: {
        user: {
          code: result.user.code,
          name: result.user.name,
          email: result.user.email,
          phone: result.user.phone,
          nid: result.user.nid,
          account_type: result.user.account_type,
          status: result.user.status,
          token: result.user.token,
        },
        account: {
          code: result.account.code,
          name: result.account.name,
          type: result.account.type,
          status: result.account.status,
        },
        wallet: {
          code: result.wallet.code,
          type: result.wallet.type,
          is_joint: result.wallet.is_joint,
          is_default: result.wallet.is_default,
          balance: result.wallet.balance,
          currency: result.wallet.currency,
          status: result.wallet.status,
        },
        sms_sent: false, // TODO: Implement SMS service
      },
    };
  }

  async verifyToken(verifyTokenDto: VerifyTokenDto): Promise<any> {
    const { token } = verifyTokenDto;

    const user = await this.prisma.user.findFirst({
      where: {
        token,
        status: 'active',
      },
      select: {
        code: true,
        name: true,
        email: true,
        phone: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'Token is invalid or expired.',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Token is valid.',
      data: user,
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<any> {
    const { phone, email } = forgotPasswordDto;

    if (!phone && !email) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Phone number or email is required.',
      });
    }

    // Find user
    const where: any = {};
    if (phone) {
      where.phone = phone.replace(/\D/g, '');
    }
    if (email) {
      where.email = email.toLowerCase().trim();
    }

    const user = await this.prisma.user.findFirst({
      where: phone && email ? { OR: [{ phone: where.phone }, { email: where.email }] } : where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'User not found with provided phone or email.',
      });
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Store reset code (using token field to store the code)
    await this.prisma.passwordReset.create({
      data: {
        user_id: user.id,
        token: resetCode,
        expires_at: expiresAt,
      },
    });

    // Send SMS if phone is available
    let smsSent = false;
    if (user.phone) {
      const smsMessage = `Kode yanyu yo guhindura ijambo banga: ${resetCode}\n\nIyi kode irarangira mu minota 15.`;
      smsSent = await this.smsService.sendSMS(user.phone, smsMessage);
    }

    // Send email if email is available
    let emailSent = false;
    if (user.email) {
      emailSent = await this.emailService.sendPasswordResetCode(user.email, resetCode);
    }

    return {
      code: 200,
      status: 'success',
      message: 'Reset code sent successfully.',
      data: {
        user_id: parseInt(user.id) || 0, // Legacy compatibility - PHP uses int
        sms_sent: smsSent,
        email_sent: emailSent,
        contact_info: {
          phone: user.phone,
          email: user.email,
        },
      },
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<any> {
    const { user_id, reset_code, new_password } = resetPasswordDto;

    // Find user by legacy_id (PHP uses int) or UUID id
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { legacy_id: BigInt(user_id) },
          { id: user_id.toString() },
        ],
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'User not found.',
      });
    }

    // Find valid reset code
    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        user_id: user.id,
        token: reset_code,
        expires_at: { gte: new Date() },
        used_at: null,
      },
    });

    if (!resetRecord) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'Invalid or expired reset code.',
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(new_password, 10);

    // Update password and mark reset code as used
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { password_hash: passwordHash },
      });

      await tx.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used_at: new Date() },
      });
    });

    return {
      code: 200,
      status: 'success',
      message: 'Password has been reset successfully.',
    };
  }
}

