// src/users/users.module.ts (UPDATED)
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { AdminUserController } from './admin-user.controller'; // ← THÊM
import { UsersService } from './users.service';
import { AdminUserService } from './admin-user.service'; // ← THÊM
import { User, UserSchema } from './schemas/user.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    CloudinaryModule,
  ],
  controllers: [
    UsersController,
    AdminUserController, // ← THÊM
  ],
  providers: [
    UsersService,
    AdminUserService, // ← THÊM
  ],
  exports: [UsersService, AdminUserService, MongooseModule], // ← Export AdminUserService
})
export class UsersModule {}
