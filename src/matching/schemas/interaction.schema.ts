// src/matching/schemas/interaction.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum InteractionType {
  LIKE = 'like',
  PASS = 'pass',
}

@Schema({ timestamps: true })
export class Interaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  fromUser: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  toUser: Types.ObjectId;

  @Prop({ type: String, enum: InteractionType, required: true })
  type: InteractionType;

  // Index để tìm nhanh: "A đã like B chưa?"
  @Prop()
  uniqueKey?: string;
}

export const InteractionSchema = SchemaFactory.createForClass(Interaction);

// Tạo compound index: 1 người chỉ like/pass 1 người 1 lần
InteractionSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });
InteractionSchema.index({ toUser: 1, type: 1 });
