import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountDto {
  @ApiProperty()
  account_id: string;

  @ApiProperty()
  account_code: string;

  @ApiProperty()
  account_name: string;

  @ApiProperty()
  account_type: string;

  @ApiProperty()
  account_status: string;

  @ApiProperty()
  account_created_at: Date;

  @ApiProperty()
  role: string;

  @ApiProperty()
  permissions: any;

  @ApiProperty()
  user_account_status: string;

  @ApiProperty()
  access_granted_at: Date;

  @ApiProperty()
  is_default: boolean;
}

export class UserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string | null;

  @ApiProperty()
  phone: string | null;

  @ApiProperty()
  account_type: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  token: string | null;

  @ApiPropertyOptional({
    description: 'Platform role slug on the default UserAccount link (e.g. system_admin, manager).',
  })
  role?: string;

  @ApiPropertyOptional({ description: 'Effective permission codes for the default account link (from RBAC).' })
  permissions?: string[] | null;

  @ApiPropertyOptional({ description: 'Default linked account code.' })
  account_code?: string | null;

  @ApiPropertyOptional({ description: 'Default linked account display name.' })
  account_name?: string | null;
}

export class DefaultAccountDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional({ description: 'UserAccount.role for this link.' })
  role?: string;

  @ApiPropertyOptional({ description: 'Effective permission codes for this link.' })
  permissions?: string[] | null;
}

export class LoginResponseDataDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;

  @ApiProperty({ type: DefaultAccountDto, nullable: true })
  account: DefaultAccountDto | null;

  @ApiProperty({ type: [AccountDto] })
  accounts: AccountDto[];

  @ApiProperty()
  total_accounts: number;

  @ApiProperty()
  profile_completion: number;
}

export class AuthResponseDto {
  @ApiProperty()
  code: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: LoginResponseDataDto })
  data: LoginResponseDataDto;
}

