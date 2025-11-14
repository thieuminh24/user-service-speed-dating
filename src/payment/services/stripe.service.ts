// src/payment/services/stripe.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Transaction } from '../schemas/transaction.schema';
import { ProductConfig } from '../payment.config';
import { PaymentResponseDto } from '../dto/payment-response.dto';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY is not defined in environment variables',
      );
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-10-29.clover',
    });
  }

  async createPaymentIntent(
    transaction: Transaction,
    productConfig: ProductConfig,
  ): Promise<PaymentResponseDto> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: productConfig.priceUSD, // in cents
      currency: 'usd',
      metadata: {
        transactionId: transaction.transactionId,
        userId: transaction.userId.toString(),
        productType: transaction.productType,
      },
      description: productConfig.name,
    });

    return {
      clientSecret: paymentIntent.client_secret ?? undefined,
      transactionId: transaction.transactionId,
      amount: productConfig.priceUSD,
      currency: 'USD',
    };
  }

  async constructWebhookEvent(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not defined');
    }
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  }

  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          transactionId: paymentIntent.metadata.transactionId,
          status: 'success',
          metadata: paymentIntent,
        };

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        return {
          transactionId: failedIntent.metadata.transactionId,
          status: 'failed',
          metadata: failedIntent,
        };

      default:
        return null;
    }
  }
}
