// src/matching/schemas/match.schema.ts

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

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const MatchSchema = SchemaFactory.createForClass(Match);

// ===== ADD COMPOUND INDEX TO PREVENT DUPLICATE MATCHES =====
MatchSchema.index(
  { user1: 1, user2: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: { $ne: true } },
  },
);
MatchSchema.index(
  { user2: 1, user1: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: { $ne: true } },
  },
);
