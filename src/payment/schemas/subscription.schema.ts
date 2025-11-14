// src/payment/schemas/subscription.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { SubscriptionTier } from '../../users/schemas/user.schema';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class Subscription extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(SubscriptionTier),
    required: true,
  })
  tier: SubscriptionTier;

  @Prop({
    type: String,
    enum: Object.values(SubscriptionStatus),
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: false })
  autoRenew: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Transaction' })
  transactionId?: MongooseSchema.Types.ObjectId;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ endDate: 1 });
