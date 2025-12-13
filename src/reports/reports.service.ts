// src/reports/reports.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Report, ReportStatus, AdminAction } from './schemas/report.schema';
import { User } from '../users/schemas/user.schema';
import {
  CreateReportDto,
  GetReportsQueryDto,
  UpdateReportStatusDto,
  ResolveReportDto,
} from './dto/report.dto';
import { AccountStatus } from 'src/common/enums';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<Report>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  // ===== USER: CREATE REPORT =====
  async createReport(reporterId: string, dto: CreateReportDto) {
    // Validate target user exists
    const targetUser = await this.userModel.findById(dto.targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User bị báo cáo không tồn tại');
    }

    // Cannot report yourself
    if (reporterId === dto.targetUserId) {
      throw new BadRequestException('Không thể tự báo cáo chính mình');
    }

    // Check if already reported
    const existingReport = await this.reportModel.findOne({
      reporterId,
      targetUserId: dto.targetUserId,
      status: { $in: [ReportStatus.PENDING, ReportStatus.REVIEWING] },
    });

    if (existingReport) {
      throw new BadRequestException('Bạn đã báo cáo user này rồi');
    }

    // Validate max 3 files
    if (dto.attachedFiles && dto.attachedFiles.length > 3) {
      throw new BadRequestException('Tối đa 3 file đính kèm');
    }

    const report = await this.reportModel.create({
      reporterId,
      targetUserId: dto.targetUserId,
      reason: dto.reason,
      description: dto.description,
      attachedFiles: dto.attachedFiles || [],
      status: ReportStatus.PENDING,
    });

    return {
      message: 'Báo cáo đã được gửi thành công',
      reportId: report._id,
    };
  }

  // ===== USER: GET MY REPORTS =====
  async getMyReports(userId: string, query: GetReportsQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      this.reportModel
        .find({ reporterId: userId })
        .populate('targetUserId', 'name email photos')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reportModel.countDocuments({ reporterId: userId }),
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===== ADMIN: GET ALL REPORTS =====
  async getAllReports(query: GetReportsQueryDto) {
    const {
      page = 1,
      limit = 20,
      status,
      reason,
      targetUserId,
      reporterId,
    } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (status) filter.status = status;
    if (reason) filter.reason = reason;
    if (targetUserId) filter.targetUserId = targetUserId;
    if (reporterId) filter.reporterId = reporterId;

    const [reports, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .populate('reporterId', 'name email photos')
        .populate('targetUserId', 'name email photos accountStatus')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reportModel.countDocuments(filter),
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===== ADMIN: GET REPORT DETAIL =====
  async getReportDetail(reportId: string) {
    const report = await this.reportModel
      .findById(reportId)
      .populate('reporterId', 'name email photos dateOfBirth basic')
      .populate(
        'targetUserId',
        'name email photos dateOfBirth basic accountStatus warningCount',
      )
      .populate('reviewedBy', 'name email')
      .lean();

    if (!report) {
      throw new NotFoundException('Báo cáo không tồn tại');
    }

    // Get report history of target user
    const targetReportCount = await this.reportModel.countDocuments({
      targetUserId: report.targetUserId,
    });

    return {
      ...report,
      targetUserStats: {
        totalReports: targetReportCount,
      },
    };
  }

  // ===== ADMIN: UPDATE REPORT STATUS =====
  async updateReportStatus(
    reportId: string,
    adminId: string,
    dto: UpdateReportStatusDto,
  ) {
    const report = await this.reportModel.findById(reportId);
    if (!report) {
      throw new NotFoundException('Báo cáo không tồn tại');
    }

    report.status = dto.status;
    if (dto.adminNote) {
      report.adminNote = dto.adminNote;
    }

    if (
      dto.status === ReportStatus.REVIEWING ||
      dto.status === ReportStatus.RESOLVED
    ) {
      report.reviewedBy = adminId as any;
      report.reviewedAt = new Date();
    }

    await report.save();

    return {
      message: 'Cập nhật trạng thái thành công',
      report,
    };
  }

  // ===== ADMIN: RESOLVE REPORT (TAKE ACTION) =====
  async resolveReport(
    reportId: string,
    adminId: string,
    dto: ResolveReportDto,
  ) {
    const report = await this.reportModel
      .findById(reportId)
      .populate('targetUserId');
    if (!report) {
      throw new NotFoundException('Báo cáo không tồn tại');
    }

    if (report.status === ReportStatus.RESOLVED) {
      throw new BadRequestException('Báo cáo đã được xử lý rồi');
    }

    const targetUser = await this.userModel.findById(report.targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User bị báo cáo không tồn tại');
    }

    // Update report
    report.status = ReportStatus.RESOLVED;
    report.adminAction = dto.action;
    report.adminNote = dto.adminNote;
    report.reviewedBy = adminId as any;
    report.reviewedAt = new Date();

    // Take action on user
    switch (dto.action) {
      case AdminAction.WARNING:
        targetUser.warningCount = (targetUser.warningCount || 0) + 1;
        targetUser.lastWarningAt = new Date();
        report.restrictionDays = undefined;
        report.restrictedFeatures = undefined;
        report.banUntil = undefined;
        break;

      case AdminAction.RESTRICTED:
        if (!dto.restrictionDays || !dto.restrictedFeatures) {
          throw new BadRequestException(
            'Cần cung cấp thời gian và tính năng bị hạn chế',
          );
        }
        const restrictedUntil = new Date();
        restrictedUntil.setDate(
          restrictedUntil.getDate() + dto.restrictionDays,
        );

        targetUser.isRestricted = true;
        targetUser.accountStatus = AccountStatus.RESTRICTED;
        targetUser.restrictionReason = `Báo cáo: ${report.reason}`;
        targetUser.restrictedUntil = restrictedUntil;
        targetUser.restrictedFeatures = dto.restrictedFeatures;

        report.restrictionDays = dto.restrictionDays;
        report.restrictedFeatures = dto.restrictedFeatures;
        break;

      case AdminAction.BANNED:
        targetUser.isBanned = true;
        targetUser.accountStatus = AccountStatus.BANNED;
        targetUser.banReason = `Báo cáo: ${report.reason} - ${dto.adminNote}`;
        targetUser.bannedAt = new Date();
        targetUser.banUntil = dto.banUntil || undefined;
        targetUser.bannedBy = adminId as any;

        report.banUntil = dto.banUntil;
        break;

      case AdminAction.NO_ACTION:
        // Do nothing to user
        break;
    }

    await Promise.all([report.save(), targetUser.save()]);

    return {
      message: 'Đã xử lý báo cáo thành công',
      action: dto.action,
      report,
      targetUser: {
        _id: targetUser._id,
        name: targetUser.name,
        accountStatus: targetUser.accountStatus,
        isBanned: targetUser.isBanned,
        isRestricted: targetUser.isRestricted,
        warningCount: targetUser.warningCount,
      },
    };
  }

  // ===== ADMIN: GET REPORT STATISTICS =====
  async getReportStatistics() {
    const [
      totalReports,
      pendingReports,
      reviewingReports,
      resolvedReports,
      reportsByReason,
    ] = await Promise.all([
      this.reportModel.countDocuments(),
      this.reportModel.countDocuments({ status: ReportStatus.PENDING }),
      this.reportModel.countDocuments({ status: ReportStatus.REVIEWING }),
      this.reportModel.countDocuments({ status: ReportStatus.RESOLVED }),
      this.reportModel.aggregate([
        {
          $group: {
            _id: '$reason',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      totalReports,
      pendingReports,
      reviewingReports,
      resolvedReports,
      reportsByReason,
    };
  }
}
