// src/verification/verification.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VerificationService } from './verification.service';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AdminGuard } from 'src/auth/admin.guard';

@Controller('verification')
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ===== USER ENDPOINTS =====

  // Submit verification với upload ảnh
  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'selfie', maxCount: 1 },
      { name: 'idCardFront', maxCount: 1 },
      { name: 'idCardBack', maxCount: 1 },
    ]),
  )
  async submitVerification(
    @Req() req: any,
    @UploadedFiles()
    files: {
      selfie?: Express.Multer.File[];
      idCardFront?: Express.Multer.File[];
      idCardBack?: Express.Multer.File[];
    },
  ) {
    // Validate files
    if (!files.selfie || !files.idCardFront || !files.idCardBack) {
      throw new BadRequestException(
        'Cần đủ 3 ảnh: selfie, CCCD mặt trước, CCCD mặt sau',
      );
    }

    // Upload to Cloudinary
    const selfieResult = await this.cloudinaryService.uploadImage(
      files.selfie[0],
    );
    const frontResult = await this.cloudinaryService.uploadImage(
      files.idCardFront[0],
    );
    const backResult = await this.cloudinaryService.uploadImage(
      files.idCardBack[0],
    );

    const dto: SubmitVerificationDto = {
      selfieUrl: selfieResult.secure_url,
      idCardUrls: [frontResult.secure_url, backResult.secure_url],
    };

    return this.verificationService.submitVerification(req.user.userId, dto);
  }

  // Get own verification status
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getMyStatus(@Req() req: any) {
    return this.verificationService.getMyVerificationStatus(req.user.userId);
  }

  // ===== ADMIN ENDPOINTS =====

  // Get pending verifications
  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getPendingVerifications() {
    return this.verificationService.getPendingVerifications();
  }

  // Get verification detail (chỉ admin mới thấy ảnh CCCD)
  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getVerificationDetail(@Param('id') id: string) {
    return this.verificationService.getVerificationDetail(id);
  }

  // Review verification
  @Patch('admin/:id/review')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async reviewVerification(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.reviewVerification(
      id,
      req.user.userId,
      dto,
    );
  }

  // Get all verifications (with optional status filter)
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAllVerifications() {
    return this.verificationService.getAllVerifications();
  }
}
