// src/users/admin-user.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import {
  GetUsersQueryDto,
  BanUserDto,
  RestrictUserDto,
  AdminUpdateUserDto,
} from './dto/admin-user.dto';
import { AccountStatus } from 'src/common/enums';

@Injectable()
export class AdminUserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  // ===== GET ALL USERS (PAGINATED) =====
  async getAllUsers(query: GetUsersQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      verificationStatus,
      subscriptionTier,
      accountStatus,
      isPremium,
      isDeleted,
    } = query;

    const skip = (page - 1) * limit;
    const filter: any = {};

    // Search
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Filters
    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (subscriptionTier) filter.subscriptionTier = subscriptionTier;
    if (accountStatus) filter.accountStatus = accountStatus;
    if (isPremium !== undefined) filter.isPremium = isPremium;
    if (isDeleted !== undefined) filter.isDeleted = isDeleted;

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===== GET USER DETAIL =====
  async getUserDetail(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password')
      .populate('bannedBy', 'name email')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User không tồn tại');
    }

    return user;
  }

  // ===== BAN USER =====
  async banUser(userId: string, adminId: string, dto: BanUserDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User không tồn tại');

    if (user.role === 'admin') {
      throw new BadRequestException('Không thể ban admin');
    }

    user.isBanned = true;
    user.accountStatus = AccountStatus.BANNED;
    user.banReason = dto.reason;
    user.bannedAt = new Date();
    user.banUntil = dto.banUntil || undefined;
    user.bannedBy = adminId as any;

    await user.save();

    return {
      message: dto.banUntil
        ? `User đã bị khoá đến ${dto.banUntil.toLocaleDateString()}`
        : 'User đã bị khoá vĩnh viễn',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isBanned: user.isBanned,
        banReason: user.banReason,
        banUntil: user.banUntil,
      },
    };
  }

  // ===== UNBAN USER =====
  async unbanUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User không tồn tại');

    user.isBanned = false;
    user.accountStatus = AccountStatus.ACTIVE;
    user.banReason = undefined;
    user.bannedAt = undefined;
    user.banUntil = undefined;
    user.bannedBy = undefined;

    await user.save();

    return {
      message: 'User đã được mở khoá',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        accountStatus: user.accountStatus,
      },
    };
  }

  // ===== RESTRICT USER =====
  async restrictUser(userId: string, dto: RestrictUserDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User không tồn tại');

    const restrictedUntil = new Date();
    restrictedUntil.setDate(restrictedUntil.getDate() + dto.days);

    user.isRestricted = true;
    user.accountStatus = AccountStatus.RESTRICTED;
    user.restrictionReason = dto.reason;
    user.restrictedUntil = restrictedUntil;
    user.restrictedFeatures = dto.features;

    await user.save();

    return {
      message: `User bị hạn chế ${dto.days} ngày`,
      user: {
        _id: user._id,
        name: user.name,
        accountStatus: user.accountStatus,
        restrictedUntil: user.restrictedUntil,
        restrictedFeatures: user.restrictedFeatures,
      },
    };
  }

  // ===== UNRESTRICT USER =====
  async unrestrictUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User không tồn tại');

    user.isRestricted = false;
    user.accountStatus = AccountStatus.ACTIVE;
    user.restrictionReason = undefined;
    user.restrictedUntil = undefined;
    user.restrictedFeatures = [];

    await user.save();

    return {
      message: 'Đã gỡ hạn chế user',
      user: {
        _id: user._id,
        name: user.name,
        accountStatus: user.accountStatus,
      },
    };
  }

  // ===== DELETE USER =====
  async deleteUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User không tồn tại');

    if (user.role === 'admin') {
      throw new BadRequestException('Không thể xoá admin');
    }

    user.isDeleted = true;
    await user.save();

    return {
      message: 'User đã bị xoá (soft delete)',
      userId: user._id,
    };
  }

  // ===== ADMIN UPDATE USER =====
  async adminUpdateUser(userId: string, dto: AdminUpdateUserDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User không tồn tại');

    // Update fields
    if (dto.name) user.name = dto.name;
    if (dto.email) user.email = dto.email;
    if (dto.subscriptionTier)
      user.subscriptionTier = dto.subscriptionTier as any;
    if (dto.premiumUntil) user.premiumUntil = dto.premiumUntil;
    if (dto.isPremium !== undefined) user.isPremium = dto.isPremium;
    if (dto.verificationStatus)
      user.verificationStatus = dto.verificationStatus;
    if (dto.isPhotoVerified !== undefined)
      user.isPhotoVerified = dto.isPhotoVerified;

    await user.save();

    return {
      message: 'Cập nhật user thành công',
      user: await this.userModel.findById(userId).select('-password'),
    };
  }

  // ===== GET STATISTICS =====
  async getStatistics() {
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      restrictedUsers,
      premiumUsers,
      verifiedUsers,
      pendingVerifications,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
    ] = await Promise.all([
      this.userModel.countDocuments({ isDeleted: false }),
      this.userModel.countDocuments({
        accountStatus: AccountStatus.ACTIVE,
        isDeleted: false,
      }),
      this.userModel.countDocuments({ isBanned: true, isDeleted: false }),
      this.userModel.countDocuments({ isRestricted: true, isDeleted: false }),
      this.userModel.countDocuments({ isPremium: true, isDeleted: false }),
      this.userModel.countDocuments({
        isPhotoVerified: true,
        isDeleted: false,
      }),
      this.userModel.countDocuments({
        verificationStatus: 'pending',
        isDeleted: false,
      }),
      this.userModel.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        isDeleted: false,
      }),
      this.userModel.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        isDeleted: false,
      }),
      this.userModel.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        isDeleted: false,
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      bannedUsers,
      restrictedUsers,
      premiumUsers,
      verifiedUsers,
      pendingVerifications,
      newUsers: {
        today: newUsersToday,
        thisWeek: newUsersThisWeek,
        thisMonth: newUsersThisMonth,
      },
    };
  }
}
