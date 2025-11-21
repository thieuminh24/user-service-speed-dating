// src/chat/schemas/message.schema.ts (Updated)
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
  createdAt: Date;
  updatedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({
    type: String,
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  // Nội dung tin nhắn
  @Prop({ type: String })
  content?: string;

  // Cho image/file
  @Prop({ type: String })
  fileUrl?: string;

  @Prop({ type: String })
  fileName?: string;

  @Prop({ type: Number })
  fileSize?: number;

  // ← NEW: For quiz invite
  @Prop({ type: Types.ObjectId, ref: 'QuizSession' })
  quizSessionId?: Types.ObjectId;

  // Reply to message
  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo?: Types.ObjectId;

  // Message status cho mỗi participant
  @Prop({
    type: Map,
    of: String,
    default: {},
  })
  readStatus: Map<string, MessageStatus>;

  // Thời gian đọc
  @Prop({
    type: Map,
    of: Date,
    default: {},
  })
  readAt: Map<string, Date>;

  // Soft delete
  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  deletedBy?: Types.ObjectId;

  @Prop({ type: Date })
  deletedAt?: Date;

  // Reactions count
  @Prop({ type: Number, default: 0 })
  reactionsCount: number;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indexes
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ isDeleted: 1 });
