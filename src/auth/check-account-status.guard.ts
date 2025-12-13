// src/auth/check-account-status.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { AccountStatus } from 'src/common/enums';

/**
 * Guard to check if user is banned or restricted
 * Use this guard after JwtAuthGuard on protected routes
 */
@Injectable()
export class CheckAccountStatusGuard implements CanActivate {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Unauthorized');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Check if banned
    if (user.isBanned) {
      const message = user.banUntil
        ? `Tài khoản của bạn đã bị khoá đến ${user.banUntil.toLocaleDateString('vi-VN')}. Lý do: ${user.banReason}`
        : `Tài khoản của bạn đã bị khoá vĩnh viễn. Lý do: ${user.banReason}`;

      throw new ForbiddenException({
        statusCode: 403,
        message,
        error: 'Account Banned',
        banReason: user.banReason,
        banUntil: user.banUntil,
      });
    }

    // Check if restricted (warning only, not blocking)
    if (user.isRestricted) {
      // You can add custom logic here to check specific features
      // For example, block "like" action if 'like' is in restrictedFeatures
      request.user.isRestricted = true;
      request.user.restrictedFeatures = user.restrictedFeatures;
    }

    // Auto-unban if ban period expired
    if (user.banUntil && user.banUntil < new Date()) {
      user.isBanned = false;
      user.accountStatus = AccountStatus.ACTIVE;
      user.banReason = undefined;
      user.bannedAt = undefined;
      user.banUntil = undefined;
      await user.save();
    }

    // Auto-unrestrict if restriction period expired
    if (user.restrictedUntil && user.restrictedUntil < new Date()) {
      user.isRestricted = false;
      user.accountStatus = AccountStatus.ACTIVE;
      user.restrictionReason = undefined;
      user.restrictedUntil = undefined;
      user.restrictedFeatures = [];
      await user.save();
    }

    return true;
  }
}

// ========================================
// USAGE: Add to any protected route
// ========================================

// Example in users.controller.ts:
/*
import { CheckAccountStatusGuard } from '../auth/check-account-status.guard';

@UseGuards(JwtAuthGuard, CheckAccountStatusGuard)
@Get('profile')
async getProfile(@Req() req: any) {
  // If user reaches here, they are not banned
  return this.usersService.getProfile(req.user.userId);
}
*/
