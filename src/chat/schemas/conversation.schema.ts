import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  BLOCKED = 'blocked',
}

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    required: true,
    unique: true, // ← CRITICAL: Add unique constraint
  })
  matchId: Types.ObjectId;

  // CORRECT: Dùng mongoose.Schema.Types.ObjectId và ref trực tiếp
  @Prop({
    type: [Types.ObjectId], // mảng ObjectId
    ref: 'User',
    required: true,
  })
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

  @Prop({ type: Map, of: Number, default: {} })
  unreadCount: Map<string, number>;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  blockedBy: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  unmatchedBy?: Types.ObjectId;

  @Prop({ type: Date })
  unmatchedAt?: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

/// Unique index cho matchId (đã đúng)
ConversationSchema.index({ matchId: 1 }, { unique: true });

// (Tùy chọn) Tạo index cho query nhanh hơn
ConversationSchema.index({ participants: 1, status: 1 });
ConversationSchema.index({ unreadCount: 1 });
