// src/reports/schemas/report.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum ReportReason {
  SCAM = 'scam',
  FAKE_ACCOUNT = 'fake_account',
  SEXUAL_CONTENT = 'sexual_content',
  VIOLENCE = 'violence',
  SPAM = 'spam',
  UNDERAGE = 'underage',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  RESOLVED = 'resolved',
}

export enum AdminAction {
  WARNING = 'warning',
  RESTRICTED = 'restricted',
  BANNED = 'banned',
  NO_ACTION = 'no_action',
}

@Schema({ timestamps: true })
export class Report extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  reporterId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  targetUserId: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ReportReason), required: true })
  reason: ReportReason;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  attachedFiles: string[]; // Cloudinary URLs (max 3)

  @Prop({
    type: String,
    enum: Object.values(ReportStatus),
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  // Admin handling
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  reviewedBy?: MongooseSchema.Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop()
  adminNote?: string;

  @Prop({ type: String, enum: Object.values(AdminAction) })
  adminAction?: AdminAction;

  // Action details
  @Prop({ type: Number })
  restrictionDays?: number;

  @Prop({ type: [String] })
  restrictedFeatures?: string[];

  @Prop({ type: Date })
  banUntil?: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Indexes
ReportSchema.index({ reporterId: 1, createdAt: -1 });
ReportSchema.index({ targetUserId: 1, createdAt: -1 });
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ reason: 1 });
