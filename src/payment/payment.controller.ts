// src/payment/payment.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Query,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { StripeService } from './services/stripe.service';
import { VNPayService } from './services/vnpay.service';
import { PRODUCT_CONFIGS } from './payment.config';

@Controller('payment')
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private stripeService: StripeService,
    private vnpayService: VNPayService,
  ) {}

  // Get available products
  @Get('products')
  getProducts() {
    return {
      products: Object.entries(PRODUCT_CONFIGS).map(([key, value]) => ({
        id: key,
        ...value,
      })),
    };
  }

  // Create payment
  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createPayment(@Req() req: any, @Body() dto: CreatePaymentDto) {
    return this.paymentService.createPayment(req.user.userId, dto);
  }

  // Stripe Webhook
  @Post('stripe-webhook')
  async handleStripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      if (!req.rawBody) {
        throw new BadRequestException('Missing raw body');
      }

      if (!signature) {
        throw new BadRequestException('Missing stripe signature');
      }

      const event = await this.stripeService.constructWebhookEvent(
        req.rawBody,
        signature,
      );

      const result = await this.stripeService.handleWebhook(event);

      if (result && result.status === 'success') {
        await this.paymentService.handleSuccessfulPayment(
          result.transactionId,
          result.metadata,
        );
      }

      return { received: true };
    } catch (error) {
      throw new BadRequestException(`Webhook Error: ${error.message}`);
    }
  }

  // VNPay Return URL
  @Get('vnpay-return')
  async handleVNPayReturn(@Query() query: any) {
    const result = this.vnpayService.verifyReturnUrl(query);

    if (result.isValid && result.transactionId) {
      await this.paymentService.handleSuccessfulPayment(result.transactionId);
      return {
        success: true,
        message: 'Payment successful',
        transactionId: result.transactionId,
      };
    } else {
      return {
        success: false,
        message: 'Payment failed or invalid signature',
      };
    }
  }

  // Get user transactions
  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async getTransactions(@Req() req: any) {
    return this.paymentService.getUserTransactions(req.user.userId);
  }

  // Get active subscription
  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  async getSubscription(@Req() req: any) {
    return this.paymentService.getActiveSubscription(req.user.userId);
  }
}
