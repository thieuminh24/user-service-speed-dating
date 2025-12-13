// src/verification/verification.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import {
  Verification,
  VerificationSchema,
} from './schemas/verification.schema';
import { UsersModule } from '../users/users.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Verification.name, schema: VerificationSchema },
    ]),
    UsersModule, // Để truy cập User model
    CloudinaryModule, // Để upload ảnh
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
