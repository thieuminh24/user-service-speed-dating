// src/ai-chat/schemas/ai-chat.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MessageRole = 'user' | 'assistant';

@Schema({ _id: false })
export class ChatMessage {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role: MessageRole;

  @Prop({ required: true })
  content: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

@Schema({ timestamps: true })
export class AiChat extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: [ChatMessageSchema], default: [] })
  messages: ChatMessage[];

  @Prop({ type: Date })
  lastMessageAt: Date;

  // Lưu context user để AI hiểu (không lưu vào messages)
  @Prop({ type: Object })
  userContext?: {
    name: string;
    age?: number;
    gender?: string;
    lookingFor?: string;
    aboutMe?: string;
  };
}

export const AiChatSchema = SchemaFactory.createForClass(AiChat);

// Index để tìm nhanh
AiChatSchema.index({ userId: 1 });
AiChatSchema.index({ lastMessageAt: -1 });
