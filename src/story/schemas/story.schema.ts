// src/story/schemas/story.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum StoryType {
  TEXT = 'text',
  VIDEO = 'video',
}

export enum TextAlign {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right',
}

export interface StoryDocument extends Story, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Story extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(StoryType), required: true })
  type: StoryType;

  // FOR TEXT STORY
  @Prop({ type: String })
  text?: string;

  @Prop({ type: String })
  textColor?: string; // hex color

  @Prop({ type: String })
  fontFamily?: string; // 'Inter', 'Roboto', 'Pacifico', etc.

  @Prop({ type: Number, default: 32 })
  fontSize?: number;

  @Prop({
    type: String,
    enum: Object.values(TextAlign),
    default: TextAlign.CENTER,
  })
  textAlign?: TextAlign;

  @Prop({ type: Boolean, default: false })
  textBold?: boolean;

  @Prop({ type: Boolean, default: false })
  textItalic?: boolean;

  @Prop({ type: String })
  backgroundColor?: string; // gradient CSS string: "linear-gradient(...)"

  // FOR VIDEO STORY
  @Prop({ type: String })
  videoUrl?: string;

  @Prop({ type: String })
  thumbnailUrl?: string;

  @Prop({ type: Number })
  videoDuration?: number; // seconds

  // COMMON
  @Prop({
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  expiresAt: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  viewedBy: Types.ObjectId[];

  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const StorySchema = SchemaFactory.createForClass(Story);

// Indexes
StorySchema.index({ userId: 1, expiresAt: 1 });
StorySchema.index({ expiresAt: 1 }); // For TTL cleanup
StorySchema.index({ isDeleted: 1 });

// TTL Index - tự động xóa sau khi expires
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
