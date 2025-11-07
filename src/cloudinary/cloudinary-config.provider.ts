// src/cloudinary/cloudinary-config.provider.ts
import { ConfigService } from '@nestjs/config';
import { CLOUDINARY_CONFIG, CloudinaryConfig } from './constants';

export const CloudinaryConfigProvider = {
  // ← ĐÃ CÓ
  provide: CLOUDINARY_CONFIG,
  useFactory: (configService: ConfigService): CloudinaryConfig => ({
    cloud_name: configService.get('CLOUDINARY_CLOUD_NAME')!,
    api_key: configService.get('CLOUDINARY_API_KEY')!,
    api_secret: configService.get('CLOUDINARY_API_SECRET')!,
  }),
  inject: [ConfigService],
};
