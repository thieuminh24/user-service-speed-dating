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
}

export const MatchSchema = SchemaFactory.createForClass(Match);

// Index để tìm match của user
MatchSchema.index({ user1: 1, user2: 1 });
MatchSchema.index({ user2: 1 });
