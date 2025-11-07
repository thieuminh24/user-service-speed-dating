// src/cloudinary/cloudinary.service.ts
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

    return new Promise((resolve, reject) => {
      const upload = this.cloudinary.uploader.upload_stream(
        {
          folder: 'dating-app/profiles',
          transformation: [{ width: 500, height: 500, crop: 'fill' }],
        },
        (error, result) => {
          if (error) return reject(error);
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
