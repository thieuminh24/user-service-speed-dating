// src/chat/schemas/message-reaction.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class MessageReaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  emoji: string;
}

export const MessageReactionSchema =
  SchemaFactory.createForClass(MessageReaction);

// Index để đảm bảo 1 user chỉ react 1 emoji cho 1 message
MessageReactionSchema.index({ messageId: 1, userId: 1 }, { unique: true });
MessageReactionSchema.index({ messageId: 1 });
