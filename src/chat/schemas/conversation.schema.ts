// src/chat/schemas/conversation.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  BLOCKED = 'blocked',
}

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Match', required: true })
  matchId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  participants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastMessage?: Types.ObjectId;

  @Prop({ type: Date })
  lastMessageAt?: Date;

  @Prop({
    type: String,
    enum: ConversationStatus,
    default: ConversationStatus.ACTIVE,
  })
  status: ConversationStatus;

  // Người unmatch/block
  @Prop({ type: Types.ObjectId, ref: 'User' })
  unmatchedBy?: Types.ObjectId;

  @Prop({ type: Date })
  unmatchedAt?: Date;

  // Block settings (nếu 1 trong 2 block nhau)
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  blockedBy: Types.ObjectId[];

  // Unread count cho mỗi user
  @Prop({
    type: Map,
    of: Number,
    default: {},
  })
  unreadCount: Map<string, number>;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes
ConversationSchema.index({ matchId: 1 }, { unique: true });
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ status: 1 });
