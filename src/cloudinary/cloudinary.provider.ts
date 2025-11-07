// src/cloudinary/cloudinary.provider.ts
import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_CONFIG, CloudinaryConfig } from './constants';

export const CloudinaryProvider = {
  // ← ĐÃ CÓ
  provide: 'CLOUDINARY',
  useFactory: (config: CloudinaryConfig) => {
    cloudinary.config({
      cloud_name: config.cloud_name,
      api_key: config.api_key,
      api_secret: config.api_secret,
    });
    return cloudinary;
  },
  inject: [CLOUDINARY_CONFIG],
};
