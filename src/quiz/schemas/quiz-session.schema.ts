// src/quiz/schemas/quiz-session.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum QuizSessionStatus {
  PENDING = 'pending', // User A invited, waiting for User B
  IN_PROGRESS = 'in_progress', // Both accepted, answering questions
  COMPLETED = 'completed', // Both submitted, result calculated
  EXPIRED = 'expired', // Not completed within time limit
}

@Schema({ timestamps: true })
export class QuizSession extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Match', required: true })
  matchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  initiator: Types.ObjectId; // User who sent invitation

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  participant: Types.ObjectId; // Other user

  // SỬA CHỖ NÀY – QUAN TRỌNG NHẤT!
  @Prop({
    type: [Types.ObjectId], // Dùng [Types.ObjectId] thay vì mảng phức tạp
    ref: 'QuizQuestion', // ref đặt trực tiếp ở đây
    required: true,
  })
  questions: Types.ObjectId[]; // hoặc bạn có thể để là any[] nếu muốn

  @Prop({
    type: String,
    enum: QuizSessionStatus,
    default: QuizSessionStatus.PENDING,
  })
  status: QuizSessionStatus;

  // Track who submitted
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  submittedBy: Types.ObjectId[];

  @Prop({ type: Date })
  startedAt?: Date; // When status changed to in_progress

  @Prop({ type: Date })
  completedAt?: Date; // When both submitted

  @Prop({ type: Date })
  expiresAt?: Date; // Auto-expire after 24h

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const QuizSessionSchema = SchemaFactory.createForClass(QuizSession);

// Indexes
QuizSessionSchema.index({ matchId: 1, status: 1 });
QuizSessionSchema.index({ initiator: 1, participant: 1 });
QuizSessionSchema.index({ status: 1, expiresAt: 1 });
QuizSessionSchema.index({ createdAt: -1 });
