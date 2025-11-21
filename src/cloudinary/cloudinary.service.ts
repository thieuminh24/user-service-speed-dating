// src/cloudinary/cloudinary.service.ts (Fixed)
import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { UploadApiResponse, v2 as cloudinaryLib } from 'cloudinary';
import toStream from 'buffer-to-stream';

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject('CLOUDINARY') private readonly cloudinary: typeof cloudinaryLib,
  ) {}

  async uploadImage(file: Express.Multer.File): Promise<UploadApiResponse> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Calculate timestamp để tránh stale request
    const timestamp = Math.round(Date.now() / 1000);

    console.log('🕐 Cloudinary upload:', {
      timestamp,
      serverTime: new Date().toISOString(),
      fileName: file.originalname,
      fileSize: file.size,
    });

    return new Promise((resolve, reject) => {
      const upload = this.cloudinary.uploader.upload_stream(
        {
          folder: 'dating-app/profiles',
          transformation: [{ width: 500, height: 500, crop: 'fill' }],
          timestamp, // ← FIX: Add timestamp
          resource_type: 'auto', // ← Support cả image và file
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary error:', error);
            return reject(error);
          }
          console.log('✅ Upload success:', result!.secure_url);
          resolve(result!);
        },
      );

      toStream(file.buffer).pipe(upload);
    });
  }

  // Method riêng cho chat files (không transform)
  async uploadFile(file: Express.Multer.File): Promise<UploadApiResponse> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const timestamp = Math.round(Date.now() / 1000);

    console.log('📎 Cloudinary file upload:', {
      timestamp,
      serverTime: new Date().toISOString(),
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    return new Promise((resolve, reject) => {
      const upload = this.cloudinary.uploader.upload_stream(
        {
          folder: 'dating-app/chat-files', // ← Folder riêng cho chat
          timestamp, // ← FIX: Add timestamp
          resource_type: 'auto', // ← Auto detect (image/video/raw)
          // Không transform cho chat files
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary file upload error:', error);
            return reject(error);
          }
          console.log('✅ File upload success:', result!.secure_url);
          resolve(result!);
        },
      );

      toStream(file.buffer).pipe(upload);
    });
  }

  async deleteImage(publicId: string): Promise<any> {
    return this.cloudinary.uploader.destroy(publicId);
  }
}
