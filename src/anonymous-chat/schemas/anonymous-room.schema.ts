// src/anonymous-chat/schemas/anonymous-room.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum RoomStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  TIMEOUT = 'timeout',
}

export enum DisconnectReason {
  USER_LEFT = 'user_left',
  PARTNER_LEFT = 'partner_left',
  IDLE_TIMEOUT = 'idle_timeout',
  CONNECTION_LOST = 'connection_lost',
  SYSTEM_CLOSED = 'system_closed',
}

@Schema({ timestamps: true })
export class AnonymousRoom extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  roomId: string; // Format: "anon_room_{uuid}"

  // ===== PARTICIPANTS =====
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user1: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user2: Types.ObjectId;

  // ===== ANONYMOUS IDENTITIES =====
  @Prop({ type: String, required: true })
  user1AnonymousName: string; // e.g., "Blue Panda"

  @Prop({ type: String, required: true })
  user2AnonymousName: string; // e.g., "Red Fox"

  // ===== ROOM STATUS =====
  @Prop({ type: String, enum: RoomStatus, default: RoomStatus.ACTIVE })
  status: RoomStatus;

  // ===== ACTIVITY TRACKING =====
  @Prop({ type: Date, default: Date.now })
  lastActivityAt: Date;

  @Prop({ type: Number, default: 0 })
  messageCount: number;

  // ===== CLOSURE INFO =====
  @Prop({ type: Date })
  closedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  closedBy?: Types.ObjectId; // Who closed/left the room

  @Prop({ type: String, enum: DisconnectReason })
  disconnectReason?: DisconnectReason;

  // ===== METADATA =====
  @Prop({ type: Date })
  matchedAt: Date; // When the match was created

  @Prop({ type: Number })
  durationSeconds?: number; // Total chat duration
}

export const AnonymousRoomSchema = SchemaFactory.createForClass(AnonymousRoom);

// ===== INDEXES =====
AnonymousRoomSchema.index({ user1: 1, status: 1 });
AnonymousRoomSchema.index({ user2: 1, status: 1 });
AnonymousRoomSchema.index({ status: 1, lastActivityAt: 1 }); // For timeout cleanup
AnonymousRoomSchema.index({ createdAt: 1 }); // For analytics

// ===== VIRTUAL: Calculate duration on query =====
AnonymousRoomSchema.pre('save', function (next) {
  if (this.status === RoomStatus.CLOSED || this.status === RoomStatus.TIMEOUT) {
    if (this.closedAt && this.matchedAt) {
      this.durationSeconds = Math.floor(
        (this.closedAt.getTime() - this.matchedAt.getTime()) / 1000,
      );
    }
  }
  next();
});
