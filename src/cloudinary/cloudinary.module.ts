// src/cloudinary/cloudinary.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryProvider } from './cloudinary.provider'; // ← ĐÚNG
import { CloudinaryConfigProvider } from './cloudinary-config.provider'; // ← ĐÚNG

@Module({
  imports: [ConfigModule],
  providers: [CloudinaryService, CloudinaryProvider, CloudinaryConfigProvider],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
