// src/quiz/schemas/quiz-result.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class QuizResult extends Document {
  @Prop({ type: Types.ObjectId, ref: 'QuizSession', required: true })
  sessionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Match', required: true })
  matchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user1: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user2: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 100 })
  compatibilityScore: number; // 0-100%

  @Prop({ required: true })
  totalQuestions: number; // Always 10

  @Prop({ required: true })
  matchedAnswers: number; // Number of matching answers

  // Breakdown by category
  @Prop({
    type: {
      personality: { type: Number, default: 0 },
      lifestyle: { type: Number, default: 0 },
      values: { type: Number, default: 0 },
      entertainment: { type: Number, default: 0 },
    },
    default: {},
  })
  categoryScores: {
    personality: number;
    lifestyle: number;
    values: number;
    entertainment: number;
  };

  // Detailed comparison (optional, for showing which answers matched)
  @Prop({
    type: [
      {
        _id: false,
        questionId: { type: Types.ObjectId, ref: 'QuizQuestion' },
        user1Answer: { type: String },
        user2Answer: { type: String },
        matched: { type: Boolean },
      },
    ],
    default: [],
  })
  detailedComparison: Array<{
    questionId: Types.ObjectId;
    user1Answer: string;
    user2Answer: string;
    matched: boolean;
  }>;

  @Prop({ type: Date, default: Date.now })
  calculatedAt: Date;

  @Prop({ type: Date })
  createdAt: Date;
}

export const QuizResultSchema = SchemaFactory.createForClass(QuizResult);

// Indexes
QuizResultSchema.index({ sessionId: 1 }, { unique: true });
QuizResultSchema.index({ matchId: 1, createdAt: -1 });
QuizResultSchema.index({ user1: 1, user2: 1 });
QuizResultSchema.index({ compatibilityScore: -1 });
