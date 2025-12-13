// src/reports/dto/report.dto.ts
import {
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ReportReason,
  ReportStatus,
  AdminAction,
} from '../schemas/report.schema';

// ===== CREATE REPORT DTO =====
export class CreateReportDto {
  @IsMongoId()
  targetUserId: string;

  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsString()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachedFiles?: string[]; // URLs from Cloudinary
}

// ===== QUERY REPORTS DTO =====
export class GetReportsQueryDto {
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
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportReason)
  reason?: ReportReason;

  @IsOptional()
  @IsMongoId()
  targetUserId?: string;

  @IsOptional()
  @IsMongoId()
  reporterId?: string;
}

// ===== UPDATE REPORT STATUS DTO =====
export class UpdateReportStatusDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsOptional()
  @IsString()
  adminNote?: string;
}

// ===== RESOLVE REPORT DTO =====
export class ResolveReportDto {
  @IsEnum(AdminAction)
  action: AdminAction;

  @IsString()
  adminNote: string;

  // For WARNING
  // No additional fields needed

  // For RESTRICTED
  @IsOptional()
  @IsNumber()
  @Min(1)
  restrictionDays?: number; // Required if action = RESTRICTED

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restrictedFeatures?: string[]; // ['like', 'message', 'match']

  // For BANNED
  @IsOptional()
  @Type(() => Date)
  banUntil?: Date; // null = permanent ban
}
