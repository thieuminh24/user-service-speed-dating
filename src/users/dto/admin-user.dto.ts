// src/users/dto/admin-user.dto.ts
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsDate,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountStatus } from 'src/common/enums';

// ===== QUERY/FILTER DTOs =====
export class GetUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string; // Search by name or email

  @IsOptional()
  @IsEnum(['none', 'pending', 'approved', 'rejected'])
  verificationStatus?: string;

  @IsOptional()
  @IsEnum(['Free', 'Premium', 'VIP'])
  subscriptionTier?: string;

  @IsOptional()
  @IsEnum(AccountStatus)
  accountStatus?: AccountStatus;

  @IsOptional()
  @Type(() => Boolean)
  isPremium?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  isDeleted?: boolean;
}

// ===== BAN USER DTO =====
export class BanUserDto {
  @IsString()
  reason: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  banUntil?: Date; // null = vĩnh viễn
}

// ===== RESTRICT USER DTO =====
export class RestrictUserDto {
  @IsString()
  reason: string;

  @IsNumber()
  days: number; // Số ngày bị hạn chế

  @IsArray()
  @IsString({ each: true })
  features: string[]; // ['like', 'message', 'match']
}

// ===== ADMIN UPDATE USER DTO =====
export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(['Free', 'Premium', 'VIP'])
  subscriptionTier?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  premiumUntil?: Date;

  @IsOptional()
  @Type(() => Boolean)
  isPremium?: boolean;

  @IsOptional()
  @IsEnum(['none', 'pending', 'approved', 'rejected'])
  verificationStatus?: string;

  @IsOptional()
  @Type(() => Boolean)
  isPhotoVerified?: boolean;
}
