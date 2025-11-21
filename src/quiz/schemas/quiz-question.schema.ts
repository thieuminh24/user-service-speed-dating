// src/quiz/schemas/quiz-question.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum QuizCategory {
  PERSONALITY = 'personality',
  LIFESTYLE = 'lifestyle',
  VALUES = 'values',
  ENTERTAINMENT = 'entertainment',
}

@Schema({ timestamps: true })
export class QuizQuestion extends Document {
  @Prop({ required: true })
  question: string;

  @Prop({
    type: String,
    enum: QuizCategory,
    required: true,
  })
  category: QuizCategory;

  @Prop({
    type: [
      {
        _id: false,
        text: { type: String, required: true },
        value: { type: String, required: true }, // a, b, c, d
      },
    ],
    required: true,
    validate: {
      validator: function (options: any[]) {
        return options.length >= 2 && options.length <= 4;
      },
      message: 'Must have 2-4 options',
    },
  })
  options: Array<{
    text: string;
    value: string;
  }>;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  usageCount: number; // Track how many times used

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const QuizQuestionSchema = SchemaFactory.createForClass(QuizQuestion);

// Indexes
QuizQuestionSchema.index({ category: 1, isActive: 1 });
QuizQuestionSchema.index({ usageCount: -1 });
