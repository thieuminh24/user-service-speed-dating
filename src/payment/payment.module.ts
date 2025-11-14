// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeService } from './services/stripe.service';
import { VNPayService } from './services/vnpay.service';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import {
  Subscription,
  SubscriptionSchema,
} from './schemas/subscription.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, StripeService, VNPayService],
  exports: [PaymentService],
})
export class PaymentModule {}
