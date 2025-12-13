// src/verification/verification.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Verification,
  VerificationStatus,
} from './schemas/verification.schema';
import { User } from '../users/schemas/user.schema';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';

@Injectable()
export class VerificationService {
  constructor(
    @InjectModel(Verification.name)
    private verificationModel: Model<Verification>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  // ===== USER: Submit verification request =====
  async submitVerification(userId: string, dto: SubmitVerificationDto) {
    // Kiểm tra user đã verify chưa
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User không tồn tại');

    if (user.isPhotoVerified) {
      throw new BadRequestException('Tài khoản đã được xác thực rồi');
    }

    // Kiểm tra có pending request không
    const pendingRequest = await this.verificationModel.findOne({
      userId,
      status: VerificationStatus.PENDING,
    });

    if (pendingRequest) {
      throw new BadRequestException('Bạn đã có yêu cầu đang chờ xét duyệt');
    }

    // Tạo verification request mới
    const verification = await this.verificationModel.create({
      userId,
      selfieUrl: dto.selfieUrl,
      idCardUrls: dto.idCardUrls,
      status: VerificationStatus.PENDING,
      submittedAt: new Date(),
    });

    // Cập nhật user status
    user.verificationStatus = VerificationStatus.PENDING;
    await user.save();

    return {
      message: 'Yêu cầu xác thực đã được gửi thành công',
      verificationId: verification._id,
      status: verification.status,
    };
  }

  // ===== USER: Get own verification status =====
  async getMyVerificationStatus(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('isPhotoVerified verificationStatus');
    if (!user) throw new NotFoundException('User không tồn tại');

    // Lấy verification request gần nhất
    const latestRequest = await this.verificationModel
      .findOne({ userId })
      .sort({ createdAt: -1 })
      .select('-idCardUrls -selfieUrl'); // Không trả về ảnh cho user

    return {
      isPhotoVerified: user.isPhotoVerified || false,
      verificationStatus: user.verificationStatus || VerificationStatus.PENDING,
      latestRequest: latestRequest
        ? {
            _id: latestRequest._id,
            status: latestRequest.status,
            submittedAt: latestRequest.submittedAt,
            rejectionReason: latestRequest.rejectionReason,
            reviewedAt: latestRequest.reviewedAt,
          }
        : null,
    };
  }

  // ===== ADMIN: Get all pending verifications =====
  async getPendingVerifications() {
    const verifications = await this.verificationModel
      .find({ status: VerificationStatus.PENDING })
      .populate('userId', 'name email photos') // Lấy info user
      .sort({ submittedAt: 1 }); // Cũ nhất trước

    return verifications;
  }

  // ===== ADMIN: Get verification detail =====
  async getVerificationDetail(verificationId: string) {
    const verification = await this.verificationModel
      .findById(verificationId)
      .populate('userId', 'name email photos dateOfBirth')
      .populate('reviewedBy', 'name email');

    if (!verification) {
      throw new NotFoundException('Verification request không tồn tại');
    }

    return verification;
  }

  // ===== ADMIN: Review verification =====
  async reviewVerification(
    verificationId: string,
    adminId: string,
    dto: ReviewVerificationDto,
  ) {
    const verification = await this.verificationModel.findById(verificationId);
    if (!verification) {
      throw new NotFoundException('Verification request không tồn tại');
    }

    if (verification.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Yêu cầu này đã được xử lý rồi');
    }

    // Kiểm tra admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    // Cập nhật verification
    verification.status = dto.status;
    verification.reviewedBy = admin._id as any;
    verification.reviewedAt = new Date();

    if (dto.status === VerificationStatus.REJECTED) {
      verification.rejectionReason = dto.rejectionReason || 'Không đạt yêu cầu';
    }

    await verification.save();

    // Cập nhật user
    const user = await this.userModel.findById(verification.userId);
    if (user) {
      if (dto.status === VerificationStatus.APPROVED) {
        user.isPhotoVerified = true;
        user.verificationStatus = VerificationStatus.APPROVED;
      } else if (dto.status === VerificationStatus.REJECTED) {
        user.isPhotoVerified = false;
        user.verificationStatus = VerificationStatus.REJECTED;
      }
      await user.save();
    }

    return {
      message:
        dto.status === VerificationStatus.APPROVED
          ? 'Đã phê duyệt verification'
          : 'Đã từ chối verification',
      verification,
    };
  }

  // ===== ADMIN: Get all verifications (with filter) =====
  async getAllVerifications(status?: VerificationStatus) {
    const query = status ? { status } : {};

    const verifications = await this.verificationModel
      .find(query)
      .populate('userId', 'name email photos')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    return verifications;
  }
}
