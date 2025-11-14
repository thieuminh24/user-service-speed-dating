// src/matching/schemas/match.schema.ts (Updated)
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Match extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user1: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user2: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  matchedAt: Date;

  @Prop({ default: false })
  isDeleted: boolean; // ← THÊM FIELD NÀY
}

export const MatchSchema = SchemaFactory.createForClass(Match);

// Index để tìm match của user
MatchSchema.index({ user1: 1, user2: 1 });
MatchSchema.index({ user2: 1 });
MatchSchema.index({ isDeleted: 1 }); // ← THÊM INDEX
