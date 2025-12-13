// src/reports/reports.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import {
  CreateReportDto,
  GetReportsQueryDto,
  UpdateReportStatusDto,
  ResolveReportDto,
} from './dto/report.dto';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ===== USER ENDPOINTS =====

  // Create report with file upload
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'files', maxCount: 3 }], {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async createReport(
    @Req() req: any,
    @Body() dto: CreateReportDto,
    @UploadedFiles() files: { files?: Express.Multer.File[] },
  ) {
    // Upload files to Cloudinary
    const attachedFiles: string[] = [];
    if (files.files) {
      for (const file of files.files) {
        const result = await this.cloudinaryService.uploadImage(file);
        attachedFiles.push(result.secure_url);
      }
    }

    return this.reportsService.createReport(req.user.userId, {
      ...dto,
      attachedFiles,
    });
  }

  // Get my reports
  @Get('my-reports')
  @UseGuards(JwtAuthGuard)
  async getMyReports(@Req() req: any, @Query() query: GetReportsQueryDto) {
    return this.reportsService.getMyReports(req.user.userId, query);
  }

  // ===== ADMIN ENDPOINTS =====

  // Get all reports (admin only)
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAllReports(@Query() query: GetReportsQueryDto) {
    return this.reportsService.getAllReports(query);
  }

  // Get report statistics
  @Get('admin/statistics')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getReportStatistics() {
    return this.reportsService.getReportStatistics();
  }

  // Get report detail
  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getReportDetail(@Param('id') id: string) {
    return this.reportsService.getReportDetail(id);
  }

  // Update report status (reviewing, etc.)
  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateReportStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateReportStatus(id, req.user.userId, dto);
  }

  // Resolve report (take action)
  @Post('admin/:id/resolve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resolveReport(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reportsService.resolveReport(id, req.user.userId, dto);
  }
}
