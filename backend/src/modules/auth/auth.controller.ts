import { Controller, Post, Body, HttpCode, HttpStatus, Req, Get, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user with email/phone and password. Returns user data, accounts, and authentication token.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'User credentials',
    examples: {
      emailLogin: {
        summary: 'Login with email',
        value: {
          identifier: 'user@example.com',
          password: 'SecurePassword123!',
        },
      },
      phoneLogin: {
        summary: 'Login with phone',
        value: {
          identifier: '250788123456',
          password: 'SecurePassword123!',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Returns user data, accounts, and authentication token.',
    type: AuthResponseDto,
    example: {
      code: 200,
      status: 'success',
      message: 'Login successful.',
      data: {
        user: {
          id: 'uuid-here',
          name: 'John Doe',
          email: 'user@example.com',
          phone: '250788123456',
          account_type: 'mcc',
          status: 'active',
          token: 'auth-token-here',
        },
        account: {
          id: 'account-uuid',
          code: 'ACC001',
          name: 'Main Account',
          type: 'tenant',
        },
        accounts: [],
        total_accounts: 1,
        profile_completion: 75,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing or invalid fields',
    example: {
      code: 400,
      status: 'error',
      message: 'Email/phone and password are required.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials',
    example: {
      code: 401,
      status: 'error',
      message: 'Invalid credentials.',
    },
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: any,
  ): Promise<AuthResponseDto> {
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'User registration or profile update',
    description: 'Register a new user with account and wallet, or update existing user profile if phone number is already registered. If the phone number is already registered (e.g., user was registered by a customer or referral), the existing user profile will be updated with the provided information, password will be updated, and status will be set to active. Creates user, account, and default wallet for new users. Returns the same success response format in both cases.',
  })
  @ApiBody({
    type: RegisterDto,
    description: 'User registration data. Business name (account_name) is optional - if not provided, it will be extracted from the full name.',
    examples: {
      newUser: {
        summary: 'Register new user',
        value: {
          name: 'John Doe',
          phone: '250788123456',
          email: 'user@example.com',
          password: 'SecurePassword123!',
          account_name: 'My Business Account',
          account_type: 'mcc',
          role: 'manager',
        },
      },
      existingUser: {
        summary: 'Update existing user (phone already registered)',
        value: {
          name: 'John Doe Updated',
          phone: '250788123456',
          email: 'newemail@example.com',
          password: 'NewPassword123!',
          account_name: 'Updated Business Name',
          account_type: 'supplier',
        },
      },
      minimalRegistration: {
        summary: 'Minimal registration (business name optional)',
        value: {
          name: 'Jane Smith',
          phone: '250788654321',
          password: 'SecurePassword123!',
          account_type: 'farmer',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful. Same response format for both new registrations and profile updates.',
    example: {
      code: 201,
      status: 'success',
      message: 'Registration successful.',
      data: {
        user: {
          code: 'U_ABC123',
          name: 'John Doe',
          email: 'user@example.com',
          phone: '250788123456',
          account_type: 'mcc',
          status: 'active',
          token: 'token_1234567890_abcdef',
        },
        account: {
          code: 'A_XYZ789',
          name: 'My Business Account',
          type: 'tenant',
          status: 'active',
        },
        wallet: {
          code: 'W_DEF456',
          type: 'regular',
          is_joint: false,
          is_default: true,
          balance: 0,
          currency: 'RWF',
          status: 'active',
        },
        sms_sent: false,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing required fields or validation errors',
    example: {
      code: 400,
      status: 'error',
      message: 'Validation failed',
    },
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify authentication token',
    description: 'Verify if an authentication token is valid and returns user information. Used to check token validity and refresh user session.',
  })
  @ApiBody({
    type: VerifyTokenDto,
    description: 'Token to verify',
    examples: {
      verifyToken: {
        summary: 'Verify token',
        value: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    example: {
      code: 200,
      status: 'success',
      message: 'Token is valid.',
      data: {
        code: 'U_ABC123',
        name: 'John Doe',
        email: 'user@example.com',
        phone: '250788123456',
        status: 'active',
        account_type: 'mcc',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Token is required',
    example: {
      code: 400,
      status: 'error',
      message: 'Token is required.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Token is invalid or expired',
    example: {
      code: 401,
      status: 'error',
      message: 'Invalid or expired token.',
    },
  })
  async verifyToken(@Body() verifyTokenDto: VerifyTokenDto) {
    return this.authService.verifyToken(verifyTokenDto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Request a password reset code. The code is sent via SMS (if phone provided) or email (if email provided). The code can be used to reset the password via the reset-password endpoint.',
  })
  @ApiBody({
    type: ForgotPasswordDto,
    description: 'User identifier (phone or email)',
    examples: {
      phoneReset: {
        summary: 'Request reset via phone',
        value: {
          phone: '250788123456',
        },
      },
      emailReset: {
        summary: 'Request reset via email',
        value: {
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Reset code sent successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Reset code sent successfully.',
      data: {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        sms_sent: true,
        email_sent: false,
        contact_info: {
          phone: '250788123456',
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Phone or email is required',
    example: {
      code: 400,
      status: 'error',
      message: 'Phone or email is required.',
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    example: {
      code: 404,
      status: 'error',
      message: 'User not found.',
    },
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset password with code',
    description: 'Reset user password using the reset code received via SMS/email. The code must be valid and not expired. After successful reset, the user can login with the new password.',
  })
  @ApiBody({
    type: ResetPasswordDto,
    description: 'Reset password data',
    examples: {
      resetWithPhone: {
        summary: 'Reset password using phone and code',
        value: {
          phone: '250788123456',
          reset_code: '123456',
          new_password: 'NewSecurePassword123!',
        },
      },
      resetWithEmail: {
        summary: 'Reset password using email and code',
        value: {
          email: 'user@example.com',
          reset_code: '123456',
          new_password: 'NewSecurePassword123!',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Password has been reset successfully.',
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing fields or invalid format',
    example: {
      code: 400,
      status: 'error',
      message: 'Phone/email, reset code, and new password are required.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired reset code',
    example: {
      code: 401,
      status: 'error',
      message: 'Invalid or expired reset code.',
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    example: {
      code: 404,
      status: 'error',
      message: 'User not found.',
    },
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Logout current session',
    description:
      'Logout endpoint for clients. For now this simply returns a success response so that mobile/web clients have a stable API. Session invalidation is handled client-side while token-based auth is being migrated.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful.',
    example: {
      code: 200,
      status: 'success',
      message: 'Logout successful.',
    },
  })
  async logout() {
    return {
      code: 200,
      status: 'success',
      message: 'Logout successful.',
    };
  }

  @Get('token')
  @ApiOperation({
    summary: 'Validate token (legacy compatibility)',
    description: 'Legacy endpoint for token validation. Accepts token in query parameter (?token=...) or request body. Prefer using POST /auth/verify for new implementations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token validation endpoint',
    example: {
      code: 200,
      status: 'success',
      message: 'Token is valid.',
      data: {
        code: 'U_ABC123',
        name: 'John Doe',
        email: 'user@example.com',
        phone: '250788123456',
        status: 'active',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Token is required',
    example: {
      code: 400,
      status: 'error',
      message: 'Token is required.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Token is invalid or expired',
    example: {
      code: 401,
      status: 'error',
      message: 'Invalid or expired token.',
    },
  })
  async validateToken(@Req() request: any) {
    const token = request.query.token || request.body?.token;
    if (!token) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Token is required.',
      });
    }
    return this.authService.verifyToken({ token });
  }
}

