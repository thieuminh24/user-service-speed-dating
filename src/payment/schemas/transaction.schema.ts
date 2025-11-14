// src/payment/schemas/transaction.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum PaymentGateway {
  STRIPE = 'stripe',
  VNPAY = 'vnpay',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum ProductType {
  PREMIUM_MONTHLY = 'premium_monthly',
  PREMIUM_YEARLY = 'premium_yearly',
  VIP_MONTHLY = 'vip_monthly',
  VIP_YEARLY = 'vip_yearly',
  SUPER_LIKE = 'super_like',
  BOOST = 'boost',
}

@Schema({ timestamps: true })
export class Transaction extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, unique: true })
  transactionId: string; // Order ID từ payment gateway

  @Prop({ type: String, enum: Object.values(PaymentGateway), required: true })
  gateway: PaymentGateway;

  @Prop({ type: String, enum: Object.values(ProductType), required: true })
  productType: ProductType;

  @Prop({ required: true })
  amount: number; // VND hoặc USD (cents cho Stripe)

  @Prop({ default: 'VND' })
  currency: string;

  @Prop({
    type: String,
    enum: Object.values(TransactionStatus),
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: any; // Raw response từ payment gateway

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop()
  description?: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ userId: 1, status: 1 });
TransactionSchema.index({ transactionId: 1 });
