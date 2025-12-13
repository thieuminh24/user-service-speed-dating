// src/verification/schemas/verification.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Verification extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  // Ảnh selfie
  @Prop({ required: true })
  selfieUrl: string;

  // Ảnh CCCD (mặt trước + mặt sau)
  @Prop({
    type: [String],
    required: true,
    validate: [arrayLimit, 'Cần đúng 2 ảnh CCCD'],
  })
  idCardUrls: string[];

  // Trạng thái
  @Prop({
    type: String,
    enum: Object.values(VerificationStatus),
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  // Lý do từ chối (nếu có)
  @Prop()
  rejectionReason?: string;

  // Admin review
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  reviewedBy?: MongooseSchema.Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  // Thời gian submit
  @Prop({ type: Date, default: Date.now })
  submittedAt: Date;
}

// Validate đúng 2 ảnh CCCD
function arrayLimit(val: string[]) {
  return val.length === 2;
}

export const VerificationSchema = SchemaFactory.createForClass(Verification);

// Index để query nhanh
VerificationSchema.index({ userId: 1 });
VerificationSchema.index({ status: 1, createdAt: -1 });
