// src/auth/admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId; // Từ JwtAuthGuard

    if (!userId) {
      throw new ForbiddenException('Unauthorized');
    }

    const user = await this.userModel.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Bạn không có quyền truy cập tính năng này');
    }

    return true;
  }
}
