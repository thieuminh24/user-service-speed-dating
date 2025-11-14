// src/payment/payment.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Transaction,
  TransactionStatus,
  PaymentGateway,
  ProductType,
} from './schemas/transaction.schema';
import {
  Subscription,
  SubscriptionStatus,
} from './schemas/subscription.schema';
import { User, SubscriptionTier } from '../users/schemas/user.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { getProductConfig } from './payment.config';
import { StripeService } from './services/stripe.service';
import { VNPayService } from './services/vnpay.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    @InjectModel(User.name) private userModel: Model<User>,
    private stripeService: StripeService,
    private vnpayService: VNPayService,
  ) {}

  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const productConfig = getProductConfig(dto.productType);
    const transactionId = this.generateTransactionId();

    // Tạo transaction pending
    const transaction = await this.transactionModel.create({
      userId,
      transactionId,
      gateway: dto.gateway,
      productType: dto.productType,
      amount:
        dto.gateway === PaymentGateway.STRIPE
          ? productConfig.priceUSD
          : productConfig.price,
      currency: dto.gateway === PaymentGateway.STRIPE ? 'USD' : 'VND',
      status: TransactionStatus.PENDING,
      description: productConfig.nameVi,
    });

    // Gọi payment gateway tương ứng
    switch (dto.gateway) {
      case PaymentGateway.STRIPE:
        return this.stripeService.createPaymentIntent(
          transaction,
          productConfig,
        );

      case PaymentGateway.VNPAY:
        return this.vnpayService.createPaymentUrl(
          transaction,
          productConfig,
          dto.returnUrl,
        );

      default:
        throw new BadRequestException('Invalid payment gateway');
    }
  }

  async handleSuccessfulPayment(transactionId: string, metadata?: any) {
    const transaction = await this.transactionModel.findOne({ transactionId });
    if (!transaction) throw new NotFoundException('Transaction not found');

    if (transaction.status === TransactionStatus.SUCCESS) {
      return { message: 'Already processed' };
    }

    // Cập nhật transaction
    transaction.status = TransactionStatus.SUCCESS;
    transaction.paidAt = new Date();
    transaction.metadata = metadata;
    await transaction.save();

    // Áp dụng benefits cho user
    await this.applyBenefits(transaction);

    return { message: 'Payment processed successfully' };
  }

  private async applyBenefits(transaction: Transaction) {
    const user = await this.userModel.findById(transaction.userId);
    if (!user) return;

    const productConfig = getProductConfig(transaction.productType);

    switch (transaction.productType) {
      case ProductType.PREMIUM_MONTHLY:
      case ProductType.PREMIUM_YEARLY:
        if (productConfig.duration) {
          await this.upgradeSubscription(
            user,
            SubscriptionTier.PREMIUM,
            productConfig.duration,
            transaction._id,
          );
        }
        break;

      case ProductType.VIP_MONTHLY:
      case ProductType.VIP_YEARLY:
        if (productConfig.duration) {
          await this.upgradeSubscription(
            user,
            SubscriptionTier.VIP,
            productConfig.duration,
            transaction._id,
          );
        }
        break;

      case ProductType.SUPER_LIKE:
        user.superLikesLeft += 5;
        await user.save();
        break;

      case ProductType.BOOST:
        user.boostsLeft += 1;
        await user.save();
        break;
    }
  }

  private async upgradeSubscription(
    user: User,
    tier: SubscriptionTier,
    durationDays: number,
    transactionId: any,
  ) {
    const now = new Date();
    const endDate = new Date(
      now.getTime() + durationDays * 24 * 60 * 60 * 1000,
    );

    // Tạo subscription record
    await this.subscriptionModel.create({
      userId: user._id,
      tier,
      status: SubscriptionStatus.ACTIVE,
      startDate: now,
      endDate,
      transactionId,
    });

    // Cập nhật user
    user.subscriptionTier = tier;
    user.isPremium = true;
    user.premiumUntil = endDate;
    user.dailyLikesLimit = -1; // Unlimited

    // Reset Super Likes cho premium users
    if (tier === SubscriptionTier.PREMIUM) {
      user.superLikesLeft = 5;
      user.superLikesResetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (tier === SubscriptionTier.VIP) {
      user.superLikesLeft = -1; // Unlimited
      user.boostsLeft += 2;
    }

    await user.save();
  }

  private generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  // Get user's transactions
  async getUserTransactions(userId: string) {
    return this.transactionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  // Get active subscription
  async getActiveSubscription(userId: string) {
    return this.subscriptionModel
      .findOne({
        userId,
        status: SubscriptionStatus.ACTIVE,
        endDate: { $gt: new Date() },
      })
      .sort({ endDate: -1 })
      .lean();
  }
}
