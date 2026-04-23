import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';

export class SubmitMccOnboardingDto {
  @ApiProperty({ example: '2026-04-20T11:00:00.000Z' })
  @IsString()
  @IsNotEmpty()
  submittedAt: string;

  @ApiProperty({ example: 'Kivu Dairy Collection Center' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  businessName: string;

  @ApiPropertyOptional({ example: 'Kivu MCC' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  commonName?: string;

  @ApiPropertyOptional({ example: 'mcc@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  businessEmail?: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  managerFirstName: string;

  @ApiProperty({ example: 'Niyonzima' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  managerLastName: string;

  @ApiProperty({ example: '0788123456' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10}$/, { message: 'managerPhone must be exactly 10 digits' })
  @MaxLength(50)
  managerPhone: string;

  @ApiProperty({ example: '1199080012345678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  managerIdNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownershipStructure?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownershipOther?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorDisability?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationalStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiProperty({ description: 'Section 1 location payload as JSON object' })
  @IsObject()
  section1Location: Record<string, unknown>;

  @ApiProperty({ description: 'Section 2 payload as JSON object' })
  @IsObject()
  section2: Record<string, unknown>;

  @ApiProperty({ description: 'Section 3 payload as JSON object' })
  @IsObject()
  section3: Record<string, unknown>;

  @ApiProperty({ description: 'Section 4 payload as JSON object' })
  @IsObject()
  section4: Record<string, unknown>;

  @ApiProperty({ description: 'Section 5 payload as JSON object' })
  @IsObject()
  section5: Record<string, unknown>;

  @ApiProperty({ description: 'Section 6 payload as JSON object' })
  @IsObject()
  section6: Record<string, unknown>;

  @ApiProperty({ description: 'Section 7 payload as JSON object' })
  @IsObject()
  section7: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Optional override webhook URL. If not set, backend uses GOOGLE_SHEETS_WEBHOOK_URL env var.',
    example: 'https://script.google.com/macros/s/abc123/exec',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  googleSheetsWebhookUrl?: string;
}
