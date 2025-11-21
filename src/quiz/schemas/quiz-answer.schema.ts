// src/quiz/schemas/quiz-answer.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class QuizAnswer extends Document {
  @Prop({ type: Types.ObjectId, ref: 'QuizSession', required: true })
  sessionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: [
      {
        _id: false,
        questionId: {
          type: Types.ObjectId,
          ref: 'QuizQuestion',
          required: true,
        },
        selectedOption: { type: String, required: true }, // a, b, c, d
      },
    ],
    required: true,
    validate: {
      validator: function (answers: any[]) {
        return answers.length === 10; // Must answer all 10 questions
      },
      message: 'Must answer all 10 questions',
    },
  })
  answers: Array<{
    questionId: Types.ObjectId;
    selectedOption: string;
  }>;

  @Prop({ type: Date })
  submittedAt: Date;

  @Prop({ type: Date })
  createdAt: Date;
}

export const QuizAnswerSchema = SchemaFactory.createForClass(QuizAnswer);

// Indexes
QuizAnswerSchema.index({ sessionId: 1, userId: 1 }, { unique: true });
QuizAnswerSchema.index({ userId: 1, createdAt: -1 });
