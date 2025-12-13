// services/verification/face-verification.service.ts
import * as faceapi from 'face-api.js';

export interface FaceMatchResult {
  isMatch: boolean;
  confidence: number; // 0-100
  distance: number; // 0-1
  message: string;
}

export interface ImageQualityResult {
  isGoodQuality: boolean;
  issues: string[];
  score: number; // 0-100
  details: {
    resolution: { width: number; height: number; isGood: boolean };
    brightness: { value: number; isGood: boolean };
    blur: { value: number; isGood: boolean };
  };
}

export class FaceVerificationService {
  private modelsLoaded = false;
  private modelsPath = '/models'; // Public folder

  /**
   * Load Face-API.js models (chỉ cần load 1 lần)
   */
  async loadModels() {
    if (this.modelsLoaded) return;

    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(this.modelsPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.modelsPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.modelsPath),
      ]);
      this.modelsLoaded = true;
      console.log('✅ Face-API models loaded');
    } catch (error) {
      console.error('❌ Failed to load models:', error);
      throw new Error('Không thể tải mô hình AI. Vui lòng thử lại.');
    }
  }

  /**
   * So khớp 2 khuôn mặt
   */
  async matchFaces(
    selfieFile: File,
    idCardFile: File,
  ): Promise<FaceMatchResult> {
    await this.loadModels();

    // Load images
    const [selfieImg, idCardImg] = await Promise.all([
      this.loadImage(selfieFile),
      this.loadImage(idCardFile),
    ]);

    // Detect faces
    const selfieDetection = await faceapi
      .detectSingleFace(selfieImg)
      .withFaceLandmarks()
      .withFaceDescriptor();

    const idCardDetection = await faceapi
      .detectSingleFace(idCardImg)
      .withFaceLandmarks()
      .withFaceDescriptor();

    // Validation
    if (!selfieDetection) {
      return {
        isMatch: false,
        confidence: 0,
        distance: 1,
        message: 'Không tìm thấy khuôn mặt trong ảnh selfie',
      };
    }

    if (!idCardDetection) {
      return {
        isMatch: false,
        confidence: 0,
        distance: 1,
        message: 'Không tìm thấy khuôn mặt trong ảnh CCCD',
      };
    }

    // Calculate distance (0 = giống hệt, 1 = hoàn toàn khác)
    const distance = faceapi.euclideanDistance(
      selfieDetection.descriptor,
      idCardDetection.descriptor,
    );

    // Convert to confidence (0-100)
    const confidence = Math.round((1 - distance) * 100);

    // Determine match (threshold: 0.6)
    const isMatch = distance < 0.6;

    return {
      isMatch,
      confidence,
      distance,
      message: isMatch
        ? `Khớp với độ tin cậy ${confidence}%`
        : confidence > 50
          ? `Có thể khớp (${confidence}%) - Cần xem xét thêm`
          : `Không khớp (${confidence}%)`,
    };
  }

  /**
   * Kiểm tra chất lượng ảnh
   */
  async checkImageQuality(file: File): Promise<ImageQualityResult> {
    const img = await this.loadImage(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 1. Check resolution
    const minResolution = 800;
    const resolutionGood =
      img.width >= minResolution && img.height >= minResolution;

    // 2. Check brightness (average RGB)
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += (r + g + b) / 3;
    }
    const avgBrightness = totalBrightness / (data.length / 4);
    const brightnessGood = avgBrightness > 50 && avgBrightness < 220;

    // 3. Check blur (Laplacian variance)
    const blurValue = this.calculateBlur(canvas);
    const blurGood = blurValue > 100; // Higher = sharper

    // Collect issues
    const issues: string[] = [];
    if (!resolutionGood) {
      issues.push(
        `Độ phân giải thấp (${img.width}x${img.height}). Nên >= ${minResolution}px`,
      );
    }
    if (!brightnessGood) {
      issues.push(avgBrightness < 50 ? 'Ảnh quá tối' : 'Ảnh quá sáng (bị lóa)');
    }
    if (!blurGood) {
      issues.push('Ảnh bị mờ. Vui lòng chụp lại');
    }

    // Calculate overall score
    const score = Math.round(
      (resolutionGood ? 40 : 0) +
        (brightnessGood
          ? 30
          : avgBrightness > 30 && avgBrightness < 240
            ? 20
            : 0) +
        (blurGood ? 30 : blurValue > 50 ? 15 : 0),
    );

    return {
      isGoodQuality: issues.length === 0,
      issues,
      score,
      details: {
        resolution: {
          width: img.width,
          height: img.height,
          isGood: resolutionGood,
        },
        brightness: {
          value: Math.round(avgBrightness),
          isGood: brightnessGood,
        },
        blur: { value: Math.round(blurValue), isGood: blurGood },
      },
    };
  }

  /**
   * Calculate blur using Laplacian variance
   */
  private calculateBlur(canvas: HTMLCanvasElement): number {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and calculate Laplacian
    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    // Simple Laplacian (approximation)
    let variance = 0;
    const w = canvas.width;
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const idx = y * w + x;
        const laplacian = Math.abs(
          4 * gray[idx] -
            gray[idx - 1] -
            gray[idx + 1] -
            gray[idx - w] -
            gray[idx + w],
        );
        variance += laplacian * laplacian;
      }
    }

    return variance / (canvas.width * canvas.height);
  }

  /**
   * Load image from File
   */
  private async loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Extract face from image (for preview)
   */
  async extractFace(file: File): Promise<string | null> {
    await this.loadModels();
    const img = await this.loadImage(file);

    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks();

    if (!detection) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const box = detection.detection.box;
    const padding = 50;

    canvas.width = box.width + padding * 2;
    canvas.height = box.height + padding * 2;

    ctx.drawImage(
      img,
      box.x - padding,
      box.y - padding,
      box.width + padding * 2,
      box.height + padding * 2,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  }
}

// Singleton instance
export const faceVerificationService = new FaceVerificationService();
