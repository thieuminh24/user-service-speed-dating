// src/verification/dto/review-verification.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { VerificationStatus } from '../schemas/verification.schema';

export class ReviewVerificationDto {
  @IsEnum(VerificationStatus, { message: 'Status không hợp lệ' })
  status: VerificationStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
