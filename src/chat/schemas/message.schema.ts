// src/chat/schemas/message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  QUIZ_INVITE = 'quiz_invite', // ← NEW
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ type: String, enum: MessageType, required: true })
  type: MessageType;

  @Prop({ type: String })
  content?: string;

  @Prop({ type: String })
  fileUrl?: string;

  @Prop({ type: String })
  fileName?: string;

  @Prop({ type: Number })
  fileSize?: number;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo?: Types.ObjectId;

  // ===== QUIZ INVITE FIELD =====
  @Prop({ type: Types.ObjectId, ref: 'QuizSession' })
  quizSessionId?: Types.ObjectId;

  @Prop({ type: Map, of: String, default: {} })
  readStatus: Map<string, MessageStatus>;

  @Prop({ type: Map, of: Date, default: {} })
  readAt: Map<string, Date>;

  @Prop({ type: Number, default: 0 })
  reactionsCount: number;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  deletedBy?: Types.ObjectId;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, isDeleted: 1 });
